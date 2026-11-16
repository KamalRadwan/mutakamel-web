"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SCOPE_UNRESOLVED_ERROR,
  useOrganizationScopeHeaders,
} from "@/hooks/useOrganizationScope";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import type { CrmRecordSourceType } from "@/hooks/useCrmRecordOptions";
import {
  CRM_CUSTOM_FIELDS_PATH,
  type CustomFieldItem,
} from "../custom-field-contract";
import { assertCustomFieldValueWrite, isBlankFieldValue, parseCustomFieldValues,
  type CustomFieldValue } from "../custom-field-values-contract";

const VALUES_PATH = `${CRM_CUSTOM_FIELDS_PATH}/values`;
const READ_CONFIG = { cache: "no-store", maxResponseBytes: 512 * 1024 } as const;
const WRITE_CONFIG = {
  cache: "no-store",
  maxResponseBytes: 100_000,
  nonReplayable: true,
} as const;

export interface ValueWriteResult {
  ok: boolean;
  error: NormalizedApiError | null;
  uncertain?: boolean;
  refreshFailed?: boolean;
  confirmed?: boolean;
}

/**
 * `GET`/`POST /custom-fields/values` — the values half of task 8.19.
 *
 * Definitions and values are separate resources: the definition list says
 * which inputs exist, and this pair supplies and persists what was typed for
 * ONE owner record. Both calls require `branchId`, an owner type and an owner
 * id; there is no "all values" read.
 *
 * The response is a bare array (`CrmCustomFieldValueEntity[]`), not a
 * paginated envelope — verified in custom-fields.service.ts#listValues.
 */
export function useCustomFieldValues(branchId: string | null) {
  const scope = useOrganizationScopeHeaders("BRANCH_REQUIRED", branchId);
  const [values, setValues] = useState<CustomFieldValue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savingFieldId, setSavingFieldId] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const saving = useRef(false);
  // Defect D5. This hook is mounted ONCE and re-pointed at whichever record the
  // user selects, so two loads for two different owners overlap by design. With
  // no epoch and no abort, record A's response could land after record B's and
  // replace what is on screen — and because `save` writes under the ownerId the
  // caller passes, the next Save wrote A's visible values onto B.
  //
  // Three guards, and all three are needed:
  //   1. an AbortController per load, so the stale request is cancelled;
  //   2. a monotonic epoch, because an abort is not instantaneous and a
  //      response already in flight can still resolve;
  //   3. an owner check on the payload itself, because neither of the first two
  //      can prove the body belongs to the record now selected.
  const epochRef = useRef(0);
  const inFlightRef = useRef<AbortController | null>(null);

  // A hook that is unmounted mid-request must not leave one running.
  useEffect(() => () => inFlightRef.current?.abort(), []);

  const load = useCallback(
    async (ownerType: CrmRecordSourceType, ownerId: string) => {
      const epoch = epochRef.current + 1;
      epochRef.current = epoch;
      inFlightRef.current?.abort();
      if (
        !branchId ||
        !isUUIDv7(branchId) ||
        !isUUIDv7(ownerId) ||
        !scope.ready
      ) {
        inFlightRef.current = null;
        setValues([]);
        setHasLoaded(false);
        // D4: with no resolved scope nothing was asked, and the screen says so
        // rather than showing the Gateway's 400.
        setLoadError(isUUIDv7(branchId) && !scope.ready ? SCOPE_UNRESOLVED_ERROR : null);
        return false;
      }
      const controller = new AbortController();
      inFlightRef.current = controller;
      setIsLoading(true);
      setLoadError(null);
      try {
        const params = new URLSearchParams({ branchId, ownerType, ownerId });
        const response = await axiosClient.get<unknown>(
          `${VALUES_PATH}?${params.toString()}`,
          { ...READ_CONFIG, signal: controller.signal, headers: scope.headers },
        );
        // Parsed against the owner that was ASKED for. A row for another record
        // is not a value this screen may show, whatever the request looked like.
        const parsed = parseCustomFieldValues(response.data, ownerType, ownerId);
        if (epoch !== epochRef.current) return false;
        setValues(parsed);
        setHasLoaded(true);
        return true;
      } catch (error) {
        if (isAbortError(error) || epoch !== epochRef.current) return false;
        setValues([]);
        setHasLoaded(false);
        setLoadError(normalizeApiError(error));
        return false;
      } finally {
        if (epoch === epochRef.current) {
          inFlightRef.current = null;
          setIsLoading(false);
        }
      }
    },
    [branchId, scope],
  );

  const save = async (
    field: CustomFieldItem,
    ownerType: CrmRecordSourceType,
    ownerId: string,
    value: unknown,
  ): Promise<ValueWriteResult> => {
    if (!branchId || !isUUIDv7(branchId) || !isUUIDv7(ownerId)) {
      return { ok: false, error: { status: 0, code: "OWNER_REQUIRED" } };
    }
    if (!scope.ready) return { ok: false, error: SCOPE_UNRESOLVED_ERROR };
    if (saving.current) return { ok: false, error: null };
    saving.current = true;
    setIsSaving(true);
    setSavingFieldId(field.id);
    try {
      const response = await axiosClient.post<unknown>(
        VALUES_PATH,
        {
          branchId,
          fieldDefinitionId: field.id,
          ownerType,
          ownerId,
          value: isBlankFieldValue(value) ? null : value,
        },
        { ...WRITE_CONFIG, skipAutoIdempotency: true, headers: scope.headers },
      );
      assertCustomFieldValueWrite(response.data, field.id, ownerType, ownerId, isBlankFieldValue(value));
      if (!(await load(ownerType, ownerId))) return { ok: false, error: null, confirmed: true, refreshFailed: true };
      return { ok: true, error: null };
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (normalized.status === 0 || normalized.status >= 500) {
        const refreshed = await load(ownerType, ownerId);
        return { ok: false, error: normalized, uncertain: true, refreshFailed: !refreshed };
      }
      return { ok: false, error: normalized };
    } finally {
      saving.current = false;
      setIsSaving(false);
      setSavingFieldId(null);
    }
  };

  return {
    values,
    hasLoaded,
    isLoading,
    isSaving,
    savingFieldId,
    loadError,
    load,
    save,
    reset: () => {
      // A reset is a new epoch too: a load already in flight must not repopulate
      // the panel after the user cleared it.
      epochRef.current += 1;
      inFlightRef.current?.abort();
      inFlightRef.current = null;
      setValues([]);
      setHasLoaded(false);
      setLoadError(null);
      // The aborted load's `finally` sees a stale epoch and leaves the flag
      // alone — deliberately, so a superseded request cannot clear a newer
      // one's spinner. Nothing follows a reset, so it clears its own.
      setIsLoading(false);
    },
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

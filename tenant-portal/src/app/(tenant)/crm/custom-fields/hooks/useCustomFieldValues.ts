"use client";

import { useCallback, useState } from "react";
import { useOrganizationScopeHeaders } from "@/hooks/useOrganizationScope";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import type { CrmRecordSourceType } from "@/hooks/useCrmRecordOptions";
import {
  CRM_CUSTOM_FIELDS_PATH,
  type CustomFieldItem,
} from "../custom-field-contract";

const VALUES_PATH = `${CRM_CUSTOM_FIELDS_PATH}/values`;
const READ_CONFIG = { cache: "no-store", maxResponseBytes: 512 * 1024 } as const;
const WRITE_CONFIG = {
  cache: "no-store",
  maxResponseBytes: 100_000,
  nonReplayable: true,
} as const;

export interface CustomFieldValue {
  fieldDefinitionId: string;
  ownerType: string;
  ownerId: string;
  value: unknown;
}

export interface ValueWriteResult {
  ok: boolean;
  error: NormalizedApiError | null;
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
  const scopeHeaders = useOrganizationScopeHeaders("BRANCH_REQUIRED", branchId);
  const [values, setValues] = useState<CustomFieldValue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const load = useCallback(
    async (ownerType: CrmRecordSourceType, ownerId: string) => {
      if (!branchId || !isUUIDv7(branchId) || !isUUIDv7(ownerId)) {
        setValues([]);
        setHasLoaded(false);
        return;
      }
      setIsLoading(true);
      setLoadError(null);
      try {
        const params = new URLSearchParams({ branchId, ownerType, ownerId });
        const response = await axiosClient.get<unknown>(
          `${VALUES_PATH}?${params.toString()}`,
          { ...READ_CONFIG, headers: scopeHeaders },
        );
        setValues(parseValues(response.data));
        setHasLoaded(true);
      } catch (error) {
        setValues([]);
        setHasLoaded(false);
        setLoadError(normalizeApiError(error));
      } finally {
        setIsLoading(false);
      }
    },
    [branchId, scopeHeaders],
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
    setIsSaving(true);
    try {
      await axiosClient.post<unknown>(
        VALUES_PATH,
        {
          branchId,
          fieldDefinitionId: field.id,
          ownerType,
          ownerId,
          value,
        },
        { ...WRITE_CONFIG, headers: scopeHeaders },
      );
      await load(ownerType, ownerId);
      return { ok: true, error: null };
    } catch (error) {
      return { ok: false, error: normalizeApiError(error) };
    } finally {
      setIsSaving(false);
    }
  };

  return {
    values,
    hasLoaded,
    isLoading,
    isSaving,
    loadError,
    load,
    save,
    reset: () => {
      setValues([]);
      setHasLoaded(false);
      setLoadError(null);
    },
  };
}

function parseValues(payload: unknown): CustomFieldValue[] {
  if (!Array.isArray(payload) || payload.length > 500) {
    throw new Error("Invalid CRM custom-field values response.");
  }
  return payload.map((entry) => {
    const value = record(entry);
    if (
      !value ||
      !isUUIDv7(value.fieldDefinitionId) ||
      typeof value.ownerType !== "string" ||
      !isUUIDv7(value.ownerId)
    ) {
      throw new Error("Invalid CRM custom-field values response.");
    }
    return {
      fieldDefinitionId: value.fieldDefinitionId,
      ownerType: value.ownerType,
      ownerId: value.ownerId,
      // `value` is `unknown` in the entity and its shape follows the field
      // type. It is rendered through the definition, never guessed at here.
      value: value.value,
    };
  });
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

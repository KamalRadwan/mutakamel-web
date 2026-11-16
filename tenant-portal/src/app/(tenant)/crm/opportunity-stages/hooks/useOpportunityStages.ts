"use client";

import { useMemo, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useAccessMode } from "@/hooks/useAccessMode";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isIdempotentReplay } from "@/lib/api/outcomes";
import {
  OPPORTUNITY_STAGES_PATH,
  parseOpportunityStageDefinitionResponse,
  type OpportunityStageDefinition,
} from "../../pipelines/pipeline-contract";
import { useOpportunityStageCatalogue } from "../../shared/hooks/useOpportunityStageCatalogue";
import {
  buildCreateOpportunityStageRequest,
  buildUpdateOpportunityStageRequest,
  opportunityStagePath,
  type OpportunityStageFormInput,
} from "../opportunity-stage-contract";

const WRITE_CONFIG = {
  cache: "no-store",
  maxResponseBytes: 256 * 1024,
  nonReplayable: true,
} as const;

export interface StageWriteResult {
  ok: boolean;
  replayed: boolean;
  error: NormalizedApiError | null;
}

/**
 * The reusable stage catalogue.
 *
 * **All five routes require `crm.pipelines.manage`, not `crm.pipelines.read`.**
 * Verified on every handler in
 * crm-app/src/crm/pipelines/opportunity-stages.controller.ts. Read admission
 * remains separate from the tenant policy that may prohibit mutations.
 */
export function useOpportunityStages() {
  const { t, lang } = useI18n();
  const { user } = useTenantAuth();
  const { canMutate } = useAccessMode();
  const canRead = user?.permissions.includes("crm.pipelines.manage") ?? false;
  const [writeDenied, setWriteDenied] = useState(false);
  const writeDeniedRef = useRef(false);
  const canManage = canRead && canMutate && !writeDenied;
  const { items, setItems, hasLoaded, isLoading, queryError, reload: load } =
    useOpportunityStageCatalogue(canRead);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const writeInFlight = useRef(false);
  const writeError = (error: unknown): StageWriteResult => {
    const normalized = normalizeApiError(error);
    if (normalized.status === 403) {
      writeDeniedRef.current = true;
      setWriteDenied(true);
    }
    return { ok: false, replayed: false, error: normalized };
  };

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return items;
    return items.filter(({ nameAr, nameEn, flag }) =>
      [nameAr, nameEn, flag].some((value) =>
        value.toLocaleLowerCase().includes(query),
      ),
    );
  }, [items, searchQuery]);

  const create = async (
    input: OpportunityStageFormInput,
  ): Promise<StageWriteResult> => {
    if (!canManage || writeDeniedRef.current) return forbidden();
    if (writeInFlight.current) return { ok: false, replayed: false, error: null };
    let body: Record<string, unknown>;
    try {
      body = buildCreateOpportunityStageRequest(input);
    } catch (error) {
      return { ok: false, replayed: false, error: localError(error) };
    }
    writeInFlight.current = true;
    setIsSubmitting(true);
    try {
      const response = await axiosClient.post<unknown>(
        OPPORTUNITY_STAGES_PATH,
        body,
        WRITE_CONFIG,
      );
      const created = parseOpportunityStageDefinitionResponse(response.data);
      setItems((current) => [
        ...current.filter(({ id }) => id !== created.id),
        created,
      ]);
      await load();
      return { ok: true, replayed: isIdempotentReplay(response.headers), error: null };
    } catch (error) {
      return writeError(error);
    } finally {
      writeInFlight.current = false;
      setIsSubmitting(false);
    }
  };

  const update = async (
    stage: OpportunityStageDefinition,
    input: OpportunityStageFormInput,
  ): Promise<StageWriteResult> => {
    if (!canManage || writeDeniedRef.current) return forbidden();
    if (writeInFlight.current) return { ok: false, replayed: false, error: null };
    let body: Record<string, unknown>;
    try {
      body = buildUpdateOpportunityStageRequest(input, stage);
    } catch (error) {
      return { ok: false, replayed: false, error: localError(error) };
    }
    writeInFlight.current = true;
    setIsSubmitting(true);
    try {
      const response = await axiosClient.patch<unknown>(
        opportunityStagePath(stage.id),
        body,
        WRITE_CONFIG,
      );
      const updated = parseOpportunityStageDefinitionResponse(response.data);
      setItems((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
      return { ok: true, replayed: isIdempotentReplay(response.headers), error: null };
    } catch (error) {
      return writeError(error);
    } finally {
      writeInFlight.current = false;
      setIsSubmitting(false);
    }
  };

  const remove = async (id: string): Promise<StageWriteResult> => {
    if (!canManage || writeDeniedRef.current) return forbidden();
    if (writeInFlight.current) return { ok: false, replayed: false, error: null };
    writeInFlight.current = true;
    setPendingId(id);
    try {
      // 204 No Content.
      const response = await axiosClient.delete<unknown>(
        opportunityStagePath(id),
        WRITE_CONFIG,
      );
      setItems((current) => current.filter((entry) => entry.id !== id));
      return { ok: true, replayed: isIdempotentReplay(response.headers), error: null };
    } catch (error) {
      const result = writeError(error);
      await load();
      return result;
    } finally {
      writeInFlight.current = false;
      setPendingId(null);
    }
  };

  return {
    t,
    lang,
    items: filteredItems,
    total: items.length,
    hasLoaded,
    isLoading,
    isSubmitting,
    pendingId,
    queryError,
    canManage,
    canRead,
    readOnly: canRead && (!canMutate || writeDenied),
    searchQuery,
    setSearchQuery,
    create,
    update,
    remove,
    reload: () => load(),
  };
}

function forbidden(): StageWriteResult {
  return {
    ok: false,
    replayed: false,
    error: { status: 403, code: "FORBIDDEN" },
  };
}

function localError(error: unknown): NormalizedApiError {
  return {
    status: 0,
    code: error instanceof Error ? error.message : "INVALID_INPUT",
  };
}

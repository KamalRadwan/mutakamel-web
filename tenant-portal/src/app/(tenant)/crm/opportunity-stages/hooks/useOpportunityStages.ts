"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isIdempotentReplay } from "@/lib/api/outcomes";
import {
  OPPORTUNITY_STAGES_PATH,
  parseOpportunityStageDefinitionsResponse,
  parseOpportunityStageDefinitionResponse,
  type OpportunityStageDefinition,
} from "../../pipelines/pipeline-contract";
import {
  buildCreateOpportunityStageRequest,
  buildUpdateOpportunityStageRequest,
  opportunityStagePath,
  type OpportunityStageFormInput,
} from "../opportunity-stage-contract";

const READ_CONFIG = { cache: "no-store", maxResponseBytes: 512 * 1024 } as const;
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
 * crm-app/src/crm/pipelines/opportunity-stages.controller.ts — the read
 * permission in docs/api/crm-opportunities.md's table is wrong for this
 * family, so gating the route on `read` would show an actor a screen whose
 * every request 403s.
 */
export function useOpportunityStages() {
  const { t, lang } = useI18n();
  const { user } = useTenantAuth();
  const canManage = user?.permissions.includes("crm.pipelines.manage") ?? false;
  const [items, setItems] = useState<OpportunityStageDefinition[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal): Promise<boolean> => {
    setIsLoading(true);
    setQueryError(null);
    try {
      const response = await axiosClient.get<unknown>(OPPORTUNITY_STAGES_PATH, {
        ...READ_CONFIG,
        signal,
      });
      setItems(parseOpportunityStageDefinitionsResponse(response.data));
      setHasLoaded(true);
      return true;
    } catch (error) {
      if (isAbortError(error)) return false;
      setQueryError(normalizeApiError(error));
      return false;
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

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
    if (!canManage) return forbidden();
    let body: Record<string, unknown>;
    try {
      body = buildCreateOpportunityStageRequest(input);
    } catch (error) {
      return { ok: false, replayed: false, error: localError(error) };
    }
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
      return { ok: false, replayed: false, error: normalizeApiError(error) };
    } finally {
      setIsSubmitting(false);
    }
  };

  const update = async (
    stage: OpportunityStageDefinition,
    input: OpportunityStageFormInput,
  ): Promise<StageWriteResult> => {
    if (!canManage) return forbidden();
    let body: Record<string, unknown>;
    try {
      body = buildUpdateOpportunityStageRequest(input, stage);
    } catch (error) {
      return { ok: false, replayed: false, error: localError(error) };
    }
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
      return { ok: false, replayed: false, error: normalizeApiError(error) };
    } finally {
      setIsSubmitting(false);
    }
  };

  const remove = async (id: string): Promise<StageWriteResult> => {
    if (!canManage) return forbidden();
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
      await load();
      return { ok: false, replayed: false, error: normalizeApiError(error) };
    } finally {
      setPendingId(null);
    }
  };

  return {
    t,
    lang,
    items: filteredItems,
    hasLoaded,
    isLoading,
    isSubmitting,
    pendingId,
    queryError,
    canManage,
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

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

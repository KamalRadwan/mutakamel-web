"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isIdempotentReplay } from "@/lib/api/outcomes";
import {
  parseOpportunityStageDefinitionResponse,
  type OpportunityStageDefinition,
} from "../../pipelines/pipeline-contract";
import {
  buildUpdateOpportunityStageRequest,
  opportunityStagePath,
  type OpportunityStageFormInput,
} from "../opportunity-stage-contract";
import type { StageWriteResult } from "./useOpportunityStages";

const READ_CONFIG = { cache: "no-store", maxResponseBytes: 128 * 1024 } as const;
const WRITE_CONFIG = {
  cache: "no-store",
  maxResponseBytes: 128 * 1024,
  nonReplayable: true,
} as const;

/** `GET`/`PATCH`/`DELETE /opportunity-stages/:id` for one definition. */
export function useOpportunityStageDetail(stageId: string) {
  const { t, lang } = useI18n();
  const { user } = useTenantAuth();
  const canManage = user?.permissions.includes("crm.pipelines.manage") ?? false;
  const [stage, setStage] = useState<OpportunityStageDefinition | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true);
      setQueryError(null);
      try {
        const response = await axiosClient.get<unknown>(
          opportunityStagePath(stageId),
          { ...READ_CONFIG, signal },
        );
        setStage(parseOpportunityStageDefinitionResponse(response.data));
      } catch (error) {
        if (isAbortError(error)) return;
        setStage(null);
        setQueryError(normalizeApiError(error));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [stageId],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const save = async (
    input: OpportunityStageFormInput,
  ): Promise<StageWriteResult> => {
    if (!canManage || !stage) {
      return {
        ok: false,
        replayed: false,
        error: { status: 403, code: "FORBIDDEN" },
      };
    }
    let body: Record<string, unknown>;
    try {
      body = buildUpdateOpportunityStageRequest(input, stage);
    } catch (error) {
      return {
        ok: false,
        replayed: false,
        error: {
          status: 0,
          code: error instanceof Error ? error.message : "INVALID_INPUT",
        },
      };
    }
    setIsSubmitting(true);
    try {
      const response = await axiosClient.patch<unknown>(
        opportunityStagePath(stage.id),
        body,
        WRITE_CONFIG,
      );
      setStage(parseOpportunityStageDefinitionResponse(response.data));
      return {
        ok: true,
        replayed: isIdempotentReplay(response.headers),
        error: null,
      };
    } catch (error) {
      return { ok: false, replayed: false, error: normalizeApiError(error) };
    } finally {
      setIsSubmitting(false);
    }
  };

  const remove = async (): Promise<StageWriteResult> => {
    if (!canManage || !stage) {
      return {
        ok: false,
        replayed: false,
        error: { status: 403, code: "FORBIDDEN" },
      };
    }
    setIsSubmitting(true);
    try {
      const response = await axiosClient.delete<unknown>(
        opportunityStagePath(stage.id),
        WRITE_CONFIG,
      );
      return {
        ok: true,
        replayed: isIdempotentReplay(response.headers),
        error: null,
      };
    } catch (error) {
      await load();
      return { ok: false, replayed: false, error: normalizeApiError(error) };
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    t,
    lang,
    stage,
    isLoading,
    isSubmitting,
    queryError,
    notFound: queryError?.status === 404,
    canManage,
    save,
    remove,
    reload: () => load(),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

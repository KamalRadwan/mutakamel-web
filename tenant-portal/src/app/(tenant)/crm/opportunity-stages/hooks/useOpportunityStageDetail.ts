"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useAccessMode } from "@/hooks/useAccessMode";
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
  const { canMutate } = useAccessMode();
  const canRead = user?.permissions.includes("crm.pipelines.manage") ?? false;
  const [writeDenied, setWriteDenied] = useState(false);
  const writeDeniedRef = useRef(false);
  const canManage = canRead && canMutate && !writeDenied;
  const [stage, setStage] = useState<OpportunityStageDefinition | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const writeInFlight = useRef(false);
  const writeError = (error: unknown): StageWriteResult => {
    const normalized = normalizeApiError(error);
    if (normalized.status === 403) {
      writeDeniedRef.current = true;
      setWriteDenied(true);
    }
    return { ok: false, replayed: false, error: normalized };
  };

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true);
      setQueryError(null);
      try {
        const response = await axiosClient.get<unknown>(
          opportunityStagePath(stageId),
          { ...READ_CONFIG, signal },
        );
        if (signal?.aborted) return false;
        setStage(parseOpportunityStageDefinitionResponse(response.data));
        return true;
      } catch (error) {
        if (signal?.aborted || isAbortError(error)) return false;
        const normalized = normalizeApiError(error);
        setStage((current) => normalized.status !== 403 && normalized.status !== 404 && current?.id === stageId ? current : null);
        setQueryError(normalized);
        return false;
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [stageId],
  );

  useEffect(() => {
    if (!canRead) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load, canRead]);

  const save = async (
    input: OpportunityStageFormInput,
  ): Promise<StageWriteResult> => {
    if (writeInFlight.current) return { ok: false, replayed: false, error: null };
    if (!canManage || writeDeniedRef.current || !stage) {
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
    writeInFlight.current = true;
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
      return writeError(error);
    } finally {
      writeInFlight.current = false;
      setIsSubmitting(false);
    }
  };

  const remove = async (): Promise<StageWriteResult> => {
    if (writeInFlight.current) return { ok: false, replayed: false, error: null };
    if (!canManage || writeDeniedRef.current || !stage) {
      return {
        ok: false,
        replayed: false,
        error: { status: 403, code: "FORBIDDEN" },
      };
    }
    writeInFlight.current = true;
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
      const result = writeError(error);
      await load();
      return result;
    } finally {
      writeInFlight.current = false;
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
    canRead,
    readOnly: canRead && (!canMutate || writeDenied),
    save,
    remove,
    reload: () => load(),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

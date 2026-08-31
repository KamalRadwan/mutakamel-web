"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isIdempotentReplay } from "@/lib/api/outcomes";
import {
  OPPORTUNITY_STAGES_PATH,
  buildUpdatePipelineRequest,
  moveStageOrder,
  parseOpportunityStageDefinitionsResponse,
  parsePipelineResponse,
  pipelinePath,
  pipelineResetPath,
  pipelineStagePath,
  pipelineStagesPath,
  pipelineStagesReorderPath,
  type OpportunityStageDefinition,
  type Pipeline,
  type UpdatePipelineInput,
} from "../pipeline-contract";
import type { PipelineWriteResult } from "./usePipelines";

const READ_CONFIG = { cache: "no-store", maxResponseBytes: 512 * 1024 } as const;
const WRITE_CONFIG = {
  cache: "no-store",
  maxResponseBytes: 256 * 1024,
  nonReplayable: true,
} as const;

const OK: PipelineWriteResult = { ok: true, replayed: false, error: null };

export function usePipelineDetail(pipelineId: string) {
  const { t, lang } = useI18n();
  const { user } = useTenantAuth();
  const canManage = user?.permissions.includes("crm.pipelines.manage") ?? false;
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [catalogue, setCatalogue] = useState<OpportunityStageDefinition[]>([]);
  // The catalogue is a SECOND source on this screen. Its failure degrades the
  // attach control only; the pipeline itself still renders — states.md's
  // partial-failure rule.
  const [catalogueError, setCatalogueError] =
    useState<NormalizedApiError | null>(null);
  const [pendingStageId, setPendingStageId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<boolean> => {
      setIsLoading(true);
      setQueryError(null);
      try {
        const response = await axiosClient.get<unknown>(
          pipelinePath(pipelineId),
          { ...READ_CONFIG, signal },
        );
        setPipeline(parsePipelineResponse(response.data));
        return true;
      } catch (error) {
        if (isAbortError(error)) return false;
        setPipeline(null);
        setQueryError(normalizeApiError(error));
        return false;
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [pipelineId],
  );

  const loadCatalogue = useCallback(async (signal?: AbortSignal) => {
    setCatalogueError(null);
    try {
      const response = await axiosClient.get<unknown>(OPPORTUNITY_STAGES_PATH, {
        ...READ_CONFIG,
        signal,
      });
      setCatalogue(parseOpportunityStageDefinitionsResponse(response.data));
    } catch (error) {
      if (isAbortError(error)) return;
      setCatalogue([]);
      setCatalogueError(normalizeApiError(error));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      // Independent, not Promise.all: a catalogue failure must not blank the
      // pipeline, and a pipeline 404 must not hide the catalogue error.
      void load(controller.signal);
      if (canManage) void loadCatalogue(controller.signal);
    });
    return () => controller.abort();
  }, [canManage, load, loadCatalogue]);

  const save = async (
    input: UpdatePipelineInput,
  ): Promise<PipelineWriteResult> => {
    if (!canManage) return forbidden();
    let body: Record<string, unknown>;
    try {
      body = buildUpdatePipelineRequest(input);
    } catch (error) {
      return { ok: false, replayed: false, error: localError(error) };
    }
    setIsSaving(true);
    try {
      const response = await axiosClient.patch<unknown>(
        pipelinePath(pipelineId),
        body,
        WRITE_CONFIG,
      );
      setPipeline(parsePipelineResponse(response.data));
      return { ...OK, replayed: isIdempotentReplay(response.headers) };
    } catch (error) {
      return { ok: false, replayed: false, error: normalizeApiError(error) };
    } finally {
      setIsSaving(false);
    }
  };

  /** `POST /:id/reset` — restores the canonical stage set. Destructive. */
  const reset = async (): Promise<PipelineWriteResult> => {
    if (!canManage) return forbidden();
    setIsSaving(true);
    try {
      const response = await axiosClient.post<unknown>(
        pipelineResetPath(pipelineId),
        undefined,
        WRITE_CONFIG,
      );
      setPipeline(parsePipelineResponse(response.data));
      return { ...OK, replayed: isIdempotentReplay(response.headers) };
    } catch (error) {
      await load();
      return { ok: false, replayed: false, error: normalizeApiError(error) };
    } finally {
      setIsSaving(false);
    }
  };

  /** `POST /:id/stages` — attaches a catalogue stage at the final rank. */
  const attachStage = async (
    opportunityStageId: string,
  ): Promise<PipelineWriteResult> => {
    if (!canManage) return forbidden();
    setPendingStageId(opportunityStageId);
    try {
      const response = await axiosClient.post<unknown>(
        pipelineStagesPath(pipelineId),
        { opportunityStageId },
        WRITE_CONFIG,
      );
      // 201 returns the membership row, not the pipeline — reload for the
      // recomputed ranks rather than splicing a shape this screen never
      // renders on its own.
      await load();
      return { ...OK, replayed: isIdempotentReplay(response.headers) };
    } catch (error) {
      return { ok: false, replayed: false, error: normalizeApiError(error) };
    } finally {
      setPendingStageId(null);
    }
  };

  /** `DELETE /:id/stages/:pipelineStageId` — 204. */
  const detachStage = async (
    pipelineStageId: string,
  ): Promise<PipelineWriteResult> => {
    if (!canManage) return forbidden();
    setPendingStageId(pipelineStageId);
    try {
      const response = await axiosClient.delete<unknown>(
        pipelineStagePath(pipelineId, pipelineStageId),
        WRITE_CONFIG,
      );
      await load();
      return { ...OK, replayed: isIdempotentReplay(response.headers) };
    } catch (error) {
      await load();
      return { ok: false, replayed: false, error: normalizeApiError(error) };
    } finally {
      setPendingStageId(null);
    }
  };

  /**
   * `PATCH /:id/stages/reorder` — the body is the COMPLETE ordered id list
   * (`ReorderPipelineStagesDto.orderedIds`), never a single position delta.
   * Verified in pipelines.controller.ts; a per-stage rank PATCH does not exist
   * and would race.
   */
  const moveStage = async (
    pipelineStageId: string,
    direction: -1 | 1,
  ): Promise<PipelineWriteResult | null> => {
    if (!canManage) return forbidden();
    const current = pipeline;
    if (!current) return null;
    const orderedIds = moveStageOrder(
      current.stages,
      pipelineStageId,
      direction,
    );
    if (!orderedIds) return null;
    setPendingStageId(pipelineStageId);
    // Optimistic: re-rank locally so the row visibly moves before the round
    // trip, and restore the server's answer either way.
    setPipeline({
      ...current,
      stages: orderedIds.map((id, index) => {
        const stage = current.stages.find((entry) => entry.id === id);
        return { ...(stage as (typeof current.stages)[number]), rank: index + 1 };
      }),
    });
    try {
      const response = await axiosClient.patch<unknown>(
        pipelineStagesReorderPath(pipelineId),
        { orderedIds },
        WRITE_CONFIG,
      );
      await load();
      return { ...OK, replayed: isIdempotentReplay(response.headers) };
    } catch (error) {
      setPipeline(current);
      return { ok: false, replayed: false, error: normalizeApiError(error) };
    } finally {
      setPendingStageId(null);
    }
  };

  const attachedStageIds = new Set(
    (pipeline?.stages ?? []).map((stage) => stage.opportunityStageId),
  );

  return {
    t,
    lang,
    pipeline,
    isLoading,
    isSaving,
    pendingStageId,
    queryError,
    notFound: queryError?.status === 404,
    catalogueError,
    canManage,
    // Only active, not-yet-attached definitions can be attached; the service
    // rejects the rest with PIPELINE_STAGE_ALREADY_ASSIGNED or an inactive
    // stage error.
    attachableStages: catalogue.filter(
      (stage) => stage.isActive && !attachedStageIds.has(stage.id),
    ),
    save,
    reset,
    attachStage,
    detachStage,
    moveStage,
    reload: () => load(),
    reloadCatalogue: () => loadCatalogue(),
  };
}

function forbidden(): PipelineWriteResult {
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

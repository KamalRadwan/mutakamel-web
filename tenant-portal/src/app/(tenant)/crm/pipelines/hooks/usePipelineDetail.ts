"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { parsePipelineResponse, pipelineConfigurationPath, pipelinePath, type Pipeline } from "../pipeline-contract";
import { useOpportunityStageCatalogue } from "../../shared/hooks/useOpportunityStageCatalogue";
import { usePipelineSafety, type PipelineWriteTicket } from "./usePipelineSafety";
import { usePipelineDetailWrites, type PipelineSnapshot } from "./usePipelineDetailWrites";
import { PIPELINE_READ_CONFIG, assertReceiptStatus, assertPipelineConfiguration } from "./pipeline-write-support";

export function usePipelineDetail(pipelineId: string) {
  const { t, lang } = useI18n();
  const { user } = useTenantAuth();
  const canManage = user?.permissions.includes("crm.pipelines.manage") ?? false;
  const safety = usePipelineSafety(`pipeline:${pipelineId}`);
  const { scope, startRead, currentRead, reconciled } = safety;
  const [snapshot, setSnapshot] = useState<PipelineSnapshot | null>(null);
  const confirmed = useRef<PipelineSnapshot | null>(null);
  const readFailed = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const catalogue = useOpportunityStageCatalogue(canManage);
  const accept = (value: Pipeline) => { confirmed.current = { scope, value }; setSnapshot(confirmed.current); };
  const load = useCallback(async (signal?: AbortSignal, write?: PipelineWriteTicket): Promise<boolean> => {
    const ticket = startRead(write);
    if (!ticket) return false;
    setIsLoading(true);
    setQueryError(null);
    try {
      const response = await axiosClient.get<unknown>(canManage ? pipelineConfigurationPath(pipelineId) : pipelinePath(pipelineId), { ...PIPELINE_READ_CONFIG, signal });
      if (signal?.aborted || !currentRead(ticket)) return false;
      assertReceiptStatus(response, 200);
      const value = parsePipelineResponse(response.data);
      if (value.id !== pipelineId) throw new Error("Pipeline read belongs to another configuration.");
      if (canManage) assertPipelineConfiguration(value);
      confirmed.current = { scope, value };
      readFailed.current = false;
      setSnapshot(confirmed.current);
      if (canManage) reconciled(ticket);
      return true;
    } catch (caught) {
      if (signal?.aborted || !currentRead(ticket)) return false;
      const error = normalizeApiError(caught);
      readFailed.current = true;
      if (error.status === 403 || error.status === 404) { confirmed.current = null; setSnapshot(null); }
      setQueryError(error);
      return false;
    } finally { if (!signal?.aborted && currentRead(ticket)) setIsLoading(false); }
  }, [scope, pipelineId, canManage, startRead, currentRead, reconciled]);
  useEffect(() => {
    if (safety.busy) return;
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) void load(controller.signal); });
    return () => controller.abort();
  }, [load, safety.busy]);
  const writes = usePipelineDetailWrites({ pipelineId, canManage, safety, confirmed, readFailed, load, accept });
  const pipeline = snapshot?.scope === scope ? snapshot.value : null;
  const attached = new Set(pipeline?.stages.map((stage) => stage.opportunityStageId));
  return {
    t, lang, pipeline, isLoading, queryError, canManage,
    notFound: queryError?.status === 404,
    catalogueError: catalogue.queryError,
    attachableStages: (catalogue.queryError ? [] : catalogue.items).filter((stage) => stage.isActive && !attached.has(stage.id)),
    ...writes,
    needsReconciliation: safety.needsReconciliation,
    requiresCatalogue: safety.requiresCatalogue,
    writeBlocked: safety.busy || safety.needsReconciliation,
    isPending: safety.isPending,
    reload: () => load(), reloadCatalogue: () => catalogue.reload(),
  };
}

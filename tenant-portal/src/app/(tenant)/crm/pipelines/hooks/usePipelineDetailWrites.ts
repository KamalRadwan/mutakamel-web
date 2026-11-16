"use client";

import { useState, type RefObject } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { isIdempotentReplay } from "@/lib/api/outcomes";
import { buildUpdatePipelineRequest, moveStageOrder, pipelinePath, pipelineResetPath, pipelineStagePath,
  pipelineStagesPath, pipelineStagesReorderPath, type Pipeline, type UpdatePipelineInput } from "../pipeline-contract";
import { parsePipelineStage, parsePipelineStages } from "../pipeline-response";
import type { usePipelineSafety, PipelineWriteTicket } from "./usePipelineSafety";
import { PIPELINE_WRITE_CONFIG, assertReceiptStatus, localPipelineError, pipelineReceipt,
  pipelineWriteError, refusedPipelineWrite, type PipelineWriteResult } from "./pipeline-write-support";

export interface PipelineSnapshot { scope: string; value: Pipeline; }
interface DetailWriteOptions {
  pipelineId: string;
  canManage: boolean;
  safety: ReturnType<typeof usePipelineSafety>;
  confirmed: RefObject<PipelineSnapshot | null>;
  readFailed: RefObject<boolean>;
  load: (signal?: AbortSignal, write?: PipelineWriteTicket) => Promise<boolean>;
  accept: (value: Pipeline) => void;
}

export function usePipelineDetailWrites({ pipelineId, canManage, safety, confirmed, readFailed, load, accept }: DetailWriteOptions) {
  const [isSaving, setIsSaving] = useState(false);
  const [pendingStageId, setPendingStageId] = useState<string | null>(null);
  const [pendingScope, setPendingScope] = useState<string>();
  const execute = async (kind: "save" | "reset" | "attach" | "detach" | "order", body?: Record<string, unknown>, stageId?: string): Promise<PipelineWriteResult> => {
    const current = confirmed.current?.scope === safety.scope ? confirmed.current.value : null;
    const allowed = canManage && !!current && !readFailed.current
      && (kind !== "save" || !current.isDefault || body?.isActive !== false)
      && (kind !== "reset" || current.isDefault)
      && (kind !== "detach" || current.stages.some((stage) => stage.id === stageId && !["NEW", "WON", "LOST"].includes(stage.flag)));
    const write = safety.beginWrite(allowed);
    if (!write) return refusedPipelineWrite(canManage ? undefined : "FORBIDDEN");
    setPendingScope(safety.scope);
    if (kind === "save" || kind === "reset") setIsSaving(true);
    else setPendingStageId(stageId ?? "order");
    try {
      const response = kind === "save" ? await axiosClient.patch<unknown>(pipelinePath(pipelineId), body, PIPELINE_WRITE_CONFIG)
        : kind === "reset" ? await axiosClient.post<unknown>(pipelineResetPath(pipelineId), undefined, PIPELINE_WRITE_CONFIG)
          : kind === "attach" ? await axiosClient.post<unknown>(pipelineStagesPath(pipelineId), body, PIPELINE_WRITE_CONFIG)
            : kind === "detach" ? await axiosClient.delete<unknown>(pipelineStagePath(pipelineId, stageId!), PIPELINE_WRITE_CONFIG)
              : await axiosClient.patch<unknown>(pipelineStagesReorderPath(pipelineId), body, PIPELINE_WRITE_CONFIG);
      if (!safety.currentWrite(write)) throw new Error("Pipeline write scope changed.");
      if (kind === "save" || kind === "reset") {
        const receipt = pipelineReceipt(response, 200, pipelineId);
        if (receipt.code !== current!.code) throw new Error("Pipeline receipt code changed.");
        if (kind === "save" && Object.entries(body!).some(([key, value]) => receipt[key as keyof Pipeline] !== value)) throw new Error("Pipeline save receipt does not match its request.");
        if (kind === "reset" && (!receipt.isDefault || !receipt.isActive || receipt.accessMode !== "ALL")) throw new Error("Invalid pipeline reset receipt.");
        if (kind === "reset" && (receipt.stages.map((stage) => stage.flag).join(",") !== "NEW,QUALIFICATION,PROPOSAL,NEGOTIATION,WON,LOST"
          || receipt.stages.some((stage, index) => stage.rank !== index + 1))) throw new Error("Invalid canonical reset stages.");
        accept(receipt);
      } else if (kind === "attach") {
        assertReceiptStatus(response, 201);
        const receipt = parsePipelineStage(response.data, pipelineId);
        if (receipt.opportunityStageId !== stageId || current!.stages.some((stage) => stage.id === receipt.id)) throw new Error("Invalid attached membership receipt.");
      } else if (kind === "detach") assertReceiptStatus(response, 204);
      else {
        assertReceiptStatus(response, 200);
        const receipt = parsePipelineStages(response.data, pipelineId);
        const orderedIds = body!.orderedIds as string[];
        if (receipt.length !== orderedIds.length || receipt.some((stage, index) => stage.id !== orderedIds[index] || stage.rank !== index + 1)) throw new Error("Invalid stage order receipt.");
      }
      safety.fence(write);
      const reconciled = await load(undefined, write);
      return { ok: true, replayed: isIdempotentReplay(response.headers), error: null, reconciled };
    } catch (caught) {
      const result = pipelineWriteError(caught);
      if (result.uncertain) {
        safety.fence(write);
        result.reconciled = await load(undefined, write);
      }
      return { ...result, stale: !safety.currentWrite(write) };
    } finally {
      const active = safety.currentWrite(write);
      safety.finish(write);
      if (active) { setIsSaving(false); setPendingStageId(null); }
    }
  };
  return {
    isSaving: isSaving && pendingScope === safety.scope,
    pendingStageId: pendingScope === safety.scope ? pendingStageId : null,
    save: (input: UpdatePipelineInput) => {
      try { return execute("save", buildUpdatePipelineRequest(input)); }
      catch (caught) { return Promise.resolve(localPipelineError(caught)); }
    },
    reset: () => execute("reset"),
    attachStage: (id: string) => execute("attach", { opportunityStageId: id }, id),
    detachStage: (id: string) => execute("detach", undefined, id),
    moveStage: (id: string, direction: -1 | 1) => {
      const current = confirmed.current?.scope === safety.scope ? confirmed.current.value : null;
      const orderedIds = current && moveStageOrder(current.stages, id, direction);
      return orderedIds ? execute("order", { orderedIds }, id) : Promise.resolve(null);
    },
  };
}

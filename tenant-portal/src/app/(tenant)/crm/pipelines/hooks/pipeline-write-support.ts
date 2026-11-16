import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import type { AxiosResponse } from "@/lib/api/axiosClient";
import { parsePipelineResponse, type Pipeline } from "../pipeline-contract";
import { isUncertainPipelineWrite } from "./pipeline-uncertainty";

export const PIPELINE_READ_CONFIG = { cache: "no-store", maxResponseBytes: 512 * 1024 } as const;
// Preserve Gateway-generated keys and replay receipts; prevent automatic transport resends.
export const PIPELINE_WRITE_CONFIG = { cache: "no-store", maxResponseBytes: 256 * 1024, nonReplayable: true } as const;

export interface PipelineWriteResult {
  ok: boolean;
  replayed: boolean;
  error: NormalizedApiError | null;
  uncertain?: boolean;
  reconciled?: boolean;
  stale?: boolean;
}

export function refusedPipelineWrite(code?: "FORBIDDEN"): PipelineWriteResult {
  return { ok: false, replayed: false, error: code ? { status: 403, code } : null };
}

export function pipelineWriteError(caught: unknown): PipelineWriteResult {
  const error = normalizeApiError(caught);
  return { ok: false, replayed: false, error, uncertain: isUncertainPipelineWrite(error) };
}

export function localPipelineError(caught: unknown): PipelineWriteResult {
  return { ok: false, replayed: false, error: { status: 0, code: caught instanceof Error ? caught.message : "PIPELINE_INPUT_INVALID" } };
}

export function assertReceiptStatus(response: AxiosResponse<unknown>, status: number) {
  if (response.status !== status) throw new Error("Invalid pipeline mutation receipt.");
}

export function pipelineReceipt(response: AxiosResponse<unknown>, status: number, id?: string): Pipeline {
  assertReceiptStatus(response, status);
  const pipeline = parsePipelineResponse(response.data);
  if (id && pipeline.id !== id) throw new Error("Pipeline receipt belongs to another resource.");
  assertPipelineConfiguration(pipeline);
  return pipeline;
}

export function assertPipelineConfiguration(pipeline: Pipeline) {
  if (!pipeline.assignments || pipeline.assignments.accessMode !== pipeline.accessMode) {
    throw new Error("Pipeline configuration has missing or inconsistent assignments.");
  }
}

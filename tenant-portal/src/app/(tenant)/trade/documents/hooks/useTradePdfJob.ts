"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AsyncJobStatus } from "@/design-system";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { tradeGet, tradePost } from "../../trade-api";
import { TRADE_ACTION_RESPONSE_BYTES } from "../trade-document-contract";
import {
  TRADE_PDF_POLL_INTERVAL_MS,
  TRADE_PDF_POLL_LIMIT,
  TRADE_PDF_RESPONSE_BYTES,
  parseTradeRenderJob,
  tradeRenderJobPath,
  tradeRenderPdfPath,
  type TradeRenderJob,
} from "../trade-pdf-contract";
import { isAbortError } from "./useTradeDocumentList";
import { useTradeWrite, type TradeWriteState } from "./useTradeWrite";

export interface TradePdfJobState {
  job: TradeRenderJob | null;
  /** The five UI states `AsyncJobState` renders — mapped, never sent. */
  uiStatus: AsyncJobStatus | null;
  isPolling: boolean;
  pollError: NormalizedApiError | null;
  /** True once the poll budget ran out with the job still in flight. */
  isPollExhausted: boolean;
  write: TradeWriteState;
  render: (body: Record<string, unknown>, operation: string) => Promise<void>;
  reset: () => void;
}

/**
 * `POST …/render-pdf` (202) and the poll that follows it.
 *
 * Two things about this flow are unusual and both are load-bearing:
 *
 * 1. **A failed render is a 200.** The job's own `failure.code` carries
 *    `PDF_INPUT_EXPIRED`, `PDF_RENDER_FAILED` or `PDF_RESULT_CONFLICT`, none of
 *    which is ever an HTTP status. The loop terminates on the job's state, not
 *    the response's.
 * 2. **The `Location` header is unusable.** The Gateway's
 *    `assertPublicLocationContract` requires the upstream `Location` on these
 *    six route keys to start with `/api/v1/trade/{segment}/{id}/render-jobs/`,
 *    and trade-app emits the canonical tenant prefix instead, which does not
 *    start with it. On that
 *    reading the Gateway raises `GW.IDEM.RESPONSE_CONTRACT_BREACH` — **502** —
 *    and the 202 never reaches the browser at all (Q36, a live backend defect,
 *    not something to work around here). The poll path is therefore rebuilt
 *    from the document and job ids, and the 502 is given its own message so the
 *    failure is legible rather than arriving as a generic upstream error.
 */
export function useTradePdfJob(
  basePath: string,
  documentId: string,
  headers: Record<string, string>,
): TradePdfJobState {
  const write = useTradeWrite();
  const [job, setJob] = useState<TradeRenderJob | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [pollError, setPollError] = useState<NormalizedApiError | null>(null);
  const [isPollExhausted, setIsPollExhausted] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const poll = useCallback(
    async (jobId: string): Promise<void> => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsPolling(true);
      setIsPollExhausted(false);
      try {
        for (let attempt = 0; attempt < TRADE_PDF_POLL_LIMIT; attempt += 1) {
          await delay(TRADE_PDF_POLL_INTERVAL_MS, controller.signal);
          if (controller.signal.aborted) return;
          const result = await tradeGet(tradeRenderJobPath(basePath, documentId, jobId), {
            signal: controller.signal,
            headers,
            maxResponseBytes: TRADE_PDF_RESPONSE_BYTES,
          });
          const next = parseTradeRenderJob(result.data);
          setJob(next);
          if (next.status === "COMPLETED" || next.status === "FAILED") return;
          // A non-terminal failure means the worker will retry, so the loop
          // continues; a terminal one will never change and stopping is honest.
          if (next.failure?.terminal) return;
        }
        setIsPollExhausted(true);
      } catch (error) {
        if (isAbortError(error)) return;
        setPollError(normalizeApiError(error));
      } finally {
        if (!controller.signal.aborted) setIsPolling(false);
      }
    },
    [basePath, documentId, headers],
  );

  const render = useCallback(
    async (body: Record<string, unknown>, operation: string): Promise<void> => {
      setPollError(null);
      setIsPollExhausted(false);
      await write.runWrite({
        operation,
        send: (idempotency) =>
          tradePost(tradeRenderPdfPath(basePath, documentId), body, {
            headers: { ...headers, ...idempotency },
            maxResponseBytes: TRADE_ACTION_RESPONSE_BYTES,
          }),
        onSuccess: (result) => {
          const accepted = parseTradeRenderJob(result.data);
          setJob(accepted);
          if (accepted.status !== "COMPLETED" && accepted.status !== "FAILED") {
            void poll(accepted.renderJobId);
          }
        },
      });
    },
    [basePath, documentId, headers, poll, write],
  );

  return {
    job,
    uiStatus: job ? toAsyncJobStatus(job) : null,
    isPolling,
    pollError,
    isPollExhausted,
    write,
    render: (body, operation) => render(body, operation),
    reset: () => {
      abortRef.current?.abort();
      setJob(null);
      setPollError(null);
      setIsPolling(false);
      setIsPollExhausted(false);
    },
  };
}

/**
 * `QuotationPdfRenderStatus` mapped onto `AsyncJobState`'s five UI states.
 *
 * `AsyncJobStatus` is a UI union, not a wire enum (Q15), so the mapping belongs
 * to the screen. `ARTIFACT_EXPIRED` is reserved for a job that completed but
 * whose signed artifact is gone — the 300-second download URL has passed, or
 * the service refused to sign it.
 */
function toAsyncJobStatus(job: TradeRenderJob): AsyncJobStatus {
  if (job.status === "FAILED") return "FAILED";
  if (job.status === "COMPLETED") {
    if (!job.artifact) return "ARTIFACT_EXPIRED";
    return Date.parse(job.artifact.downloadExpiresAt) <= Date.now() ? "ARTIFACT_EXPIRED" : "SUCCEEDED";
  }
  return job.status === "RETRYING" ? "RUNNING" : "QUEUED";
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { BRANCH_SCOPE_HEADER, COMPANY_SCOPE_HEADER } from "@/lib/api/organization-scope";
import { can } from "@/lib/auth/permission-scope";
import type { AsyncJobStatus } from "@/design-system";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { tradeGet, tradePost } from "../../trade-api";
import { TRADE_ACTION_RESPONSE_BYTES, TRADE_V1, record, tradeInvalidResponse } from "../trade-document-contract";
import {
  TRADE_PDF_POLL_INTERVAL_MS, TRADE_PDF_POLL_LIMIT, TRADE_PDF_RESPONSE_BYTES,
  parseTradeRenderJob, tradeRenderJobPath, tradeRenderPdfPath, type TradeRenderJob,
} from "../trade-pdf-contract";
import { isAbortError } from "./useTradeDocumentList";
import { useTradeWrite, type TradeWriteState } from "./useTradeWrite";

export interface TradePdfJobState {
  job: TradeRenderJob | null;
  uiStatus: AsyncJobStatus | null;
  isPolling: boolean;
  pollError: NormalizedApiError | null;
  isPollExhausted: boolean;
  canReadStatus?: boolean;
  readOnlySettlement?: boolean;
  write: TradeWriteState;
  defaultAssignmentHelp: "configure" | "ask-admin" | null;
  render: (body: Record<string, unknown>, operation: string) => Promise<void>;
  /** Reads the same job; completed reads renew its signed link without another render. */
  refresh: () => Promise<void>;
  reset: () => void;
}

/** Render acceptance, bounded monitoring, and exact-request uncertainty recovery. */
export function useTradePdfJob(
  basePath: string, documentId: string, headers: Record<string, string>, sourceKey = "",
): TradePdfJobState {
  const write = useTradeWrite();
  const { user, realtimeAuthGeneration, readReadyProfileCommit, subscribeProfileReadiness } = useTenantAuth();
  const readyProfile = useSyncExternalStore(subscribeProfileReadiness, readReadyProfileCommit, () => null);
  const purchaseType = basePath === `${TRADE_V1}/purchase-quotations` ? "PURCHASE_QUOTATION"
    : basePath === `${TRADE_V1}/purchase-orders` ? "PURCHASE_ORDER" : null;
  const key = JSON.stringify([basePath, documentId, sourceKey, Object.entries(headers).sort()]);
  const owner = useMemo(() => ({ key, actorId: user?.id, realtimeAuthGeneration }), [key, user?.id, realtimeAuthGeneration]);
  const purchaseOwner = purchaseType ? owner : null;
  const liveOwner = useRef<typeof owner | null>(null);
  const liveUser = useRef(user);
  const deniedPurchaseOwner = useRef<typeof purchaseOwner>(null);
  const [retiredPurchaseOwner, setRetiredPurchaseOwner] = useState<typeof purchaseOwner>(null);
  const latestPurchaseWriteGeneration = useRef(0);
  const [purchaseWriteGeneration, setPurchaseWriteGeneration] = useState(0);
  const [defaultRequestOwner, setDefaultRequestOwner] = useState<typeof owner | null>(null);
  useLayoutEffect(() => {
    liveOwner.current = owner;
    liveUser.current = user;
    return () => { liveOwner.current = null; };
  }, [owner, user]);
  const currentKey = useRef(key);
  const [stored, setStored] = useState<{ key: string; owner: typeof purchaseOwner; job: TradeRenderJob; sourceVersion: unknown } | null>(null);
  const [polling, setPolling] = useState<{ key: string; owner: typeof purchaseOwner; active: boolean } | null>(null);
  const [pollError, setPollError] = useState<NormalizedApiError | null>(null);
  const [isPollExhausted, setIsPollExhausted] = useState(false);
  const [, expire] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const livePurchaseJob = useRef<{ owner: NonNullable<typeof purchaseOwner>; id: string } | null>(null);
  const isPolling = polling?.key === key && polling.owner === purchaseOwner && polling.active;
  const current = stored?.key === key && stored.owner === purchaseOwner ? stored : null;
  const job = current?.job ?? null;

  useEffect(() => { currentKey.current = key; return () => abortRef.current?.abort(); }, [key, purchaseOwner]);
  useEffect(() => {
    if (!job?.artifact) return;
    const remaining = Date.parse(job.artifact.downloadExpiresAt) - Date.now();
    if (remaining <= 0) return;
    const timer = setTimeout(() => expire((value) => value + 1), Math.min(remaining + 1, 2_147_483_647));
    return () => clearTimeout(timer);
  }, [job?.artifact]);

  const monitor = useCallback(async (accepted: TradeRenderJob, sourceVersion: unknown, immediate: boolean): Promise<void> => {
    const jobId = accepted.renderJobId;
    const ownsJob = () => {
      if (!purchaseOwner) return true;
      const currentJob = livePurchaseJob.current;
      return liveOwner.current === purchaseOwner && currentJob?.owner === purchaseOwner && currentJob.id === jobId;
    };
    if (!ownsJob()) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const active = () => !controller.signal.aborted && currentKey.current === key && ownsJob();
    setPolling({ key, owner: purchaseOwner, active: true });
    setPollError(null);
    setIsPollExhausted(false);
    let previous = accepted;
    try {
      for (let attempt = 0; attempt < TRADE_PDF_POLL_LIMIT; attempt += 1) {
        if (!immediate || attempt > 0) await delay(TRADE_PDF_POLL_INTERVAL_MS, controller.signal);
        if (!active()) return;
        const result = await tradeGet(tradeRenderJobPath(basePath, documentId, jobId), {
          signal: controller.signal, headers, maxResponseBytes: TRADE_PDF_RESPONSE_BYTES,
        });
        const next = parseTradeRenderJob(result.data);
        if (!active()) return;
        if (purchaseType) {
          assertPurchaseJob(result, next, purchaseType, basePath, documentId, { sourceVersion, previous });
          if (purchaseOwner && deniedPurchaseOwner.current === purchaseOwner) {
            // Retire earlier write callbacks before admitting new actions.
            const generation = latestPurchaseWriteGeneration.current + 1;
            latestPurchaseWriteGeneration.current = generation;
            deniedPurchaseOwner.current = null;
            setPurchaseWriteGeneration(generation);
          }
        }
        setStored({ key, owner: purchaseOwner, job: next, sourceVersion });
        previous = next;
        if (next.status === "COMPLETED" || next.status === "FAILED" || next.failure?.terminal) return;
      }
      if (active()) setIsPollExhausted(true);
    } catch (error) {
      if (!isAbortError(error) && active()) {
        const normalized = normalizeApiError(error);
        if (purchaseOwner && normalized.status === 403 && normalized.code === "TRADE.AUTH.TARGET_DENIED") {
          deniedPurchaseOwner.current = purchaseOwner;
          setRetiredPurchaseOwner(purchaseOwner);
        }
        if (purchaseType) setStored(value => value?.key === key && value.owner === purchaseOwner && value.job.renderJobId === jobId
          ? { ...value, job: { ...value.job, artifact: null } } : value);
        setPollError(normalized);
      }
    } finally {
      if (active()) setPolling({ key, owner: purchaseOwner, active: false });
    }
  }, [basePath, documentId, headers, key, purchaseOwner, purchaseType]);

  const companyId = headers[COMPANY_SCOPE_HEADER];
  const branchId = headers[BRANCH_SCOPE_HEADER];
  const render = useCallback(async (body: Record<string, unknown>, operation: string): Promise<void> => {
    const canPost = purchaseOwner ? () =>
      liveOwner.current === purchaseOwner && latestPurchaseWriteGeneration.current === purchaseWriteGeneration &&
        deniedPurchaseOwner.current !== purchaseOwner && !!companyId && !!branchId &&
        can(liveUser.current, purchaseType === "PURCHASE_QUOTATION" ? "trade.purchase_quotations.read" : "trade.purchase_orders.read",
          { companyId, branchId }) : undefined;
    if (write.isBlocked || isPolling || canPost?.() === false) return;
    const submitted = { ...body };
    const submittedHeaders = { ...headers };
    setPollError(null);
    setIsPollExhausted(false);
    await write.runWrite({
      operation,
      canRetry: canPost,
      send: async (idempotency) => {
        if (liveOwner.current === owner) {
          setDefaultRequestOwner(submitted.templateVersionId === undefined ? owner : null);
          if (purchaseOwner) setRetiredPurchaseOwner(null);
        }
        const result = await tradePost(tradeRenderPdfPath(basePath, documentId), submitted, {
          headers: { ...submittedHeaders, ...idempotency }, maxResponseBytes: TRADE_ACTION_RESPONSE_BYTES,
        });
        const accepted = parseTradeRenderJob(result.data);
        if (purchaseType) assertPurchaseJob(result, accepted, purchaseType, basePath, documentId, {
          sourceVersion: submitted.sourceVersion, templateVersionId: submitted.templateVersionId,
        });
        if ((accepted.quotationId && accepted.quotationId !== documentId) || (accepted.quotationRevisionId && accepted.quotationRevisionId !== submitted.revisionId)) throw new Error("Invalid Trade PDF acceptance.");
        return result;
      },
      onSuccess: (result) => {
        const accepted = parseTradeRenderJob(result.data);
        if (currentKey.current !== key || canPost?.() === false) return;
        if (purchaseOwner) {
          livePurchaseJob.current = { owner: purchaseOwner, id: accepted.renderJobId };
          abortRef.current?.abort();
          setPolling(null);
        }
        setStored({ key, owner: purchaseOwner, job: accepted, sourceVersion: submitted.sourceVersion });
        if (accepted.status !== "COMPLETED" && accepted.status !== "FAILED") {
          void monitor(accepted, submitted.sourceVersion, false);
        }
      },
    });
  }, [basePath, branchId, companyId, documentId, headers, isPolling, key, monitor, owner, purchaseOwner, purchaseType,
    purchaseWriteGeneration, write]);

  const target = { companyId, branchId };
  const reason = write.writeError?.fieldErrors?.reason;
  const missingDefault = defaultRequestOwner === owner && !!owner.actorId && !!owner.realtimeAuthGeneration &&
    !!companyId && !!branchId && write.writeError?.status === 422 &&
    write.writeError.code === "TRADE.BUSINESS_DOCUMENT.PDF_TEMPLATE_INCOMPATIBLE" &&
    reason?.length === 1 && reason[0] === "no_eligible_default_assignment";
  const canConfigure = missingDefault && readyProfile?.user === user &&
    user?.accessibleBranchCompanies?.some(scope => scope.companyId === companyId && scope.branchId === branchId) &&
    can(user, "templates.read", target) && can(user, "templates.assignments.manage", target);
  const canReadStatus = Boolean(current && (!write.isBlocked || (purchaseOwner && write.ambiguous && !write.isWriting)));
  const readOnlySettlement = Boolean(current && purchaseOwner && retiredPurchaseOwner === purchaseOwner && write.ambiguous);

  return {
    defaultAssignmentHelp: missingDefault ? (canConfigure ? "configure" : "ask-admin") : null,
    job, uiStatus: job ? toAsyncJobStatus(job) : null,
    canReadStatus: purchaseOwner ? canReadStatus : undefined, readOnlySettlement,
    isPolling, pollError: current ? pollError : null, isPollExhausted: !!current && isPollExhausted, write, render,
    refresh: async () => { if (current && canReadStatus) await monitor(current.job, current.sourceVersion, true); },
    reset: () => {
      abortRef.current?.abort();
      if (purchaseOwner && livePurchaseJob.current?.owner === purchaseOwner) livePurchaseJob.current = null;
      setDefaultRequestOwner(null);
      setStored(null); setPollError(null); setPolling(null); setIsPollExhausted(false);
    },
  };
}

function assertPurchaseJob(
  result: { status: number; data: unknown }, job: TradeRenderJob,
  documentType: "PURCHASE_QUOTATION" | "PURCHASE_ORDER", basePath: string, documentId: string,
  expected: { sourceVersion: unknown; templateVersionId?: unknown; previous?: TradeRenderJob },
) {
  const row = record(result.data);
  const previous = expected.previous;
  if (result.status !== (previous ? 200 : 202) || row?.documentType !== documentType ||
    row.documentId !== documentId || typeof expected.sourceVersion !== "number" ||
    row.sourceVersion !== expected.sourceVersion || !job.templateDefinitionId || !job.templateVersionId ||
    job.statusUrl !== tradeRenderJobPath(basePath, documentId, job.renderJobId) ||
    (expected.templateVersionId !== undefined && job.templateVersionId !== expected.templateVersionId) ||
    (job.artifact && (!previous || job.status !== "COMPLETED")) ||
    (previous && (job.renderJobId !== previous.renderJobId ||
      job.templateDefinitionId !== previous.templateDefinitionId || job.templateVersionId !== previous.templateVersionId ||
      job.attemptCount < previous.attemptCount ||
      ((previous.status === "COMPLETED" || previous.status === "FAILED") && job.status !== previous.status)))) {
    tradeInvalidResponse();
  }
}

function toAsyncJobStatus(job: TradeRenderJob): AsyncJobStatus {
  if (job.status === "FAILED") return "FAILED";
  if (job.status === "COMPLETED") {
    return !job.artifact || Date.parse(job.artifact.downloadExpiresAt) <= Date.now() ? "ARTIFACT_EXPIRED" : "SUCCEEDED";
  }
  return job.status === "RETRYING" ? "RUNNING" : "QUEUED";
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const finish = () => { signal.removeEventListener("abort", abort); resolve(); };
    const timer = setTimeout(finish, ms);
    const abort = () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); };
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  });
}

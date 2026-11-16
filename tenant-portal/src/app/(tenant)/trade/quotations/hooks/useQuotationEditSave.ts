"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { tradeGet, tradeIfMatch, tradePatch, tradePost } from "../../trade-api";
import {
  TRADE_ACTION_RESPONSE_BYTES,
  TRADE_DOCUMENT_RESPONSE_BYTES,
  tradeDocumentActionPath,
  tradeDocumentPath,
} from "../../documents/trade-document-contract";
import { useTradeWrite, type TradeWriteState } from "../../documents/hooks/useTradeWrite";
import {
  QUOTATIONS_PATH,
  parseQuotation,
  parseQuotationDetail,
  parseQuotationRevisionResult,
  type Quotation,
  type QuotationDetail,
  type UpdateQuotationHeaderRequest,
} from "../quotation-contract";
import { quotationScopedHeaders } from "../quotation-workspace-hydration";
import type { QuotationRevisionInput } from "./useQuotationSave";

export interface QuotationEditSaveOptions {
  existingQuotation: QuotationDetail | null;
  isEnabled: boolean;
  canUpdate: boolean;
  canSend: boolean;
  write?: TradeWriteState;
  onSaved?: (detail: QuotationDetail) => Promise<unknown> | void;
}

export function useQuotationEditSave(options: QuotationEditSaveOptions) {
  const { existingQuotation, isEnabled, canUpdate, canSend, onSaved } = options;
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const { t } = useI18n();
  const internalWrite = useTradeWrite();
  const write = options.write ?? internalWrite;
  const actorId = user?.id ?? null;

  const [trackedProp, setTrackedProp] = useState<QuotationDetail | null>(existingQuotation);
  const [confirmedQuotation, setConfirmedQuotation] = useState<QuotationDetail | null>(existingQuotation);
  const [detailsError, setDetailsError] = useState<NormalizedApiError | null>(null);
  const [isDetailsCurrent, setIsDetailsCurrent] = useState(Boolean(existingQuotation));
  const [isReloadingDetails, setIsReloadingDetails] = useState(false);
  const [savingStep, setSavingStep] = useState<"idle" | "header" | "revision" | "sending">("idle");
  const active = useRef(false);

  if (existingQuotation !== trackedProp && !write.isBlocked) {
    setTrackedProp(existingQuotation);
    if (!existingQuotation) {
      setConfirmedQuotation(null);
      setIsDetailsCurrent(false);
      setDetailsError(null);
    } else if (
      !confirmedQuotation ||
      confirmedQuotation.id !== existingQuotation.id ||
      existingQuotation.version > confirmedQuotation.version
    ) {
      setConfirmedQuotation(existingQuotation);
      setIsDetailsCurrent(true);
      setDetailsError(null);
    }
  }

  const liveAuthRef = useRef<{
    actorId: string | null;
    generation: string | null;
    canUpdate: boolean;
    canSend: boolean;
    isEnabled: boolean;
  } | null>(null);
  useLayoutEffect(() => {
    liveAuthRef.current = {
      actorId,
      generation: realtimeAuthGeneration ?? null,
      canUpdate,
      canSend,
      isEnabled,
    };
    return () => { liveAuthRef.current = null; };
  }, [actorId, canSend, canUpdate, isEnabled, realtimeAuthGeneration]);

  const makeAuthFence = useCallback((expectedActor: string | null, expectedGen: string | null) => {
    const isCurrent = () => Boolean(
      liveAuthRef.current &&
      liveAuthRef.current.actorId === expectedActor &&
      liveAuthRef.current.generation === expectedGen,
    );
    const assertCurrent = () => {
      if (!isCurrent()) throw new DOMException("Quotation actor session changed.", "AbortError");
    };
    return { isCurrent, assertCurrent };
  }, []);

  const lockedHeaders = useMemo(
    () => (confirmedQuotation ? quotationScopedHeaders(confirmedQuotation) : null),
    [confirmedQuotation],
  );

  const versionConflict = Boolean(
    confirmedQuotation &&
    !write.ambiguous &&
    write.writeError?.code === "TRADE.CONCURRENCY.STALE_VERSION",
  );

  const refreshDetail = useCallback(async (
    known: QuotationDetail,
    scope: Record<string, string>,
    fence: { isCurrent: () => boolean; assertCurrent: () => void },
  ): Promise<QuotationDetail | null> => {
    if (!fence.isCurrent()) return null;
    setConfirmedQuotation(known);
    setIsDetailsCurrent(false);
    setDetailsError(null);
    try {
      const response = await tradeGet(tradeDocumentPath(QUOTATIONS_PATH, known.id), {
        headers: scope,
        maxResponseBytes: TRADE_DOCUMENT_RESPONSE_BYTES,
        assertCurrent: fence.assertCurrent,
      });
      if (!fence.isCurrent()) return null;
      const detail = parseQuotationDetail(response.data);
      if (detail.id !== known.id || detail.companyId !== known.companyId || detail.branchId !== known.branchId) {
        throw new Error("QUOTATION_DETAIL_SCOPE_MISMATCH");
      }
      setConfirmedQuotation(detail);
      setIsDetailsCurrent(true);
      await onSaved?.(detail);
      return detail;
    } catch (error) {
      if (fence.isCurrent()) setDetailsError(normalizeApiError(error));
      return null;
    }
  }, [onSaved]);

  const saveExisting = useCallback(async (
    headerPatch: UpdateQuotationHeaderRequest | null,
    revision: QuotationRevisionInput | null,
    onHeaderPatched?: (updated: Quotation) => void,
    confirmIssuedChange = false,
  ): Promise<boolean> => {
    const target = confirmedQuotation;
    if (
      active.current || !target || !isEnabled || !canUpdate || write.isBlocked || !isDetailsCurrent ||
      (!headerPatch && !revision)
    ) {
      return false;
    }
    const requiresSend = Boolean(revision && target.lifecycleStatus === "SENT");
    const patchAfterRevision = Boolean(headerPatch && requiresSend);
    if (headerPatch && target.lifecycleStatus !== "DRAFT" && !patchAfterRevision) return false;
    if (revision) {
      const canReviseStatus =
        target.lifecycleStatus === "DRAFT" ||
        (target.lifecycleStatus === "SENT" && canSend && confirmIssuedChange);
      if (!canReviseStatus) return false;
    }

    const fence = makeAuthFence(actorId, realtimeAuthGeneration ?? null);
    const scope = quotationScopedHeaders(target);
    const initialVersion = target.version;
    const frozenPatch = headerPatch ? { ...headerPatch } : null;
    const frozenRevision: QuotationRevisionInput | null = revision
      ? {
          ...revision,
          ...(revision.pricing ? { pricing: { ...revision.pricing } } : {}),
          lines: revision.lines.map((line) => ({
            ...line,
            ...(line.discount ? { discount: { ...line.discount } } : {}),
          })),
          terms: { ...revision.terms },
        }
      : null;

    let committedPatch: Quotation | null = null;
    let committedRevision = false;
    let knownAfterWrite: QuotationDetail = target;
    let needsDetailRefresh = false;

    active.current = true;
    try {
      return await write.runWrite({
        operation: t.common.save,
        canRetry: () => Boolean(
          fence.isCurrent() &&
          liveAuthRef.current?.isEnabled &&
          liveAuthRef.current?.canUpdate &&
          (!requiresSend || liveAuthRef.current?.canSend),
        ),
        send: async (idempotency) => {
          fence.assertCurrent();
          try {
            let lastResponse;
            const saveHeader = async (patch: UpdateQuotationHeaderRequest, expectedVersion: number) => {
              setSavingStep("header");
              const response = await tradePatch(tradeDocumentPath(QUOTATIONS_PATH, target.id), patch, {
                headers: { ...scope, ...idempotency, "if-match": tradeIfMatch(expectedVersion) },
                maxResponseBytes: TRADE_ACTION_RESPONSE_BYTES,
                assertCurrent: fence.assertCurrent,
              });
              const updatedHeader = parseQuotation(response.data);
              if (
                updatedHeader.id !== target.id ||
                updatedHeader.companyId !== target.companyId ||
                updatedHeader.branchId !== target.branchId
              ) {
                throw new Error("QUOTATION_DETAIL_SCOPE_MISMATCH");
              }
              committedPatch = updatedHeader;
              knownAfterWrite = { ...knownAfterWrite, ...updatedHeader };
              setConfirmedQuotation(knownAfterWrite);
              onHeaderPatched?.(updatedHeader);
              return response;
            };
            if (frozenPatch && !patchAfterRevision && !committedPatch) {
              lastResponse = await saveHeader(frozenPatch, initialVersion);
            }

            if (frozenRevision && !committedRevision) {
              const versionForRevision = committedPatch ? committedPatch.version : initialVersion;
              setSavingStep("revision");
              lastResponse = await tradePost(
                tradeDocumentActionPath(QUOTATIONS_PATH, target.id, "revisions"),
                frozenRevision,
                {
                  headers: { ...scope, ...idempotency, "if-match": tradeIfMatch(versionForRevision) },
                  maxResponseBytes: TRADE_ACTION_RESPONSE_BYTES,
                  assertCurrent: fence.assertCurrent,
                },
              );
              const savedRevision = parseQuotationRevisionResult(lastResponse.data);
              const baseHeader = committedPatch ? { ...target, ...committedPatch } : target;
              const otherRevisions = baseHeader.revisions.filter((entry) => entry.id !== savedRevision.revision.id);
              knownAfterWrite = {
                ...baseHeader,
                lifecycleStatus: "DRAFT",
                currentRevisionId: savedRevision.revision.id,
                grandTotal: savedRevision.revision.grandTotal,
                revisions: [savedRevision.revision, ...otherRevisions],
                currentLines: savedRevision.lines,
              };
              committedRevision = true;
              needsDetailRefresh = true;
            }
            if (frozenPatch && patchAfterRevision && !committedPatch) {
              // The revision changes the SENT header to DRAFT in one versioned write.
              lastResponse = await saveHeader(frozenPatch, initialVersion + 1);
            }

            if (!lastResponse) throw new Error("QUOTATION_WRITE_NOT_EXECUTED");
            return lastResponse;
          } catch (error) {
            if (patchAfterRevision && committedRevision && !committedPatch) {
              await refreshDetail(knownAfterWrite, scope, fence);
            }
            throw error;
          } finally {
            setSavingStep("idle");
          }
        },
        onSuccess: async () => {
          if (needsDetailRefresh) {
            await refreshDetail(knownAfterWrite, scope, fence);
          } else if (fence.isCurrent()) {
            setConfirmedQuotation(knownAfterWrite);
            setIsDetailsCurrent(true);
            setDetailsError(null);
            await onSaved?.(knownAfterWrite);
          }
          setSavingStep("idle");
        },
      });
    } finally {
      active.current = false;
      setSavingStep("idle");
    }
  }, [actorId, canSend, canUpdate, confirmedQuotation, isDetailsCurrent, isEnabled, makeAuthFence, onSaved, realtimeAuthGeneration, refreshDetail, t.common.save, write]);

  const canSendSaved = Boolean(
    confirmedQuotation &&
    isDetailsCurrent &&
    canSend &&
    confirmedQuotation.lifecycleStatus === "DRAFT" &&
    confirmedQuotation.currentRevisionId &&
    !write.isBlocked &&
    savingStep === "idle",
  );

  const sendExisting = useCallback(async () => {
    const target = confirmedQuotation;
    if (!target || !canSendSaved || active.current) return;
    const fence = makeAuthFence(actorId, realtimeAuthGeneration ?? null);
    const scope = quotationScopedHeaders(target);
    const expectedVersion = target.version;
    active.current = true;
    setSavingStep("sending");
    let sentHeader: Quotation | null = null;
    try {
      await write.runWrite({
        operation: t.tradeDocuments.quotations.send,
        canRetry: () => Boolean(fence.isCurrent() && liveAuthRef.current?.canSend),
        send: async (idempotency) => {
          setSavingStep("sending");
          try {
            fence.assertCurrent();
            const response = await tradePost(
              tradeDocumentActionPath(QUOTATIONS_PATH, target.id, "send"),
              undefined,
              {
                headers: { ...scope, ...idempotency, "if-match": tradeIfMatch(expectedVersion) },
                maxResponseBytes: TRADE_ACTION_RESPONSE_BYTES,
                assertCurrent: fence.assertCurrent,
              },
            );
            sentHeader = parseQuotation(response.data);
            return response;
          } finally {
            setSavingStep("idle");
          }
        },
        onSuccess: async () => {
          if (sentHeader) await refreshDetail({ ...target, ...sentHeader }, scope, fence);
          setSavingStep("idle");
        },
      });
    } finally {
      active.current = false;
      setSavingStep("idle");
    }
  }, [actorId, canSendSaved, confirmedQuotation, makeAuthFence, realtimeAuthGeneration, refreshDetail, t.tradeDocuments.quotations.send, write]);

  const reloadExistingDetails = useCallback(async (): Promise<QuotationDetail | null> => {
    const target = confirmedQuotation;
    if (active.current || write.isWriting || write.ambiguous || !target) return null;
    const fence = makeAuthFence(actorId, realtimeAuthGeneration ?? null);
    active.current = true;
    setIsReloadingDetails(true);
    setDetailsError(null);
    try {
      const scope = quotationScopedHeaders(target);
      const response = await tradeGet(tradeDocumentPath(QUOTATIONS_PATH, target.id), {
        headers: scope,
        maxResponseBytes: TRADE_DOCUMENT_RESPONSE_BYTES,
        assertCurrent: fence.assertCurrent,
      });
      if (!fence.isCurrent()) return null;
      const detail = parseQuotationDetail(response.data);
      if (detail.id !== target.id || detail.companyId !== target.companyId || detail.branchId !== target.branchId) {
        throw new Error("QUOTATION_DETAIL_SCOPE_MISMATCH");
      }
      setConfirmedQuotation(detail);
      setIsDetailsCurrent(true);
      write.clearWriteError();
      await onSaved?.(detail);
      return detail;
    } catch (error) {
      if (fence.isCurrent()) setDetailsError(normalizeApiError(error));
      return null;
    } finally {
      active.current = false;
      setIsReloadingDetails(false);
    }
  }, [actorId, confirmedQuotation, makeAuthFence, onSaved, realtimeAuthGeneration, write]);

  return {
    confirmedQuotation,
    lockedHeaders,
    detailsError,
    isDetailsCurrent,
    isReloadingDetails,
    versionConflict,
    savingStep,
    write,
    canSendSaved,
    saveExisting,
    sendExisting,
    reloadExistingDetails,
  };
}

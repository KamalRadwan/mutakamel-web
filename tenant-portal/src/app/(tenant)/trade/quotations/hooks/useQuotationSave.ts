"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { requiresSameKeyRecovery } from "@/lib/api/outcomes";
import { BRANCH_SCOPE_HEADER, COMPANY_SCOPE_HEADER } from "@/lib/api/organization-scope";
import { CHANNEL_SCOPE_HEADER, tradeGet, tradeIfMatch, tradePost } from "../../trade-api";
import { TRADE_ACTION_RESPONSE_BYTES, TRADE_DOCUMENT_RESPONSE_BYTES,
  tradeDocumentActionPath, tradeDocumentPath } from "../../documents/trade-document-contract";
import { useTradeWrite, type TradeWriteState } from "../../documents/hooks/useTradeWrite";
import { QUOTATIONS_PATH, parseQuotation, parseQuotationDetail, parseQuotationRevisionResult,
  type CreateQuotationRequest, type Quotation, type QuotationDetail } from "../quotation-contract";
import type { QuotationPricingIntent, QuotationPricingLineInput } from "../quotation-discount-contract";
import { consumeQuotationReplacement, readQuotationHandoff, rememberQuotationReplacementCreate,
  type QuotationReplacementSource } from "../quotation-composer-draft";

export interface QuotationRevisionInput {
  validUntil: string;
  lines: QuotationPricingLineInput[];
  terms: Record<string, unknown>;
  pricing?: QuotationPricingIntent;
  expectedPricingFingerprint?: string;
}

export interface QuotationSaveOptions {
  headers: Record<string, string>;
  isEnabled: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canSend: boolean;
  replacementSource?: QuotationReplacementSource;
  replacementActorId?: string | null;
  replacementHandoffId?: string;
  replacementContext?: string;
  isReplacementAuthCurrent?: () => boolean;
  write?: TradeWriteState;
  onSaved?: (detail: QuotationDetail) => Promise<unknown> | void;
}

export function useQuotationSave(options: QuotationSaveOptions) {
  const { onSaved, replacementSource, replacementActorId, replacementHandoffId, replacementContext,
    isReplacementAuthCurrent } = options;
  const { t } = useI18n();
  const internalWrite = useTradeWrite();
  const write = options.write ?? internalWrite;
  const [partialHeader, setPartialHeader] = useState<Quotation | null>(null);
  const [savedQuotation, setSavedQuotation] = useState<QuotationDetail | null>(null);
  const [lockedHeaders, setLockedHeaders] = useState<Record<string, string> | null>(null);
  const [detailsError, setDetailsError] = useState<NormalizedApiError | null>(null);
  const [replacementStorageError, setReplacementStorageError] = useState(false);
  const [replacementReconciliation, setReplacementReconciliation] = useState<
    { key: string; kind: "mismatch" } | { key: string; kind: "confirmed"; quotationId: string } | null>(null);
  const [isDetailsCurrent, setIsDetailsCurrent] = useState(false);
  const [isReloadingDetails, setIsReloadingDetails] = useState(false);
  const [savingStep, setSavingStep] = useState<"idle" | "header" | "revision" | "sending">("idle");
  const active = useRef(false);
  const consumedReplacement = useRef<string | null>(null);
  const mountedCreateKey = useRef<string | null>(null);
  const liveReplacement = useRef<{ context?: string; canCreate: boolean; canUpdate: boolean } | null>(null);
  useLayoutEffect(() => {
    liveReplacement.current = { context: replacementContext, canCreate: options.canCreate, canUpdate: options.canUpdate };
    return () => { liveReplacement.current = null; };
  }, [replacementContext, options.canCreate, options.canUpdate]);
  const isReplacementCurrent = useCallback(() => !isReplacementAuthCurrent || (
    replacementContext !== undefined && liveReplacement.current?.context === replacementContext && isReplacementAuthCurrent()
  ), [isReplacementAuthCurrent, replacementContext]);
  const assertReplacementCurrent = useCallback(() => {
    if (!isReplacementCurrent()) {
      throw new DOMException("Quotation replacement context changed.", "AbortError");
    }
  }, [isReplacementCurrent]);
  const assertCurrent = isReplacementAuthCurrent ? assertReplacementCurrent : undefined;
  const headers = useMemo(() => lockedHeaders ?? options.headers, [lockedHeaders, options.headers]);
  const partialHeaderConflict = Boolean(partialHeader
    && write.writeError?.code === "TRADE.CONCURRENCY.STALE_VERSION");

  const rememberConfirmed = useCallback((known: QuotationDetail) => {
    setSavedQuotation(known);
    setPartialHeader(null);
    setIsDetailsCurrent(false);
    setDetailsError(null);
  }, []);
  const loadDetails = useCallback(async (known: QuotationDetail, scope: Record<string, string>) => {
    if (!isReplacementCurrent()) return;
    rememberConfirmed(known);
    try {
      const response = await tradeGet(tradeDocumentPath(QUOTATIONS_PATH, known.id), {
        headers: scope, maxResponseBytes: TRADE_DOCUMENT_RESPONSE_BYTES, assertCurrent,
      });
      if (!isReplacementCurrent()) return;
      const detail = scopedQuotationDetail(response.data, known);
      setSavedQuotation(detail);
      setIsDetailsCurrent(true);
      await onSaved?.(detail);
    } catch (error) {
      // A read failure cannot erase a confirmed write or invent a new header version.
      if (isReplacementCurrent()) setDetailsError(normalizeApiError(error));
    }
  }, [assertCurrent, isReplacementCurrent, onSaved, rememberConfirmed]);

  const save = useCallback(async (
    create: CreateQuotationRequest | null, revision: QuotationRevisionInput | null,
  ) => {
    if (active.current || write.isBlocked || savedQuotation || replacementReconciliation?.kind === "confirmed" || !options.isEnabled
      || (!partialHeader && !options.canCreate) || (revision !== null && !options.canUpdate)) return false;
    const canWriteReplacement = () => isReplacementCurrent() && liveReplacement.current?.canUpdate === true;
    if (replacementSource && (!revision || !canWriteReplacement()
      || (!partialHeader && !liveReplacement.current?.canCreate))) return false;
    let confirmedHeader = partialHeader;
    let known: QuotationDetail | null = null;
    let uncertain = false;
    let createKey: string | undefined;
    let reconcileOnly = false;
    const assertReplacementWrite = (requiresCreate: boolean) => {
      const canUpdate = canWriteReplacement();
      // Once the original context is lost, recover a possibly committed
      // collection receipt without continuing to the revision.
      if (requiresCreate && !canUpdate) reconcileOnly = true;
      if (!canUpdate || (requiresCreate && !liveReplacement.current?.canCreate)) {
        throw new DOMException("Quotation replacement write access changed.", "AbortError");
      }
    };
    const scope = { ...headers };
    setLockedHeaders(scope);
    active.current = true;
    try {
      if (replacementSource && !confirmedHeader) {
        setSavingStep("header");
        setDetailsError(null);
        setReplacementStorageError(false);
        try {
          const response = await tradeGet(tradeDocumentPath(QUOTATIONS_PATH, replacementSource.quotationId), {
            headers: scope, maxResponseBytes: TRADE_DOCUMENT_RESPONSE_BYTES, assertCurrent,
          });
          if (!canWriteReplacement()) return false;
          const source = parseQuotationDetail(response.data);
          if (source.id !== replacementSource.quotationId || source.version !== replacementSource.version
            || !matchesReplacementCustomer(source, replacementSource, scope)
            || source.customerEligibilitySource !== "CRM_PROFILE"
            || source.lifecycleStatus !== "DRAFT" || source.documentNumber || source.currentRevisionId
            || source.acceptedRevisionId || source.revisions.length || source.currentLines.length || source.contactPartyId) {
            throw new Error("QUOTATION_REPLACEMENT_SOURCE_CHANGED");
          }
        } catch (error) {
          if (isReplacementCurrent()) setDetailsError(normalizeApiError(error));
          return false;
        }
        if (!liveReplacement.current?.canCreate || !replacementActorId || !replacementHandoffId || !create) return false;
        if (consumedReplacement.current !== replacementHandoffId
          && readQuotationHandoff(replacementActorId, scope, replacementSource.quotationId)?.replacementHandoffId !== replacementHandoffId) {
          setReplacementStorageError(true);
          return false;
        }
        const remembered = rememberQuotationReplacementCreate(replacementActorId, scope, replacementSource.quotationId, create);
        if (!remembered) {
          setReplacementStorageError(true);
          return false;
        }
        if (!remembered.matches) {
          setReplacementReconciliation({ key: remembered.key, kind: "mismatch" });
          return false;
        }
        setReplacementReconciliation(null);
        createKey = remembered.key;
        if (remembered.first) mountedCreateKey.current = createKey;
        reconcileOnly = mountedCreateKey.current !== createKey;
        if (consumedReplacement.current !== replacementHandoffId) {
          if (!consumeQuotationReplacement(replacementActorId, scope, replacementSource.quotationId, replacementHandoffId)) {
            setReplacementStorageError(true);
            return false;
          }
          consumedReplacement.current = replacementHandoffId;
        }
      }
      if (confirmedHeader && revision === null) {
        await loadDetails({ ...confirmedHeader, revisions: [], currentLines: [] }, scope);
        return true;
      }
      const completed = await write.runWrite({
        operation: reconcileOnly ? t.quotationExperience.replacementRecoverTitle : t.tradeDocuments.quotations.saveQuotation,
        idempotencyKey: createKey,
        canRetry: replacementSource ? () => canWriteReplacement()
          && (confirmedHeader !== null || liveReplacement.current?.canCreate === true) : undefined,
        send: async (idempotency) => {
          try {
          if (replacementSource && !canWriteReplacement()) {
            throw new Error("QUOTATION_REPLACEMENT_CONTEXT_CHANGED");
          }
          // One retained intent spans both independent commands. Route/operation identity
          // separates their keys; replay resumes at the last confirmed command.
          let response;
          if (!confirmedHeader) {
            if (!create) throw new Error("QUOTATION_FORM_CUSTOMER");
            if (replacementSource && !liveReplacement.current?.canCreate) throw new Error("QUOTATION_REPLACEMENT_CREATE_UNAVAILABLE");
            setSavingStep("header");
            response = await tradePost(QUOTATIONS_PATH, create, {
              headers: { ...scope, ...idempotency }, maxResponseBytes: TRADE_ACTION_RESPONSE_BYTES,
              assertCurrent: replacementSource ? () => assertReplacementWrite(true) : undefined,
            });
            const created = parseQuotation(response.data);
            if (replacementSource && (created.id === replacementSource.quotationId || created.lifecycleStatus !== "DRAFT"
              || created.currentRevisionId || created.currencyCode !== create.currencyCode
              || !matchesReplacementCustomer(created, replacementSource, scope))) {
              throw new Error("QUOTATION_REPLACEMENT_HEADER_MISMATCH");
            }
            if (replacementSource && createKey && (reconcileOnly || !canWriteReplacement())) {
              setReplacementReconciliation({ key: createKey, kind: "confirmed", quotationId: created.id });
              reconcileOnly = true;
              return response;
            }
            confirmedHeader = created;
            setPartialHeader(confirmedHeader);
          }
          const header = confirmedHeader;
          known = { ...header, revisions: [], currentLines: [] };
          if (revision) {
            if (replacementSource && !canWriteReplacement()) {
              throw new Error("QUOTATION_REPLACEMENT_CONTEXT_CHANGED");
            }
            if (replacementSource && !matchesReplacementCustomer(header, replacementSource, scope)) {
              throw new Error("QUOTATION_REPLACEMENT_HEADER_MISMATCH");
            }
            setSavingStep("revision");
            response = await tradePost(tradeDocumentActionPath(QUOTATIONS_PATH, header.id, "revisions"), revision, {
              headers: { ...scope, ...idempotency, "if-match": tradeIfMatch(header.version) },
              maxResponseBytes: TRADE_ACTION_RESPONSE_BYTES,
              assertCurrent: replacementSource ? () => assertReplacementWrite(false) : undefined,
            });
            const committed = parseQuotationRevisionResult(response.data);
            known = { ...header, currentRevisionId: committed.revision.id,
              grandTotal: committed.revision.grandTotal,
              revisions: [committed.revision], currentLines: committed.lines };
          }
          if (!response) throw new Error("QUOTATION_WRITE_NOT_EXECUTED");
          return response;
          } catch (error) {
            if (replacementSource && !confirmedHeader && !isReplacementCurrent()) reconcileOnly = true;
            uncertain = requiresSameKeyRecovery(normalizeApiError(error));
            throw error;
          }
        },
        onSuccess: async () => {
          if (known) {
            if (isReplacementCurrent()) await loadDetails(known, scope);
            else if (known.currentRevisionId) rememberConfirmed(known);
          }
          setSavingStep("idle");
        },
      });
      return completed && !reconcileOnly && isReplacementCurrent();
    } finally {
      active.current = false;
      setSavingStep("idle");
      if (!confirmedHeader && !uncertain) setLockedHeaders(null);
    }
  }, [assertCurrent, headers, isReplacementCurrent, loadDetails, options.canCreate, options.canUpdate, options.isEnabled, rememberConfirmed,
    replacementSource, replacementActorId, replacementHandoffId, replacementReconciliation,
    partialHeader, savedQuotation, t.quotationExperience.replacementRecoverTitle, t.tradeDocuments.quotations.saveQuotation, write]);

  const canSendSaved = Boolean(savedQuotation && isDetailsCurrent && options.canSend
    && savedQuotation.lifecycleStatus === "DRAFT" && savedQuotation.currentRevisionId
    && !write.isBlocked && savingStep === "idle");
  const sendSaved = useCallback(async () => {
    if (!savedQuotation || !canSendSaved || active.current || !isReplacementCurrent()) return;
    const known = savedQuotation;
    const scope = { ...headers };
    active.current = true;
    setSavingStep("sending");
    let confirmed: Quotation | null = null;
    try {
      await write.runWrite({
        operation: t.tradeDocuments.quotations.send,
        send: async (idempotency) => {
          const response = await tradePost(tradeDocumentActionPath(QUOTATIONS_PATH, known.id, "send"), undefined, {
            headers: { ...scope, ...idempotency, "if-match": tradeIfMatch(known.version) },
            maxResponseBytes: TRADE_ACTION_RESPONSE_BYTES, assertCurrent,
          });
          confirmed = parseQuotation(response.data);
          return response;
        },
        onSuccess: async () => {
          if (confirmed) await loadDetails({ ...known, ...confirmed }, scope);
          setSavingStep("idle");
        },
      });
    } finally { active.current = false; setSavingStep("idle"); }
  }, [assertCurrent, canSendSaved, headers, isReplacementCurrent, loadDetails, savedQuotation, t.tradeDocuments.quotations.send, write]);
  const reloadSavedDetails = useCallback(async () => {
    if (active.current || write.isBlocked || (!savedQuotation && !partialHeader) || !isReplacementCurrent()) return;
    active.current = true;
    setIsReloadingDetails(true);
    try {
      if (savedQuotation) {
        await loadDetails(savedQuotation, headers);
        return;
      }
      if (!partialHeader) return;
      setDetailsError(null);
      try {
        const response = await tradeGet(tradeDocumentPath(QUOTATIONS_PATH, partialHeader.id), {
          headers, maxResponseBytes: TRADE_DOCUMENT_RESPONSE_BYTES, assertCurrent,
        });
        if (!isReplacementCurrent()) return;
        const detail = scopedQuotationDetail(response.data, partialHeader);
        if (replacementSource && !matchesReplacementCustomer(detail, replacementSource, headers)) {
          throw new Error("QUOTATION_REPLACEMENT_HEADER_MISMATCH");
        }
        // Reviewing the server version must not reset the caller's unsaved lines.
        if (detail.lifecycleStatus === "DRAFT") setPartialHeader(detail);
        else {
          setSavedQuotation(detail); setPartialHeader(null); setIsDetailsCurrent(true);
          await onSaved?.(detail);
        }
        write.clearWriteError();
      } catch (error) {
        if (isReplacementCurrent()) setDetailsError(normalizeApiError(error));
      }
    } finally { active.current = false; setIsReloadingDetails(false); }
  }, [assertCurrent, headers, isReplacementCurrent, loadDetails, onSaved, partialHeader, replacementSource, savedQuotation, write]);
  const restoreHeader = useCallback((header: Quotation | null, scope: Record<string, string> | null) => {
    setPartialHeader(header); setLockedHeaders(scope);
  }, []);
  const reset = useCallback(() => {
    if (write.isBlocked || active.current) return;
    setPartialHeader(null); setSavedQuotation(null); setLockedHeaders(null);
    setDetailsError(null); setIsDetailsCurrent(false); setSavingStep("idle");
    setReplacementStorageError(false);
    setReplacementReconciliation(null);
    write.clearWriteError();
  }, [write]);

  return { partialHeader, savedQuotation, lockedHeaders, detailsError, isDetailsCurrent,
    replacementStorageError, replacementReconciliation,
    replacementRetryBlocked: Boolean(replacementSource && write.ambiguous
      && (!replacementContext || !options.canUpdate || (!partialHeader && !options.canCreate))),
    partialHeaderConflict, isReloadingDetails,
    savingStep, write, save, canSendSaved, sendSaved, reloadSavedDetails, restoreHeader, reset };
}

function matchesReplacementCustomer(header: Quotation, source: QuotationReplacementSource, headers: Record<string, string>): boolean {
  return header.partyId === source.partyId && header.crmCustomerProfileId === source.crmCustomerProfileId
    && header.companyId === headers[COMPANY_SCOPE_HEADER] && header.branchId === headers[BRANCH_SCOPE_HEADER]
    && (header.channelId ?? null) === (headers[CHANNEL_SCOPE_HEADER] ?? null);
}

function scopedQuotationDetail(payload: unknown, known: Quotation): QuotationDetail {
  const detail = parseQuotationDetail(payload);
  if (detail.id !== known.id || detail.companyId !== known.companyId || detail.branchId !== known.branchId) {
    throw new Error("QUOTATION_DETAIL_SCOPE_MISMATCH");
  }
  return detail;
}

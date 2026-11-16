"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { BRANCH_SCOPE_HEADER, COMPANY_SCOPE_HEADER } from "@/lib/api/organization-scope";
import { CHANNEL_SCOPE_HEADER, tradePost, tradeIfMatch } from "../../trade-api";
import {
  TRADE_ACTION_RESPONSE_BYTES,
  partyDisplayName,
  tradeDocumentActionPath,
} from "../../documents/trade-document-contract";
import { useTradeLineDraft, type TradeLineDraftState } from "../../documents/hooks/useTradeLineDraft";
import { useTradeWrite, type TradeWriteState } from "../../documents/hooks/useTradeWrite";
import { QUOTATIONS_PATH, type QuotationDetail } from "../quotation-contract";
import { defaultQuotationDiscount, type QuotationDiscountDraft } from "../quotation-discount-draft";
import { defaultQuotationFields, hasQuotationScope, quotationScope, quotationScopeKey,
  validQuotationDate, writeQuotationHandoff } from "../quotation-composer-draft";
import { buildSanitizedQuotationTerms, hydrateQuotationWorkspace, quotationScopedHeaders } from "../quotation-workspace-hydration";
import { useQuotationPricing, type QuotationPricingState } from "./useQuotationPricing";

export interface QuotationRevisionState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  validUntil: string;
  setValidUntil: (value: string) => void;
  paymentTermCode: string;
  setPaymentTermCode: (value: string) => void;
  incotermCode: string;
  setIncotermCode: (value: string) => void;
  deliveryDays: string;
  setDeliveryDays: (value: string) => void;
  warrantyMonths: string;
  setWarrantyMonths: (value: string) => void;
  deliveryDaysError?: string;
  warrantyMonthsError?: string;
  lineDraft: TradeLineDraftState;
  write: TradeWriteState;
  canSubmit: boolean;
  submit: () => Promise<void>;
  pricing: QuotationPricingState;
  headers: Record<string, string>;
  partyId: string | null;
  requiresSupersedeConfirmation: boolean;
  supersedeConfirmed: boolean;
  setSupersedeConfirmed: (value: boolean) => void;
  sourceChanged: boolean;
  canPrepareReplacement: boolean;
  prepareReplacement: () => void;
  replacementHandoffFailed: boolean;
}

function parseTermInteger(input: string, blankDefault: number): number | null {
  const value = input.trim();
  if (value === "") return blankDefault;
  if (!/^[0-9]+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function useQuotationRevision(
  quotation: QuotationDetail | null,
  headers: Record<string, string>,
  onCreated: () => Promise<unknown>,
  options: { canSupersede?: boolean; replacementActorId?: string | null; onReplacementReady?: (quotationId: string) => void } = {},
): QuotationRevisionState {
  const { t } = useI18n();
  const write = useTradeWrite();
  const [isOpen, setIsOpen] = useState(false);
  const [openedContext, setOpenedContext] = useState<string | null>(null);
  const [replacementHandoffFailed, setReplacementHandoffFailed] = useState(false);
  const replacementOpening = useRef(false);
  const submitting = useRef(false);
  const [supersedeConfirmed, setSupersedeConfirmed] = useState(false);
  const [validUntil, setValidUntil] = useState("");
  const [paymentTermCode, setPaymentTermCode] = useState("NET_30");
  const [incotermCode, setIncotermCode] = useState("EXW");
  const [deliveryDays, setDeliveryDays] = useState("14");
  const [warrantyMonths, setWarrantyMonths] = useState("12");
  const [extraTerms, setExtraTerms] = useState<Record<string, unknown>>({});
  const [discount, setDiscount] = useState(defaultQuotationDiscount);
  const [priceBooksByLineId, setPriceBooksByLineId] = useState<Record<string, string>>({});

  const effectiveHeaders = useMemo(
    () => (quotation?.companyId && quotation?.branchId ? quotationScopedHeaders(quotation) : headers),
    [headers, quotation],
  );
  const parsedDeliveryDays = parseTermInteger(deliveryDays, 14);
  const parsedWarrantyMonths = parseTermInteger(warrantyMonths, 12);
  const termsReady = parsedDeliveryDays !== null && parsedWarrantyMonths !== null;
  const requiresSupersedeConfirmation = quotation?.lifecycleStatus === "SENT";
  const statusAllowed = quotation?.lifecycleStatus === "DRAFT" || (requiresSupersedeConfirmation && options.canSupersede === true);
  const contextKey = JSON.stringify([quotation?.id, quotation?.version, quotation?.partyId, quotation?.crmCustomerProfileId,
    options.replacementActorId, quotationScopeKey(effectiveHeaders)]);
  const sourceChanged = isOpen && openedContext !== contextKey;

  const lineDraft = useTradeLineDraft(
    effectiveHeaders,
    quotation?.currencyCode ?? "",
    quotation?.partyId ?? null,
    "SALES",
    isOpen && !sourceChanged,
    true,
    false,
  );
  const updateDiscount = useCallback((change: (current: QuotationDiscountDraft) => QuotationDiscountDraft) => {
    if (!write.isBlocked) setDiscount(change);
  }, [write.isBlocked]);
  const pricing = useQuotationPricing({
    draft: discount, update: updateDiscount, headers: effectiveHeaders,
    currencyCode: quotation?.currencyCode ?? "", partyId: quotation?.partyId ?? null,
    crmCustomerProfileId: quotation?.crmCustomerProfileId,
    contextKey: JSON.stringify([quotation?.id, quotation?.partyId, Object.entries(effectiveHeaders).sort()]),
    lines: lineDraft.lines, priceBooksByLineId,
    enabled: isOpen && !sourceChanged && Boolean(quotation), locked: write.isBlocked,
    stale: write.writeError?.code === "TRADE.QUOTE.PRICING_CHANGED", writeError: write.writeError,
    clearWriteError: write.clearWriteError,
  });

  const linesReady =
    lineDraft.invalidLineIndex === null &&
    lineDraft.lines.every((line) => line.itemId !== "" && line.uomId !== "");

  const displayName = quotation ? partyDisplayName(quotation.partySnapshot ?? {}) : null;
  const canPrepareReplacement = Boolean(quotation && options.replacementActorId && options.onReplacementReady
    && isOpen && !sourceChanged && !write.isBlocked && openedContext === contextKey && hasQuotationScope(effectiveHeaders)
    && quotation.companyId === effectiveHeaders[COMPANY_SCOPE_HEADER] && quotation.branchId === effectiveHeaders[BRANCH_SCOPE_HEADER]
    && (quotation.channelId ?? null) === (effectiveHeaders[CHANNEL_SCOPE_HEADER] ?? null)
    && quotation.lifecycleStatus === "DRAFT" && !quotation.documentNumber && !quotation.currentRevisionId
    && !quotation.acceptedRevisionId && quotation.revisions.length === 0 && quotation.currentLines.length === 0
    && quotation.customerEligibilitySource === "CRM_PROFILE" && quotation.crmCustomerProfileId && displayName
    && !quotation.contactPartyId && lineDraft.lines.some((line) => line.itemId !== "")
    && write.writeError?.status === 409 && write.writeError.code === "TRADE.PRICE.MARGIN_GUARD");

  function prepareReplacement() {
    if (submitting.current || replacementOpening.current || !canPrepareReplacement || !quotation?.crmCustomerProfileId
      || !displayName || !options.replacementActorId) return;
    const ids = new Set(lineDraft.lines.map((line) => line.itemId));
    const stored = writeQuotationHandoff(options.replacementActorId, {
      ...defaultQuotationFields(), scope: quotationScope(effectiveHeaders), partialHeader: null,
      replacementSource: { quotationId: quotation.id, version: quotation.version, partyId: quotation.partyId,
        crmCustomerProfileId: quotation.crmCustomerProfileId, displayName },
      currencyCode: quotation.currencyCode, draftReference: quotation.draftReference ?? "",
      validUntil, paymentTermCode, incotermCode, deliveryDays, warrantyMonths, discount,
      lineDraft: { lines: lineDraft.lines, items: Object.values(lineDraft.itemsById).filter((item) => ids.has(item.id)),
        uomsByItem: Object.fromEntries(Object.entries(lineDraft.uomsByItem).filter(([id]) => ids.has(id))) },
    });
    setReplacementHandoffFailed(!stored);
    if (stored) {
      replacementOpening.current = true;
      options.onReplacementReady?.(quotation.id);
    }
  }

  const submit = useCallback(async (): Promise<void> => {
    if (submitting.current || replacementOpening.current || !quotation || !isOpen || !statusAllowed || sourceChanged
      || (requiresSupersedeConfirmation && !supersedeConfirmed)
      || !linesReady || !validQuotationDate(validUntil) || write.isBlocked || !termsReady || !pricing.ready) return;
    submitting.current = true;
    try {
      await write.runWrite({
        operation: t.tradeDocuments.quotations.newRevision,
        send: (idempotency) =>
          tradePost(
            tradeDocumentActionPath(QUOTATIONS_PATH, quotation.id, "revisions"),
            {
              validUntil,
              lines: pricing.request!.lines,
              pricing: pricing.request!.pricing,
              expectedPricingFingerprint: pricing.preview.calculation!.fingerprint,
              terms: buildSanitizedQuotationTerms({
                paymentTermCode,
                incotermCode,
                deliveryDays: parsedDeliveryDays,
                warrantyMonths: parsedWarrantyMonths,
                extraTerms,
              }),
            },
            {
              headers: { ...effectiveHeaders, ...idempotency, "if-match": tradeIfMatch(quotation.version) },
              maxResponseBytes: TRADE_ACTION_RESPONSE_BYTES,
            },
          ),
        onSuccess: async () => {
          setIsOpen(false);
          await onCreated();
        },
      });
    } finally {
      submitting.current = false;
    }
  }, [
    quotation, isOpen, statusAllowed, sourceChanged, requiresSupersedeConfirmation, supersedeConfirmed,
    linesReady, validUntil, paymentTermCode, incotermCode, parsedDeliveryDays, parsedWarrantyMonths,
    extraTerms, termsReady, write, t, pricing, effectiveHeaders, onCreated,
  ]);

  return {
    isOpen,
    open: () => {
      if (write.isBlocked || submitting.current || isOpen) return;
      const hasPersistedRevision = Boolean(quotation?.currentRevisionId && Array.isArray(quotation.revisions) && Array.isArray(quotation.currentLines));
      if (hasPersistedRevision && quotation && openedContext !== contextKey) {
        const hydrated = hydrateQuotationWorkspace(quotation, "");
        if (typeof lineDraft.restore === "function") {
          lineDraft.restore({ lines: hydrated.lines, items: [], uomsByItem: {} });
        }
        setValidUntil(hydrated.validUntil);
        setPaymentTermCode(hydrated.terms.paymentTermCode);
        setIncotermCode(hydrated.terms.incotermCode);
        setDeliveryDays(hydrated.terms.deliveryDays);
        setWarrantyMonths(hydrated.terms.warrantyMonths);
        setExtraTerms(hydrated.terms.extraTerms);
        setDiscount(hydrated.discount);
        setPriceBooksByLineId(hydrated.priceBooksByLineId);
      } else if (openedContext !== null && openedContext !== contextKey) {
        const defaults = defaultQuotationFields();
        if (typeof lineDraft.reset === "function") lineDraft.reset([]);
        setValidUntil("");
        setPaymentTermCode(defaults.paymentTermCode);
        setIncotermCode(defaults.incotermCode);
        setDeliveryDays(defaults.deliveryDays);
        setWarrantyMonths(defaults.warrantyMonths);
        setExtraTerms({});
        setDiscount(defaults.discount);
        setPriceBooksByLineId({});
      }
      replacementOpening.current = false;
      setOpenedContext(contextKey);
      if (options.replacementActorId) write.clearWriteError();
      setReplacementHandoffFailed(false);
      setSupersedeConfirmed(false);
      setIsOpen(true);
    },
    close: () => {
      if (write.isBlocked || submitting.current) return;
      setIsOpen(false);
    },
    validUntil, setValidUntil, paymentTermCode, setPaymentTermCode, incotermCode, setIncotermCode,
    deliveryDays, setDeliveryDays, warrantyMonths, setWarrantyMonths,
    deliveryDaysError: parsedDeliveryDays === null ? t.tradeDocuments.executive.revisionTermIntegerInvalid : undefined,
    warrantyMonthsError: parsedWarrantyMonths === null ? t.tradeDocuments.executive.revisionTermIntegerInvalid : undefined,
    lineDraft, pricing, headers: effectiveHeaders, partyId: quotation?.partyId ?? null,
    requiresSupersedeConfirmation, supersedeConfirmed, sourceChanged,
    canPrepareReplacement, prepareReplacement, replacementHandoffFailed,
    setSupersedeConfirmed: (value) => { if (!write.isBlocked) setSupersedeConfirmed(value); },
    write,
    canSubmit: isOpen && statusAllowed && !sourceChanged && (!requiresSupersedeConfirmation || supersedeConfirmed)
      && linesReady && validQuotationDate(validUntil) && !write.isBlocked && termsReady && pricing.ready,
    submit,
  };
}

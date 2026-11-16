"use client";

import { useCallback, useMemo, useState } from "react";
import type { NormalizedApiError } from "@/lib/api/errors";
import type { TradeLineDraft } from "../../documents/hooks/useTradeLineDraft";
import { buildQuotationPricingRequest, type QuotationDiscountDraft } from "../quotation-discount-draft";
import { useQuotationDiscount } from "./useQuotationDiscount";
import { useQuotationDiscountLimits } from "./useQuotationDiscountLimits";
import { useQuotationDiscountPolicy } from "./useQuotationDiscountPolicy";
import { useQuotationPricingPreview } from "./useQuotationPricingPreview";

interface PricingOptions {
  draft: QuotationDiscountDraft;
  update: (change: (current: QuotationDiscountDraft) => QuotationDiscountDraft) => void;
  headers: Record<string, string>; currencyCode: string; partyId: string | null;
  crmCustomerProfileId?: string | null; contextKey: string; lines: TradeLineDraft[];
  priceBooksByLineId?: Readonly<Record<string, string>>; blockedLines?: boolean;
  enabled: boolean; locked: boolean; stale: boolean; clearWriteError: () => void;
  writeError?: NormalizedApiError | null;
}

/** Shared by first revision and later revisions; the server owns every amount. */
export function useQuotationPricing(options: PricingOptions) {
  const { draft, update, headers, enabled, locked } = options;
  const discount = useQuotationDiscount({ draft, update, contextKey: options.contextKey,
    currencyCode: options.currencyCode, lineIds: options.lines.map((line) => line.clientLineId),
    enabled: enabled && Boolean(options.partyId && options.currencyCode), locked });
  const policy = useQuotationDiscountPolicy(headers, enabled);
  const request = buildQuotationPricingRequest(draft, options.lines, options.partyId, options.currencyCode,
    options.crmCustomerProfileId, { priceBooksByLineId: options.priceBooksByLineId, blocked: options.blockedLines });
  const requestKey = JSON.stringify(request);
  const [rejection, setRejection] = useState<{ error: NormalizedApiError; requestKey: string } | null>(null);
  const error = options.writeError ?? null;
  if (error && rejection?.error !== error) setRejection({ error, requestKey });
  const writeError = error && (rejection?.error !== error || rejection.requestKey === requestKey) ? error : null;
  const pricingRejected = writeError?.code === "TRADE.QUOTE.PRICING_CHANGED" || writeError?.code?.startsWith("TRADE.QUOTE.DISCOUNT_") === true;
  const permitted = draft.mode !== "DISCOUNT" || policy.policy?.canApply === true;
  const preview = useQuotationPricingPreview({ request, headers,
    enabled: enabled && permitted, stale: pricingRejected || (options.stale && error === null) });
  const refresh = useCallback(() => { options.clearWriteError(); policy.retry(); preview.retry(); }, [options, policy, preview]);
  const limits = useQuotationDiscountLimits(headers, enabled && policy.policy?.canManage === true, refresh);
  const byLineId = useMemo(() => Object.fromEntries((preview.calculation?.lines ?? []).map((line) => [line.clientLineId, line])), [preview.calculation]);
  return { discount, policy, preview, limits, request,
    ready: request !== null && permitted && preview.ready,
    byLineId, writeError, refresh };
}
export type QuotationPricingState = ReturnType<typeof useQuotationPricing>;

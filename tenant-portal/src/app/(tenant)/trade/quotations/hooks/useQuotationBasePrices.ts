"use client";

import { isUUIDv7 } from "@/lib/uuid";
import { multiplyFixedDecimal, sumFixedDecimals } from "../../documents/fixed-decimal";
import { useTradeDocumentPricing } from "../../documents/hooks/useTradeDocumentPricing";
import type { TradeLineDraft } from "../../documents/hooks/useTradeLineDraft";
import { canonicalTradeQuantity } from "../../documents/trade-line-validation";
import { hasQuotationScope } from "../quotation-composer-draft";

export function useQuotationBasePrices({ headers, currencyCode, lines, enabled }: {
  headers: Record<string, string>;
  currencyCode: string;
  lines: readonly Pick<TradeLineDraft, "clientLineId" | "itemId" | "uomId" | "quantity">[];
  enabled: boolean;
}) {
  const shouldLoad = enabled && hasQuotationScope(headers);
  const inputs = shouldLoad ? lines.flatMap(({ clientLineId, itemId, uomId, quantity: input }) => {
    const quantity = canonicalTradeQuantity(input);
    return quantity !== null && isUUIDv7(itemId) && isUUIDv7(uomId)
      ? [{ clientLineId, itemId, uomId, quantity }] : [];
  }) : [];
  const pricing = useTradeDocumentPricing({
    headers, currencyCode, lines: inputs, partyId: null, purpose: "SALES",
    enabled: shouldLoad, useBasePrice: true,
  });
  const byLineId = Object.fromEntries(inputs.map((line, index) => {
    const price = pricing.prices[index];
    const unitPrice = price?.unitPrice ?? null;
    return [line.clientLineId, {
      unitPrice,
      lineAmount: unitPrice === null ? null : multiplyFixedDecimal(line.quantity, unitPrice),
      loading: price?.isPricing ?? false,
      unavailable: Boolean(price?.error),
    }];
  }));
  const subtotal = pricing.ready && inputs.length === lines.length
    ? sumFixedDecimals(Object.values(byLineId).map(({ lineAmount }) => lineAmount!)) : null;
  return { byLineId, subtotal, retry: pricing.retry };
}

export type QuotationBasePrices = ReturnType<typeof useQuotationBasePrices>;

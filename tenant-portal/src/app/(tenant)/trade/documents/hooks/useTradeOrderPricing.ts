"use client";

import { computeTradeEvidence, type TradeEvidenceLineDraft } from "../lib/trade-financial-evidence";
import type { TradePricePurpose } from "../trade-lookup-contract";
import { useTradeDocumentPricing } from "./useTradeDocumentPricing";

export function useTradeOrderPricing(
  headers: Record<string, string>,
  currencyCode: string,
  partyId: string,
  purpose: TradePricePurpose,
  drafts: TradeEvidenceLineDraft[],
  enabled: boolean,
) {
  const result = useTradeDocumentPricing({
    headers,
    currencyCode: currencyCode.trim().toUpperCase(),
    partyId: partyId.trim(),
    purpose,
    lines: drafts.map((line) => ({
      clientLineId: line.id,
      itemId: line.itemId.trim(),
      uomId: line.uomCode.trim(),
      quantity: line.quantity.trim(),
    })),
    enabled,
  });
  const lines = drafts.map((line, index) => ({
    ...line,
    unitPrice: result.prices[index]?.unitPrice ?? "",
  }));
  const evidence = result.ready ? computeTradeEvidence(lines, { dialect: "ORDER", currencyCode }) : null;
  return {
    lines,
    pricing: { ready: result.ready, error: result.prices.find((price) => price.error)?.error ?? null },
    computed: evidence?.ok ? evidence : null,
  };
}

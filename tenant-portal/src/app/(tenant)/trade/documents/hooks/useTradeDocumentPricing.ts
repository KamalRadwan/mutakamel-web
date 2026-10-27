"use client";

import { useEffect, useMemo, useState } from "react";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import { tradePost } from "../../trade-api";
import { NON_NEGATIVE_DECIMAL, POSITIVE_DECIMAL } from "../fixed-decimal";
import { tradeInvalidResponse } from "../trade-document-contract";
import {
  TRADE_LOOKUP_RESPONSE_BYTES,
  TRADE_PRICING_EVALUATE_PATH,
  parseTradePriceDecision,
  type TradePricePurpose,
} from "../trade-lookup-contract";

interface PricingLine {
  clientLineId: string;
  itemId: string;
  uomId: string;
  quantity: string;
}

interface LinePrice {
  unitPrice: string | null;
  error: NormalizedApiError | null;
}

interface PricingQuery {
  headers: Record<string, string>;
  currencyCode: string;
  partyId: string | null;
  purpose: TradePricePurpose;
  lines: PricingLine[];
  enabled: boolean;
}

/** PricingEvaluateDto has no client-authoritative price override. */
export function useTradeDocumentPricing(query: PricingQuery) {
  const [settled, setSettled] = useState<{ request: object; prices: LinePrice[] } | null>(null);
  // Include scope and raw inputs: a render after an edit must invalidate old
  // evidence immediately, before the next effect or a late response runs.
  const key = JSON.stringify({
    ...query,
    headers: Object.fromEntries(Object.entries(query.headers).sort(([a], [b]) => a.localeCompare(b))),
  });
  const request = useMemo(() => ({ key }), [key]);
  const valid = query.enabled && /^[A-Z]{3}$/u.test(query.currencyCode) &&
    (query.partyId === null || isUUIDv7(query.partyId)) && query.lines.length > 0 &&
    query.lines.every((line) => isUUIDv7(line.itemId) && isUUIDv7(line.uomId) &&
      POSITIVE_DECIMAL.test(line.quantity));

  useEffect(() => {
    if (!valid) return;
    const current: PricingQuery = JSON.parse(request.key);
    const controller = new AbortController();
    // Debounce typing without leaving the previous price available to submit.
    const timer = setTimeout(() => {
      void Promise.all(current.lines.map(async (line): Promise<LinePrice> => {
        try {
          const response = await tradePost(TRADE_PRICING_EVALUATE_PATH, {
            purpose: current.purpose,
            partyId: current.partyId ?? undefined,
            itemId: line.itemId,
            uomId: line.uomId,
            quantity: line.quantity,
            currencyCode: current.currencyCode,
          }, {
            headers: current.headers,
            signal: controller.signal,
            maxResponseBytes: TRADE_LOOKUP_RESPONSE_BYTES,
          });
          const decision = parseTradePriceDecision(response.data);
          if (decision.currencyCode !== current.currencyCode || !NON_NEGATIVE_DECIMAL.test(decision.unitPrice)) {
            tradeInvalidResponse();
          }
          return { unitPrice: decision.unitPrice, error: null };
        } catch (error) {
          return { unitPrice: null, error: normalizeApiError(error) };
        }
      })).then((prices) => {
        if (!controller.signal.aborted) setSettled({ request, prices });
      });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [request, valid]);

  const prices = valid && settled?.request === request ? settled.prices : null;
  return {
    prices: query.lines.map((_, index) => ({
      unitPrice: prices?.[index]?.unitPrice ?? null,
      error: prices?.[index]?.error ?? null,
      isPricing: valid && prices === null,
    })),
    ready: valid && prices !== null && prices.every((price) => price.unitPrice !== null),
  };
}

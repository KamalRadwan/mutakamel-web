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
  type TradePriceDecision,
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
  decision: TradePriceDecision | null;
  error: NormalizedApiError | null;
}

interface PricingQuery {
  headers: Record<string, string>;
  currencyCode: string;
  partyId: string | null;
  purpose: TradePricePurpose;
  lines: PricingLine[];
  enabled: boolean;
  useBasePrice?: boolean;
}

/** PricingEvaluateDto has no client-authoritative price override. */
export function useTradeDocumentPricing(query: PricingQuery) {
  const [settled, setSettled] = useState<{ request: object; prices: LinePrice[] } | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Include scope and raw inputs: a render after an edit must invalidate old
  // evidence immediately, before the next effect or a late response runs.
  const key = JSON.stringify({
    ...query,
    attempt,
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
      const evaluateLine = async (line: PricingLine): Promise<LinePrice> => {
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
            ...(current.useBasePrice ? { suppressForbiddenToast: true } : {}),
          });
          const decision = parseTradePriceDecision(response.data);
          const unitPrice = current.useBasePrice ? decision.baselineUnitPrice : decision.unitPrice;
          if (decision.currencyCode !== current.currencyCode || unitPrice === undefined || !NON_NEGATIVE_DECIMAL.test(unitPrice)) {
            tradeInvalidResponse();
          }
          return { unitPrice, decision, error: null };
        } catch (error) {
          return { unitPrice: null, decision: null, error: normalizeApiError(error) };
        }
      };
      void (async () => {
        const prices: LinePrice[] = [];
        // Advisory quotation prices use the per-line API and may have many items.
        const batchSize = current.useBasePrice ? 6 : current.lines.length;
        for (let offset = 0; offset < current.lines.length && !controller.signal.aborted; offset += batchSize) {
          prices.push(...await Promise.all(current.lines.slice(offset, offset + batchSize).map(evaluateLine)));
        }
        if (!controller.signal.aborted) setSettled({ request, prices });
      })();
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [request, valid]);

  const prices = valid && settled?.request === request ? settled.prices : null;
  return {
    prices: query.lines.map((_, index) => ({
      unitPrice: prices?.[index]?.unitPrice ?? null,
      decision: prices?.[index]?.decision ?? null,
      error: prices?.[index]?.error ?? null,
      isPricing: valid && prices === null,
    })),
    ready: valid && prices !== null && prices.every((price) => price.unitPrice !== null),
    retry: () => setAttempt((value) => value + 1),
  };
}

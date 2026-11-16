"use client";

import { useEffect, useMemo, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import { tradePost } from "../../trade-api";
import { isTradeDecimal, TRADE_DOCUMENT_RESPONSE_BYTES } from "../../documents/trade-document-contract";
import { parseQuotationPricingCalculation, QUOTATION_PRICING_PREVIEW_PATH,
  type QuotationPricingCalculation, type QuotationPricingRequest } from "../quotation-discount-contract";

export interface QuotationPricingFailure extends NormalizedApiError {
  maxDiscountAmount?: string; maxDiscountPercent?: string; clientLineIds: string[];
}
function quotationPricingFailure(error: unknown): QuotationPricingFailure {
  return quotationPricingFailureDetails(normalizeApiError(error));
}
export function quotationPricingFailureDetails(result: NormalizedApiError): QuotationPricingFailure {
  const first = (key: string) => result.fieldErrors?.[key]?.[0];
  const amount = first("maxDiscountAmount");
  const percent = first("maxDiscountPercent");
  return { ...result, ...(isTradeDecimal(amount) && amount.length <= 40 ? { maxDiscountAmount: amount } : {}),
    ...(isTradeDecimal(percent) && percent.length <= 40 ? { maxDiscountPercent: percent } : {}),
    clientLineIds: (result.fieldErrors?.clientLineId ?? []).filter(isUUIDv7).slice(0, 1_000) };
}
interface PreviewOptions {
  request: QuotationPricingRequest | null; headers: Record<string, string>;
  enabled: boolean; stale?: boolean;
}

/** A preview is usable only for the exact actor, scope and complete pricing intent. */
export function useQuotationPricingPreview({ request: body, headers, enabled, stale = false }: PreviewOptions) {
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<{ key: object; calculation: QuotationPricingCalculation | null; error: QuotationPricingFailure | null } | null>(null);
  const key = JSON.stringify({ actor: user?.id ?? null, realtimeAuthGeneration, headers: Object.fromEntries(Object.entries(headers).sort()), body, attempt });
  const request = useMemo(() => ({ key }), [key]);
  const valid = enabled && body !== null && Boolean(user?.id);
  useEffect(() => {
    if (!valid) return;
    const current = JSON.parse(request.key) as { headers: Record<string, string>; body: QuotationPricingRequest };
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void tradePost(QUOTATION_PRICING_PREVIEW_PATH, current.body, { headers: current.headers,
        signal: controller.signal, maxResponseBytes: TRADE_DOCUMENT_RESPONSE_BYTES,
        suppressForbiddenToast: true, skipAutoIdempotency: true,
      }).then((response) => {
        const calculation = parseQuotationPricingCalculation(response.data, current.body);
        if (!controller.signal.aborted) setSettled({ key: request, calculation, error: null });
      }).catch((error: unknown) => {
        if (!controller.signal.aborted) setSettled({ key: request, calculation: null, error: quotationPricingFailure(error) });
      });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [request, valid]);
  const result = valid && settled?.key === request && !stale ? settled : null;
  return {
    calculation: result?.calculation ?? null,
    error: result?.error ?? null,
    loading: valid && result === null && !stale,
    ready: Boolean(result?.calculation),
    stale,
    retry: () => setAttempt((value) => value + 1),
  };
}

"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button, Money, PermissionGate } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { QuotationPricingState } from "../hooks/useQuotationPricing";
import { quotationPricingFailureDetails } from "../hooks/useQuotationPricingPreview";

export function QuotationPricingFeedback({ state, currencyCode }: { state: QuotationPricingState; currencyCode: string }) {
  const { t } = useI18n();
  const copy = t.quotationDiscount;
  const failure = state.preview.error ?? (state.writeError?.code?.startsWith("TRADE.QUOTE.DISCOUNT_")
    ? quotationPricingFailureDetails(state.writeError) : null);
  if (state.preview.stale && (!state.writeError || state.writeError.code === "TRADE.QUOTE.PRICING_CHANGED")) return <div role="alert" className="space-y-2 rounded-md border border-kpi-rated-line bg-kpi-rated-surface p-3 text-sm text-kpi-rated-text">
    <p className="font-medium">{copy.staleTitle}</p><p>{copy.staleDescription}</p>
    <Button variant="outline" size="sm" onClick={state.refresh}><RefreshCw className="size-4" aria-hidden="true" />{copy.recalculate}</Button>
  </div>;
  if (failure?.status === 403) return <PermissionGate require="trade.quotations.discount" denied>{null}</PermissionGate>;
  if (failure) {
    const descriptions: Record<string, string> = {
      "TRADE.QUOTE.DISCOUNT_INVALID": failure.fieldErrors?.value?.includes("CURRENCY_PRECISION") ? copy.currencyPrecision : copy.invalidDiscount,
      "TRADE.QUOTE.DISCOUNT_FLOOR_REQUIRED": copy.floorMissing,
      "TRADE.QUOTE.DISCOUNT_EXCEEDS_ALLOWED": copy.floorExceeded,
      "TRADE.QUOTE.DISCOUNT_REASON_REQUIRED": copy.reasonRequired,
      "TRADE.QUOTE.DISCOUNT_FREE_NOT_ALLOWED": copy.freeItemDenied,
      "TRADE.QUOTE.DISCOUNT_LIMIT_REQUIRED": copy.policyMissing,
    };
    return <div role="alert" className="space-y-2 rounded-md border border-destructive/25 bg-destructive/5 p-3 text-sm">
      <p className="flex items-start gap-2 text-destructive"><AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{descriptions[failure.code ?? ""] ?? copy.previewUnavailable}</p>
      {failure.maxDiscountAmount !== undefined ? <p>{copy.maximumAmount}: <Money value={failure.maxDiscountAmount} currency={currencyCode} maximumFractionDigits={8} /></p> : null}
      {failure.maxDiscountPercent !== undefined ? <p>{copy.maximumPercent}: <Money value={failure.maxDiscountPercent} maximumFractionDigits={8} />%</p> : null}
      <Button variant="outline" size="sm" onClick={state.refresh}><RefreshCw className="size-4" aria-hidden="true" />{copy.recalculate}</Button>
    </div>;
  }
  return state.preview.loading ? <p role="status" className="text-sm text-muted-foreground">{copy.previewPending}</p> : null;
}

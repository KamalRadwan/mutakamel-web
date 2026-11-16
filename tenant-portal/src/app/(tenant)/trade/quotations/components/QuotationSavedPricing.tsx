"use client";

import { Badge } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { QuotationRevision } from "../quotation-contract";
import { readQuotationSavedPricing } from "../quotation-discount-snapshots";
import { QuotationPricingTotals } from "./QuotationPricingTotals";

export function QuotationSavedPricing({ revision, currencyCode }: { revision: QuotationRevision; currencyCode: string }) {
  const { t } = useI18n();
  const copy = t.quotationDiscount;
  const saved = readQuotationSavedPricing(revision.discountSnapshot);
  const totals = saved?.totals ?? {
    subtotal: revision.subtotal,
    discountTotal: revision.discountTotal,
    grandTotal: revision.grandTotal,
    baseSubtotal: revision.subtotal,
    promotionSavings: revision.discountTotal,
  };
  return <section aria-label={copy.title} className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><Badge tone="neutral">{revision.pricingMode === "DISCOUNT" ? copy.discount : revision.pricingMode === "PROMOTIONS" ? copy.promotions : copy.none}</Badge><p className="text-xs text-muted-foreground">{copy.locked}</p></div>
    <QuotationPricingTotals totals={totals} mode={revision.pricingMode} currencyCode={currencyCode} />
    {saved?.pricing.reason ? <div className="space-y-1 rounded-md border border-border p-3 text-sm"><p className="text-xs text-muted-foreground">{copy.reason}</p><p className="whitespace-pre-wrap wrap-anywhere">{saved.pricing.reason}</p></div> : null}
  </section>;
}

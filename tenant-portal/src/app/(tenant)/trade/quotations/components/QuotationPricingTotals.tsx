"use client";

import { Money, cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { compareFixedDecimal } from "../../documents/fixed-decimal";
import type { QuotationPricingMode, QuotationPricingTotals as PricingTotals } from "../quotation-discount-contract";

export function QuotationPricingTotals({
  totals,
  mode,
  currencyCode,
  integrated = false,
  showBasePrices = false,
  baseSubtotal,
}: {
  totals: PricingTotals | null;
  mode: QuotationPricingMode;
  currencyCode: string;
  integrated?: boolean;
  showBasePrices?: boolean;
  baseSubtotal?: string | null;
}) {
  const { t } = useI18n();
  const copy = t.quotationDiscount;
  const subtotalValue = totals ? (mode === "PROMOTIONS" ? totals.baseSubtotal : totals.subtotal) : baseSubtotal ?? null;
  const deductionValue = totals ? (mode === "PROMOTIONS" ? totals.promotionSavings : totals.discountTotal) : null;
  const hasDeduction = deductionValue !== null && compareFixedDecimal(deductionValue, "0") > 0;

  return <div className={cn("flex flex-wrap items-end gap-x-4 gap-y-1.5 bg-primary/3 px-2.5 py-1.5",
    integrated && "border-t border-border")}>
    {showBasePrices ? <p className="text-xs text-muted-foreground">{t.quotationExperience.basePricingNote}</p> : null}
    <dl className="ms-auto w-full max-w-80 text-xs text-foreground sm:w-80">
      <div className="flex items-baseline justify-between gap-2 border-b border-border px-2.5 py-1">
        <dt className="font-medium">{copy.subtotal}</dt>
        <dd dir="ltr" className="tabular-nums">
          {subtotalValue !== null ? <Money value={subtotalValue} currency={currencyCode} maximumFractionDigits={8} /> : "—"}
        </dd>
      </div>
      <div className="flex items-baseline justify-between gap-2 px-2.5 py-1">
        <dt className="font-medium">{copy.discount}</dt>
        <dd dir="ltr" className="tabular-nums">
          {deductionValue !== null
            ? <Money value={hasDeduction ? `-${deductionValue}` : deductionValue} currency={currencyCode} maximumFractionDigits={8} />
            : "—"}
        </dd>
      </div>
      <div className="flex items-baseline justify-between gap-2 rounded-sm bg-primary/15 px-2.5 py-1 font-semibold text-primary">
        <dt>{copy.total}</dt>
        <dd dir="ltr" className="tabular-nums">
          {totals ? <Money value={totals.grandTotal} currency={currencyCode} maximumFractionDigits={8} /> : "—"}
        </dd>
      </div>
    </dl>
  </div>;
}

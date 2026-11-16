"use client";

import { Money, cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";

export function QuotationTotalsRibbon({ total, currencyCode, count, compact = false, selection = false }: {
  total: string | null; currencyCode: string; count: number; compact?: boolean; selection?: boolean;
}) {
  const { t } = useI18n();
  const copy = t.quotationExperience;
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-primary/10 bg-primary/5 px-3 py-2.5">
    <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
      {selection ? <p className="text-sm font-medium sm:border-e sm:border-primary/20 sm:pe-4">{copy.selectedItems.replace("{count}", String(count))}</p> : null}
      <p className="text-sm text-foreground">{!selection && compact ? copy.previewNote : copy.estimatedTotal}</p>
    </div>
    <p className={cn("rounded-md bg-primary/10 px-3 py-1 text-xl font-semibold tabular-nums text-primary", total === null && "text-muted-foreground")}
      aria-label={copy.estimatedTotal}>
      {total !== null ? <Money value={total} currency={currencyCode} maximumFractionDigits={8} /> : "—"}
    </p>
  </div>;
}

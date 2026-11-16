"use client";

import { CalendarDays, CreditCard, Pencil, ShieldCheck, Tag, Truck } from "lucide-react";
import { Button } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";

export function QuotationCommercialSummary({ terms, onEdit, disabled = false, compact = false }: {
  terms: Record<string, unknown>; onEdit?: () => void; disabled?: boolean; compact?: boolean;
}) {
  const { t, lang } = useI18n(); const c = t.quotationExperience;
  const text = (value: unknown) => typeof value === "string" && value.trim() ? value : t.tradeDocuments.notRecorded;
  const duration = (value: unknown, unit: string) => {
    const parsed = typeof value === "number" ? value : typeof value === "string" && /^\d+$/u.test(value) ? Number(value) : NaN;
    return Number.isSafeInteger(parsed) && parsed >= 0 ? `${formatNumber(parsed, lang)} ${unit}` : t.tradeDocuments.notRecorded;
  };
  return <section aria-label={c.termsSection} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-lg border border-border bg-card lg:flex ${compact ? "px-4 py-3" : "px-5 py-4"}`}>
    <h2 className="col-start-1 row-start-1 flex min-w-0 items-center gap-2 text-base font-semibold"><Tag className="size-5 shrink-0" aria-hidden="true" />{c.termsSection}</h2>
    <dl className="col-span-full row-start-2 grid min-w-0 flex-1 grid-cols-2 gap-4 lg:grid-cols-4">
      <div className="flex min-w-0 gap-2 border-s border-border ps-2 sm:gap-3 sm:ps-4"><CreditCard className="mt-1 size-5 shrink-0 text-muted-foreground" aria-hidden="true" /><div className="min-w-0 wrap-anywhere"><dt className="text-sm text-muted-foreground">{c.paymentTerm}</dt><dd className="mt-1 font-semibold"><bdi>{text(terms.paymentTermCode)}</bdi></dd></div></div>
      <div className="flex min-w-0 gap-2 border-s border-border ps-2 sm:gap-3 sm:ps-4"><Truck className="mt-1 size-5 shrink-0 text-muted-foreground" aria-hidden="true" /><div className="min-w-0 wrap-anywhere"><dt className="text-sm text-muted-foreground">{c.incoterm}</dt><dd className="mt-1 font-semibold"><bdi>{text(terms.incotermCode)}</bdi></dd></div></div>
      <div className="flex min-w-0 gap-2 border-s border-border ps-2 sm:gap-3 sm:ps-4"><CalendarDays className="mt-1 size-5 shrink-0 text-muted-foreground" aria-hidden="true" /><div className="min-w-0 wrap-anywhere"><dt className="text-sm text-muted-foreground">{c.deliveryDays}</dt><dd className="mt-1 font-semibold">{duration(terms.deliveryDays, t.quotationFlow.dayUnit)}</dd></div></div>
      <div className="flex min-w-0 gap-2 border-s border-border ps-2 sm:gap-3 sm:ps-4"><ShieldCheck className="mt-1 size-5 shrink-0 text-muted-foreground" aria-hidden="true" /><div className="min-w-0 wrap-anywhere"><dt className="text-sm text-muted-foreground">{c.warrantyMonths}</dt><dd className="mt-1 font-semibold">{duration(terms.warrantyMonths, t.quotationFlow.monthUnit)}</dd></div></div>
    </dl>
    {onEdit ? <Button variant="ghost" size="md" className="col-start-2 row-start-1" aria-label={t.quotationFlow.editTerms} disabled={disabled} onClick={onEdit}><Pencil className="size-4" aria-hidden="true" /></Button> : null}
  </section>;
}

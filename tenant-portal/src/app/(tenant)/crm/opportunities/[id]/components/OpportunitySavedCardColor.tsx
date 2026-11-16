"use client";

import { Button, CARD_COLORS, cardColorFill, cn, type CardColor } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";

export function OpportunitySavedCardColor({ value, disabled, onChange }: { value: CardColor | null; disabled: boolean; onChange: (value: CardColor | null) => void }) {
  const { t } = useI18n();
  return <div className="flex flex-col gap-1.5"><span className="text-xs font-medium">{t.crmOpportunityDetail.form.cardColor}</span><div role="group" aria-label={t.crmOpportunityDetail.form.cardColor} className="flex min-h-10 flex-wrap items-center gap-1 rounded-lg border border-line-card bg-surface-subtle px-2 py-1">
    <Button size="xs" variant="outline" disabled={disabled} aria-pressed={value === null} onClick={() => onChange(null)}>{t.crmOpportunityDetail.form.none}</Button>
    {CARD_COLORS.map((color) => <Button key={color} size="xs" variant="ghost" disabled={disabled} aria-label={t.crmLeads.card.colors[color]} aria-pressed={value === color} onClick={() => onChange(color)} className={cn("size-6 rounded-md p-1", value === color && "ring-2 ring-ring ring-offset-1 ring-offset-card")}><span className={cn("size-4 rounded-sm", cardColorFill(color))} aria-hidden="true" /></Button>)}
  </div></div>;
}

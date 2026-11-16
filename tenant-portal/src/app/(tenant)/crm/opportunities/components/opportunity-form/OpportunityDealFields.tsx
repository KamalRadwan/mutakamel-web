"use client";

import { Banknote } from "lucide-react";
import { DatePicker, DossierFormCard, DossierFormStars, Field, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { fromIsoDate, toIsoDate } from "../../../shared/iso-date";
import type { OpportunityFormCardsProps } from "./opportunity-form-types";

export function OpportunityDealFields({ form, errors, disabled, view, onFieldChange, onBlur, currencyOptions = [], cardColorSlot }: OpportunityFormCardsProps) {
  const { t } = useI18n();
  return <DossierFormCard title={t.crmOpportunityDetail.form.dealForecast} icon={Banknote} tone="emerald">
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <Field showLabel label={t.crmOpportunityDetail.amount} error={errors.amount}>
        <Input size="sm" placeholder="" value={form.amount} inputMode="decimal" dir="ltr" disabled={disabled}
          onChange={(event) => onFieldChange("amount", event.target.value)} onBlur={() => onBlur("amount")} />
      </Field>
      <Field showLabel label={t.crmLeadConvert.currencyCode} required={Boolean(form.amount.trim())} error={errors.currencyCode}>
        <Input size="sm" value={form.currencyCode} list="opportunity-currency-options" maxLength={3} dir="ltr"
          disabled={disabled} placeholder={t.crmOpportunities.workspaceDefaultCurrency}
          onChange={(event) => onFieldChange("currencyCode", event.target.value.toUpperCase())} onBlur={() => onBlur("currencyCode")} />
        <datalist id="opportunity-currency-options">{currencyOptions.map((code) => <option key={code} value={code} />)}</datalist>
      </Field>
      {view === "full" && <>
        <Field showLabel label={t.crmOpportunities.expectedClose} error={errors.expectedCloseDate}>
          <DatePicker value={fromIsoDate(form.expectedCloseDate)} disabled={disabled}
            onValueChange={(value) => { onFieldChange("expectedCloseDate", toIsoDate(value)); onBlur("expectedCloseDate"); }}
            placeholder={t.crmLeadConvert.selectDate} clearLabel={t.crmLeadConvert.clearDate} />
        </Field>
        <Field showLabel label={t.crmOpportunityDetail.create.probabilityPercent} error={errors.probabilityPercent}>
          <div className="relative" dir="ltr"><Input size="sm" placeholder="" value={form.probabilityPercent} inputMode="numeric" dir="ltr"
            className="pe-7" disabled={disabled} onChange={(event) => onFieldChange("probabilityPercent", event.target.value)} onBlur={() => onBlur("probabilityPercent")} />
            <span className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground" aria-hidden="true">%</span></div>
        </Field>
      </>}
    </div>
    <div className={cardColorSlot ? "grid grid-cols-1 gap-2 sm:grid-cols-2" : undefined}>
      <DossierFormStars value={Number(form.importance || "0")} label={t.crmOpportunities.importance}
        levelLabel={(level) => formatTemplate(t.crmOpportunities.setImportance, { level })}
        disabled={disabled} error={errors.importance} onBlur={() => onBlur("importance")}
        onChange={(value) => onFieldChange("importance", String(value))} />
      {cardColorSlot}
    </div>
  </DossierFormCard>;
}

"use client";

import { Button, DatePicker, Field, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { fromIsoDate, toIsoDate } from "../../../shared/iso-date";
import { leadDetailsUserName } from "../lead-details-edit-contract";
import type { LeadConvertState } from "./LeadConvertModal";

export function ConversionOpportunityFields({ convert, disabled }: { convert: LeadConvertState; disabled: boolean }) {
  const { t, lang } = useI18n();
  const { form, options, errors } = convert;
  if (!form) return null;
  return <>
    <Field label={t.crmOpportunities.pipeline} required error={errors.pipelineId ?? (options.pipelinesFailed ? t.crmLeadConvert.pipelinesFailed : undefined)}>
      <Select value={form.pipelineId || undefined} disabled={disabled || options.loading} onValueChange={(value) => convert.setField("pipelineId", value)}>
        <SelectTrigger><SelectValue placeholder={t.crmOpportunities.selectPipeline} /></SelectTrigger>
        <SelectContent>{options.pipelines.map((pipeline) => <SelectItem key={pipeline.id} value={pipeline.id}>{localizedName(pipeline, lang)}</SelectItem>)}</SelectContent>
      </Select>
    </Field>
    <Field label={t.crmOpportunities.stage} required error={errors.stageId} hint={t.crmLeadConvert.stageHint}>
      <Select value={form.stageId || undefined} disabled={disabled || options.loading || !convert.selectableStages.length} onValueChange={(value) => convert.setField("stageId", value)}>
        <SelectTrigger><SelectValue placeholder={t.crmLeadConvert.selectStage} /></SelectTrigger>
        <SelectContent>{convert.selectableStages.map((stage) => <SelectItem key={stage.id} value={stage.id}>{localizedName(stage, lang)}</SelectItem>)}</SelectContent>
      </Select>
    </Field>
    {options.pipelinesFailed && !disabled && <Button size="sm" onClick={options.reload}>{t.common.retry}</Button>}
    <Field label={t.crmOpportunities.title} required error={errors.title} className="md:col-span-2">
      <Input value={form.title} maxLength={180} disabled={disabled} onChange={(event) => convert.setField("title", event.target.value)} />
    </Field>
    <Field label={t.crmLeadConvert.amount} hint={t.crmLeadConvert.amountHint} error={errors.amount}>
      <Input value={form.amount} inputMode="decimal" disabled={disabled} onChange={(event) => convert.setField("amount", event.target.value)} />
    </Field>
    <Field label={t.crmLeadConvert.currencyCode} hint={t.crmLeadConvert.currencyHint} error={errors.currencyCode}>
      <Input value={form.currencyCode} maxLength={3} disabled={disabled} onChange={(event) => convert.setField("currencyCode", event.target.value)} />
    </Field>
    <Field label={t.crmLeadConvert.importance} error={errors.importance}>
      <Input type="number" min={0} max={3} step={1} value={form.importance} disabled={disabled} onChange={(event) => convert.setField("importance", event.target.value)} />
    </Field>
    <Field label={t.crmLeadConvert.probability} error={errors.probabilityPercent}>
      <Input type="number" min={0} max={100} step={1} value={form.probabilityPercent} disabled={disabled} onChange={(event) => convert.setField("probabilityPercent", event.target.value)} />
    </Field>
    <Field label={t.crmLeadDetail.salesPerson} error={errors.ownerUserId}
      hint={options.usersFailed || !options.canReadUsers ? t.crmLeadConvert.ownerOptionsUnavailable : t.crmLeadConvert.ownerHint}>
      <Select value={form.ownerUserId || "__inherit__"} disabled={disabled || options.loading}
        onValueChange={(value) => convert.setField("ownerUserId", value === "__inherit__" ? "" : value)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__inherit__">{t.crmLeadConvert.inheritOwner}</SelectItem>
          {options.ownerOptions.map((user) => <SelectItem key={user.id} value={user.id}>{leadDetailsUserName(user) || t.crmLeadDetail.userNameUnavailable}</SelectItem>)}
        </SelectContent>
      </Select>
    </Field>
    <Field label={t.crmOpportunities.expectedClose} error={errors.expectedCloseDate}>
      <DatePicker value={fromIsoDate(form.expectedCloseDate)} disabled={disabled} onValueChange={(date) => convert.setField("expectedCloseDate", toIsoDate(date))}
        placeholder={t.crmLeadConvert.selectDate} clearLabel={t.crmLeadConvert.clearDate} />
    </Field>
    <Field label={t.crmLeadConvert.opportunityDescription} error={errors.description} className="md:col-span-2">
      <Textarea size="sm" rows={2} maxLength={2000} disabled={disabled} value={form.description} onChange={(event) => convert.setField("description", event.target.value)} />
    </Field>
  </>;
}

"use client";

import { X } from "lucide-react";
import { Button, Field, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { CRM_CONTACT_METHOD_TYPES, type CrmContactMethodType } from "../../lead-contract";
import type { LeadConvertState } from "./LeadConvertModal";

export function ConversionContactFields({ convert, disabled }: { convert: LeadConvertState; disabled: boolean }) {
  const { t } = useI18n();
  const { form, errors } = convert;
  if (!form) return null;
  return <>
    <Field label={t.crmLeadConvert.contactFullName} hint={t.crmLeadConvert.contactNameHint} error={errors.contactFullName}>
      <Input value={form.contactFullName} maxLength={180} disabled={disabled} onChange={(event) => convert.setField("contactFullName", event.target.value)} />
    </Field>
    <Field label={t.crmLeadConvert.contactJobTitle} error={errors.contactJobTitle}>
      <Input value={form.contactJobTitle} maxLength={120} disabled={disabled} onChange={(event) => convert.setField("contactJobTitle", event.target.value)} />
    </Field>
    <Field label={t.crmLeadConvert.firstName} error={errors.contactFirstName}>
      <Input value={form.contactFirstName} maxLength={80} disabled={disabled} onChange={(event) => convert.setField("contactFirstName", event.target.value)} />
    </Field>
    <Field label={t.crmLeadConvert.lastName} error={errors.contactLastName}>
      <Input value={form.contactLastName} maxLength={80} disabled={disabled} onChange={(event) => convert.setField("contactLastName", event.target.value)} />
    </Field>
    <Field label={t.crmLeads.email} error={errors.contactEmail} className="md:col-span-2">
      <Input type="email" value={form.contactEmail} maxLength={180} disabled={disabled} onChange={(event) => convert.setField("contactEmail", event.target.value)} />
    </Field>
    <div className="flex min-w-0 flex-col gap-2 md:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-medium">{t.crmLeadConvert.contactMethods}</h4>
        <Button size="sm" disabled={disabled || form.contactMethods.length >= 20} onClick={convert.addMethod}>{t.crmLeadConvert.addMethod}</Button>
      </div>
      {errors.contactMethods && <p role="alert" className="text-xs text-destructive">{errors.contactMethods}</p>}
      {form.contactMethods.map((method, index) => <div key={method.rowId} className="grid min-w-0 grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_2fr_1fr_auto]">
        <Field label={t.crmLeadConvert.methodType} error={errors["contactMethods." + index + ".methodType"]}>
          <Select value={method.methodType} disabled={disabled} onValueChange={(value) => convert.setField("contactMethods", form.contactMethods.map((row) => row.rowId === method.rowId ? { ...row, methodType: value as CrmContactMethodType } : row))}>
            <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              {CRM_CONTACT_METHOD_TYPES.map((type) => <SelectItem key={type} value={type}>{t.crmLeadConvert.methodTypes[type]}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t.crmLeadConvert.methodValue} required error={errors["contactMethods." + index + ".value"]}>
          <Input value={method.value} maxLength={255} disabled={disabled} onChange={(event) => convert.setField("contactMethods", form.contactMethods.map((row) => row.rowId === method.rowId ? { ...row, value: event.target.value } : row))} />
        </Field>
        <Field label={t.crmLeadConvert.methodLabel} error={errors["contactMethods." + index + ".label"]}>
          <Input value={method.label ?? ""} maxLength={80} disabled={disabled} onChange={(event) => convert.setField("contactMethods", form.contactMethods.map((row) => row.rowId === method.rowId ? { ...row, label: event.target.value } : row))} />
        </Field>
        <Button size="sm" variant="ghost" disabled={disabled} aria-label={t.crmLeadConvert.removeMethod} title={t.crmLeadConvert.removeMethod}
          onClick={() => convert.setField("contactMethods", form.contactMethods.filter((row) => row.rowId !== method.rowId))}><X className="size-3.5" aria-hidden="true" /></Button>
      </div>)}
    </div>
  </>;
}

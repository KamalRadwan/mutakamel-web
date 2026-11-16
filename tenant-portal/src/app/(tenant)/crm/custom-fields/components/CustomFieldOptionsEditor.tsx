"use client";

import { Plus, RotateCcw, X } from "lucide-react";
import { Button, Checkbox, Field, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { useCustomFieldForm } from "../hooks/useCustomFieldForm";

export function CustomFieldOptionsEditor({ form, disabled, conflict, onRestoreActivity }: {
  form: ReturnType<typeof useCustomFieldForm>; disabled: boolean;
  conflict?: string | null; onRestoreActivity?: () => void;
}) {
  const { t } = useI18n();
  return (
    <section className="flex flex-col gap-2 border-t border-border pt-3" aria-label={t.crmCustomFields.optionsTitle}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{t.crmCustomFields.optionsTitle}</h3>
          <span className="text-xs tabular-nums text-muted-foreground">
            {t.crmCustomFields.optionsCount(form.options.length)} / 100
          </span>
        </div>
        <Button type="button" variant="ghost" size="sm" disabled={disabled || form.options.length >= 100} onClick={form.addOption}>
          <Plus className="size-3.5" aria-hidden="true" />{t.crmCustomFields.addOption}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t.crmCustomFields.optionsHelp}</p>
      {form.optionsError ? <p role="alert" className="text-xs text-destructive">{form.optionsError}</p> : null}
      {conflict ? <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive-subtle p-2">
        <p role="alert" className="text-xs text-destructive">{conflict}</p>
        {onRestoreActivity ? <Button variant="outline" size="sm" disabled={disabled || !form.optionActivityChanged} onClick={onRestoreActivity}>
          <RotateCcw className="size-3.5" aria-hidden="true" />{t.crmCustomFields.restoreOptionActivity}
        </Button> : null}
      </div> : null}
      <div className="flex flex-col divide-y divide-border">
        {form.options.map((option, index) => (
          <fieldset key={option.rowId} className="grid min-w-0 grid-cols-2 items-start gap-2 py-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,1.25fr)_5rem_3.5rem_2rem]">
            <legend className="sr-only">{t.crmCustomFields.optionNumber(index + 1)}</legend>
            <Field label={t.crmCustomFields.optionKey} showLabel required readOnly={option.persisted} error={form.optionsError ?? undefined}>
              <Input dir="ltr" className="font-mono" value={option.key} maxLength={64} readOnly={option.persisted} disabled={disabled} required
                onChange={(event) => form.updateOption(option.rowId, { key: event.target.value })} />
            </Field>
            <Field label={t.crmLeadStages.arabicName} showLabel required error={form.optionsError ?? undefined}>
              <Input dir="rtl" value={option.nameAr} maxLength={120} disabled={disabled} required
                onChange={(event) => form.updateOption(option.rowId, { nameAr: event.target.value })} />
            </Field>
            <Field label={t.crmLeadStages.englishName} showLabel required error={form.optionsError ?? undefined}>
              <Input dir="ltr" value={option.nameEn} maxLength={120} disabled={disabled} required
                onChange={(event) => form.updateOption(option.rowId, { nameEn: event.target.value })} />
            </Field>
            <Field label={t.crmCustomFields.displayOrder} showLabel error={form.optionsError ?? undefined}>
              <Input type="number" dir="ltr" min={1} step={1} value={option.sortOrder || ""} disabled={disabled}
                onChange={(event) => form.updateOptionOrder(option.rowId, event.target.value)} />
            </Field>
            <Field label={t.common.active} showLabel>
              <Checkbox checked={option.isActive} disabled={disabled} className="my-1.5"
                onCheckedChange={(checked) => form.updateOption(option.rowId, { isActive: checked === true })} />
            </Field>
            {!option.persisted ? <Button type="button" variant="ghost" size="sm" className="mt-5 size-7 p-0" disabled={disabled}
              aria-label={t.crmCustomFields.removeOption + ": " + t.crmCustomFields.optionNumber(index + 1)}
              onClick={() => form.removeOption(option.rowId)}><X className="size-3.5" aria-hidden="true" /></Button> : null}
          </fieldset>
        ))}
      </div>
    </section>
  );
}

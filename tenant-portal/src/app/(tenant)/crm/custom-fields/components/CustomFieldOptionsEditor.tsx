"use client";

import { Button, Checkbox, Field, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { useCustomFieldForm } from "../hooks/useCustomFieldForm";

export function CustomFieldOptionsEditor({ form, disabled }: { form: ReturnType<typeof useCustomFieldForm>; disabled: boolean }) {
  const { t } = useI18n();
  return (
    <section className="flex flex-col gap-3" aria-label={t.crmCustomFields.optionsTitle}>
      <p className="text-xs text-muted-foreground">{t.crmCustomFields.optionsHelp}</p>
      {form.optionsError ? <p role="alert" className="text-xs text-destructive">{form.optionsError}</p> : null}
      {form.options.map((option, index) => (
        <fieldset key={option.rowId} className="flex flex-col gap-3 rounded-sm border border-border p-3">
          <legend className="px-1 text-xs font-medium">{t.crmCustomFields.optionNumber(index + 1)}</legend>
          <Field label={t.crmCustomFields.optionKey} showLabel required readOnly={option.persisted} error={form.optionsError ?? undefined}>
            <Input dir="ltr" value={option.key} maxLength={64} readOnly={option.persisted} disabled={disabled} required
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
          <label className="flex items-center gap-2 text-xs text-foreground">
            <Checkbox checked={option.isActive} disabled={disabled}
              onCheckedChange={(checked) => form.updateOption(option.rowId, { isActive: checked === true })} />
            {t.common.active}
          </label>
          {!option.persisted ? <Button type="button" variant="ghost" size="sm" disabled={disabled}
            onClick={() => form.removeOption(option.rowId)}>{t.crmCustomFields.removeOption}</Button> : null}
        </fieldset>
      ))}
      <Button type="button" variant="outline" size="sm" disabled={disabled || form.options.length >= 100}
        onClick={form.addOption}>{t.crmCustomFields.addOption}</Button>
    </section>
  );
}

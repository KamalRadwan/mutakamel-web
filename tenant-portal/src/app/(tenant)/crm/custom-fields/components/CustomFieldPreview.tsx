"use client";

import { Eye } from "lucide-react";
import { Field, Input, Select, SelectTrigger, SelectValue, Switch, Textarea } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedValue } from "@/lib/format/localized";
import type { useCustomFieldForm } from "../hooks/useCustomFieldForm";

export function CustomFieldPreview({ form }: { form: ReturnType<typeof useCustomFieldForm> }) {
  const { t, lang } = useI18n();
  const label = localizedValue(form.nameAr, form.nameEn, lang) || t.crmCustomFields.previewTitle;
  const placeholder = localizedValue(form.placeholderAr, form.placeholderEn, lang) || t.crmCustomFields.valuePlaceholder;
  return (
    <section className="rounded-md border border-border bg-muted/25 px-3 py-2" aria-label={t.crmCustomFields.previewTitle}>
      <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Eye className="size-3.5" aria-hidden="true" />
        <span className="font-medium">{t.crmCustomFields.previewTitle}</span>
        <span className="ms-auto">{t.crmCustomFields.fieldTypes[form.type]}</span>
      </div>
      <Field label={label} showLabel hint={t.crmCustomFields.previewHint}>
        {form.picklist ? (
          <Select disabled>
            <SelectTrigger size="sm"><SelectValue placeholder={t.crmCustomFields.previewSelectPlaceholder} /></SelectTrigger>
          </Select>
        ) : form.type === "TEXTAREA" ? (
          <Textarea disabled value="" placeholder={placeholder} rows={2} />
        ) : form.type === "BOOLEAN" ? (
          <Switch checked={false} disabled />
        ) : (
          <Input disabled value="" placeholder={placeholder}
            type={form.type === "NUMBER" ? "number" : form.type === "DATE" ? "date" : form.type === "EMAIL" ? "email" :
              form.type === "URL" ? "url" : form.type === "PHONE" ? "tel" : "text"}
            dir={form.type === "TEXT" ? undefined : "ltr"} />
        )}
      </Field>
    </section>
  );
}

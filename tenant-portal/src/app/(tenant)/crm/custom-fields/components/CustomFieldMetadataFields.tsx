"use client";

import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger, Field, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { useCustomFieldForm } from "../hooks/useCustomFieldForm";

export function CustomFieldMetadataFields({ form, disabled }: {
  form: ReturnType<typeof useCustomFieldForm>; disabled: boolean;
}) {
  const { t } = useI18n();
  return (
    <Collapsible open={form.metadataOpen} onOpenChange={form.setMetadataOpen} className="border-t border-border pt-2">
      <CollapsibleTrigger disabled={disabled} className="group flex w-full justify-between gap-3 py-1 text-start text-xs">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-medium text-foreground">{t.crmCustomFields.additionalSettings}</span>
          <span className="text-xs text-muted-foreground">{t.crmCustomFields.metadataSummary}</span>
        </span>
        <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid gap-3 pb-1 pt-3 sm:grid-cols-2">
          <Field label={t.crmCustomFields.placeholderAr} showLabel hint={t.crmCustomFields.placeholderHelp} error={form.metadataError ?? undefined}>
            <Input dir="rtl" value={form.placeholderAr} maxLength={180} disabled={disabled}
              onChange={(event) => form.setPlaceholderAr(event.target.value)} />
          </Field>
          <Field label={t.crmCustomFields.placeholderEn} showLabel hint={t.crmCustomFields.placeholderHelp} error={form.metadataError ?? undefined}>
            <Input dir="ltr" value={form.placeholderEn} maxLength={180} disabled={disabled}
              onChange={(event) => form.setPlaceholderEn(event.target.value)} />
          </Field>
          <Field label={t.crmCustomFields.displayOrder} showLabel hint={t.crmCustomFields.orderHelp} error={form.metadataError ?? undefined}>
            <Input type="number" dir="ltr" min={1} step={1} value={form.sortOrder} disabled={disabled}
              onChange={(event) => form.setSortOrder(event.target.value)} />
          </Field>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

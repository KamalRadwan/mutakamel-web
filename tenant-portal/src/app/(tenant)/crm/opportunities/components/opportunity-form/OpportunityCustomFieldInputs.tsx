"use client";

import { SlidersHorizontal } from "lucide-react";
import { DegradedBanner, DossierFormCard, Field, Skeleton } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedValue } from "@/lib/format/localized";
import { CustomFieldValueInput } from "../../../shared/components/CustomFieldValueInput";
import type { OpportunityFormCardsProps } from "./opportunity-form-types";

export function OpportunityCustomFieldInputs({ customFields, view, form, errors, disabled, onFieldChange, onBlur }: OpportunityFormCardsProps) {
  const { t, lang } = useI18n();
  const fields = view === "fast"
    ? customFields.definitions.filter((field) => customFields.requiredFieldKeys.includes(field.fieldKey))
    : customFields.definitions;
  if (customFields.loading) return <Skeleton className="h-24 rounded-lg" />;
  if (customFields.degraded) return <DegradedBanner message={t.crmOpportunityDetail.form.customFieldsUnavailable} />;
  if (fields.length === 0) return null;
  return <DossierFormCard title={t.crmShared.customFieldsTitle} icon={SlidersHorizontal} tone="violet">
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {fields.map((field) => <Field key={field.id} showLabel
        label={localizedValue(field.nameAr, field.nameEn, lang)} required={customFields.requiredFieldKeys.includes(field.fieldKey)}
        error={errors[`customFields.${field.fieldKey}`]} className={field.type === "TEXTAREA" || fields.length === 1 ? "sm:col-span-2" : undefined}>
        <div onBlur={() => onBlur(`customFields.${field.fieldKey}`)}><CustomFieldValueInput field={field}
          value={form.customFields[field.fieldKey]} disabled={disabled} showPlaceholder={false}
          onChange={(value) => onFieldChange("customFields", { ...form.customFields, [field.fieldKey]: value })} /></div>
      </Field>)}
    </div>
  </DossierFormCard>;
}

"use client";

import { Input, MultiSelect, RadioGroup, RadioGroupItem, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea, useFieldControl } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedValue } from "@/lib/format/localized";
import type { CustomFieldItem } from "../custom-field-contract";

export function CustomFieldRecordValueInput({ field, value, disabled, readOnly, onChange }: {
  field: CustomFieldItem; value: unknown; disabled: boolean; readOnly: boolean; onChange: (next: unknown) => void;
}) {
  const { t, lang } = useI18n();
  const control = useFieldControl();
  const options = field.options.filter((option) => option.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((option) => ({ value: option.key, label: localizedValue(option.nameAr, option.nameEn, lang) }));
  const placeholder = localizedValue(field.placeholderAr ?? "", field.placeholderEn ?? "", lang) || t.crmCustomFields.valuePlaceholder;
  if (readOnly) {
    const label = (key: string) => {
      const option = field.options.find((entry) => entry.key === key);
      return option ? localizedValue(option.nameAr, option.nameEn, lang) : key;
    };
    const display = Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string").map(label).join(" · ") :
      typeof value === "boolean" ? (value ? t.crmCustomFields.booleanYes : t.crmCustomFields.booleanNo) :
        typeof value === "string" && field.type === "SELECT" ? label(value) :
          typeof value === "string" || typeof value === "number" ? String(value) : "";
    return <Input value={display} readOnly placeholder={placeholder} />;
  }
  if (field.type === "BOOLEAN") return <RadioGroup {...control} aria-label={localizedValue(field.nameAr, field.nameEn, lang)}
    className="flex min-h-7 items-center gap-4"
    value={value === true ? "yes" : value === false ? "no" : ""} disabled={disabled}
    onValueChange={(next) => onChange(next === "yes")}>
    <label className="flex items-center gap-2 text-xs"><RadioGroupItem value="yes" />{t.crmCustomFields.booleanYes}</label>
    <label className="flex items-center gap-2 text-xs"><RadioGroupItem value="no" />{t.crmCustomFields.booleanNo}</label>
  </RadioGroup>;
  if (field.type === "TEXTAREA") return <Textarea value={typeof value === "string" ? value : ""}
    maxLength={5000} disabled={disabled} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />;
  if (field.type === "SELECT") return <Select value={typeof value === "string" ? value : ""} disabled={disabled || !options.length}
    onValueChange={onChange}>
    <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
    <SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
  </Select>;
  if (field.type === "MULTI_SELECT") return <MultiSelect values={Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []}
    onValuesChange={onChange} options={options} disabled={disabled} placeholder={placeholder} emptyLabel={t.crmCustomFields.noOptions}
    moreLabel={t.crmPipelines.moreChips} removeLabel={t.crmPipelines.removeChip} overflowLabel={t.crmPipelines.overflowChips} />;
  return <Input size="sm" type={field.type === "NUMBER" ? "number" : field.type === "DATE" ? "date" :
    field.type === "EMAIL" ? "email" : field.type === "URL" ? "url" : field.type === "PHONE" ? "tel" : "text"}
    dir={field.type === "TEXT" ? undefined : "ltr"}
    value={typeof value === "string" || typeof value === "number" ? String(value) : ""}
    maxLength={field.type === "TEXT" ? 500 : field.type === "URL" ? 2048 : field.type === "EMAIL" ? 254 : field.type === "PHONE" ? 64 : undefined}
    disabled={disabled} placeholder={field.type === "DATETIME" ? "2026-11-03T10:30:00+02:00" : placeholder}
    onChange={(event) => onChange(field.type === "NUMBER" ? event.target.value === "" ? null : Number(event.target.value) : event.target.value)} />;
}

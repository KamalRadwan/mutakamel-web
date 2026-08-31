"use client";

import { useI18n } from "@/i18n/I18nContext";
import { INDUSTRY_OPTIONS, matchIndustry } from "@/lib/geo/industries";
import { CatalogueSelect } from "./CatalogueSelect";

interface IndustrySelectProps {
  id: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

/** Sector picker: curated catalogue with a free-text escape hatch. */
export function IndustrySelect({
  id,
  name,
  value,
  onChange,
  disabled = false,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: IndustrySelectProps) {
  const { lang, t } = useI18n();
  return (
    <CatalogueSelect
      id={id}
      name={name}
      value={value}
      onChange={onChange}
      entries={INDUSTRY_OPTIONS}
      match={matchIndustry}
      lang={lang}
      label={t.tenants.wizard.fieldLabels.industry}
      placeholder={t.tenants.wizard.chooseIndustryPlaceholder}
      searchPlaceholder={t.tenants.wizard.searchIndustryPlaceholder}
      emptyLabel={t.tenants.wizard.noMatchingIndustry}
      otherLabel={t.tenants.wizard.industryOther}
      otherPlaceholder={t.tenants.wizard.industryOtherPlaceholder}
      disabled={disabled}
      aria-describedby={ariaDescribedBy}
      aria-invalid={ariaInvalid}
    />
  );
}

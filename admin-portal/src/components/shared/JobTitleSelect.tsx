"use client";

import { useI18n } from "@/i18n/I18nContext";
import { JOB_TITLE_OPTIONS, matchJobTitle } from "@/lib/geo/job-titles";
import { CatalogueSelect } from "./CatalogueSelect";

interface JobTitleSelectProps {
  id: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

/**
 * Owner job-title picker.
 *
 * Keeps the catalogue's own order rather than sorting: the list is arranged
 * most-common first, which is what an operator reaches for.
 */
export function JobTitleSelect({
  id,
  name,
  value,
  onChange,
  disabled = false,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: JobTitleSelectProps) {
  const { lang, t } = useI18n();
  return (
    <CatalogueSelect
      id={id}
      name={name}
      value={value}
      onChange={onChange}
      entries={JOB_TITLE_OPTIONS}
      match={matchJobTitle}
      lang={lang}
      preserveOrder
      maxLength={120}
      label={t.tenants.wizard.fieldLabels.jobTitle}
      placeholder={t.tenants.wizard.chooseJobTitlePlaceholder}
      searchPlaceholder={t.tenants.wizard.searchJobTitlePlaceholder}
      emptyLabel={t.tenants.wizard.noMatchingJobTitle}
      otherLabel={t.tenants.wizard.jobTitleOther}
      otherPlaceholder={t.tenants.wizard.jobTitleOtherPlaceholder}
      disabled={disabled}
      aria-describedby={ariaDescribedBy}
      aria-invalid={ariaInvalid}
    />
  );
}

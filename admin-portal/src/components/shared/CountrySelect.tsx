"use client";

import { useMemo } from "react";
import { Globe } from "lucide-react";
import { Combobox, type ComboboxOption } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { getCountryOptions } from "@/lib/geo/country-data";

interface CountrySelectProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (isoCode: string) => void;
  placeholder?: string;
  allowAll?: boolean;
  allLabel?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

/** Country combobox with complete listbox keyboard and focus behavior. */
export function CountrySelect({
  id,
  label,
  value,
  onChange,
  placeholder,
  allowAll = false,
  allLabel,
  searchPlaceholder,
  emptyLabel,
  disabled = false,
  className,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: CountrySelectProps) {
  const { lang, t } = useI18n();
  const resolvedPlaceholder = placeholder ?? t.tenants.wizard.chooseCountryPlaceholder;
  const resolvedAllLabel = allLabel ?? (lang === "ar" ? "كل الدول" : "All countries");
  const resolvedSearchPlaceholder = searchPlaceholder ?? t.tenants.wizard.searchCountriesPlaceholder;
  const resolvedEmptyLabel = emptyLabel ?? t.tenants.wizard.noMatchingCountries;
  const resolvedLabel = label ?? (allowAll ? resolvedAllLabel : t.tenants.wizard.countryLabel);

  const options = useMemo<ComboboxOption[]>(() => {
    const countryOptions = getCountryOptions().map((country) => ({
      value: country.isoCode,
      label: `${country.name} (${country.isoCode})`,
      // The ISO code and calling code stay searchable even though only the
      // name is shown, so "EG" and "+20" both find Egypt.
      keywords: [country.name, country.isoCode, country.callingCode],
      leading: (
        <span
          // The flag is decoration: the name and ISO code carry the meaning,
          // and emoji flags do not render on every platform.
          aria-hidden="true"
          className="w-5 shrink-0 text-center text-base leading-none"
        >
          {country.flag}
        </span>
      ),
    }));

    if (!allowAll) return countryOptions;
    return [
      {
        value: "ALL",
        label: resolvedAllLabel,
        keywords: ["all"],
        leading: <Globe className="size-4 shrink-0 text-info" aria-hidden="true" />,
      },
      ...countryOptions,
    ];
  }, [allowAll, resolvedAllLabel]);

  return (
    <Combobox
      id={id}
      value={value}
      options={options}
      onValueChange={onChange}
      label={resolvedLabel}
      placeholder={resolvedPlaceholder}
      searchPlaceholder={resolvedSearchPlaceholder}
      emptyLabel={resolvedEmptyLabel}
      disabled={disabled}
      preferDownward
      aria-describedby={ariaDescribedBy}
      aria-invalid={ariaInvalid}
      className={className}
      contentClassName="max-w-sm"
    />
  );
}

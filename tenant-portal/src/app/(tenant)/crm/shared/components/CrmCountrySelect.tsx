"use client";

import { useMemo, useState } from "react";
import { Combobox, type ComboboxOption } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { getCountryOptions } from "@/lib/geo/country-data";

export interface CrmCountrySelectProps {
  value: string;
  disabled?: boolean;
  onChange: (next: string) => void;
  onBlur: () => void;
}

/**
 * An address country, as a searchable list of flags and names.
 *
 * What is stored is still the NAME, because that is all the DTO's `country`
 * is — a free-text string the server only trims. Storing the ISO code would
 * put "EG" on every screen that prints an address, and not one of them knows
 * how to expand it back.
 *
 * A value that matches no country is kept and shown as it stands. Addresses
 * typed before this control existed have to survive being opened in it, and a
 * picker that silently blanked them would lose data on a save the user never
 * meant to make.
 */
export function CrmCountrySelect({ value, disabled, onChange, onBlur }: CrmCountrySelectProps) {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState("");
  const countries = getCountryOptions(lang);

  // Names from both dictionaries, so a country stored in one language is still
  // recognised — and shown with its flag — while the other is on screen.
  const isoByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const language of ["ar", "en"] as const) {
      for (const country of getCountryOptions(language)) {
        map.set(country.name.toLowerCase(), country.isoCode);
      }
    }
    return map;
  }, []);

  const selected = useMemo(() => {
    const isoCode = isoByName.get(value.trim().toLowerCase());
    return countries.find((country) => country.isoCode === isoCode) ?? null;
  }, [countries, isoByName, value]);

  const options = useMemo<ComboboxOption[]>(() => {
    const needle = query.trim().toLowerCase();
    return countries
      .filter(
        (country) =>
          needle.length === 0 ||
          country.name.toLowerCase().includes(needle) ||
          country.isoCode.toLowerCase().includes(needle),
      )
      .map((country) => ({ value: country.isoCode, label: `${country.flag} ${country.name}` }));
  }, [countries, query]);

  return (
    <Combobox
      // Falls back to the raw string so an unrecognised country still reads as
      // itself in the trigger rather than as the placeholder.
      value={selected?.isoCode ?? (value || undefined)}
      selectedLabel={selected ? `${selected.flag} ${selected.name}` : value}
      options={options}
      onSearch={setQuery}
      debounceMs={0}
      onValueChange={(isoCode) =>
        onChange(countries.find((country) => country.isoCode === isoCode)?.name ?? "")
      }
      onBlur={onBlur}
      placeholder={t.crmShared.chooseCountry}
      searchPlaceholder={t.crmShared.searchCountries}
      loadingLabel={t.common.loading}
      emptyLabel={t.crmShared.noMatchingCountries}
      clearLabel={t.crmShared.clearCountry}
      disabled={disabled}
    />
  );
}

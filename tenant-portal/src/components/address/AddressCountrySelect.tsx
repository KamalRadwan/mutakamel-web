"use client";

import { useMemo, useState } from "react";
import { Combobox, type ComboboxOption } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { countryIsoFromName, getCountryOptions } from "@/lib/geo/country-data";

export interface AddressCountrySelectProps {
  value: string;
  disabled?: boolean;
  onChange: (next: string) => void;
  onBlur?: () => void;
}

/**
 * An address country, as a searchable list of flags and names.
 *
 * What is stored is still the NAME, because that is all an address `country`
 * is — a free-text string the server only trims. Storing the ISO code would
 * put "EG" on every screen that prints an address, and not one of them knows
 * how to expand it back. `countryIsoFromName` is how the geography routes get
 * the code they need without the record ever holding one.
 *
 * A value that matches no country is kept and shown as it stands. Addresses
 * typed before this control existed have to survive being opened in it, and a
 * picker that silently blanked them would lose data on a save the user never
 * meant to make.
 */
export function AddressCountrySelect({
  value,
  disabled,
  onChange,
  onBlur,
}: AddressCountrySelectProps) {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState("");
  const countries = getCountryOptions(lang);

  const selected = useMemo(() => {
    const isoCode = countryIsoFromName(value);
    return countries.find((country) => country.isoCode === isoCode) ?? null;
  }, [countries, value]);

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
      placeholder={t.address.chooseCountry}
      searchPlaceholder={t.address.searchCountries}
      loadingLabel={t.common.loading}
      emptyLabel={t.address.noMatchingCountries}
      clearLabel={t.address.clearCountry}
      disabled={disabled}
    />
  );
}

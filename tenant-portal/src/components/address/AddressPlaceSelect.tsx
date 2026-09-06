"use client";

import { useMemo } from "react";
import { Combobox, Input, type ComboboxOption } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { useAddressPlaceOptions, type AddressPlaceLoader } from "./useAddressPlaceOptions";

interface AddressPlaceSelectLabels {
  placeholder: string;
  searchPlaceholder: string;
  emptyLabel: string;
  clearLabel: string;
}

export interface AddressPlaceChange {
  /** The name to store. Empty when the picker was cleared. */
  name: string;
  /** The catalogue row's identity, when one was chosen. */
  key?: string;
  /**
   * Whether this came from the catalogue — a pick or a clear — rather than
   * from typing. Only a catalogue change may cascade: wiping the city on every
   * keystroke of a hand-typed state would delete a city the user already wrote.
   */
  fromCatalogue: boolean;
}

export interface AddressPlaceSelectProps {
  value: string;
  /**
   * Loads one page of the catalogue for a typed query, or `null` when there is
   * nothing to load from yet — no country chosen, no state chosen.
   */
  loader: AddressPlaceLoader | null;
  labels: AddressPlaceSelectLabels;
  maxLength: number;
  disabled?: boolean;
  onChange: (change: AddressPlaceChange) => void;
  onBlur?: () => void;
}

/** No catalogue emits this: subdivision codes carry no underscores. */
const TRUNCATED_ROW = "__address_place_truncated__";

/**
 * One place in an address — a state, a governorate, a city — as a searchable
 * list, or as a plain box when there is no list to search.
 *
 * What is stored is the NAME, as `AddressCountrySelect` stores it, and for the
 * same reason: `state`, `area` and `city` are free-text columns that every read
 * screen prints verbatim. A code would render as a code everywhere.
 *
 * A value matching nothing in the list is kept and shown as it stands.
 * Addresses typed before this control existed have to survive being opened in
 * it, and a picker that silently blanked them would lose data on a save the
 * user never meant to make.
 *
 * The degraded box is not an error state. A catalogue that is empty, absent or
 * unreachable must never stop somebody recording where a customer lives, so the
 * field falls back to what it was before — a text box with the same binding.
 */
export function AddressPlaceSelect({
  value,
  loader,
  labels,
  maxLength,
  disabled,
  onChange,
  onBlur,
}: AddressPlaceSelectProps) {
  const { t, lang } = useI18n();
  const { options, truncated, total, status, isLoading, search } = useAddressPlaceOptions(loader);

  const selected = useMemo(() => {
    const needle = value.trim().toLowerCase();
    return options.find((option) => option.name.trim().toLowerCase() === needle) ?? null;
  }, [options, value]);

  const rows = useMemo<ComboboxOption[]>(() => {
    const listed: ComboboxOption[] = options.map((option) => ({
      value: option.key,
      label: option.name,
      description: option.description,
    }));
    // The count rides in the list rather than under the field, because it is
    // only true while the popover is open and only actionable where the user
    // is already looking. `disabled` keeps it unselectable.
    if (truncated) {
      listed.push({
        value: TRUNCATED_ROW,
        label: formatTemplate(t.address.keepTyping, {
          shown: formatNumber(options.length, lang),
          total: formatNumber(total, lang),
        }),
        disabled: true,
      });
    }
    return listed;
  }, [lang, options, t, total, truncated]);

  if (status === "unavailable") {
    return (
      <Input
        value={value}
        maxLength={maxLength}
        disabled={disabled}
        onChange={(event) => onChange({ name: event.target.value, fromCatalogue: false })}
        onBlur={onBlur}
      />
    );
  }

  return (
    <Combobox
      // Falls back to the raw string so a name the catalogue does not carry
      // still reads as itself in the trigger rather than as the placeholder.
      value={selected?.key ?? (value || undefined)}
      selectedLabel={selected?.name ?? value}
      options={rows}
      // No `debounceMs` override, unlike `AddressCountrySelect`: that list is
      // local and filters for free, while every keystroke here is an HTTP
      // request. The primitive's 300 ms default is exactly what this needs.
      onSearch={search}
      loading={isLoading || status === "loading"}
      onValueChange={(key) => {
        const picked = options.find((option) => option.key === key);
        onChange({ name: picked?.name ?? "", key: picked?.key, fromCatalogue: true });
      }}
      onBlur={onBlur}
      placeholder={labels.placeholder}
      searchPlaceholder={labels.searchPlaceholder}
      loadingLabel={t.common.loading}
      emptyLabel={labels.emptyLabel}
      clearLabel={labels.clearLabel}
      disabled={disabled}
    />
  );
}

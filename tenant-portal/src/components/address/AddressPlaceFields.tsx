"use client";

import { useMemo, useState } from "react";
import { Field } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { countryIsoFromName } from "@/lib/geo/country-data";
import {
  fetchGeographyCities,
  fetchGeographyStates,
  type GeographyCity,
  type GeographyList,
  type GeographyState,
} from "@/lib/geo/geography-api";
import { AddressCountrySelect } from "./AddressCountrySelect";
import { AddressPlaceSelect, type AddressPlaceChange } from "./AddressPlaceSelect";
import type { AddressPlaceLoader, AddressPlaceResult } from "./useAddressPlaceOptions";

/** The three fields this template owns, in cascade order. */
export interface AddressPlaceValues {
  country: string;
  state: string;
  city: string;
}

type AddressPlacePatch = Partial<AddressPlaceValues>;

export interface AddressPlaceFieldsProps {
  values: AddressPlaceValues;
  /** The same three fields, each named as this form names its own column. */
  labels: AddressPlaceValues;
  /**
   * One patch, because a cascade sets more than one field per interaction and
   * two sequential single-field writes would let a caller persist the moment
   * in between — an address whose city belongs to the previous country.
   */
  onChange: (patch: AddressPlacePatch) => void;
  onBlur?: (path: string) => void;
  errors?: Record<string, string | undefined>;
  /** Joined to the field name: "address" reads `errors["address.city"]`. */
  errorPrefix?: string;
  /** The column bound, from the caller's own contract — both are 120 today. */
  maxLength: number;
  disabled?: boolean;
}

/**
 * Country → state → city, as one cascade, for every address form in the app.
 *
 * The three DTO columns are free text everywhere, so this stores NAMES and the
 * catalogue codes never leave this component. The country's ISO code is derived
 * from its stored name; the state's code is remembered from the pick that
 * produced it.
 *
 * That memory is deliberately not reconstructed for a record loaded from the
 * server: an address written before this control existed carries a state name
 * and no code, and resolving one would cost a request on every form open to
 * assist an edit most users will not make. Such a record opens with its city as
 * a text box holding its own value — never blocked, only unassisted, until the
 * user picks a state from the list.
 */
export function AddressPlaceFields({
  values,
  labels,
  onChange,
  onBlur,
  errors,
  errorPrefix,
  maxLength,
  disabled,
}: AddressPlaceFieldsProps) {
  const { t } = useI18n();
  const [pickedStateCode, setPickedStateCode] = useState<string | null>(null);

  const countryIso = countryIsoFromName(values.country);
  // A state cleared by the form itself — a reset, a switched record — leaves
  // the remembered code pointing at nothing.
  const stateCode = values.state ? pickedStateCode : null;

  const loadStates = useMemo<AddressPlaceLoader | null>(() => {
    if (!countryIso) return null;
    return async (query, signal) =>
      toPlaceResult(
        await fetchGeographyStates(countryIso, { search: query, signal }),
        (state) => ({
          key: state.code,
          name: state.name,
          description: state.nativeName ?? state.type ?? undefined,
        }),
      );
  }, [countryIso]);

  const loadCities = useMemo<AddressPlaceLoader | null>(() => {
    if (!countryIso || !stateCode) return null;
    return async (query, signal) =>
      toPlaceResult(
        await fetchGeographyCities(countryIso, stateCode, { search: query, signal }),
        (city) => ({
          key: String(city.id),
          name: city.name,
          description: city.nativeName ?? undefined,
        }),
      );
  }, [countryIso, stateCode]);

  const path = (field: keyof AddressPlaceValues) =>
    errorPrefix ? `${errorPrefix}.${field}` : field;

  function handleCountry(next: string) {
    if (next === values.country) return;
    setPickedStateCode(null);
    // The state and the city belonged to the country being left. Keeping them
    // would submit an address that does not exist anywhere.
    onChange({ country: next, state: "", city: "" });
  }

  function handleState(change: AddressPlaceChange) {
    if (change.fromCatalogue) {
      setPickedStateCode(change.key ?? null);
      onChange({ state: change.name, city: "" });
      return;
    }
    // Typed, not picked: there is no catalogue relationship left to break, and
    // clearing the city per keystroke would erase what the user already wrote.
    onChange({ state: change.name });
  }

  return (
    <>
      <Field label={labels.country} error={errors?.[path("country")]}>
        <AddressCountrySelect
          value={values.country}
          disabled={disabled}
          onChange={handleCountry}
          onBlur={() => onBlur?.(path("country"))}
        />
      </Field>

      <Field label={labels.state} error={errors?.[path("state")]}>
        <AddressPlaceSelect
          value={values.state}
          loader={loadStates}
          maxLength={maxLength}
          disabled={disabled}
          labels={{
            placeholder: t.address.chooseState,
            searchPlaceholder: t.address.searchStates,
            emptyLabel: t.address.noMatchingStates,
            clearLabel: t.address.clearState,
          }}
          onChange={handleState}
          onBlur={() => onBlur?.(path("state"))}
        />
      </Field>

      <Field label={labels.city} error={errors?.[path("city")]}>
        <AddressPlaceSelect
          value={values.city}
          loader={loadCities}
          maxLength={maxLength}
          disabled={disabled}
          labels={{
            placeholder: t.address.chooseCity,
            searchPlaceholder: t.address.searchCities,
            emptyLabel: t.address.noMatchingCities,
            clearLabel: t.address.clearCity,
          }}
          onChange={(change) => onChange({ city: change.name })}
          onBlur={() => onBlur?.(path("city"))}
        />
      </Field>
    </>
  );
}

function toPlaceResult<T extends GeographyState | GeographyCity>(
  list: GeographyList<T>,
  toOption: (item: T) => AddressPlaceResult["options"][number],
): AddressPlaceResult {
  return {
    options: list.items.map(toOption),
    truncated: list.truncated,
    total: list.total,
  };
}

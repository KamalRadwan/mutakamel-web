"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Combobox, FieldControlBoundary, Input, type ComboboxOption } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  browserCountryIso,
  getCountryOptions,
  splitPhoneNumber,
  type CountryOption,
} from "@/lib/geo/country-data";

/** The first country by name that dials with `callingCode`, or none. */
function firstIsoForCode(countries: readonly CountryOption[], callingCode: string): string {
  if (!callingCode) return "";
  return countries.find((country) => country.callingCode === callingCode)?.isoCode ?? "";
}

export interface CrmPhoneNumberInputProps {
  /** The single string every CRM DTO takes — calling code and national part joined. */
  value: string;
  /** `@MaxLength` on that whole string, which the two parts share. */
  maxLength: number;
  disabled?: boolean;
  onChange: (next: string) => void;
  onBlur: () => void;
}

/**
 * A phone as a country code and a national number, stored as one string.
 *
 * The split is a UI affordance, not a change of contract: CRM takes
 * `phones: string[]` with nothing but a length cap, so what leaves here is
 * still the one string the DTO expects — `"+20" + "1050049899"`. Asking for
 * the code as free text beside the number, which is what this replaced, let
 * the two disagree and put E.164 knowledge on the user.
 *
 * Pasting a full international number into the number field splits it across
 * both controls rather than being rejected or silently double-prefixed. The
 * rule for that lives in `splitPhoneNumber`, shared behaviour-for-behaviour
 * with the admin portal.
 */
export function CrmPhoneNumberInput({
  value,
  maxLength,
  disabled,
  onChange,
  onBlur,
}: CrmPhoneNumberInputProps) {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState("");

  const countries = getCountryOptions(lang);

  const parsed = splitPhoneNumber(value);
  const nationalNumber = parsed?.nationalNumber ?? "";
  const incomingCode = parsed?.callingCode ?? "";

  // The chosen COUNTRY is what is held, not its calling code, and it is state
  // rather than a function of `value` — two separate reasons.
  //
  // A country, because 25 of them share +1: reading the flag back out of the
  // code would answer "Anguilla" to someone who picked the United States. A
  // code that arrives inside a value carries no country with it, and that is
  // the only case that falls back to the first match by name.
  //
  // State, because a code with no number behind it composes to the empty
  // string — anything else would submit "+20" as somebody's phone number —
  // and a derived picker would therefore reset itself the moment it was used
  // before typing.
  const [isoCode, setIsoCode] = useState(() => firstIsoForCode(countries, incomingCode));
  const [syncedValue, setSyncedValue] = useState(value);
  const seededRef = useRef(false);

  // Open on the reader's own country instead of on nothing. Seeded in an
  // effect and never during render: the server's timezone is not the reader's,
  // so a value read from `Intl` while rendering would disagree with the markup
  // the server sent. `queueMicrotask` keeps the write out of the effect's own
  // pass, matching how the other deferred loaders in this app set state.
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    if (isoCode || value) return;
    const home = browserCountryIso();
    if (home) queueMicrotask(() => setIsoCode(home));
  }, [isoCode, value]);
  const selected = countries.find((country) => country.isoCode === isoCode) ?? null;
  if (value !== syncedValue) {
    setSyncedValue(value);
    // A value the parent replaced wholesale — a picked contact's number, a
    // form reset — brings its own code. An emptied field brings none, and
    // keeps the country already chosen.
    if (incomingCode && incomingCode !== selected?.callingCode) {
      setIsoCode(firstIsoForCode(countries, incomingCode));
    }
  }
  const callingCode = selected?.callingCode ?? "";

  // Both dictionaries in the haystack, never only the one on screen: a reader
  // in Arabic who types "egypt" and a reader in English who types "مصر" are
  // each looking for the same row. Both lists are cached, so asking for the
  // pair costs one build rather than one per keystroke.
  const searchable = useMemo(() => {
    const arabic = new Map(getCountryOptions("ar").map(({ isoCode, name }) => [isoCode, name]));
    const english = new Map(getCountryOptions("en").map(({ isoCode, name }) => [isoCode, name]));
    return countries.map((country) => ({
      country,
      haystack: [
        arabic.get(country.isoCode) ?? "",
        english.get(country.isoCode) ?? "",
        country.isoCode,
        country.callingCode,
      ]
        .join(" ")
        .toLowerCase(),
    }));
  }, [countries]);

  const options = useMemo<ComboboxOption[]>(() => {
    const needle = query.trim().toLowerCase();
    return searchable
      .filter(({ haystack }) => needle.length === 0 || haystack.includes(needle))
      .map(({ country }) => ({
        value: country.isoCode,
        // Flag and code on the trigger line, the name under it: the code is
        // what the field is for, and the name is how it is found.
        label: `${country.flag} ${country.callingCode}`,
        description: country.name,
      }));
  }, [searchable, query]);

  function compose(code: string, national: string): string {
    return national ? `${code}${national}` : "";
  }

  function handleCodeChange(nextIso: string | undefined) {
    const country = countries.find((candidate) => candidate.isoCode === nextIso);
    if (!country) return;
    setIsoCode(country.isoCode);
    onChange(compose(country.callingCode, nationalNumber));
  }

  function handleNumberChange(raw: string) {
    // A pasted international number carries its own code; honour it rather
    // than concatenating it onto whatever the picker happens to show.
    const pasted = splitPhoneNumber(raw);
    if (pasted?.callingCode) {
      // Only re-resolve the country when the pasted code is a different one —
      // otherwise pasting a US number would swap the flag to Anguilla's.
      if (pasted.callingCode !== callingCode) {
        setIsoCode(firstIsoForCode(countries, pasted.callingCode));
      }
      onChange(compose(pasted.callingCode, pasted.nationalNumber));
      return;
    }
    onChange(compose(callingCode, raw.replace(/[^0-9]/gu, "")));
  }

  return (
    // dir="ltr" on the row, not just the input: a phone number is Latin digits
    // behind a plus and reads code-then-number in both languages.
    <div className="flex flex-1 flex-wrap items-center gap-1.5" dir="ltr">
      {/* One label covers two controls, and it names the number. The picker
          opts out of the field rather than claiming the same id, and takes its
          accessible name from its own trigger text. See field-control.tsx. */}
      <FieldControlBoundary>
        {/* Narrow on purpose: a dial code is four characters at most, and
            every pixel it does not take is one the number box does. 5rem fits
            a flag, "+966" and the chevron; the 6rem it used to be was paying
            for nothing and the number box was the one that went short. */}
        <div className="w-20 shrink-0">
          <Combobox
            value={selected?.isoCode}
            selectedLabel={selected ? `${selected.flag} ${selected.callingCode}` : callingCode}
            options={options}
            onSearch={setQuery}
            // A static catalogue, so there is nothing to wait for between the
            // keystroke and the answer.
            debounceMs={0}
            onValueChange={handleCodeChange}
            placeholder={t.crmShared.callingCode}
            searchPlaceholder={t.crmShared.searchCountries}
            loadingLabel={t.common.loading}
            emptyLabel={t.crmShared.noMatchingCountries}
            disabled={disabled}
          />
        </div>
      </FieldControlBoundary>
      <Input
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        dir="ltr"
        value={nationalNumber}
        maxLength={Math.max(1, maxLength - callingCode.length)}
        disabled={disabled}
        onChange={(event) => handleNumberChange(event.target.value)}
        onBlur={onBlur}
        // A floor, not just a share. `flex-1` alone let the number box collapse
        // to whatever was left after the code picker and the add button in a
        // narrow column, and an eleven-digit number does not fit in what was
        // left. Below the floor the row wraps instead, which is readable; a
        // squeezed number box is not.
        className="min-w-32 flex-1"
      />
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { Combobox, Input, type ComboboxOption } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  getCountryOptions,
  splitPhoneNumber,
} from "@/lib/geo/country-data";

export interface PhoneNumberValue {
  /** E.164 calling code including the plus, e.g. "+20". */
  callingCode: string;
  /** National part, digits only. */
  nationalNumber: string;
}

interface PhoneNumberInputProps {
  id: string;
  name?: string;
  value: PhoneNumberValue;
  onChange: (next: PhoneNumberValue) => void;
  disabled?: boolean;
  required?: boolean;
  numberPlaceholder?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

/**
 * Calling code and national number as one control.
 *
 * The wizard previously asked for a free-text "+20" alongside a free-text
 * number, which let the two disagree and pushed E.164 knowledge onto the
 * admin. Pasting a full international number into the number field splits it
 * across both parts instead of being rejected.
 */
export function PhoneNumberInput({
  id,
  name,
  value,
  onChange,
  disabled = false,
  required = false,
  numberPlaceholder,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: PhoneNumberInputProps) {
  const { lang, t } = useI18n();

  const options = useMemo<ComboboxOption[]>(
    () =>
      getCountryOptions().map((country) => ({
        // Several countries share a calling code, so the option value has to
        // be the ISO code; the calling code alone is not unique.
        value: country.isoCode,
        label: `${country.callingCode} · ${country.name}`,
        keywords: [
          country.name,
          country.isoCode,
          country.callingCode,
          country.callingCode.slice(1),
        ],
        leading: (
          <span
            aria-hidden="true"
            className="w-5 shrink-0 text-center text-base leading-none"
          >
            {country.flag}
          </span>
        ),
      })),
    [],
  );

  // Which country is showing for the current code. Shared codes resolve to the
  // first match by name, which keeps the trigger stable while typing.
  const selectedIso = useMemo(() => {
    if (!value.callingCode) return "";
    return (
      getCountryOptions().find(
        (country) => country.callingCode === value.callingCode,
      )?.isoCode ?? ""
    );
  }, [value.callingCode]);

  const handleNumberChange = (raw: string) => {
    // A pasted international number carries its own code; honour it rather
    // than concatenating it onto whatever the picker happens to show.
    const parsed = splitPhoneNumber(raw);
    if (parsed?.callingCode) {
      onChange({
        callingCode: parsed.callingCode,
        nationalNumber: parsed.nationalNumber,
      });
      return;
    }
    onChange({
      callingCode: value.callingCode,
      nationalNumber: raw.replace(/[^0-9]/gu, ""),
    });
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row" dir="ltr">
      <Combobox
        id={`${id}-code`}
        value={selectedIso}
        options={options}
        onValueChange={(isoCode) => {
          const country = getCountryOptions().find(
            (candidate) => candidate.isoCode === isoCode,
          );
          if (!country) return;
          onChange({
            callingCode: country.callingCode,
            nationalNumber: value.nationalNumber,
          });
        }}
        label={t.tenants.wizard.fieldLabels.phoneCallingCode}
        placeholder={t.tenants.wizard.choosePhoneCodePlaceholder}
        searchPlaceholder={t.tenants.wizard.searchCountriesPlaceholder}
        emptyLabel={t.tenants.wizard.noMatchingCountries}
        disabled={disabled}
        preferDownward
        className="sm:w-56 sm:shrink-0"
        contentClassName="max-w-sm"
        aria-invalid={ariaInvalid}
      />
      <Input
        id={id}
        name={name}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        dir="ltr"
        value={value.nationalNumber}
        disabled={disabled}
        required={required}
        onChange={(event) => handleNumberChange(event.target.value)}
        placeholder={numberPlaceholder}
        // The visible order is code-then-number in both locales because a
        // phone number is not mirrored in Arabic.
        className={`flex-1 ${lang === "ar" ? "text-start" : ""}`}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
      />
    </div>
  );
}

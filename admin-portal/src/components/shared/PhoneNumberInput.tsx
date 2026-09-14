"use client";

import { memo, useMemo } from "react";
import { Phone } from "lucide-react";
import { Combobox, Input, cn, type ComboboxOption } from "@/design-system";
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
  className?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

/**
 * Calling code and national number as one compact control.
 */
export const PhoneNumberInput = memo(function PhoneNumberInput({
  id,
  name,
  value,
  onChange,
  disabled = false,
  required = false,
  numberPlaceholder,
  className,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: PhoneNumberInputProps) {
  const { t } = useI18n();

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
    <div
      className={cn(
        "flex items-center rounded-md border border-input bg-card h-(--size-control-sm) text-xs overflow-hidden transition-colors w-full min-w-0",
        "focus-within:ring-2 focus-within:ring-ring focus-within:border-input",
        ariaInvalid && "border-destructive focus-within:ring-destructive",
        className,
      )}
      dir="ltr"
    >
      <div className="flex items-center ps-2.5 pe-1 shrink-0 h-full">
        <Phone className="size-3.5 text-muted-foreground me-1.5 shrink-0" aria-hidden="true" />
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
          triggerLabel={value.callingCode || undefined}
          className="border-0 shadow-none px-1 h-full bg-transparent hover:bg-transparent focus-visible:ring-0 w-auto gap-1 text-xs font-mono"
          contentClassName="max-w-sm"
          aria-invalid={ariaInvalid}
        />
      </div>
      <div className="h-4 w-px bg-border shrink-0" />
      <Input
        id={id}
        name={name}
        type="tel"
        size="sm"
        inputMode="tel"
        autoComplete="tel-national"
        dir="ltr"
        value={value.nationalNumber}
        disabled={disabled}
        required={required}
        onChange={(event) => handleNumberChange(event.target.value)}
        placeholder={numberPlaceholder}
        aria-label={numberPlaceholder}
        className="flex-1 rounded-none border-0 bg-transparent px-2.5 h-8 shadow-none focus-visible:ring-0 text-xs text-foreground placeholder:text-muted-foreground min-w-0"
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
      />
    </div>
  );
});

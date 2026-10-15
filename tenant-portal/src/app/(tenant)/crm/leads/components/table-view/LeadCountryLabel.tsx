"use client";

import { useI18n } from "@/i18n/I18nContext";
import { getCountryOptions } from "@/lib/geo/country-data";
import { leadCountryIso } from "../../lead-card-contract";

/**
 * The stored country with its flag. An unrecognised country shows its text
 * and no flag — never a guessed one.
 */
export function LeadCountryLabel({ country, city }: { country: string; city?: string }) {
  const { lang } = useI18n();
  const iso = leadCountryIso(country);
  const flag = getCountryOptions(lang).find(({ isoCode }) => isoCode === iso)?.flag;
  const text = [country.trim(), city?.trim()].filter(Boolean).join(" · ");

  return (
    <span className="flex min-w-0 items-center gap-1.5 whitespace-nowrap">
      {flag && <span aria-hidden="true" className="text-sm leading-none">{flag}</span>}
      <span className="truncate">{text}</span>
    </span>
  );
}

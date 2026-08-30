import type { Language } from "./I18nContext";

export type AdminPortalLocale = "ar-EG" | "en-US";

/** The product-wide numeral/date locale decision recorded as DS-07. */
export function localeForLanguage(lang: Language): AdminPortalLocale {
  return lang === "ar" ? "ar-EG" : "en-US";
}

export function formatLocaleNumber(
  lang: Language,
  value: number,
  options: Intl.NumberFormatOptions = {},
): string {
  return new Intl.NumberFormat(localeForLanguage(lang), options).format(value);
}

export interface PluralForms {
  zero: string;
  one: string;
  two: string;
  few: string;
  many: string;
  other: string;
}

/**
 * Arabic has six plural categories, so "1 تنبيهات" and "2 تنبيهات" are both
 * wrong the way "1 alerts" is. `Intl.PluralRules` already knows the rules
 * for both languages; the dictionary just supplies every form.
 */
export function pluralize(
  lang: Language,
  count: number,
  forms: PluralForms,
): string {
  try {
    return (
      forms[new Intl.PluralRules(localeForLanguage(lang)).select(count)] ??
      forms.other
    );
  } catch {
    return forms.other;
  }
}

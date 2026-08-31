import type { Language } from "@/i18n/useLanguage";

// Arabic renders Western digits — settled, not a fallback. See
// docs/design/typography.md#the-digit-decision--settled. Never pass
// undefined to Intl, which resolves to the runtime's default and is
// non-deterministic across machines and CI.
export const INTL_LOCALE: Record<Language, string> = {
  ar: "ar-EG-u-nu-latn",
  en: "en-US",
};

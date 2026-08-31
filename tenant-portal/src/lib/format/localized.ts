import type { Language } from "@/i18n/useLanguage";

// The one exemption to the zero-ternary rule, and the only place the syntax
// is allowed to live — docs/design/i18n.md#the-one-exemption-bilingual-data-fields.
//
// Choosing between two backend-supplied bilingual DATA fields is not a
// dictionary lookup and never can be: a tenant's own stage name is runtime
// data, unknown at build time. Routing every such site through this file
// keeps `design:census`'s languageTernaries counter meaningful — any match
// outside these three functions is a real violation.
//
// The fallback is the reason this is mandatory rather than optional: a tenant
// can leave one language blank, and an inline ternary renders an empty cell.

/**
 * Picks the value for the active language, falling back to the other one
 * when it is blank, then to an empty string.
 */
export function localizedValue(
  arabic: string | null | undefined,
  english: string | null | undefined,
  lang: Language,
): string {
  // Bilingual data selection, not UI copy. ESLint's ternary selectors only
  // fire on a Literal branch, so this needs no disable — but `design:census`
  // matches the syntax and counts it, which is why 3.17 baselines
  // languageTernaries at a floor rather than 0.
  const preferred = lang === "ar" ? arabic : english;
  return preferred || english || arabic || "";
}

export interface BilingualName {
  nameAr: string | null;
  nameEn: string | null;
}

/**
 * The `nameAr`/`nameEn` pair carried by lead stages, acquisition sources,
 * pipelines and opportunity stages.
 */
export function localizedName(
  item: BilingualName | null | undefined,
  lang: Language,
): string {
  if (!item) return "";
  return localizedValue(item.nameAr, item.nameEn, lang);
}

/**
 * The same choice made in the OTHER language, for the secondary line a few
 * screens show under the primary name. Never falls back to the primary
 * language — a duplicated name on both lines reads as a rendering bug.
 */
export function alternateName(
  item: BilingualName | null | undefined,
  lang: Language,
): string {
  if (!item) return "";
  return (lang === "ar" ? item.nameEn : item.nameAr) ?? "";
}

import type { Language } from "@/i18n/useLanguage";
import { INTL_LOCALE } from "./locale";

// A well-formed decimal, optionally signed and optionally exponent-free.
// Anything else is not a number we may format — see Money.tsx for why a
// malformed value is rendered verbatim rather than as "NaN".
const DECIMAL = /^[+-]?\d+(\.\d+)?$/;

/**
 * Formats a decimal **string** through `Intl` with an explicit locale, with no
 * float round-trip.
 *
 * `Intl.NumberFormat.prototype.format` accepts a string and formats its digits
 * exactly. The cast exists only because TypeScript types that overload as the
 * template-literal type `${number}`, which a runtime `string` cannot satisfy;
 * the regex is the real guard. Never `Number()` a decimal off the wire —
 * precision is lost silently past 2^53.
 *
 * A value that is not a well-formed decimal is returned unchanged.
 */
export function formatDecimalString(
  value: string,
  lang: Language,
  options?: Intl.NumberFormatOptions,
): string {
  const trimmed = value.trim();
  if (!DECIMAL.test(trimmed)) return value;
  return new Intl.NumberFormat(INTL_LOCALE[lang], options).format(trimmed as `${number}`);
}

/**
 * Formats a number this app computed itself — a count, an axis tick, a
 * percentage. Distinct from `formatDecimalString` on purpose: that one exists
 * to protect wire decimals, and widening it to accept `number` would make the
 * dangerous call look like the safe one.
 */
export function formatNumber(
  value: number,
  lang: Language,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(INTL_LOCALE[lang], options).format(value);
}

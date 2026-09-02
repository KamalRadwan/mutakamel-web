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

// Kibibytes and mebibytes are what the backend caps in (`25 * 1024 * 1024`),
// and `Intl` has no unit for them — so the number is divided by the binary
// factor and labelled with the decimal unit, the convention every
// operating-system file listing uses.
const BYTE_STEP = 1024;
const BYTE_UNITS = ["byte", "kilobyte", "megabyte", "gigabyte"] as const;
// A fraction below a megabyte is noise: "1.5 kB" tells a reader nothing "2 kB"
// does not. It starts mattering at the megabyte, where the step is large.
const FIRST_UNIT_WITH_A_FRACTION = BYTE_UNITS.indexOf("megabyte");

/**
 * Formats a byte count for display. **The** byte formatter — `formatFileSize`
 * in the CRM attachment code delegates here rather than keeping a second
 * implementation of the same arithmetic.
 *
 * The attachment-policy limit used to render as a locale-less number with the
 * English word "bytes" spliced onto it — two bugs in one line. The unit was
 * English on an otherwise Arabic screen, and a locale-conversion call with NO
 * argument resolves to the *runtime's* default locale, so the grouping
 * separators differed between a developer's machine, a user's browser and CI.
 * `Intl`'s `style: "unit"` supplies a translated unit for both languages, and
 * `INTL_LOCALE` supplies the explicit locale that makes the output
 * deterministic — the rule docs/design/i18n.md#dates-numbers-currency states.
 */
export function formatBytes(bytes: number, lang: Language): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  let value = bytes;
  let unitIndex = 0;
  while (value >= BYTE_STEP && unitIndex < BYTE_UNITS.length - 1) {
    value /= BYTE_STEP;
    unitIndex += 1;
  }
  return new Intl.NumberFormat(INTL_LOCALE[lang], {
    style: "unit",
    unit: BYTE_UNITS[unitIndex],
    unitDisplay: "short",
    maximumFractionDigits: unitIndex >= FIRST_UNIT_WITH_A_FRACTION ? 1 : 0,
  }).format(value);
}

"use client";

import { useLanguage, type Language } from "@/i18n/useLanguage";
import { INTL_LOCALE } from "@/lib/format/locale";
import { cn } from "../lib/cn";

export interface MoneyProps {
  /** The exact decimal string off the wire. Never a number — see the note below. */
  value: string;
  /** ISO 4217 code. Omitted, the value renders as a plain decimal. */
  currency?: string;
  /** Overrides the active language. This is formatting, not copy. */
  language?: Language;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  className?: string;
}

// A well-formed decimal, optionally signed. Anything else is not a number this
// component may format, and is rendered verbatim instead: a malformed value is
// still evidence the user needs to see, and "NaN" destroys it.
const DECIMAL = /^[+-]?\d+(\.\d+)?$/;

/**
 * Renders money from a decimal **string**.
 *
 * This is a correctness primitive, not a style one. `Number("9007199254740993.15")`
 * silently loses precision past 2^53 and rounds trailing digits, so a total can
 * come out wrong by cents on a large invoice and nothing anywhere reports it.
 *
 * `Intl.NumberFormat.prototype.format` accepts a string and formats the digits
 * exactly, with no float round-trip — that is the whole mechanism here. The
 * cast below is required only because TypeScript types that overload as the
 * template-literal type `${number}`, which a runtime `string` cannot satisfy;
 * the regex above is the actual guard.
 */
export function Money({
  value,
  currency,
  language,
  minimumFractionDigits,
  maximumFractionDigits,
  className,
}: MoneyProps) {
  const activeLanguage = useLanguage();
  const lang = language ?? activeLanguage;
  const trimmed = value.trim();

  if (!DECIMAL.test(trimmed)) {
    return <bdi className={cn("tabular-nums", className)}>{value}</bdi>;
  }

  const formatted = new Intl.NumberFormat(INTL_LOCALE[lang], {
    style: currency ? "currency" : "decimal",
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(trimmed as `${number}`);

  // <bdi> keeps a Latin-digit amount from being reordered by the bidi
  // algorithm when it sits inside Arabic copy — docs/design/theming.md#rtl.
  return <bdi className={cn("tabular-nums", className)}>{formatted}</bdi>;
}

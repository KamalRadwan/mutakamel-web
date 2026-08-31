"use client";

import { useLanguage, type Language } from "@/i18n/useLanguage";
import { INTL_LOCALE } from "@/lib/format/locale";
import { cn } from "../lib/cn";

export type DateTimePrecision = "date" | "datetime" | "time";

export interface DateTimeProps {
  /** The timestamp exactly as the wire sent it — an ISO 8601 string. */
  value: string;
  precision?: DateTimePrecision;
  /** Overrides the active language. This is formatting, not copy. */
  language?: Language;
  /** IANA zone, e.g. "Africa/Cairo". Omitted, the browser's zone is used. */
  timeZone?: string;
  className?: string;
}

// Explicit fields, not `dateStyle: "medium"`, and the difference is not
// cosmetic: ar-EG's own medium style is all-numeric (`15‏/03‏/2026`), which
// contradicts typography.md's rule that Arabic keeps the locale's **month
// names** and changes only the numerals. Naming the fields yields
// `15 مارس 2026` in Arabic and the identical `Mar 15, 2026` in English.
export const DATE_TIME_OPTIONS: Record<DateTimePrecision, Intl.DateTimeFormatOptions> = {
  date: { year: "numeric", month: "short", day: "numeric" },
  datetime: { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
  time: { hour: "numeric", minute: "2-digit" },
};

/**
 * Renders a timestamp with the same discipline `Money` applies to decimals.
 *
 * The locale is always explicit: `Intl` with `undefined` resolves to the
 * runtime's default, which differs between a developer's laptop, a colleague's
 * and CI, so a snapshot that passes locally can fail in the pipeline for
 * reasons unrelated to the change. Arabic gets Arabic month names with Western
 * digits via `ar-EG-u-nu-latn` — settled in typography.md.
 *
 * The machine-readable value is preserved in `<time dateTime>` regardless of
 * how it is displayed.
 */
export function DateTime({
  value,
  precision = "datetime",
  language,
  timeZone,
  className,
}: DateTimeProps) {
  const activeLanguage = useLanguage();
  const lang = language ?? activeLanguage;
  const parsed = new Date(value);

  // An unparseable timestamp is still evidence. Render it as-is rather than
  // "Invalid Date", and drop the <time> wrapper — a dateTime attribute the
  // parser rejected is not a machine-readable value.
  if (Number.isNaN(parsed.getTime())) {
    return <span className={cn("tabular-nums", className)}>{value}</span>;
  }

  const formatted = new Intl.DateTimeFormat(INTL_LOCALE[lang], {
    ...DATE_TIME_OPTIONS[precision],
    timeZone,
  }).format(parsed);

  return (
    <time dateTime={value} className={cn("tabular-nums", className)}>
      {formatted}
    </time>
  );
}

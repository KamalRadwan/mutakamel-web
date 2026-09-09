import type { Language } from "@/i18n/useLanguage";
import { INTL_LOCALE } from "./locale";

// Dates use the Arabic locale's month names and ordering — only the
// numerals are Latin. A malformed value renders as-is rather than "Invalid
// Date", since it is still evidence worth showing.
export function formatDateTime(value: string, lang: Language): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(INTL_LOCALE[lang], { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function formatDate(value: string, lang: Language): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(INTL_LOCALE[lang], { dateStyle: "medium" }).format(date);
}

/**
 * All digits: `06/09/2026 08:01 AM`.
 *
 * For a LOG, where every row carries a timestamp and a reader compares them to
 * each other rather than reading each as a sentence. A month name is longer, is
 * a different width in the two languages, and makes two rows a minute apart
 * hard to line up — which is what `dateStyle: "medium"` gives, and why this is
 * a second formatter rather than an option on the first.
 *
 * Day before month in BOTH languages, and `hour12` stated: `en-US` would
 * otherwise put the month first, and the two dictionaries would then disagree
 * about what `06/09` means in a screenshot pasted into a ticket.
 */
export function formatDateTimeNumeric(value: string, lang: Language): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat(INTL_LOCALE[lang], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const at = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  // Assembled from parts rather than taken as one formatted string: the locale
  // decides the ORDER, and the point of this format is that the order does not
  // change between the two languages.
  return `${at("day")}/${at("month")}/${at("year")} ${at("hour")}:${at("minute")} ${at("dayPeriod")}`.trim();
}

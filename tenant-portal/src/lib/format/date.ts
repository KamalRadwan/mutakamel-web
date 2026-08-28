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

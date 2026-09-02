import { formatBytes } from "@/lib/format/number";
import type { Language } from "@/i18n/useLanguage";

/**
 * A byte count as a localized size.
 *
 * Kept as a named CRM helper because two attachment call sites and a contract
 * test refer to it, but the arithmetic now lives in one place:
 * `formatBytes` in `src/lib/format/number.ts`. This file used to carry its own
 * copy of the unit ladder, which is how the static-data catalogue ended up
 * formatting the same quantity a third way — a locale-less conversion with the
 * English word "bytes" appended (U10).
 *
 * The unit name comes from `Intl`'s own unit formatting rather than a
 * dictionary key, so it is declined correctly in both languages without this
 * app inventing plural rules.
 */
export function formatFileSize(bytes: number, lang: Language): string {
  return formatBytes(bytes, lang);
}

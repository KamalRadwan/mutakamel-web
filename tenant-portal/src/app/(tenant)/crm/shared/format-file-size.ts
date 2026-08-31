import { formatNumber } from "@/lib/format/number";
import type { Language } from "@/i18n/useLanguage";

const KIB = 1024;
const MIB = KIB * KIB;

/**
 * A byte count as a localized size.
 *
 * The unit name comes from `Intl`'s own unit formatting rather than a
 * dictionary key, so it is declined correctly in both languages without this
 * app inventing plural rules. `formatNumber` is the right helper here and
 * `formatDecimalString` is not: a size is a count this client computed, not a
 * decimal off the wire.
 *
 * Kibibytes and mebibytes are what the backend caps in (`25 * 1024 * 1024`),
 * and `Intl` has no unit for them — so the number is divided by the binary
 * factor and labelled with the decimal unit, the same convention every
 * operating-system file listing uses.
 */
export function formatFileSize(bytes: number, lang: Language): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < KIB) {
    return formatNumber(bytes, lang, {
      style: "unit",
      unit: "byte",
      unitDisplay: "short",
      maximumFractionDigits: 0,
    });
  }
  if (bytes < MIB) {
    return formatNumber(bytes / KIB, lang, {
      style: "unit",
      unit: "kilobyte",
      unitDisplay: "short",
      maximumFractionDigits: 0,
    });
  }
  return formatNumber(bytes / MIB, lang, {
    style: "unit",
    unit: "megabyte",
    unitDisplay: "short",
    maximumFractionDigits: 1,
  });
}

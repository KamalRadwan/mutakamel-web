/**
 * Projection of `backend/mutakamel-apps/core-app/src/common/money/iso4217-minor-units.ts`.
 *
 * ISO-4217 minor units default to 2 fractional digits except for 17 zero-unit,
 * 7 three-unit, and 2 four-unit currencies. Spendable-code validity (including
 * rejection of non-spendable XAU/XAG/XPD/XPT/XDR/XSU/XUA/XTS/XXX and unknown
 * three-letter codes) remains authoritatively enforced by `CurrenciesService.create`
 * on the server.
 */
export const DEFAULT_CURRENCY_MINOR_UNITS = 2;

export const ISO4217_MINOR_UNIT_EXCEPTIONS: Readonly<Record<string, number>> = Object.freeze({
  // Zero fractional digits (17)
  BIF: 0,
  CLP: 0,
  DJF: 0,
  GNF: 0,
  ISK: 0,
  JPY: 0,
  KMF: 0,
  KRW: 0,
  PYG: 0,
  RWF: 0,
  UGX: 0,
  UYI: 0,
  VND: 0,
  VUV: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,
  // Three fractional digits (7)
  BHD: 3,
  IQD: 3,
  JOD: 3,
  KWD: 3,
  LYD: 3,
  OMR: 3,
  TND: 3,
  // Four fractional digits (2)
  CLF: 4,
  UYW: 4,
});

export function currencyMinorUnits(code: string): number {
  const normalized = code.trim().toUpperCase();
  return ISO4217_MINOR_UNIT_EXCEPTIONS[normalized] ?? DEFAULT_CURRENCY_MINOR_UNITS;
}

/**
 * Non-spendable ISO-4217 precious-metal, supranational, test, and no-currency
 * codes rejected by `CurrenciesService.assertIsoCurrencyCode` via
 * `backend/mutakamel-apps/core-app/src/common/money/iso4217-minor-units.ts`.
 */
export const ISO4217_NON_SPENDABLE_CODES: ReadonlySet<string> = new Set([
  "XDR",
  "XSU",
  "XUA",
  "XAU",
  "XAG",
  "XPD",
  "XPT",
  "XTS",
  "XXX",
]);

/**
 * Enumerates runtime-supported spendable 3-letter ISO-4217 currency codes using
 * `Intl.supportedValuesOf('currency')`, excluding server-rejected non-spendable
 * codes. Returns `[]` when enumeration is unavailable so the form falls back to
 * free-code entry without inventing currency metadata; Core remains authoritative.
 */
export function supportedSpendableCurrencyCodes(): readonly string[] {
  if (typeof Intl === "undefined") return [];
  const supportedValuesOf = (
    Intl as typeof Intl & { supportedValuesOf?: (key: "currency") => string[] }
  ).supportedValuesOf;
  if (typeof supportedValuesOf !== "function") return [];

  try {
    const rawCodes = supportedValuesOf.call(Intl, "currency");
    if (!Array.isArray(rawCodes)) return [];
    const unique = new Set<string>();
    for (const entry of rawCodes) {
      if (typeof entry !== "string") continue;
      const normalized = entry.trim().toUpperCase();
      if (/^[A-Z]{3}$/u.test(normalized) && !ISO4217_NON_SPENDABLE_CODES.has(normalized)) {
        unique.add(normalized);
      }
    }
    return [...unique].sort();
  } catch {
    return [];
  }
}

/**
 * Returns the fixed ISO-4217 minor-unit precision once a three-letter ASCII
 * code is entered, or `null` while the code input is blank or incomplete so the
 * form never implies an editable or pre-chosen precision before code entry.
 */
export function deriveCurrencyMinorUnits(code: string): number | null {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z]{3}$/u.test(normalized)) return null;
  return currencyMinorUnits(normalized);
}

// CRM opportunity amounts are numeric(20,3), but writes require JSON numbers.
// Keep reads as strings; only convert writes after checking currency scale and
// the exact decimal JSON will emit. Three-decimal values near the existing
// 13-integer-digit ceiling can lose a minor unit, so the round-trip check binds.

/** Existing client ceiling; each value must also pass the round-trip check. */
export const MONEY_MAX_INTEGER_DIGITS = 13;

/** The two-decimal ceiling; three-decimal values need their own exact check. */
export const MONEY_MAX_AMOUNT = "9999999999999.99";

const MONEY_SHAPE = new RegExp(`^\\d{1,${MONEY_MAX_INTEGER_DIGITS}}(\\.\\d{1,3})?$`);

// Mirrors crm-app/src/crm/opportunities/opportunities.service.ts (CRM-OPP-018).
const CURRENCY_MINOR_UNITS = new Map<string, number>([
  ["KWD", 3], ["BHD", 3], ["OMR", 3], ["JOD", 3], ["TND", 3], ["LYD", 3], ["IQD", 3],
  ["JPY", 0], ["KRW", 0], ["VND", 0], ["CLP", 0], ["ISK", 0],
]);

/** Thrown, never rendered: the screens validate first and map their own words. */
export const MONEY_OUT_OF_RANGE = "CRM_AMOUNT_OUT_OF_SAFE_RANGE";
export const MONEY_SCALE_INVALID = "CRM_AMOUNT_SCALE_INVALID";

function hasCurrencyScale(value: string, currencyCode: string): boolean {
  const scale = CURRENCY_MINOR_UNITS.get(currencyCode.trim().toUpperCase()) ?? 2;
  const fraction = value.split(".")[1]?.replace(/0+$/, "") ?? "";
  return fraction.length <= scale;
}

/**
 * The decimal the wire will actually carry, with no trailing zeros.
 *
 * `String(aNumber)` produces the SHORTEST decimal that reads back as the same
 * double, and `JSON.stringify` uses that same algorithm — so comparing against
 * this canonical form is a direct check of "the JSON we are about to emit is
 * the amount the user typed", not an approximation of one.
 */
function canonicalDecimal(value: string): string {
  const [whole, fraction = ""] = value.split(".");
  const digits = whole.replace(/^0+(?=\d)/, "");
  const decimals = fraction.replace(/0+$/, "");
  return decimals.length > 0 ? `${digits}.${decimals}` : digits;
}

/**
 * Whether an amount fits its currency and survives JSON without rounding.
 * An empty box is valid — it means "no amount".
 */
export function isExactMoneyDecimal(value: string, currencyCode = ""): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;
  if (!MONEY_SHAPE.test(trimmed) || !hasCurrencyScale(trimmed, currencyCode)) return false;
  return String(Number(trimmed)) === canonicalDecimal(trimmed);
}

/**
 * The JSON number for a typed amount, or `undefined` for an empty box.
 *
 * Throws rather than rounding: an amount that cannot be represented exactly is
 * a refusal the user has to see, never a value silently written to a column
 * that would have stored it correctly.
 */
export function toMoneyWireNumber(value: string, currencyCode = ""): number | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  if (!MONEY_SHAPE.test(trimmed) || String(Number(trimmed)) !== canonicalDecimal(trimmed)) {
    throw new Error(MONEY_OUT_OF_RANGE);
  }
  if (!hasCurrencyScale(trimmed, currencyCode)) throw new Error(MONEY_SCALE_INVALID);
  return Number(trimmed);
}

// The one place a money amount crosses from a decimal string into the JSON
// number the CRM write DTOs demand — defect D3.
//
// Every money column in CRM is `numeric(18, 2)` and is exact. Every money DTO
// field is `@IsNumber({ maxDecimalPlaces: 2 })`, so JSON must carry a
// **number**: there is no string form the backend accepts, and the conversion
// cannot be avoided on the way out. What CAN be avoided is doing it silently
// outside the range where it is lossless.
//
// The previous guard allowed 15 integer digits "because the integer part stays
// below 2^53". That reasoning is wrong: the integer part is not what has to
// survive, the value WITH its cents does.
//
//   Number("999999999999999.99")   -> 1000000000000000     (a whole unit gained)
//   Number("99999999999999.99")    -> 99999999999999.98    (a cent lost)
//
// Two conditions make the conversion exact, and the tighter one binds:
//
//   a) adjacent doubles must be closer together than one cent, so two amounts
//      one cent apart cannot collapse onto the same double. The gap is 2^-7
//      below 2^46 = 70_368_744_177_664 and 2^-6 above it, so the value must
//      stay under 2^46;
//   b) the amount in minor units must itself be a safe integer (< 2^53).
//
// (a) is the stricter of the two, and 13 integer digits — 9_999_999_999_999.99,
// about 1e13 — sits comfortably inside it while staying a rule a person can
// check by counting. That is 4 orders of magnitude below what numeric(18, 2)
// stores, so an amount this rejects is one the wire could not have carried
// faithfully anyway.
//
// Nothing converts a money value on the way IN. Amounts arrive as decimal
// strings and render through `Money`; only this direction exists.

/** The widest integer part whose cents survive the trip through a double. */
export const MONEY_MAX_INTEGER_DIGITS = 13;

/** `9_999_999_999_999.99` — the largest amount `toMoneyWireNumber` accepts. */
export const MONEY_MAX_AMOUNT = "9999999999999.99";

const MONEY_SHAPE = new RegExp(`^\\d{1,${MONEY_MAX_INTEGER_DIGITS}}(\\.\\d{1,2})?$`);

/** Thrown, never rendered: the screens validate first and map their own words. */
export const MONEY_OUT_OF_RANGE = "CRM_AMOUNT_OUT_OF_SAFE_RANGE";

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
  const cents = fraction.replace(/0+$/, "");
  return cents.length > 0 ? `${digits}.${cents}` : digits;
}

/**
 * Whether a typed amount is a 2-decimal value this client can send without
 * losing a cent. An empty box is valid — it means "no amount".
 */
export function isExactMoneyDecimal(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;
  if (!MONEY_SHAPE.test(trimmed)) return false;
  return String(Number(trimmed)) === canonicalDecimal(trimmed);
}

/**
 * The JSON number for a typed amount, or `undefined` for an empty box.
 *
 * Throws rather than rounding: an amount that cannot be represented exactly is
 * a refusal the user has to see, never a value silently written to a column
 * that would have stored it correctly.
 */
export function toMoneyWireNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  if (!isExactMoneyDecimal(trimmed)) throw new Error(MONEY_OUT_OF_RANGE);
  return Number(trimmed);
}

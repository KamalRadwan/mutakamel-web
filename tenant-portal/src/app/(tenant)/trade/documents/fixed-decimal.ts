// A line-for-line port of trade-app's `src/common/fixed-decimal.ts`.
//
// This exists because Trade makes the **browser** the calculator and the
// server the referee: `CreateSalesOrderDto`, `CreatePurchaseOrderDto`,
// `ConvertQuotationDto`, `CreateInvoiceDto` and `CreateContractDto` all carry
// complete per-line and document totals, and
// `validateNewOrderFinancialEvidence`
// (trade-app/src/modules/documents/order-print-snapshot.service.ts) plus
// `validateInvoiceTotals`
// (trade-app/src/modules/financial-documents/financial-documents.service.ts)
// recompute every figure and reject the request when any of them disagrees.
//
// Two of those comparisons are **exact string equality**, not a numeric
// compare — `totals.subtotal !== subtotal` in `validateInvoiceTotals`. So it
// is not enough to be numerically right: the browser has to produce the same
// *text* the server's `fixedDecimalText` would, which strips trailing zeros.
// `"10.50"` is a rejection where `"10.5"` is accepted. That is the whole
// reason this is a port rather than an approximation, and the reason nothing
// here ever touches `Number`.
//
// All arithmetic is `bigint` in units of 1e-8. `Number` cannot represent the
// domain: `numeric(24,8)` reaches 10^16 whole units, which is past 2^53.

// `numeric(24,8)` — eight decimal places, so one unit is 1e-8.
//
// Written as `BigInt(...)` calls rather than `1n` literals throughout: this
// project's tsconfig targets ES2017, where a BigInt literal is a compile error
// (TS2737), while the `esnext` lib still supplies the type and the global. The
// arithmetic is identical to trade-app's.
const ZERO_UNITS = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);
const FIXED_DECIMAL_SCALE = BigInt("100000000");

/**
 * Non-negative canonical decimal — the DTO's `NON_NEGATIVE_DECIMAL_PATTERN`.
 * No leading zeros, and a fractional part of one to eight digits when present.
 */
export const NON_NEGATIVE_DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/u;

/** `SIGNED_DECIMAL_PATTERN` — orders allow a negative `roundingTotal`. */
export const SIGNED_DECIMAL = /^-?(?:0|[1-9]\d*)(?:\.\d{1,8})?$/u;

/** `POSITIVE_DECIMAL_PATTERN` — non-negative and not zero, for a quantity. */
export const POSITIVE_DECIMAL = /^(?!0(?:\.0{1,8})?$)(?:0|[1-9]\d*)(?:\.\d{1,8})?$/u;

/** The canonical text for zero. The server compares `amountPaid` to it literally. */
export const DECIMAL_ZERO = "0";

class FixedDecimalError extends Error {
  constructor() {
    super("Value must be a decimal string with at most eight decimal places.");
    this.name = "FixedDecimalError";
  }
}

/** `fixedDecimalUnits` — parses to signed 1e-8 units, or throws. */
export function fixedDecimalUnits(value: string): bigint {
  const sign = value.startsWith("-") ? -ONE : ONE;
  const unsigned = sign < ZERO_UNITS ? value.slice(1) : value;
  const [whole, fraction = ""] = unsigned.split(".");
  if (!whole || !/^\d+$/u.test(whole) || !/^\d{0,8}$/u.test(fraction)) {
    throw new FixedDecimalError();
  }
  return sign * (BigInt(whole) * FIXED_DECIMAL_SCALE + BigInt(fraction.padEnd(8, "0")));
}

/**
 * `fixedDecimalText` — renders units back to text with **trailing zeros
 * stripped**.
 *
 * This is the trap task 11.21 names: `10.50` comes back as `"10.5"` and
 * `10.00` as `"10"`. A string comparison against a padded form fails, and so
 * does a submitted total that pads.
 */
export function fixedDecimalText(value: bigint): string {
  const sign = value < ZERO_UNITS ? "-" : "";
  const absolute = value < ZERO_UNITS ? -value : value;
  const whole = absolute / FIXED_DECIMAL_SCALE;
  const fraction = (absolute % FIXED_DECIMAL_SCALE)
    .toString()
    .padStart(8, "0")
    .replace(/0+$/u, "");
  return `${sign}${whole}${fraction ? `.${fraction}` : ""}`;
}

/** Numeric ordering, so `"10.5"` and `"10.50"` compare equal. */
export function compareFixedDecimal(left: string, right: string): number {
  const difference = fixedDecimalUnits(left) - fixedDecimalUnits(right);
  return difference < ZERO_UNITS ? -1 : difference > ZERO_UNITS ? 1 : 0;
}

export function addFixedDecimal(left: string, right: string): string {
  return fixedDecimalText(fixedDecimalUnits(left) + fixedDecimalUnits(right));
}

export function subtractFixedDecimal(left: string, right: string): string {
  return fixedDecimalText(fixedDecimalUnits(left) - fixedDecimalUnits(right));
}

/**
 * `multiplyFixedDecimal` — half-up on the **magnitude**, so a negative product
 * rounds away from zero rather than toward it.
 *
 * The server rounds the same way, and quantity × unitPrice is the only
 * multiplication in any of the identities, so this rounding rule is the single
 * place a correct client and a correct server can still disagree.
 */
export function multiplyFixedDecimal(left: string, right: string): string {
  const product = fixedDecimalUnits(left) * fixedDecimalUnits(right);
  const sign = product < ZERO_UNITS ? -ONE : ONE;
  const absolute = product < ZERO_UNITS ? -product : product;
  return fixedDecimalText(
    sign * ((absolute + FIXED_DECIMAL_SCALE / TWO) / FIXED_DECIMAL_SCALE),
  );
}

export function sumFixedDecimals(values: readonly string[]): string {
  return fixedDecimalText(
    values.reduce((total, value) => total + fixedDecimalUnits(value), ZERO_UNITS),
  );
}

/**
 * Normalizes typed input into the canonical form the DTO patterns accept.
 *
 * Returns `null` rather than throwing, because this runs on every keystroke of
 * a quantity field. `"007"`, `"1."` and `"10.50"` are all things a person
 * types and none of them is a value the server accepts; `"7"`, `"1"` and
 * `"10.5"` are.
 */
export function canonicalizeDecimalInput(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (!/^-?\d*(?:\.\d*)?$/u.test(trimmed) || !/\d/u.test(trimmed)) return null;
  // A leading "." and a trailing "." are both things people type and neither is
  // parseable: `fixedDecimalUnits` requires a whole part and rejects an empty
  // fraction. Supplying the implied digits here keeps ".5" usable without
  // loosening what is ultimately sent.
  const padded = trimmed.replace(/^(-?)\./u, "$10.").replace(/\.$/u, "");
  try {
    return fixedDecimalText(fixedDecimalUnits(padded));
  } catch {
    return null;
  }
}

/** True when the value is already canonical **and** matches the DTO pattern. */
export function isCanonicalDecimal(value: unknown, pattern: RegExp): value is string {
  if (typeof value !== "string" || !pattern.test(value)) return false;
  try {
    return fixedDecimalText(fixedDecimalUnits(value)) === value;
  } catch {
    return false;
  }
}

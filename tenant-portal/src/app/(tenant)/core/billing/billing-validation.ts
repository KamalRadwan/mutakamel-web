import { requiredText } from "../contracts/core-page";

// The wire guards every Core billing contract in this route group shares.
//
// They live apart from the shapes they validate because three files use them —
// the invoice/summary contract, the collection flow and the wallet histories —
// and because the rule they encode is one rule, not three: **money is an exact
// decimal string and stays one**. `Number()`, `parseFloat`, `+value` and plain
// arithmetic all lose precision silently, so nothing here ever produces a
// number from a value that arrived as a decimal.

export function invalidBillingResponse(): never {
  throw new Error("Invalid Core billing response.");
}

// `numeric(18,4)` and `numeric(12,2)` columns arrive as exact decimal strings.
// The bound is generous on purpose: this validates the SHAPE, and clamping the
// scale here would silently reject a wider column rather than surface it.
const DECIMAL_STRING = /^-?\d{1,20}(?:\.\d{1,8})?$/u;

function isDecimalString(value: unknown): value is string {
  return typeof value === "string" && DECIMAL_STRING.test(value);
}

export function requiredDecimal(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (!isDecimalString(value)) invalidBillingResponse();
  return value;
}

export function nullableDecimal(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  if (value === undefined || value === null) return null;
  if (!isDecimalString(value)) invalidBillingResponse();
  return value;
}

export function nullableTimestamp(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || Number.isNaN(new Date(value).getTime())) {
    invalidBillingResponse();
  }
  return value;
}

/**
 * A lifecycle value kept as the raw wire string.
 *
 * Deliberately not narrowed to a union: an unrecognised status must reach the
 * badge's raw fallback rather than throw. One new backend enum value should not
 * be able to blank the screen a tenant settles invoices on
 * (docs/architecture/data-layer.md#runtime-response-validation).
 */
export function wireEnum(source: Record<string, unknown>, key: string): string {
  return requiredText(source, key, 64);
}

export function nullableWireEnum(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.length === 0 || value.length > 64) {
    invalidBillingResponse();
  }
  return value;
}

/** The three-letter collection currency codes Core validates with `/^[A-Z]{3}$/`. */
export function currencyCode(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (typeof value !== "string" || !/^[A-Z]{3}$/u.test(value)) invalidBillingResponse();
  return value;
}

/** `PaginationQueryDto` — Core caps `limit` at 100. */
export const BILLING_PAGE_SIZE = 20;

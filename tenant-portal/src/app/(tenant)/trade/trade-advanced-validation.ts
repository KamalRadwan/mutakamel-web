// Runtime guards shared by the Phase 12 Trade contracts (inventory, pricing,
// governance, automation, analytics).
//
// Every response passes a validator before it reaches the UI (AGENTS.md, S3).
// This mirrors `core/core-validation.ts` beside `core/core-api.ts`: one small
// kernel per route group, hand-written because the shapes are flat.
//
// Trade differs from Core in three ways that live here rather than in each
// screen — see docs/api/trade-advanced.md#pagination--three-dialects-and-some-lists-have-none:
//
//   offset page   { items, total, page, limit }   most families
//   limit only    { items }                       no `total` is sent at all
//   limit+offset  { items, pagination }           GET /dashboards, and only it

const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

/** Trade money and quantity: `numeric` columns, at most 8 decimal places. */
const DECIMAL_STRING = /^-?\d+(\.\d{1,8})?$/u;

/** `^[A-Z][A-Z0-9_.-]{1,99}$` — the governed-code pattern on every Create DTO. */
import { wireLabel } from "@/lib/format/wire-label";

export const GOVERNED_CODE_PATTERN = /^[A-Z][A-Z0-9_.-]{1,99}$/u;

/** The shorter variant inventory periods and reason codes use. */
export const INVENTORY_CODE_PATTERN = /^[A-Z][A-Z0-9_.-]{1,79}$/u;

export function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function isUuidV7(value: unknown): value is string {
  return typeof value === "string" && UUID_V7_PATTERN.test(value);
}

export function isTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return !Number.isNaN(new Date(value).getTime());
}

export function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

export function isBoundedInteger(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
}

/**
 * A `numeric` column. It stays a string all the way to `Money` — `Number()`
 * on any of these is silent precision loss on financial data (S5).
 */
export function isDecimalString(value: unknown): value is string {
  return typeof value === "string" && DECIMAL_STRING.test(value);
}

export function isNullableDecimalString(value: unknown): value is string | null {
  return value === null || isDecimalString(value);
}

/** An optional free-text column: absent, null, or a bounded string. */
export function isOptionalText(value: unknown, maxLength: number): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.length <= maxLength)
  );
}

/** A member of a closed wire enum, checked against the literal list. */
export function isMemberOf<T extends string>(
  value: unknown,
  members: readonly T[],
): value is T {
  return typeof value === "string" && (members as readonly string[]).includes(value);
}

/**
 * A value the server sends that no enum in source closes.
 *
 * Control tower's `severity` and `retryClass` are the two documented cases
 * (docs/api/trade-advanced.md#not-verified): the filter list, the exported enum
 * and the literals actually written disagree, so an unknown string is a normal
 * outcome and must render as itself rather than being mapped or dropped.
 */
export function asOpenEnum(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= 64 ? value : null;
}

/**
 * The label for a wire value.
 *
 * Every enum rendered needs a `t.*` label (AGENTS.md) and this page's closed
 * enums all have one. A fallback is still needed for the ones source does
 * **not** close — control tower's `severity` and `retryClass`, and the inline
 * `@IsIn` lists on inventory query DTOs that no exported enum pins. The code
 * must stay visible there; a blank cell or a mapped guess is not the answer
 * (docs/api/trade-advanced.md#not-verified).
 *
 * It used to return the wire value **bare**, so an unpinned enum reached an
 * Arabic screen as an English SCREAMING_CASE token and nothing anywhere
 * recorded that a label was owed. `wireLabel` keeps the code visible, puts a
 * translated sentence around it, and warns once per unseen value.
 */
export function tradeStatusLabel(
  labels: Readonly<Record<string, string | undefined>>,
  value: string,
  unknown: string,
): string {
  return wireLabel(labels, value, unknown, "tradeStatus");
}

/** `{ items, total, page, limit }` — flat, with no `meta` and no `totalPages`. */
export interface TradeOffsetPage<T> {
  readonly items: T[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

export function parseTradeOffsetPage<T>(
  payload: unknown,
  parseItem: (value: unknown) => T,
  invalid: () => never,
): TradeOffsetPage<T> {
  const page = record(payload);
  if (
    !page ||
    !Array.isArray(page.items) ||
    !isBoundedInteger(page.total, 0, Number.MAX_SAFE_INTEGER) ||
    !isBoundedInteger(page.page, 1, Number.MAX_SAFE_INTEGER) ||
    !isBoundedInteger(page.limit, 1, 100)
  ) {
    invalid();
  }
  return { items: page.items.map(parseItem), total: page.total, page: page.page, limit: page.limit };
}

/**
 * A `{ items }` list with no `total` — `GET /widgets` and the webhook event
 * catalogue. "Is there more?" is unanswerable, so no page object is derived.
 */
export function parseTradeItemList<T>(
  payload: unknown,
  parseItem: (value: unknown) => T,
  invalid: () => never,
): T[] {
  const body = record(payload);
  if (!body || !Array.isArray(body.items)) invalid();
  return body.items.map(parseItem);
}

/**
 * A **bare array** under `data`.
 *
 * Every inventory read is one: `listNodes`, `listPeriods`,
 * `listUomConversions`, `listSerials` and `listDecisions` all end in
 * TypeORM's `getMany()` (or a `.map()` over it) and return the array itself —
 * there is no `items` wrapper and no `total`, so `limit` is a ceiling and
 * `rows.length === limit` is the only "there may be more" signal
 * (trade-app/src/modules/inventory/inventory-governance.service.ts).
 */
export function parseTradeArray<T>(
  payload: unknown,
  parseItem: (value: unknown) => T,
  invalid: () => never,
): T[] {
  if (!Array.isArray(payload)) invalid();
  return payload.map(parseItem);
}

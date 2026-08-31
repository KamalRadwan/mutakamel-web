// Hand-written runtime guards shared by the Core settings contracts.
//
// Every response passes a validator before it reaches the UI (AGENTS.md).
// The five settings modules validate by hand — the shapes are small and flat;
// `core/notifications/` uses zod, matching the runtime it reuses. The split is
// per module, never inside one (docs/architecture/data-layer.md).

const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

/** Core rows are `bigint`/`numeric` columns serialised as exact decimal strings. */
const UNSIGNED_INTEGER_STRING = /^\d{1,20}$/u;
const DECIMAL_STRING = /^-?\d+(\.\d+)?$/u;

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
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

export function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

export function isBoundedInteger(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
}

/**
 * A `bigint` column arrives as a string and must stay one — a numbering
 * sequence can outrun `Number.MAX_SAFE_INTEGER`, so `Number()` here would
 * silently corrupt it (docs/architecture/data-layer.md#decimals).
 */
export function isUnsignedIntegerString(value: unknown): value is string {
  return typeof value === "string" && UNSIGNED_INTEGER_STRING.test(value);
}

/** A `numeric` column: exact decimal string, formatted for display only. */
export function isDecimalString(value: unknown): value is string {
  return typeof value === "string" && DECIMAL_STRING.test(value);
}

export function isNullableDecimalString(value: unknown): value is string | null {
  return value === null || isDecimalString(value);
}

export type ActiveStatus = "ACTIVE" | "INACTIVE";

/** `ActiveStatusEnum` — core-app/packages/database/src/enums/active-status.enum.ts. */
export function isActiveStatus(value: unknown): value is ActiveStatus {
  return value === "ACTIVE" || value === "INACTIVE";
}

export interface CorePage<T> {
  readonly items: T[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

/**
 * `PaginatedResult<T>` — shared-libs/packages/database/src/interfaces/
 * paginated-result.interface.ts. `totalPages`/`hasNext`/`hasPrev` also ride
 * along; `Pagination` derives what it needs from total/page/limit, so they are
 * read but not re-exposed.
 */
export function parseCorePage<T>(
  payload: unknown,
  parseItem: (value: unknown) => T,
  invalid: () => never,
): CorePage<T> {
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
  return {
    items: page.items.map(parseItem),
    total: page.total,
    page: page.page,
    limit: page.limit,
  };
}

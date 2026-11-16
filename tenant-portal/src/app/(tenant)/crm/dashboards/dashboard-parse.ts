// Shared runtime-validation primitives for the CRM dashboards and widgets
// contracts (S3).
//
// One module rather than a copy in each of the five contract files: the
// dashboards family has more wire shapes than any other CRM screen, and five
// hand-copied `record()` helpers is exactly the duplication the cleanliness
// rules forbid.

export function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function optionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/**
 * A finite JSON number.
 *
 * Dashboard values arrive as **numbers**, not decimal strings — every money
 * aggregate in `dashboards.service.ts` is cast `::float`, and
 * `dashboard-execution.service.ts` runs every point through `Number()`. See
 * docs/api/crm-dashboards.md#money-is-a-number-here-not-a-decimal-string.
 */
export function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function timestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(new Date(value).getTime());
}

export function civilDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function civilDateRange(value: unknown) {
  const range = record(value);
  return civilDate(range?.from) && civilDate(range?.to) && range.from <= range.to
    ? { from: range.from, to: range.to }
    : null;
}

export function stringArray(value: unknown, max: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= max &&
    value.every((entry) => typeof entry === "string")
  );
}

export function boundedArray(value: unknown, max: number): value is unknown[] {
  return Array.isArray(value) && value.length <= max;
}

export function invalidResponse(what: string): never {
  throw new Error(`Invalid CRM ${what} response.`);
}

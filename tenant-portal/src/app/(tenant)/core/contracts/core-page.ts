import { isUUIDv7 } from "@/lib/uuid";

// Shared response primitives for Core identity and settings screens under
// `app/(tenant)/core/`.
//
// This sits at the Core segment root rather than inside one screen because
// organization, users and roles are three views of ONE backend resource graph:
// the invite drawer needs company/branch/department/team, the user detail needs
// roles, and the role editor needs the permission catalogue. Duplicating the
// envelope reader and the guard helpers four times is the outcome
// file-architecture.md#cleanliness-rules forbids, and a sibling-screen import
// of a whole parse module is more than the "narrow, named type/enum" the
// dependency rules allow. A parent-segment module is neither.

/** Core's `PaginationQueryDto` upper bound (`PAGINATION_DEFAULTS.MAX_LIMIT`). */
export const CORE_MAX_PAGE_LIMIT = 100;
const CORE_LIST_PAGE_SIZE = 25;
export const CORE_LIST_RESPONSE_LIMIT_BYTES = 1_000_000;
export const CORE_DETAIL_RESPONSE_LIMIT_BYTES = 250_000;
export const CORE_WRITE_RESPONSE_LIMIT_BYTES = 250_000;

export interface CorePageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface CorePage<T> extends CorePageMeta {
  items: T[];
}

export function invalidCoreResponse(): never {
  throw new Error("Invalid Core identity response.");
}

export function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function requiredUuidV7(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (!isUUIDv7(value)) invalidCoreResponse();
  return value;
}

export function nullableUuidV7(
  source: Record<string, unknown>,
  key: string,
): string | null {
  const value = source[key];
  if (value === undefined || value === null) return null;
  if (!isUUIDv7(value)) invalidCoreResponse();
  return value;
}

export function requiredText(
  source: Record<string, unknown>,
  key: string,
  maxLength: number,
): string {
  const value = source[key];
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) {
    invalidCoreResponse();
  }
  return value;
}

export function nullableText(
  source: Record<string, unknown>,
  key: string,
  maxLength: number,
): string | null {
  const value = source[key];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > maxLength) invalidCoreResponse();
  return value;
}

export function requiredBoolean(source: Record<string, unknown>, key: string): boolean {
  const value = source[key];
  if (typeof value !== "boolean") invalidCoreResponse();
  return value;
}

/**
 * A `timestamptz` column as it arrives over JSON.
 *
 * Deliberately looser than the CRM catalogues' exact-ISO round-trip check:
 * TypeORM serialises `Date` through `toJSON`, and the only property a screen
 * relies on is that `Intl` can format it.
 */
export function requiredTimestamp(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (typeof value !== "string" || Number.isNaN(new Date(value).getTime())) {
    invalidCoreResponse();
  }
  return value;
}

export function isMember<const T extends readonly string[]>(
  values: T,
  value: unknown,
): value is T[number] {
  return typeof value === "string" && values.includes(value as T[number]);
}

function safeInteger(
  source: Record<string, unknown>,
  key: string,
  minimum: number,
): number {
  const value = source[key];
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    invalidCoreResponse();
  }
  return value as number;
}

/**
 * Validates the `meta` half of a Core paginated envelope and re-derives every
 * field the server claims, so an inconsistent page cannot drive the pager.
 *
 * Out-of-range pages (`page > totalPages`) are accepted ONLY when `data` is
 * empty (`itemCount === 0`) so callers can recover after deletions or filter
 * changes; `page > totalPages` with non-empty items is rejected.
 *
 * Core currently emits two proven `hasPrev` variants ONLY when `total === 0` and
 * `page > 1`:
 * - `BaseRepository.envelope` (`shared-libs/packages/database/src/repositories/base.repository.ts`): `hasPrev = page > 1` (`true`)
 * - `emptyPage` (`shared-libs/packages/database/src/query-engine/query-result.helpers.ts`, used on empty company/branch scopes): `hasPrev = false`
 * Both return `false` on `page === 1`, and `total > 0` always goes through
 * `BaseRepository.envelope` (`hasPrev = page > 1`).
 */
export function parseCorePageMeta(payload: unknown, itemCount: number): CorePageMeta {
  const meta = record(payload);
  if (!meta || !Number.isSafeInteger(itemCount) || itemCount < 0) invalidCoreResponse();

  const page = safeInteger(meta, "page", 1);
  const limit = safeInteger(meta, "limit", 1);
  const total = safeInteger(meta, "total", 0);
  const totalPages = safeInteger(meta, "totalPages", 0);
  const hasNext = requiredBoolean(meta, "hasNext");
  const hasPrev = requiredBoolean(meta, "hasPrev");
  const validHasPrev = page === 1 ? !hasPrev : total === 0 || hasPrev;

  if (
    limit > CORE_MAX_PAGE_LIMIT ||
    itemCount > limit ||
    itemCount > total ||
    (page > totalPages && itemCount > 0) ||
    totalPages !== (total === 0 ? 0 : Math.ceil(total / limit)) ||
    hasNext !== (page < totalPages) ||
    !validHasPrev
  ) {
    invalidCoreResponse();
  }

  return { page, limit, total, totalPages, hasNext, hasPrev };
}

/**
 * Maps a Core list envelope — `data` is the items array, `meta` is the pager —
 * through one item parser, rejecting duplicate ids.
 */
export function parseCorePage<T extends { id: string }>(
  envelope: { data: unknown; meta: unknown },
  parseItem: (value: unknown) => T,
): CorePage<T> {
  if (!Array.isArray(envelope.data)) invalidCoreResponse();
  const items = envelope.data.map(parseItem);
  if (new Set(items.map(({ id }) => id)).size !== items.length) invalidCoreResponse();
  return { items, ...parseCorePageMeta(envelope.meta, items.length) };
}

export function parseCoreArray<T extends { id: string }>(
  payload: unknown,
  parseItem: (value: unknown) => T,
  maxItems: number,
): T[] {
  if (!Array.isArray(payload) || payload.length > maxItems) invalidCoreResponse();
  const items = payload.map(parseItem);
  if (new Set(items.map(({ id }) => id)).size !== items.length) invalidCoreResponse();
  return items;
}

/**
 * The list query every Core list route accepts (`PaginationQueryDto`), plus the
 * caller's own filters. `sortBy` is validated server-side against a per-endpoint
 * whitelist, so it is never assembled from user input here.
 */
export function buildCoreListQuery(options: {
  page: number;
  search: string;
  sortBy: string;
  sortDir?: "ASC" | "DESC";
  /** Pickers ask for the full page; lists take the screen's page size. */
  limit?: number;
  filters?: Record<string, string | undefined>;
}): string {
  const query = new URLSearchParams({
    page: String(options.page),
    limit: String(Math.min(options.limit ?? CORE_LIST_PAGE_SIZE, CORE_MAX_PAGE_LIMIT)),
    sortBy: options.sortBy,
    sortDir: options.sortDir ?? "ASC",
  });
  const search = options.search.trim();
  if (search) query.set("search", search.slice(0, 200));
  for (const [key, value] of Object.entries(options.filters ?? {})) {
    if (value) query.set(key, value);
  }
  return query.toString();
}

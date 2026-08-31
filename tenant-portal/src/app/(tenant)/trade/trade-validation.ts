import type { Language } from "@/i18n/useLanguage";
import { localizedValue } from "@/lib/format/localized";
import { derivePageInfo } from "./trade-api";

// Runtime guards shared by the Trade contracts, mirroring the arrangement
// `core/core-validation.ts` uses for Core. Every Trade response passes through
// one of these before it reaches the UI (AGENTS.md, S3).
//
// Trade's shapes differ from Core's in three ways that are encoded here rather
// than rediscovered per screen:
//
//   - every id is UUID v7 (`UUID_V7_PATTERN` in trade-app-common);
//   - money and quantity are decimal strings of at most 8 dp, never numbers
//     (trade-app/src/common/fixed-decimal.ts), and arrive with trailing
//     fractional zeros STRIPPED, so `10.50` is on the wire as `"10.5"`;
//   - a list is flat `{ items, total, page, limit }` with no `totalPages`,
//     `hasNext` or `hasPrev` and no sibling `meta`.

const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

/** `^(?:0|[1-9]\d*)(?:\.\d{1,8})?$` — trade-app's non-negative decimal DTO regex. */
const TRADE_DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/u;

/** `^[a-z]{2}(?:-[A-Z]{2})?$` — the locale keys `normalizeLocalizedNames` accepts. */
const LOCALE_KEY_PATTERN = /^[a-z]{2}(?:-[A-Z]{2})?$/u;

export function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function isUuidV7(value: unknown): value is string {
  return typeof value === "string" && UUID_V7_PATTERN.test(value);
}

export function isNullableUuidV7(value: unknown): value is string | null {
  return value === null || value === undefined || isUuidV7(value);
}

export function isTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return !Number.isNaN(new Date(value).getTime());
}

export function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

function isBoundedInteger(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
}

/**
 * A Trade `version` column. `TradeAuditableEntity` starts at 1 and TypeORM's
 * `@VersionColumn` only ever increments, so 0 is not a value a row can hold —
 * and `parseExpectedVersion` rejects it. The single exception is the
 * `If-Match: "0"` a company-default price-book upsert sends to mean "no
 * mapping yet", which is a REQUEST value and never a response one.
 */
export function isRowVersion(value: unknown): value is number {
  return isBoundedInteger(value, 1, Number.MAX_SAFE_INTEGER);
}

/** A `numeric(24,8)` column. Format for display; never `Number()` it. */
export function isTradeDecimalString(value: unknown): value is string {
  return typeof value === "string" && TRADE_DECIMAL_PATTERN.test(value);
}

export function isNullableTradeDecimalString(value: unknown): value is string | null {
  return value === null || value === undefined || isTradeDecimalString(value);
}

/** A `jsonb` object column — `restrictions`, `terms`, `saleConstraints`, `valueSchema`. */
export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return record(value) !== null;
}

/**
 * `localized_names` — a non-empty map of locale key to display text, bounded
 * at 20 entries by `normalizeLocalizedNames` in
 * `trade-app/src/modules/catalog/catalog-uom.service.ts`. The item and channel
 * writers accept any `@IsObject()`, so the bound is asserted only where the
 * server asserts it and this guard stays permissive about size.
 */
export function isLocalizedNames(value: unknown): value is Record<string, string> {
  const names = record(value);
  if (!names) return false;
  return Object.values(names).every((name) => typeof name === "string");
}

export const LOCALIZED_NAME_MAX_LENGTH = 160;
const LOCALIZED_NAMES_MAX_ENTRIES = 20;

/** True when every key is a locale the server's own normalizer would accept. */
export function hasValidLocaleKeys(names: Record<string, string>): boolean {
  const entries = Object.entries(names);
  return (
    entries.length > 0 &&
    entries.length <= LOCALIZED_NAMES_MAX_ENTRIES &&
    entries.every(
      ([locale, name]) =>
        LOCALE_KEY_PATTERN.test(locale) &&
        name.trim().length > 0 &&
        name.trim().length <= LOCALIZED_NAME_MAX_LENGTH,
    )
  );
}

function localeValue(names: Record<string, string>, language: string): string | null {
  const exact = names[language];
  if (typeof exact === "string" && exact.trim().length > 0) return exact;
  const regional = Object.entries(names).find(
    ([locale, name]) => locale.startsWith(`${language}-`) && name.trim().length > 0,
  );
  return regional ? regional[1] : null;
}

/**
 * The display name for the active language out of a Trade `localizedNames` map.
 *
 * Selection between two backend-supplied bilingual DATA fields goes through
 * `localizedValue`, which is the one place the language ternary is allowed to
 * live (docs/design/i18n.md#the-one-exemption-bilingual-data-fields). Falls
 * through to any populated locale rather than rendering blank: the tenant
 * chooses the locale set, and it need not contain `ar` or `en` at all.
 */
export function tradeLocalizedName(names: Record<string, string>, lang: Language): string {
  const chosen = localizedValue(localeValue(names, "ar"), localeValue(names, "en"), lang);
  if (chosen) return chosen;
  return Object.values(names).find((name) => name.trim().length > 0) ?? "";
}

export interface TradePage<T> {
  readonly items: T[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
  readonly hasPrev: boolean;
  readonly hasNext: boolean;
}

/**
 * Parses a flat Trade list page.
 *
 * The pager fields Trade does not send are derived by `derivePageInfo` in the
 * shared transport rather than recomputed here — there must be exactly one
 * implementation of that arithmetic, or the last page renders wrong on
 * whichever screen has the second copy.
 */
export function parseTradePage<T>(
  payload: unknown,
  parseItem: (value: unknown) => T,
  invalid: () => never,
): TradePage<T> {
  const info = derivePageInfo(payload);
  if (!info) invalid();
  return {
    items: info.items.map(parseItem),
    total: info.total,
    page: info.page,
    limit: info.limit,
    totalPages: info.totalPages,
    hasPrev: info.hasPrev,
    hasNext: info.hasNext,
  };
}

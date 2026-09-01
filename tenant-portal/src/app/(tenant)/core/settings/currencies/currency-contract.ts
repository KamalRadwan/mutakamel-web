import type { CorePath } from "@/lib/api/envelope";
import {
  isActiveStatus,
  isBoundedInteger,
  isNonEmptyString,
  isNullableDecimalString,
  isTimestamp,
  isUuidV7,
  parseCorePage,
  record,
  type ActiveStatus,
  type CorePage,
} from "../../core-validation";

export const CURRENCIES_PATH = "/api/tenant/core/v1/currencies";

/** `CreateCurrencyDto` / `UpdateCurrencyDto` column bounds. */
export const CURRENCY_CODE_LENGTH = 3;
export const CURRENCY_NAME_MAX_LENGTH = 80;
export const CURRENCY_SYMBOL_MAX_LENGTH = 8;
const CURRENCY_DECIMAL_PLACES_MIN = 0;
const CURRENCY_DECIMAL_PLACES_MAX = 8;
const CURRENCY_RATE_MAX = 1_000_000_000;
export const CURRENCY_PAGE_SIZE = 20;

/** `CurrenciesService` — every rejection carries one of these. */
export const CURRENCY_CODE_TAKEN_CODE = "CURRENCY_CODE_TAKEN";
export const CURRENCY_CODE_INVALID_CODE = "CURRENCY_CODE_INVALID";
export const CURRENCY_RATE_REQUIRED_CODE = "CURRENCY_EXCHANGE_RATE_REQUIRED";
export const CURRENCY_DEFAULT_DELETE_CODE = "CURRENCY_DEFAULT_DELETE";
export const CURRENCY_IN_USE_CODE = "CURRENCY_IN_USE";
export const CURRENCY_INACTIVE_DEFAULT_CODE = "CURRENCY_INACTIVE_DEFAULT";

export interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string | null;
  decimalPlaces: number;
  isDefault: boolean;
  /** `numeric(18,8)` — an exact decimal string. Never `Number()` it for display. */
  exchangeRate: string | null;
  status: ActiveStatus;
  updatedAt: string;
}

export interface CurrencyFormValues {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: string;
  exchangeRate: string;
  isDefault: boolean;
}

/** `CreateCurrencyDto`. `exchangeRate` is `@IsNumber` on the wire, not a string. */
export interface CreateCurrencyRequest {
  code: string;
  name: string;
  symbol?: string;
  decimalPlaces?: number;
  exchangeRate?: number;
  isDefault?: boolean;
}

/** `UpdateCurrencyDto` — no `code`; the code is immutable once created. */
export interface UpdateCurrencyRequest {
  name?: string;
  symbol?: string;
  decimalPlaces?: number;
  exchangeRate?: number;
  status?: ActiveStatus;
}

export const EMPTY_CURRENCY_FORM: CurrencyFormValues = {
  code: "",
  name: "",
  symbol: "",
  decimalPlaces: "2",
  exchangeRate: "",
  isDefault: false,
};

export function toCurrencyForm(currency: Currency): CurrencyFormValues {
  return {
    code: currency.code,
    name: currency.name,
    symbol: currency.symbol ?? "",
    decimalPlaces: String(currency.decimalPlaces),
    // The stored value is a decimal string and stays one until the DTO forces
    // a number at the boundary below.
    exchangeRate: currency.exchangeRate ?? "",
    isDefault: currency.isDefault,
  };
}

export function currencyPath(id: string): CorePath {
  if (!isUuidV7(id)) invalidResponse();
  return `${CURRENCIES_PATH}/${encodeURIComponent(id)}` as CorePath;
}

export function setDefaultCurrencyPath(id: string): CorePath {
  return `${currencyPath(id)}/set-default` as CorePath;
}

/** The only sort fields GET /currencies accepts; anything else is a 400. */
export const CURRENCY_SORT_FIELDS = ["code", "name", "exchangeRate", "createdAt"] as const;
export type CurrencySortField = (typeof CURRENCY_SORT_FIELDS)[number];

export function currenciesListPath(
  page: number,
  status?: ActiveStatus,
  search?: string,
  sortBy: CurrencySortField = "code",
  sortDir: "ASC" | "DESC" = "ASC",
): CorePath {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(CURRENCY_PAGE_SIZE),
    sortBy,
    sortDir,
  });
  if (status) query.set("status", status);
  if (search) query.set("search", search);
  return `${CURRENCIES_PATH}?${query.toString()}` as CorePath;
}

export function buildCreateCurrencyRequest(values: CurrencyFormValues): CreateCurrencyRequest {
  const code = values.code.trim().toUpperCase();
  const name = values.name.trim();
  if (code.length !== CURRENCY_CODE_LENGTH) throw new Error("CURRENCY_FORM_CODE");
  if (name.length === 0 || name.length > CURRENCY_NAME_MAX_LENGTH) {
    throw new Error("CURRENCY_FORM_NAME");
  }

  const request: CreateCurrencyRequest = { code, name };
  const symbol = values.symbol.trim();
  if (symbol.length > 0) request.symbol = symbol;
  const decimalPlaces = parseDecimalPlaces(values.decimalPlaces);
  if (decimalPlaces !== undefined) request.decimalPlaces = decimalPlaces;
  if (values.isDefault) request.isDefault = true;
  // The server forces the default currency's rate to exactly 1, so sending one
  // for it would be a value the server discards.
  if (!values.isDefault) request.exchangeRate = parseExchangeRate(values.exchangeRate);
  return request;
}

export function buildUpdateCurrencyRequest(
  current: Currency,
  values: CurrencyFormValues,
): UpdateCurrencyRequest {
  const request: UpdateCurrencyRequest = {};
  const name = values.name.trim();
  if (name.length === 0 || name.length > CURRENCY_NAME_MAX_LENGTH) {
    throw new Error("CURRENCY_FORM_NAME");
  }
  if (name !== current.name) request.name = name;

  const symbol = values.symbol.trim();
  if (symbol !== (current.symbol ?? "")) request.symbol = symbol;

  const decimalPlaces = parseDecimalPlaces(values.decimalPlaces);
  if (decimalPlaces !== undefined && decimalPlaces !== current.decimalPlaces) {
    request.decimalPlaces = decimalPlaces;
  }

  // `applyUpdate` ignores an exchange rate on the default currency, so sending
  // one there is a no-op the user would read as a saved change.
  const rate = values.exchangeRate.trim();
  if (!current.isDefault && rate.length > 0 && rate !== (current.exchangeRate ?? "")) {
    request.exchangeRate = parseExchangeRate(values.exchangeRate);
  }
  return request;
}

export function parseCurrenciesResponse(payload: unknown): CorePage<Currency> {
  return parseCorePage(payload, parseCurrencyResponse, invalidResponse);
}

export function parseCurrencyResponse(payload: unknown): Currency {
  const currency = record(payload);
  if (
    !currency ||
    !isUuidV7(currency.id) ||
    !isNonEmptyString(currency.code, CURRENCY_CODE_LENGTH) ||
    !isNonEmptyString(currency.name, CURRENCY_NAME_MAX_LENGTH) ||
    !isBoundedInteger(currency.decimalPlaces, CURRENCY_DECIMAL_PLACES_MIN, CURRENCY_DECIMAL_PLACES_MAX) ||
    typeof currency.isDefault !== "boolean" ||
    !isNullableDecimalString(currency.exchangeRate ?? null) ||
    !isActiveStatus(currency.status) ||
    !isTimestamp(currency.updatedAt) ||
    !isOptionalSymbol(currency.symbol)
  ) {
    invalidResponse();
  }

  return {
    id: currency.id,
    code: currency.code,
    name: currency.name,
    symbol: (currency.symbol as string | null | undefined) ?? null,
    decimalPlaces: currency.decimalPlaces,
    isDefault: currency.isDefault,
    exchangeRate: (currency.exchangeRate as string | null | undefined) ?? null,
    status: currency.status,
    updatedAt: currency.updatedAt,
  };
}

/**
 * `@IsNumber({ maxDecimalPlaces: 8 })` — the DTO takes a JSON number, so the
 * conversion happens here and nowhere else. This coerces *typed input*, never
 * a decimal that arrived on the wire.
 */
function parseExchangeRate(value: string): number {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,8})?$/u.test(trimmed)) throw new Error("CURRENCY_FORM_RATE");
  const rate = Number(trimmed);
  if (!(rate > 0) || rate > CURRENCY_RATE_MAX) throw new Error("CURRENCY_FORM_RATE");
  return rate;
}

function parseDecimalPlaces(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  if (!/^\d{1,2}$/u.test(trimmed)) throw new Error("CURRENCY_FORM_DECIMALS");
  const places = Number(trimmed);
  if (places < CURRENCY_DECIMAL_PLACES_MIN || places > CURRENCY_DECIMAL_PLACES_MAX) {
    throw new Error("CURRENCY_FORM_DECIMALS");
  }
  return places;
}

function isOptionalSymbol(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.length <= CURRENCY_SYMBOL_MAX_LENGTH)
  );
}

function invalidResponse(): never {
  throw new Error("Invalid Core currencies response.");
}

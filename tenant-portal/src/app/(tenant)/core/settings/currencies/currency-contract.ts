import { readCorePage, type CorePath } from "@/lib/api/envelope";
import { buildCoreListQuery, parseCorePage, type CorePage } from "../../contracts/core-page";
import {
  isActiveStatus,
  isBoundedInteger,
  isNonEmptyString,
  isNullableDecimalString,
  isTimestamp,
  isUuidV7,
  record,
  type ActiveStatus,
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
export const CURRENCY_PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
const LIST_RESPONSE_LIMIT_BYTES = 400_000;

export const INVALID_CURRENCIES_RESPONSE_MESSAGE = "Invalid Core currencies response.";

/** `CurrenciesService` — documented domain rejection codes. */
export const CURRENCY_CODE_TAKEN_CODE = "CURRENCY_CODE_TAKEN";
export const CURRENCY_CODE_INVALID_CODE = "CURRENCY_CODE_INVALID";
export const CURRENCY_RATE_REQUIRED_CODE = "CURRENCY_EXCHANGE_RATE_REQUIRED";
export const CURRENCY_DEFAULT_DELETE_CODE = "CURRENCY_DEFAULT_DELETE";
export const CURRENCY_IN_USE_CODE = "CURRENCY_IN_USE";
export const CURRENCY_COMPANY_IN_USE_CODE = "CURRENCY_COMPANY_IN_USE";
export const CURRENCY_INACTIVE_DEFAULT_CODE = "CURRENCY_INACTIVE_DEFAULT";
export const CURRENCY_DECIMAL_PLACES_IMMUTABLE_CODE = "CURRENCY_DECIMAL_PLACES_IMMUTABLE";
export const CURRENCY_PRECISION_MISMATCH_CODE = "CURRENCY_PRECISION_MISMATCH";
export const CURRENCY_REBASE_OUT_OF_RANGE_CODE = "CURRENCY_REBASE_OUT_OF_RANGE";
export const CURRENCY_REBASE_PRECISION_LOSS_CODE = "CURRENCY_REBASE_PRECISION_LOSS";
export const CURRENCY_NOT_FOUND_CODE = "CURRENCY_NOT_FOUND";

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

/** `UpdateCurrencyDto` — code and decimal places are immutable once created. */
export interface UpdateCurrencyRequest {
  name?: string;
  symbol?: string;
  exchangeRate?: number;
  status?: ActiveStatus;
}

export const EMPTY_CURRENCY_FORM: CurrencyFormValues = {
  code: "",
  name: "",
  symbol: "",
  decimalPlaces: "",
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

/** Pairs the human-readable currency name with its ISO-4217 code; never a UUID. */
export function formatCurrencyLabel(currency: Pick<Currency, "name" | "code">): string {
  return `${currency.name} (${currency.code})`;
}

export function currencyPath(id: string): CorePath {
  if (!isUuidV7(id)) invalidResponse();
  return `${CURRENCIES_PATH}/${encodeURIComponent(id)}` as CorePath;
}

export function setDefaultCurrencyPath(id: string): CorePath {
  return `${currencyPath(id)}/set-default` as CorePath;
}

/** The only sort fields GET /currencies accepts (`CurrencyQueryDto`); anything else is a 400. */
export const CURRENCY_SORT_FIELDS = ["code", "name", "exchangeRate", "createdAt"] as const;
export type CurrencySortField = (typeof CURRENCY_SORT_FIELDS)[number];
export type CurrencyListFilter = "ACTIVE" | "INACTIVE" | "DEFAULT" | "NON_DEFAULT";

export function resolveCurrencyListFilter(
  filter: CurrencyListFilter | undefined,
): { status?: ActiveStatus; isDefault?: boolean } {
  if (filter === "ACTIVE" || filter === "INACTIVE") return { status: filter };
  if (filter === "DEFAULT") return { isDefault: true };
  if (filter === "NON_DEFAULT") return { isDefault: false };
  return {};
}

export interface CurrenciesListOptions {
  page: number;
  limit?: number;
  status?: ActiveStatus;
  isDefault?: boolean;
  search?: string;
  sortBy?: CurrencySortField;
  sortDir?: "ASC" | "DESC";
  signal?: AbortSignal;
}

export function currenciesListQuery(options: Omit<CurrenciesListOptions, "signal">): string {
  return buildCoreListQuery({
    page: options.page,
    limit: options.limit ?? CURRENCY_PAGE_SIZE,
    search: options.search ?? "",
    sortBy: options.sortBy ?? "code",
    sortDir: options.sortDir ?? "ASC",
    filters: {
      status: options.status,
      isDefault:
        options.isDefault === undefined ? undefined : options.isDefault ? "true" : "false",
    },
  });
}

export function currenciesListPath(
  page: number,
  status?: ActiveStatus,
  search?: string,
  sortBy: CurrencySortField = "code",
  sortDir: "ASC" | "DESC" = "ASC",
  isDefault?: boolean,
  limit: number = CURRENCY_PAGE_SIZE,
): CorePath {
  return `${CURRENCIES_PATH}?${currenciesListQuery({ page, limit, status, isDefault, search, sortBy, sortDir })}` as CorePath;
}

export async function fetchCurrenciesPage(options: CurrenciesListOptions): Promise<CorePage<Currency>> {
  const envelope = await readCorePage(CURRENCIES_PATH, currenciesListQuery(options), {
    signal: options.signal,
    cache: "no-store",
    suppressForbiddenToast: true,
    maxResponseBytes: LIST_RESPONSE_LIMIT_BYTES,
  });
  return parseCurrenciesResponse(envelope);
}

/** Reads the tenant's default currency independently of filtered or paged table rows. */
export async function fetchBaseCurrency(signal?: AbortSignal): Promise<Currency | null> {
  const page = await fetchCurrenciesPage({ page: 1, limit: 1, isDefault: true, signal });
  return page.items.find((item) => item.isDefault) ?? null;
}

const CURRENCY_MAX_INT_STR = String(CURRENCY_RATE_MAX);
const ZERO_FRACTION_8 = "00000000";

/** Pure decimal-string check (no float coercion) for stored positive `numeric(18,8)` rates. */
export function hasValidSavedExchangeRate(rate: string | null): boolean {
  if (rate === null) return false;
  const trimmed = rate.trim();
  if (!/^\d+(\.\d{1,8})?$/u.test(trimmed) || !/[1-9]/u.test(trimmed)) return false;
  const [rawInt = ""] = trimmed.split(".");
  const intPart = rawInt.replace(/^0+/u, "") || "0";
  return intPart.length <= 10;
}

/** Exact decimal-string bound check (`> 0` and `<= 1_000_000_000`, `<= 8` decimals) before DTO `Number()` coercion. */
export function isValidTypedExchangeRate(value: string): boolean {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,8})?$/u.test(trimmed)) return false;
  const [rawInt = "", fracPart = ""] = trimmed.split(".");
  const intPart = rawInt.replace(/^0+/u, "") || "0";
  const fracPadded = fracPart.padEnd(8, "0");
  if (intPart === "0" && fracPadded === ZERO_FRACTION_8) return false;
  if (intPart.length > CURRENCY_MAX_INT_STR.length) return false;
  if (intPart.length === CURRENCY_MAX_INT_STR.length) {
    if (intPart > CURRENCY_MAX_INT_STR) return false;
    return intPart < CURRENCY_MAX_INT_STR || fracPadded === ZERO_FRACTION_8;
  }
  return true;
}

export function buildCreateCurrencyRequest(values: CurrencyFormValues): CreateCurrencyRequest {
  const code = values.code.trim().toUpperCase();
  const name = values.name.trim();
  if (code.length !== CURRENCY_CODE_LENGTH || !/^[A-Z]{3}$/u.test(code)) {
    throw new Error("CURRENCY_FORM_CODE");
  }
  if (name.length === 0 || name.length > CURRENCY_NAME_MAX_LENGTH) {
    throw new Error("CURRENCY_FORM_NAME");
  }

  const request: CreateCurrencyRequest = { code, name };
  const symbol = values.symbol.trim();
  if (symbol.length > CURRENCY_SYMBOL_MAX_LENGTH) throw new Error("CURRENCY_FORM_SYMBOL");
  if (symbol.length > 0) request.symbol = symbol;
  if (values.isDefault) request.isDefault = true;
  // `decimalPlaces` is omitted on create: `CurrenciesService.create` derives
  // the ISO-4217 minor unit authoritatively from `code`.
  // A replacement default needs its rate against the current default for
  // rebasing. Only the first default can omit it; Core decides under its lock.
  if (!values.isDefault || values.exchangeRate.trim().length > 0) {
    request.exchangeRate = parseExchangeRate(values.exchangeRate);
  }
  return request;
}

export function buildUpdateCurrencyRequest(
  current: Currency,
  values: CurrencyFormValues,
  options?: { activate?: boolean },
): UpdateCurrencyRequest {
  const request: UpdateCurrencyRequest = {};
  const name = values.name.trim();
  if (name.length === 0 || name.length > CURRENCY_NAME_MAX_LENGTH) {
    throw new Error("CURRENCY_FORM_NAME");
  }
  if (name !== current.name) request.name = name;

  const symbol = values.symbol.trim();
  if (symbol.length > CURRENCY_SYMBOL_MAX_LENGTH) throw new Error("CURRENCY_FORM_SYMBOL");
  if (symbol !== (current.symbol ?? "")) request.symbol = symbol;

  const shouldActivate = Boolean(options?.activate) && !current.isDefault && current.status === "INACTIVE";
  if (shouldActivate) request.status = "ACTIVE";

  // `applyUpdate` ignores an exchange rate on the default currency, so sending
  // one there is a no-op the user would read as a saved change.
  const rate = values.exchangeRate.trim();
  const storedRate = current.exchangeRate?.trim() ?? "";
  if (!current.isDefault) {
    const rateRequired = shouldActivate || current.status === "ACTIVE" || current.exchangeRate !== null;
    if (rate.length === 0) {
      if (rateRequired) throw new Error("CURRENCY_FORM_RATE");
    } else if (rate !== storedRate || !hasValidSavedExchangeRate(current.exchangeRate)) {
      request.exchangeRate = parseExchangeRate(values.exchangeRate);
    }
  }
  return request;
}

export function parseCurrenciesResponse(payload: unknown): CorePage<Currency> {
  const envelope = record(payload);
  if (!envelope) invalidResponse();
  try {
    return parseCorePage({ data: envelope.data, meta: envelope.meta }, parseCurrencyResponse);
  } catch {
    invalidResponse();
  }
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
 * conversion happens here and nowhere else, only after `isValidTypedExchangeRate`
 * proves exact string bounds (`1000000000.00000001` is rejected before `Number`).
 */
function parseExchangeRate(value: string): number {
  if (!isValidTypedExchangeRate(value)) throw new Error("CURRENCY_FORM_RATE");
  return Number(value.trim());
}

function isOptionalSymbol(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === "string" && value.length <= CURRENCY_SYMBOL_MAX_LENGTH);
}

function invalidResponse(): never {
  throw new Error(INVALID_CURRENCIES_RESPONSE_MESSAGE);
}

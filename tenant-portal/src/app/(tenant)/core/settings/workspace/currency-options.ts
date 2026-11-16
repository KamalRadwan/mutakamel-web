import { readCorePage, type CorePath } from "@/lib/api/envelope";
import {
  CORE_LIST_RESPONSE_LIMIT_BYTES,
  CORE_MAX_PAGE_LIMIT,
  buildCoreListQuery,
  parseCorePageMeta,
  record,
  type CorePageMeta,
} from "../../contracts/core-page";
import { isBoundedInteger, isNullableDecimalString } from "../../core-validation";
import { WorkspaceInvalidResponseError } from "./workspace-errors";

// Active currency options for the workspace default-currency selector.
//
// Core's `ResponseEnvelopeInterceptor` emits `{ success, data: [...], meta: { page, limit, total, totalPages, hasNext, hasPrev } }`.
// Reading through `readCorePage` + `parseCorePageMeta` preserves pagination metadata,
// rejects legacy `{ items }` shapes, rejects cross-page duplicate overlap, and
// surfaces explicit truncation if a tenant holds more than 500 active currencies.
export const CURRENCY_OPTIONS_PATH: CorePath = "/api/tenant/core/v1/currencies";
export const CURRENCY_OPTIONS_MAX_ITEMS = 500;

const CURRENCY_CODE_LENGTH = 3;
const CURRENCY_NAME_MAX_LENGTH = 80;
const CURRENCY_SYMBOL_MAX_LENGTH = 8;
const CURRENCY_DECIMAL_PLACES_MIN = 0;
const CURRENCY_DECIMAL_PLACES_MAX = 8;

export interface CurrencyOption {
  code: string;
  name: string;
  symbol?: string | null;
  decimalPlaces?: number | null;
  /** `numeric(18,8)` — preserved as an exact decimal string without float conversion. */
  exchangeRate?: string | null;
}

export interface CurrencyOptionsResult {
  currencies: CurrencyOption[];
  total: number;
  isTruncated: boolean;
}

interface CurrencyOptionsPage extends CorePageMeta {
  items: CurrencyOption[];
}

function invalidCurrenciesResponse(): never {
  throw new WorkspaceInvalidResponseError("Invalid Core currencies response.");
}

function parseOptionalSymbol(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") invalidCurrenciesResponse();
  const trimmed = value.trim();
  if (trimmed.length > CURRENCY_SYMBOL_MAX_LENGTH) invalidCurrenciesResponse();
  return trimmed.length > 0 ? trimmed : null;
}

function parseOptionalDecimalPlaces(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (!isBoundedInteger(value, CURRENCY_DECIMAL_PLACES_MIN, CURRENCY_DECIMAL_PLACES_MAX)) {
    invalidCurrenciesResponse();
  }
  return value;
}

function parseOptionalExchangeRate(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (!isNullableDecimalString(value)) invalidCurrenciesResponse();
  return value;
}

function parseCurrencyOptionItem(value: unknown): CurrencyOption {
  const currency = record(value);
  if (
    !currency ||
    typeof currency.code !== "string" ||
    currency.code.length !== CURRENCY_CODE_LENGTH ||
    typeof currency.name !== "string" ||
    currency.name.length === 0 ||
    currency.name.length > CURRENCY_NAME_MAX_LENGTH
  ) {
    invalidCurrenciesResponse();
  }

  const symbol = parseOptionalSymbol(currency.symbol);
  const decimalPlaces = parseOptionalDecimalPlaces(currency.decimalPlaces);
  const exchangeRate = parseOptionalExchangeRate(currency.exchangeRate);

  return {
    code: currency.code,
    name: currency.name,
    ...(symbol !== null ? { symbol } : {}),
    ...(decimalPlaces !== null ? { decimalPlaces } : {}),
    ...(exchangeRate !== null ? { exchangeRate } : {}),
  };
}

export function parseCurrencyOptionsPage(
  envelope: {
    data: unknown;
    meta: unknown;
  },
  expectedPage?: number,
): CurrencyOptionsPage {
  if (!Array.isArray(envelope.data)) invalidCurrenciesResponse();
  const items = envelope.data.map(parseCurrencyOptionItem);
  if (new Set(items.map((item) => item.code)).size !== items.length) {
    invalidCurrenciesResponse();
  }

  let meta: CorePageMeta;
  try {
    meta = parseCorePageMeta(envelope.meta, items.length);
  } catch {
    invalidCurrenciesResponse();
  }

  if (
    expectedPage !== undefined &&
    (meta.page !== expectedPage || meta.limit !== CORE_MAX_PAGE_LIMIT)
  ) {
    invalidCurrenciesResponse();
  }

  return { items, ...meta };
}

export async function loadCurrencyOptions(signal?: AbortSignal): Promise<CurrencyOptionsResult> {
  const collected: CurrencyOption[] = [];
  const seenCodes = new Set<string>();
  const maxPages = Math.ceil(CURRENCY_OPTIONS_MAX_ITEMS / CORE_MAX_PAGE_LIMIT);

  for (let page = 1; page <= maxPages; page += 1) {
    signal?.throwIfAborted();
    const query = buildCoreListQuery({
      page,
      search: "",
      sortBy: "code",
      sortDir: "ASC",
      limit: CORE_MAX_PAGE_LIMIT,
      filters: { status: "ACTIVE" },
    });

    const envelope = await readCorePage(CURRENCY_OPTIONS_PATH, query, {
      signal,
      cache: "no-store",
      suppressForbiddenToast: true,
      maxResponseBytes: CORE_LIST_RESPONSE_LIMIT_BYTES,
    });
    signal?.throwIfAborted();

    const parsed = parseCurrencyOptionsPage(envelope, page);
    for (let index = 0; index < parsed.items.length; index += 1) {
      const item = parsed.items[index];
      if (seenCodes.has(item.code)) invalidCurrenciesResponse();
      seenCodes.add(item.code);
      collected.push(item);

      if (collected.length >= CURRENCY_OPTIONS_MAX_ITEMS) {
        return {
          currencies: collected,
          total: parsed.total,
          isTruncated:
            index + 1 < parsed.items.length || parsed.hasNext || collected.length < parsed.total,
        };
      }
    }

    if (!parsed.hasNext) {
      if (collected.length < parsed.total) {
        invalidCurrenciesResponse();
      }
      return { currencies: collected, total: parsed.total, isTruncated: false };
    }

    // A short intermediate page before reaching `total` indicates inconsistent pagination.
    if (parsed.items.length !== CORE_MAX_PAGE_LIMIT) {
      invalidCurrenciesResponse();
    }
  }

  return { currencies: collected, total: collected.length, isTruncated: false };
}

import { ApiError } from '../../../../core/api/api-errors';
import { fakeDelay, fakeId } from '../../../../core/fake/fake-utils';
import { coreValidationDetails } from '../core-response.model';
import {
  CorePage,
  CURRENCY_CODE_PATTERN,
  CURRENCY_LIMITS,
  CreateCurrencyBody,
  Currency,
  CurrencyListQuery,
  CurrencySortBy,
  NON_SPENDABLE_CURRENCY_CODES,
  UpdateCurrencyBody,
  isSupportedCurrencyCode,
  minorUnitsOf,
} from './currencies.model';

export const FAKE_CURRENCIES_FAIL_NEXT: { code: string | null; status: number } = {
  code: null,
  status: 500,
};

const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REBASE_MAX_EXCLUSIVE = 10_000_000_000;
const REBASE_MAX_REL_ERROR = 0.00001;
const SORT_WHITELIST: ReadonlySet<CurrencySortBy> = new Set(['code', 'name', 'exchangeRate', 'createdAt']);

interface IdempotencyRecord {
  op: string;
  fingerprint: string;
  result: unknown;
}

interface CompanyRef {
  id: string;
  name: string;
}

interface CurrenciesFakeStore {
  currencies: Currency[];
  workspaceDefaultCurrencyCode: string;
  activeCompaniesByCurrency: Record<string, CompanyRef[]>;
  idempotency: Map<string, IdempotencyRecord>;
}

function createSeedStore(): CurrenciesFakeStore {
  return {
    workspaceDefaultCurrencyCode: 'AED',
    activeCompaniesByCurrency: {
      USD: [
        { id: fakeId(), name: 'Najd Trading Co.' },
        { id: fakeId(), name: 'Riyadh Logistics' },
      ],
    },
    idempotency: new Map<string, IdempotencyRecord>(),
    currencies: [
      {
        id: fakeId(),
        code: 'SAR',
        name: 'Saudi Riyal',
        symbol: 'ر.س',
        decimalPlaces: 2,
        isDefault: true,
        exchangeRate: '1.00000000',
        status: 'ACTIVE',
        createdAt: '2026-01-10T08:00:00.000Z',
        updatedAt: '2026-01-10T08:00:00.000Z',
      },
      {
        id: fakeId(),
        code: 'USD',
        name: 'US Dollar',
        symbol: '$',
        decimalPlaces: 2,
        isDefault: false,
        exchangeRate: '0.26666667',
        status: 'ACTIVE',
        createdAt: '2026-01-12T09:15:00.000Z',
        updatedAt: '2026-06-01T10:30:00.000Z',
      },
      {
        id: fakeId(),
        code: 'AED',
        name: 'UAE Dirham',
        symbol: 'د.إ',
        decimalPlaces: 2,
        isDefault: false,
        exchangeRate: '0.97866667',
        status: 'ACTIVE',
        createdAt: '2026-01-14T11:20:00.000Z',
        updatedAt: '2026-05-18T14:00:00.000Z',
      },
      {
        id: fakeId(),
        code: 'EUR',
        name: 'Euro',
        symbol: '€',
        decimalPlaces: 2,
        isDefault: false,
        exchangeRate: '0.24500000',
        status: 'ACTIVE',
        createdAt: '2026-02-02T12:00:00.000Z',
        updatedAt: '2026-07-09T16:45:00.000Z',
      },
      {
        id: fakeId(),
        code: 'KWD',
        name: 'Kuwaiti Dinar',
        symbol: 'د.ك',
        decimalPlaces: 3,
        isDefault: false,
        exchangeRate: '0.08200000',
        status: 'ACTIVE',
        createdAt: '2026-02-18T09:40:00.000Z',
        updatedAt: '2026-08-03T11:10:00.000Z',
      },
      {
        id: fakeId(),
        code: 'EGP',
        name: 'Egyptian Pound',
        symbol: 'ج.م',
        decimalPlaces: 2,
        isDefault: false,
        exchangeRate: '13.00000000',
        status: 'ACTIVE',
        createdAt: '2026-03-04T13:05:00.000Z',
        updatedAt: '2026-09-12T08:25:00.000Z',
      },
      {
        id: fakeId(),
        code: 'JPY',
        name: 'Japanese Yen',
        symbol: '¥',
        decimalPlaces: 0,
        isDefault: false,
        exchangeRate: '40.00000000',
        status: 'INACTIVE',
        createdAt: '2026-03-22T15:30:00.000Z',
        updatedAt: '2026-09-28T17:00:00.000Z',
      },
      {
        id: fakeId(),
        code: 'GBP',
        name: 'Pound Sterling',
        symbol: '£',
        decimalPlaces: 2,
        isDefault: false,
        exchangeRate: null,
        status: 'INACTIVE',
        createdAt: '2026-04-08T10:00:00.000Z',
        updatedAt: '2026-10-05T12:40:00.000Z',
      },
    ],
  };
}

let store: CurrenciesFakeStore = createSeedStore();

export function resetCurrenciesFake(): void {
  store = createSeedStore();
  FAKE_CURRENCIES_FAIL_NEXT.code = null;
  FAKE_CURRENCIES_FAIL_NEXT.status = 500;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function consumeForcedFailure(): void {
  const code = FAKE_CURRENCIES_FAIL_NEXT.code;
  if (!code) return;
  const status = FAKE_CURRENCIES_FAIL_NEXT.status || 500;
  FAKE_CURRENCIES_FAIL_NEXT.code = null;
  FAKE_CURRENCIES_FAIL_NEXT.status = 500;
  throw new ApiError(status, code);
}

function runIdempotent<T>(op: string, key: string, payload: unknown, run: () => T): T {
  const trimmedKey = typeof key === 'string' ? key.trim() : '';
  if (!trimmedKey) {
    throw new ApiError(400, 'GW.IDEM.MISSING');
  }
  if (!UUID_V7_PATTERN.test(trimmedKey)) {
    throw new ApiError(400, 'GW.IDEM.BAD_VALUE');
  }
  const fingerprint = JSON.stringify(payload) ?? '';
  const existing = store.idempotency.get(trimmedKey);
  if (existing) {
    if (existing.op !== op || existing.fingerprint !== fingerprint) {
      throw new ApiError(422, 'GW.IDEM.MISMATCH');
    }
    return clone(existing.result as T);
  }
  const result = run();
  store.idempotency.set(trimmedKey, { op, fingerprint, result: clone(result) });
  return clone(result);
}

function isValidRateNumber(value: unknown): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  if (value <= 0 || value > CURRENCY_LIMITS.rateMax) return false;
  return Number(value.toFixed(CURRENCY_LIMITS.rateDecimals)) === value;
}

function computeRebasedRates(
  rows: readonly Currency[],
  divisor: number,
  excludeId?: string,
): Map<string, string> {
  if (!Number.isFinite(divisor) || divisor <= 0) {
    throw new ApiError(422, 'CURRENCY_REBASE_OUT_OF_RANGE');
  }

  const nextRates = new Map<string, string>();
  for (const row of rows) {
    if (row.id === excludeId || row.exchangeRate === null) continue;
    const current = Number(row.exchangeRate);
    const exact = current / divisor;
    if (!Number.isFinite(exact) || exact <= 0 || exact >= REBASE_MAX_EXCLUSIVE) {
      throw new ApiError(422, 'CURRENCY_REBASE_OUT_OF_RANGE');
    }
    const rounded = Number(exact.toFixed(CURRENCY_LIMITS.rateDecimals));
    if (!Number.isFinite(rounded) || rounded <= 0 || rounded >= REBASE_MAX_EXCLUSIVE) {
      throw new ApiError(422, 'CURRENCY_REBASE_OUT_OF_RANGE');
    }
    const relError = Math.abs(rounded - exact) / exact;
    if (relError > REBASE_MAX_REL_ERROR) {
      throw new ApiError(422, 'CURRENCY_REBASE_PRECISION_LOSS');
    }
    nextRates.set(row.id, rounded.toFixed(CURRENCY_LIMITS.rateDecimals));
  }
  return nextRates;
}

function assertCanDeactivate(row: Currency): void {
  if (row.isDefault) {
    throw new ApiError(409, 'CURRENCY_DEFAULT_DELETE');
  }
  if (row.code === store.workspaceDefaultCurrencyCode) {
    throw new ApiError(409, 'CURRENCY_IN_USE');
  }
  const activeCompanies = store.activeCompaniesByCurrency[row.code];
  if (activeCompanies && activeCompanies.length > 0) {
    // Core (currencies.service.ts assertNotActiveCompanyCurrency) sends code + message only, no details.
    throw new ApiError(409, 'CURRENCY_COMPANY_IN_USE');
  }
}

export async function fakeListCurrencies(query?: CurrencyListQuery): Promise<CorePage<Currency>> {
  await fakeDelay();

  const sortBy: CurrencySortBy = query?.sortBy && SORT_WHITELIST.has(query.sortBy) ? query.sortBy : 'code';
  const sortDir: 'ASC' | 'DESC' = query?.sortDir === 'DESC' ? 'DESC' : 'ASC';
  const dirFactor = sortDir === 'DESC' ? -1 : 1;

  const rawSearch = query?.search?.trim() ?? '';
  const term = rawSearch.slice(0, 200).toLowerCase();

  let filtered = store.currencies.filter((item) => {
    if (query?.status && item.status !== query.status) return false;
    if (query?.isDefault !== undefined && item.isDefault !== query.isDefault) return false;
    if (term) {
      const codeMatch = item.code.toLowerCase().includes(term);
      const nameMatch = item.name.toLowerCase().includes(term);
      const symbolMatch = item.symbol ? item.symbol.toLowerCase().includes(term) : false;
      if (!codeMatch && !nameMatch && !symbolMatch) return false;
    }
    return true;
  });

  filtered = filtered.slice().sort((a, b) => {
    if (sortBy === 'exchangeRate') {
      if (a.exchangeRate === null && b.exchangeRate !== null) return 1;
      if (a.exchangeRate !== null && b.exchangeRate === null) return -1;
      if (a.exchangeRate !== null && b.exchangeRate !== null) {
        const diff = Number(a.exchangeRate) - Number(b.exchangeRate);
        if (diff !== 0) return diff * dirFactor;
      }
    } else if (sortBy === 'name') {
      const cmp = a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
      if (cmp !== 0) return cmp * dirFactor;
    } else if (sortBy === 'createdAt') {
      if (a.createdAt !== b.createdAt) {
        return (a.createdAt < b.createdAt ? -1 : 1) * dirFactor;
      }
    } else {
      const cmp = a.code.localeCompare(b.code, 'en');
      if (cmp !== 0) return cmp * dirFactor;
    }

    const codeTie = a.code.localeCompare(b.code, 'en');
    if (codeTie !== 0) return codeTie;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const rawPage = query?.page ?? 1;
  const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1;
  const rawLimit = query?.limit ?? 20;
  const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, Math.floor(rawLimit))) : 20;

  const total = filtered.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const items = filtered.slice(start, start + limit).map(clone);

  // Core's envelope moves the PaginatedResult counters into meta and the rows into data.
  return {
    data: items,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1 && total > 0,
    },
  };
}

export async function fakeCreateCurrency(body: CreateCurrencyBody, key: string): Promise<Currency> {
  await fakeDelay();
  consumeForcedFailure();

  const rawBody = body as CreateCurrencyBody & { decimalPlaces?: unknown };
  const normalizedPayload = {
    code: typeof rawBody.code === 'string' ? rawBody.code.trim().toUpperCase() : rawBody.code,
    name: typeof rawBody.name === 'string' ? rawBody.name.trim() : rawBody.name,
    symbol: typeof rawBody.symbol === 'string' ? rawBody.symbol.trim() : rawBody.symbol,
    exchangeRate: rawBody.exchangeRate,
    isDefault: Boolean(rawBody.isDefault),
    decimalPlaces: rawBody.decimalPlaces,
  };

  return runIdempotent('createCurrency', key, normalizedPayload, () => {
    const code = typeof rawBody.code === 'string' ? rawBody.code.trim().toUpperCase() : '';
    if (!CURRENCY_CODE_PATTERN.test(code) || NON_SPENDABLE_CURRENCY_CODES.has(code) || !isSupportedCurrencyCode(code)) {
      throw new ApiError(422, 'CURRENCY_CODE_INVALID');
    }

    const derivedDecimals = minorUnitsOf(code);
    if (rawBody.decimalPlaces !== undefined && rawBody.decimalPlaces !== derivedDecimals) {
      throw new ApiError(422, 'CURRENCY_PRECISION_MISMATCH');
    }

    if (store.currencies.some((item) => item.code === code)) {
      throw new ApiError(409, 'CURRENCY_CODE_TAKEN');
    }

    const details: Record<string, string> = {};
    const name = typeof rawBody.name === 'string' ? rawBody.name.trim() : '';
    if (!name || Array.from(name).length > CURRENCY_LIMITS.name) {
      details['name'] = 'invalid';
    }

    const rawSymbol = typeof rawBody.symbol === 'string' ? rawBody.symbol.trim() : '';
    if (rawBody.symbol !== undefined && typeof rawBody.symbol !== 'string') {
      details['symbol'] = 'invalid';
    } else if (Array.from(rawSymbol).length > CURRENCY_LIMITS.symbol) {
      details['symbol'] = 'invalid';
    }

    if (rawBody.exchangeRate !== undefined && !isValidRateNumber(rawBody.exchangeRate)) {
      details['exchangeRate'] = 'invalid';
    }

    if (Object.keys(details).length > 0) {
      throw new ApiError(400, 'CORE_VALIDATION_FAILED', coreValidationDetails(details));
    }

    const now = new Date().toISOString();
    const symbol = rawSymbol ? rawSymbol : null;
    const existingDefault = store.currencies.find((item) => item.isDefault);

    if (!existingDefault) {
      const created: Currency = {
        id: fakeId(),
        code,
        name,
        symbol,
        decimalPlaces: derivedDecimals,
        isDefault: true,
        exchangeRate: '1.00000000',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      };
      store.currencies = [...store.currencies, created];
      return clone(created);
    }

    if (rawBody.exchangeRate === undefined) {
      throw new ApiError(422, 'CURRENCY_EXCHANGE_RATE_REQUIRED');
    }

    if (rawBody.isDefault) {
      const rebased = computeRebasedRates(store.currencies, rawBody.exchangeRate);
      store.currencies = store.currencies.map((item) => {
        const nextRate = rebased.get(item.id);
        return {
          ...item,
          isDefault: false,
          exchangeRate: nextRate !== undefined ? nextRate : item.exchangeRate,
          updatedAt: item.isDefault || nextRate !== undefined ? now : item.updatedAt,
        };
      });
      const created: Currency = {
        id: fakeId(),
        code,
        name,
        symbol,
        decimalPlaces: derivedDecimals,
        isDefault: true,
        exchangeRate: '1.00000000',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      };
      store.currencies = [...store.currencies, created];
      return clone(created);
    }

    const created: Currency = {
      id: fakeId(),
      code,
      name,
      symbol,
      decimalPlaces: derivedDecimals,
      isDefault: false,
      exchangeRate: rawBody.exchangeRate.toFixed(CURRENCY_LIMITS.rateDecimals),
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    store.currencies = [...store.currencies, created];
    return clone(created);
  });
}

export async function fakeUpdateCurrency(
  id: string,
  body: UpdateCurrencyBody,
  key: string,
): Promise<Currency> {
  await fakeDelay();
  consumeForcedFailure();

  const rawBody = body as UpdateCurrencyBody & { code?: unknown; decimalPlaces?: unknown };
  return runIdempotent(`updateCurrency:${id}`, key, rawBody, () => {
    const disallowed: Record<string, string> = {};
    if ('code' in rawBody && rawBody.code !== undefined) disallowed['code'] = 'immutable';
    if ('decimalPlaces' in rawBody && rawBody.decimalPlaces !== undefined) {
      disallowed['decimalPlaces'] = 'immutable';
    }
    if (Object.keys(disallowed).length > 0) {
      throw new ApiError(400, 'CORE_VALIDATION_FAILED', coreValidationDetails(disallowed));
    }

    const existing = store.currencies.find((item) => item.id === id);
    if (!existing) {
      throw new ApiError(404, 'CURRENCY_NOT_FOUND');
    }

    const details: Record<string, string> = {};
    let nextName = existing.name;
    if (rawBody.name !== undefined) {
      const trimmed = typeof rawBody.name === 'string' ? rawBody.name.trim() : '';
      if (!trimmed || Array.from(trimmed).length > CURRENCY_LIMITS.name) {
        details['name'] = 'invalid';
      } else {
        nextName = trimmed;
      }
    }

    let nextSymbol = existing.symbol;
    if (rawBody.symbol !== undefined) {
      if (typeof rawBody.symbol !== 'string') {
        details['symbol'] = 'invalid';
      } else {
        const trimmed = rawBody.symbol.trim();
        if (Array.from(trimmed).length > CURRENCY_LIMITS.symbol) {
          details['symbol'] = 'invalid';
        } else {
          nextSymbol = trimmed ? trimmed : null;
        }
      }
    }

    let nextRate = existing.exchangeRate;
    if (rawBody.exchangeRate !== undefined && !existing.isDefault) {
      if (!isValidRateNumber(rawBody.exchangeRate)) {
        details['exchangeRate'] = 'invalid';
      } else {
        nextRate = rawBody.exchangeRate.toFixed(CURRENCY_LIMITS.rateDecimals);
      }
    }

    if (rawBody.status !== undefined && rawBody.status !== 'ACTIVE' && rawBody.status !== 'INACTIVE') {
      details['status'] = 'invalid';
    }

    if (Object.keys(details).length > 0) {
      throw new ApiError(400, 'CORE_VALIDATION_FAILED', coreValidationDetails(details));
    }

    let nextStatus = existing.status;
    if (rawBody.status === 'ACTIVE') {
      if (!existing.isDefault && (nextRate === null || Number(nextRate) <= 0)) {
        throw new ApiError(422, 'CURRENCY_EXCHANGE_RATE_REQUIRED');
      }
      nextStatus = 'ACTIVE';
    } else if (rawBody.status === 'INACTIVE') {
      assertCanDeactivate(existing);
      nextStatus = 'INACTIVE';
    }

    const updated: Currency = {
      ...existing,
      name: nextName,
      symbol: nextSymbol,
      exchangeRate: existing.isDefault ? '1.00000000' : nextRate,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    };
    store.currencies = store.currencies.map((item) => (item.id === id ? updated : item));
    return clone(updated);
  });
}

export async function fakeSetDefaultCurrency(id: string, key: string): Promise<Currency> {
  await fakeDelay();
  consumeForcedFailure();

  return runIdempotent(`setDefaultCurrency:${id}`, key, { id }, () => {
    const target = store.currencies.find((item) => item.id === id);
    if (!target) {
      throw new ApiError(404, 'CURRENCY_NOT_FOUND');
    }
    if (target.status === 'INACTIVE') {
      throw new ApiError(409, 'CURRENCY_INACTIVE_DEFAULT');
    }
    if (target.isDefault) {
      return clone(target);
    }
    if (target.exchangeRate === null) {
      throw new ApiError(422, 'CURRENCY_EXCHANGE_RATE_REQUIRED');
    }
    const divisor = Number(target.exchangeRate);
    if (!Number.isFinite(divisor) || divisor <= 0) {
      throw new ApiError(422, 'CURRENCY_EXCHANGE_RATE_REQUIRED');
    }

    const rebased = computeRebasedRates(store.currencies, divisor, target.id);
    const now = new Date().toISOString();

    let promoted: Currency = target;
    store.currencies = store.currencies.map((item) => {
      if (item.id === target.id) {
        promoted = {
          ...item,
          isDefault: true,
          exchangeRate: '1.00000000',
          updatedAt: now,
        };
        return promoted;
      }
      const nextRate = rebased.get(item.id);
      return {
        ...item,
        isDefault: false,
        exchangeRate: nextRate !== undefined ? nextRate : item.exchangeRate,
        updatedAt: item.isDefault || nextRate !== undefined ? now : item.updatedAt,
      };
    });

    return clone(promoted);
  });
}

export async function fakeDeactivateCurrency(id: string, key: string): Promise<void> {
  await fakeDelay();
  consumeForcedFailure();

  runIdempotent(`deactivateCurrency:${id}`, key, { id }, () => {
    const target = store.currencies.find((item) => item.id === id);
    if (!target) {
      throw new ApiError(404, 'CURRENCY_NOT_FOUND');
    }
    assertCanDeactivate(target);

    const updated: Currency = {
      ...target,
      status: 'INACTIVE',
      updatedAt: new Date().toISOString(),
    };
    store.currencies = store.currencies.map((item) => (item.id === id ? updated : item));
    return true;
  });
}

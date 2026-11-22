import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import {
  createCurrency,
  deactivateCurrency,
  getDefaultCurrency,
  listCurrencies,
  listCurrencyCatalogue,
  setDefaultCurrency,
  updateCurrency,
} from './currencies.api';
import { FAKE_CURRENCIES_FAIL_NEXT, resetCurrenciesFake } from './currencies.fake';
import { Currency } from './currencies.model';

/*
 * currencies.api.ts over currencies.fake.ts: Core envelope { data, meta } for the list, bare
 * Currency for single records, CORE_VALIDATION_FAILED details keyed by field, IDEM_* codes and
 * the currency business codes (default, rebase, in-use).
 */

async function settle<T>(promise: Promise<T>): Promise<T> {
  const guarded = promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await vi.runAllTimersAsync();
  const result = await guarded;
  if (!result.ok) throw result.error;
  return result.value;
}

async function errorOf(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await settle(promise);
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('expected an ApiError');
}

function expectCorePage(page: unknown): void {
  expect(Object.keys(page as object).sort()).toEqual(['data', 'meta']);
  const { data, meta } = page as { data: unknown[]; meta: Record<string, unknown> };
  expect(Array.isArray(data)).toBe(true);
  expect(Object.keys(meta).sort()).toEqual(['hasNext', 'hasPrev', 'limit', 'page', 'total', 'totalPages']);
}

async function byCode(code: string): Promise<Currency> {
  const page = await settle(listCurrencies({ search: code, limit: 100 }));
  const row = page.data.find((item) => item.code === code);
  if (!row) throw new Error(`no currency ${code}`);
  return row;
}

describe('currencies api (fake)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetCurrenciesFake();
  });
  afterEach(() => vi.useRealTimers());

  describe('listCurrencies', () => {
    it('returns the Core paged envelope sorted by code', async () => {
      const page = await settle(listCurrencies());
      expectCorePage(page);
      expect(page.meta).toEqual({ page: 1, limit: 20, total: 8, totalPages: 1, hasNext: false, hasPrev: false });
      const codes = page.data.map((row) => row.code);
      expect(codes).toEqual([...codes].sort());
    });

    it('filters by status, default flag and search on code, name or symbol', async () => {
      const inactive = await settle(listCurrencies({ status: 'INACTIVE' }));
      expect(inactive.data.map((row) => row.code).sort()).toEqual(['GBP', 'JPY']);
      const defaults = await settle(listCurrencies({ isDefault: true }));
      expect(defaults.data.map((row) => row.code)).toEqual(['SAR']);
      const bySymbol = await settle(listCurrencies({ search: '€' }));
      expect(bySymbol.data.map((row) => row.code)).toEqual(['EUR']);
    });

    it('sorts by exchange rate with null rates last', async () => {
      const page = await settle(listCurrencies({ sortBy: 'exchangeRate', sortDir: 'DESC' }));
      expect(page.data[page.data.length - 1].exchangeRate).toBeNull();
      expect(page.data[0].code).toBe('JPY');
    });

    it('pages and clamps the limit', async () => {
      const page = await settle(listCurrencies({ limit: 3, page: 3 }));
      expect(page.data).toHaveLength(2);
      expect(page.meta).toMatchObject({ page: 3, limit: 3, total: 8, totalPages: 3, hasNext: false, hasPrev: true });
      expect((await settle(listCurrencies({ limit: 0 }))).meta.limit).toBe(1);
    });
  });

  describe('getDefaultCurrency and listCurrencyCatalogue', () => {
    it('returns the default currency as a bare record', async () => {
      const currency = await settle(getDefaultCurrency());
      expect(currency).toMatchObject({ code: 'SAR', isDefault: true, exchangeRate: '1.00000000' });
    });

    it('builds a catalogue of spendable ISO codes with minor units', async () => {
      const entries = await listCurrencyCatalogue('en');
      expect(entries.length).toBeGreaterThan(50);
      const kwd = entries.find((entry) => entry.code === 'KWD')!;
      expect(kwd.decimalPlaces).toBe(3);
      expect(entries.find((entry) => entry.code === 'JPY')!.decimalPlaces).toBe(0);
      expect(entries.some((entry) => entry.code === 'XDR')).toBe(false);
      entries[0].name = 'mutated';
      expect((await listCurrencyCatalogue('en'))[0].name).not.toBe('mutated');
    });
  });

  describe('createCurrency', () => {
    it('creates a non-default currency with an 8-decimal rate and derived decimals', async () => {
      const created = await settle(createCurrency({ code: 'bhd', name: ' Bahraini Dinar ', exchangeRate: 0.1 }, newIdempotencyKey()));
      expect(created).toMatchObject({
        code: 'BHD',
        name: 'Bahraini Dinar',
        decimalPlaces: 3,
        isDefault: false,
        exchangeRate: '0.10000000',
        status: 'ACTIVE',
        symbol: null,
      });
    });

    it('creates a new default and rebases the other rates', async () => {
      const created = await settle(
        createCurrency({ code: 'QAR', name: 'Qatari Riyal', exchangeRate: 0.5, isDefault: true }, newIdempotencyKey()),
      );
      expect(created).toMatchObject({ isDefault: true, exchangeRate: '1.00000000' });
      const sar = await byCode('SAR');
      expect(sar.isDefault).toBe(false);
      expect(sar.exchangeRate).toBe('2.00000000');
      const defaults = await settle(listCurrencies({ isDefault: true }));
      expect(defaults.data.map((row) => row.code)).toEqual(['QAR']);
    });

    it('answers 400 CORE_VALIDATION_FAILED with messages keyed by field', async () => {
      const error = await errorOf(createCurrency({ code: 'CHF', name: '', symbol: '123456789', exchangeRate: -1 }, newIdempotencyKey()));
      expect(error.status).toBe(400);
      expect(error.code).toBe('CORE_VALIDATION_FAILED');
      expect(error.details).toEqual({
        name: ['name is not valid'],
        symbol: ['symbol is not valid'],
        exchangeRate: ['exchangeRate is not valid'],
      });
    });

    it('answers the currency business codes', async () => {
      const invalid = await errorOf(createCurrency({ code: 'XDR', name: 'SDR', exchangeRate: 1 }, newIdempotencyKey()));
      expect([invalid.status, invalid.code]).toEqual([422, 'CURRENCY_CODE_INVALID']);

      const taken = await errorOf(createCurrency({ code: 'USD', name: 'Dollar', exchangeRate: 1 }, newIdempotencyKey()));
      expect([taken.status, taken.code]).toEqual([409, 'CURRENCY_CODE_TAKEN']);

      const precision = await errorOf(
        createCurrency({ code: 'CHF', name: 'Franc', exchangeRate: 1, decimalPlaces: 3 } as never, newIdempotencyKey()),
      );
      expect([precision.status, precision.code]).toEqual([422, 'CURRENCY_PRECISION_MISMATCH']);

      const rate = await errorOf(createCurrency({ code: 'CHF', name: 'Franc' }, newIdempotencyKey()));
      expect([rate.status, rate.code]).toEqual([422, 'CURRENCY_EXCHANGE_RATE_REQUIRED']);
    });

    it('replays the same key and body; answers IDEM_MISSING, IDEM_BAD_VALUE and IDEM_MISMATCH', async () => {
      const key = newIdempotencyKey();
      const body = { code: 'CHF', name: 'Swiss Franc', exchangeRate: 0.23 };
      const first = await settle(createCurrency(body, key));
      expect(await settle(createCurrency(body, key))).toEqual(first);
      expect((await settle(listCurrencies({ search: 'CHF' }))).meta.total).toBe(1);

      const mismatch = await errorOf(createCurrency({ ...body, name: 'Other' }, key));
      expect([mismatch.status, mismatch.code]).toEqual([422, 'GW.IDEM.MISMATCH']);
      const missing = await errorOf(createCurrency(body, '  '));
      expect([missing.status, missing.code]).toEqual([400, 'GW.IDEM.MISSING']);
      const bad = await errorOf(createCurrency(body, 'abc'));
      expect([bad.status, bad.code]).toEqual([400, 'GW.IDEM.BAD_VALUE']);
    });

    it('throws the queued FAIL_NEXT code once', async () => {
      FAKE_CURRENCIES_FAIL_NEXT.code = 'IDEM_IN_FLIGHT';
      FAKE_CURRENCIES_FAIL_NEXT.status = 409;
      const error = await errorOf(createCurrency({ code: 'CHF', name: 'Franc', exchangeRate: 1 }, newIdempotencyKey()));
      expect([error.status, error.code]).toEqual([409, 'IDEM_IN_FLIGHT']);
      expect(FAKE_CURRENCIES_FAIL_NEXT.code).toBeNull();
    });
  });

  describe('updateCurrency', () => {
    it('updates name, symbol and rate', async () => {
      const eur = await byCode('EUR');
      const updated = await settle(updateCurrency(eur.id, { name: 'Euro (EU)', symbol: '', exchangeRate: 0.25 }, newIdempotencyKey()));
      expect(updated).toMatchObject({ name: 'Euro (EU)', symbol: null, exchangeRate: '0.25000000' });
    });

    it('keeps the default currency at rate 1', async () => {
      const sar = await byCode('SAR');
      const updated = await settle(updateCurrency(sar.id, { exchangeRate: 3 }, newIdempotencyKey()));
      expect(updated.exchangeRate).toBe('1.00000000');
    });

    it('rejects immutable code and decimalPlaces', async () => {
      const eur = await byCode('EUR');
      const error = await errorOf(updateCurrency(eur.id, { code: 'EUX', decimalPlaces: 3 } as never, newIdempotencyKey()));
      expect(error.code).toBe('CORE_VALIDATION_FAILED');
      expect(error.details).toEqual({
        code: ['property code should not exist'],
        decimalPlaces: ['property decimalPlaces should not exist'],
      });
    });

    it('answers 404 CURRENCY_NOT_FOUND and 422 CURRENCY_EXCHANGE_RATE_REQUIRED', async () => {
      const missing = await errorOf(updateCurrency('missing', { name: 'X' }, newIdempotencyKey()));
      expect([missing.status, missing.code]).toEqual([404, 'CURRENCY_NOT_FOUND']);
      const gbp = await byCode('GBP');
      const rate = await errorOf(updateCurrency(gbp.id, { status: 'ACTIVE' }, newIdempotencyKey()));
      expect([rate.status, rate.code]).toEqual([422, 'CURRENCY_EXCHANGE_RATE_REQUIRED']);
    });
  });

  describe('setDefaultCurrency', () => {
    it('promotes a currency and rebases the others', async () => {
      const usd = await byCode('USD');
      const promoted = await settle(setDefaultCurrency(usd.id, newIdempotencyKey()));
      expect(promoted).toMatchObject({ code: 'USD', isDefault: true, exchangeRate: '1.00000000' });
      const sar = await byCode('SAR');
      expect(sar.isDefault).toBe(false);
      expect(Number(sar.exchangeRate)).toBeCloseTo(3.75, 4);
    });

    it('returns the current default unchanged', async () => {
      const sar = await byCode('SAR');
      expect(await settle(setDefaultCurrency(sar.id, newIdempotencyKey()))).toMatchObject({ id: sar.id, isDefault: true });
    });

    it('answers 409 CURRENCY_INACTIVE_DEFAULT and 404 CURRENCY_NOT_FOUND', async () => {
      const jpy = await byCode('JPY');
      const inactive = await errorOf(setDefaultCurrency(jpy.id, newIdempotencyKey()));
      expect([inactive.status, inactive.code]).toEqual([409, 'CURRENCY_INACTIVE_DEFAULT']);
      const missing = await errorOf(setDefaultCurrency('missing', newIdempotencyKey()));
      expect([missing.status, missing.code]).toEqual([404, 'CURRENCY_NOT_FOUND']);
    });
  });

  describe('deactivateCurrency', () => {
    it('deactivates a free currency and resolves with no body', async () => {
      const eur = await byCode('EUR');
      await expect(settle(deactivateCurrency(eur.id, newIdempotencyKey()))).resolves.toBeUndefined();
      expect((await byCode('EUR')).status).toBe('INACTIVE');
    });

    it('answers 409 for the default, the workspace currency and a company currency', async () => {
      const sar = await byCode('SAR');
      const def = await errorOf(deactivateCurrency(sar.id, newIdempotencyKey()));
      expect([def.status, def.code]).toEqual([409, 'CURRENCY_DEFAULT_DELETE']);

      const aed = await byCode('AED');
      const inUse = await errorOf(deactivateCurrency(aed.id, newIdempotencyKey()));
      expect([inUse.status, inUse.code]).toEqual([409, 'CURRENCY_IN_USE']);

      const usd = await byCode('USD');
      const company = await errorOf(deactivateCurrency(usd.id, newIdempotencyKey()));
      expect([company.status, company.code]).toEqual([409, 'CURRENCY_COMPANY_IN_USE']);
      expect(Object.keys(company.details ?? {})).toEqual([]);
    });

    // AGENTS.md Phase 3: fake error details hold string arrays only, because the backend's shared
    // error filter drops every other value. CURRENCY_COMPANY_IN_USE sends a number and objects,
    // which deactivate-blocker-modal reads; in production that list would never arrive.
    it('CURRENCY_COMPANY_IN_USE details are string arrays only (Core sends none)', async () => {
      const usd = await byCode('USD');
      const error = await errorOf(deactivateCurrency(usd.id, newIdempotencyKey()));
      for (const value of Object.values(error.details ?? {})) {
        expect(Array.isArray(value) && value.every((item) => typeof item === 'string')).toBe(true);
      }
    });
  });
});

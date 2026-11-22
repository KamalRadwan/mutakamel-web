import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../core/api/idempotency';
import { createCurrency, getDefaultCurrency, listCurrencies } from './currencies/currencies.api';
import { listNumbering, peekNumbering } from './numbering/numbering.api';
import { createTax, listTaxes } from './taxes/taxes.api';

/*
 * Core's global ResponseEnvelopeInterceptor turns a PaginatedResult into { data, meta }.
 * These specs pin the fakes to that shape and to the CORE_VALIDATION_FAILED details shape.
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

describe('settings lists use Core envelope { data, meta }', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('currencies', async () => {
    const page = await settle(listCurrencies({ limit: 20 }));
    expectCorePage(page);
    expect(page.meta.total).toBeGreaterThanOrEqual(page.data.length);
    const defaultCurrency = await settle(getDefaultCurrency());
    expect(defaultCurrency?.isDefault ?? true).toBe(true);
  });

  it('taxes', async () => {
    expectCorePage(await settle(listTaxes({ limit: 20 })));
  });

  it('numbering', async () => {
    expectCorePage(await settle(listNumbering({ limit: 20 })));
  });
});

describe('settings validation errors carry field -> messages', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('currencies', async () => {
    const error = await errorOf(createCurrency({ code: 'CHF', name: '', exchangeRate: 1 }, newIdempotencyKey()));
    expect(error.code).toBe('CORE_VALIDATION_FAILED');
    expect(error.details?.['name']).toEqual(['name is not valid']);
  });

  it('taxes', async () => {
    const error = await errorOf(createTax({ code: '', name: '', rate: 5 }, newIdempotencyKey()));
    expect(error.code).toBe('CORE_VALIDATION_FAILED');
    expect(error.details?.['code']).toEqual(['code is not valid']);
  });
});

describe('numbering peek', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns companyId null for a workspace-wide sequence', async () => {
    const peek = await settle(peekNumbering('BUSINESS_LETTER', null));
    expect(peek.companyId).toBeNull();
  });
});

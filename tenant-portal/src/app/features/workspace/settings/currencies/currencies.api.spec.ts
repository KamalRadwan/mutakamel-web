import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DOCUMENT, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { AuthSession } from '../../../../core/auth/auth-session';
import { CurrenciesApi } from './currencies.api';
import type { Currency } from './currencies.model';

const path = '/api/tenant/core/v1/currencies';
const currency: Currency = {
  id: '01970000-0000-7000-8000-000000000001', code: 'USD', name: 'US dollar', symbol: '$',
  decimalPlaces: 2, isDefault: true, exchangeRate: '1.00000000', status: 'ACTIVE', createdAt: '', updatedAt: '',
};
const meta = { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false };

describe('CurrenciesApi', () => {
  let api: CurrenciesApi;
  let http: HttpTestingController;
  let csrf: string;
  const me = signal({ id: 'reader-1' });

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: AuthSession, useValue: { me } },
    ] });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(CurrenciesApi);
    const document = TestBed.inject(DOCUMENT);
    csrf = 'csrf-token';
    vi.spyOn(document, 'cookie', 'get').mockImplementation(() =>
      csrf ? `mutakamel-http-tenant-csrf=${csrf}; __Host-mutakamel-tenant-csrf=${csrf}` : '');
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); });

  it('list unwraps data and meta', async () => {
    const pending = api.listCurrencies({ page: 2, limit: 50, search: 'USD', status: 'ACTIVE', sortBy: 'code', sortDir: 'ASC' });
    const request = http.expectOne((req) => req.url === path);
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('limit')).toBe('50');
    expect(request.request.params.get('search')).toBe('USD');
    expect(request.request.withCredentials).toBe(true);
    request.flush({ success: true, data: [currency], meta });
    expect(await pending).toEqual({ data: [currency], meta });
  });

  it('malformed list → COMMON.GENERIC.INTERNAL_ERROR', async () => {
    const pending = api.listCurrencies();
    const assertion = expect(pending).rejects.toMatchObject({ status: 502, code: 'COMMON.GENERIC.INTERNAL_ERROR' });
    http.expectOne((req) => req.url === path).flush({ success: true, data: {} });
    await assertion;
  });

  it('limit is capped at 100', async () => {
    for (const limit of [20, 50, 100, 1000]) {
      const pending = api.listCurrencies({ limit });
      const request = http.expectOne((req) => req.url === path);
      expect(request.request.params.get('limit')).toBe(String(Math.min(100, limit)));
      request.flush({ success: true, data: [], meta: { ...meta, total: 0 } });
      await pending;
    }
  });

  it('default lookup query and null', async () => {
    for (const rows of [[currency], []]) {
      const pending = api.getDefaultCurrency();
      const request = http.expectOne((req) => req.url === path);
      expect(request.request.params.get('isDefault')).toBe('true');
      expect(request.request.params.get('limit')).toBe('1');
      request.flush({ success: true, data: rows, meta });
      expect(await pending).toEqual(rows[0] ?? null);
    }
  });

  it('create key reuse on retry', async () => {
    const key = newIdempotencyKey();
    const body = { code: 'USD', name: 'US dollar' };
    const first = api.createCurrency(body, key);
    const rejected = expect(first).rejects.toBeInstanceOf(ApiError);
    const request = http.expectOne(path);
    expect(request.request.headers.get('x-idempotency-key')).toMatch(/^[\da-f]{8}-[\da-f]{4}-7[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
    expect(request.request.headers.get('x-csrf-token')).toBe(csrf);
    expect(request.request.method).toBe('POST');
    request.flush({}, { status: 503, statusText: 'Unavailable' });
    await rejected;
    const retry = api.createCurrency(body, key);
    const repeated = http.expectOne(path);
    expect(repeated.request.headers.get('x-idempotency-key')).toBe(key);
    expect(repeated.request.body).toEqual(body);
    repeated.flush({ success: true, data: currency }, { status: 201, statusText: 'Created' });
    expect(await retry).toEqual(currency);
  });

  it('create without CSRF sends nothing', async () => {
    csrf = '';
    await expect(api.createCurrency({ code: 'USD', name: 'Dollar' }, newIdempotencyKey()))
      .rejects.toMatchObject({ code: 'GW.AUTH.CSRF_INVALID' });
    http.expectNone(path);
  });

  it('create preserves CORE_VALIDATION_FAILED field messages', async () => {
    const pending = api.createCurrency({ code: 'CHF', name: '', exchangeRate: 1 }, newIdempotencyKey());
    const rejected = expect(pending).rejects.toMatchObject({
      code: 'CORE_VALIDATION_FAILED', details: { name: ['name is not valid'] },
    });
    http.expectOne(path).flush({ errorCode: 'CORE_VALIDATION_FAILED', details: { name: ['name is not valid'] } },
      { status: 400, statusText: 'Bad Request' });
    await rejected;
  });

  it('set-default sends no body and accepts 201', async () => {
    const pending = api.setDefaultCurrency(currency.id, newIdempotencyKey());
    const request = http.expectOne(`${path}/${currency.id}/set-default`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
    request.flush({ success: true, data: currency }, { status: 201, statusText: 'Created' });
    expect(await pending).toEqual(currency);
  });

  it('deactivate returns void on 204', async () => {
    const pending = api.deactivateCurrency(currency.id, newIdempotencyKey());
    const request = http.expectOne(`${path}/${currency.id}`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });
    expect(await pending).toBeUndefined();
  });

  it('update sends only the patch and invalidates currency queries after every write', async () => {
    const queries = api['queries'];
    const cancel = vi.spyOn(queries, 'cancelQueries');
    const invalidate = vi.spyOn(queries, 'invalidateQueries');
    const pending = api.updateCurrency(currency.id, { symbol: '', exchangeRate: 10_000_000_000 }, newIdempotencyKey());
    const request = http.expectOne(`${path}/${currency.id}`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ symbol: '', exchangeRate: 10_000_000_000 });
    request.flush({ success: true, data: { ...currency, symbol: null } });
    await pending;
    expect(cancel).toHaveBeenCalledWith({ queryKey: ['ws-currencies'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['ws-currencies'] });
  });

  it('query keys include the reader and query and disable automatic retry', async () => {
    const queries = api['queries'];
    const fetch = vi.spyOn(queries, 'fetchQuery');
    const pending = api.listCurrencies({ search: 'EUR' });
    http.expectOne((req) => req.url === path).flush({ success: true, data: [], meta });
    await pending;
    expect(fetch).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['ws-currencies', me().id, { search: 'EUR', page: 1, limit: 20 }] }));
    expect(queries.getDefaultOptions().queries?.retry).toBe(false);
  });

  it('client ISO catalogue stays available without HTTP', async () => {
    const entries = await api.listCurrencyCatalogue('en');
    expect(entries.find((entry) => entry.code === 'USD')).toMatchObject({ decimalPlaces: 2 });
    http.expectNone(() => true);
  });
});

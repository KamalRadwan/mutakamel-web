import { DOCUMENT, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSession } from '../../../../core/auth/auth-session';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { TaxesApi } from './taxes.api';
import type { Tax } from './taxes.model';

const path = '/api/tenant/core/v1/taxes';
const tax: Tax = { id: '01970000-0000-7000-8000-000000000001', code: 'VAT15', name: 'VAT', rate: '15.0000',
  isInclusive: false, companyId: null, status: 'ACTIVE', createdAt: '', updatedAt: '' };
const meta = { page: 2, limit: 20, total: 21, totalPages: 2, hasNext: false, hasPrev: true };

describe('TaxesApi', () => {
  let api: TaxesApi;
  let http: HttpTestingController;
  let cookie = '';
  const me = signal({ id: 'user', isTenantOwner: false, permissions: ['taxes.tax.read', 'taxes.tax.manage'],
    permissionScopes: { 'taxes.tax.read': { tenantWide: false, companyIds: ['company'], branchIds: [] },
      'taxes.tax.manage': { tenantWide: false, companyIds: ['company'], branchIds: [] } },
    accessibleCompanies: ['company'] } as unknown as TenantMe);

  beforeEach(() => {
    cookie = 'mutakamel-http-tenant-csrf=test-csrf';
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: AuthSession, useValue: { me } }, { provide: DOCUMENT, useValue: { location: { protocol: 'http:' }, get cookie() { return cookie; } } },
    ] });
    api = TestBed.inject(TaxesApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('list unwraps data and meta', async () => {
    const promise = api.listTaxes({ page: 2, limit: 20, sortBy: 'rate', sortDir: 'DESC', search: 'VAT', status: 'ACTIVE', companyId: 'company', isInclusive: false });
    const request = http.expectOne((r) => r.url === path);
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.params.get('isInclusive')).toBe('false');
    expect(request.request.params.keys().sort()).toEqual(['companyId', 'isInclusive', 'limit', 'page', 'search', 'sortBy', 'sortDir', 'status']);
    request.flush({ success: true, data: [tax], meta });
    expect(await promise).toEqual({ data: [tax], meta });
  });

  it.each([{ data: [] }, { success: true, data: {} }, { success: true, data: [], meta: {} },
    { success: true, data: [{}], meta }])('malformed list → COMMON.GENERIC.INTERNAL_ERROR: %j', async (body) => {
    const promise = api.listTaxes();
    const assertion = expect(promise).rejects.toMatchObject({ status: 502, code: 'COMMON.GENERIC.INTERNAL_ERROR' });
    http.expectOne(path).flush(body);
    await assertion;
  });

  it('query key includes the scope revision', async () => {
    const fetchQuery = vi.spyOn(api['queries'], 'fetchQuery');
    const first = api.listTaxes();
    http.expectOne(path).flush({ success: true, data: [tax], meta });
    await first;
    const original = me();
    const revision = api.scopeRevision();
    expect(fetchQuery.mock.calls[0][0].queryKey).toEqual(['ws-taxes', revision, {}]);
    me.set({ ...original, permissionScopes: { ...original.permissionScopes,
      'taxes.tax.read': { tenantWide: false, companyIds: [], branchIds: [] } }, accessibleCompanies: [] });
    expect(api.scopeRevision()).not.toBe(revision);
    const second = api.listTaxes();
    http.expectOne(path).flush({ success: true, data: [], meta: { ...meta, total: 0 } });
    expect((await second).data).toEqual([]);
    expect(fetchQuery.mock.calls[1][0].queryKey).toEqual(['ws-taxes', api.scopeRevision(), {}]);
    me.set(original);
  });

  it('create key reuse on retry', async () => {
    const key = newIdempotencyKey();
    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const body = { code: 'VAT15', name: 'VAT', rate: 15 };
    const first = api.createTax(body, key);
    const failed = expect(first).rejects.toMatchObject({ status: 503 });
    const request = http.expectOne(path);
    expect(request.request.headers.get('x-csrf-token')).toBe('test-csrf');
    expect(request.request.headers.get('x-idempotency-key')).toBe(key);
    request.flush({ errorCode: 'COMMON.GENERIC.INTERNAL_ERROR' }, { status: 503, statusText: 'Unavailable' });
    await failed;
    const retry = api.createTax(body, key);
    const replay = http.expectOne(path);
    expect(replay.request.method).toBe('POST');
    expect(replay.request.body).toEqual(request.request.body);
    expect(replay.request.headers.get('x-idempotency-key')).toBe(key);
    replay.flush({ success: true, data: tax }, { status: 201, statusText: 'Created' });
    expect(await retry).toEqual(tax);
  });

  it('create without CSRF sends nothing', async () => {
    cookie = '';
    await expect(api.createTax({ code: 'VAT', name: 'VAT', rate: 15 }, newIdempotencyKey())).rejects.toMatchObject({ code: 'GW.AUTH.CSRF_INVALID' });
    http.expectNone(path);
  });

  it('workspace tax omits companyId', async () => {
    const promise = api.createTax({ code: 'VAT', name: 'VAT', rate: 15 }, newIdempotencyKey());
    const request = http.expectOne(path);
    expect(request.request.body).not.toHaveProperty('companyId');
    request.flush({ success: true, data: tax }, { status: 201, statusText: 'Created' });
    await promise;
  });

  it('create preserves CORE_VALIDATION_FAILED field messages', async () => {
    const pending = api.createTax({ code: '', name: '', rate: 5 }, newIdempotencyKey());
    const rejected = expect(pending).rejects.toMatchObject({
      code: 'CORE_VALIDATION_FAILED', details: { code: ['code is not valid'] },
    });
    http.expectOne(path).flush({ errorCode: 'CORE_VALIDATION_FAILED', details: { code: ['code is not valid'] } },
      { status: 400, statusText: 'Bad Request' });
    await rejected;
  });

  it('deactivate returns void on 204', async () => {
    const promise = api.deactivateTax(tax.id, newIdempotencyKey());
    const request = http.expectOne(`${path}/${tax.id}`);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.body).toBeNull();
    request.flush(null, { status: 204, statusText: 'No Content' });
    expect(await promise).toBeUndefined();
  });

  it('update sends only the patch and invalidates the list', async () => {
    const invalidate = vi.spyOn(api['queries'], 'invalidateQueries');
    const promise = api.updateTax(tax.id, { name: 'New VAT', rate: 7.5 }, newIdempotencyKey());
    const request = http.expectOne(`${path}/${tax.id}`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ name: 'New VAT', rate: 7.5 });
    request.flush({ success: true, data: { ...tax, name: 'New VAT', rate: '7.5000' } });
    expect((await promise).name).toBe('New VAT');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['ws-taxes'] });
  });

  it('429 preserves Retry-After for the core mapper', async () => {
    const promise = api.deactivateTax(tax.id, newIdempotencyKey());
    const failed = expect(promise).rejects.toMatchObject({ code: 'GW.RATE.LIMIT_EXCEEDED', details: { retryAfterSeconds: ['8'] } });
    http.expectOne(`${path}/${tax.id}`).flush({ code: 'GW.RATE.LIMIT_EXCEEDED' },
      { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '8' } });
    await failed;
  });
});

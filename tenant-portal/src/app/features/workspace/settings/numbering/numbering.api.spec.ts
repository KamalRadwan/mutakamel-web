import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { QueryClient } from '@tanstack/angular-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSession } from '../../../../core/auth/auth-session';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { NumberingApi } from './numbering.api';

const path = '/api/tenant/core/v1/numbering';
const sequence = { id: 'seq', code: 'INV', prefix: 'INV-', padding: 5, nextValue: '9007199254740991',
  companyId: null, createdAt: '2026-11-01', updatedAt: '2026-11-01' };
const meta = { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false };

describe('NumberingApi', () => {
  let api: NumberingApi;
  let http: HttpTestingController;
  let cookie: string;
  const me = signal({ id: 'actor', permissions: ['numbering.read'], permissionScopes: {}, accessibleCompanies: [] } as unknown as TenantMe);

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: AuthSession, useValue: { me } }] });
    const doc = TestBed.inject(DOCUMENT);
    const name = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    cookie = `${name}=csrf-proof`;
    vi.spyOn(doc, 'cookie', 'get').mockImplementation(() => cookie);
    api = TestBed.inject(NumberingApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); });

  it('list unwraps data and meta', async () => {
    const result = api.listNumbering({ page: 1, limit: 20, sortBy: 'nextValue', sortDir: 'DESC', search: 'INV', code: 'INV', companyId: 'company' });
    const request = http.expectOne((r) => r.url === path);
    expect(request.request.params.get('code')).toBe('INV');
    expect(request.request.params.get('companyId')).toBe('company');
    expect(request.request.withCredentials).toBe(true);
    request.flush({ success: true, data: [sequence], meta });
    await expect(result).resolves.toEqual({ data: [sequence], meta });
  });

  it('malformed list → COMMON.GENERIC.INTERNAL_ERROR', async () => {
    for (const body of [{ data: [] }, { success: true, data: {} }, { success: true, data: [], meta: {} }]) {
      const result = api.listNumbering({});
      http.expectOne(path).flush(body);
      await expect(result).rejects.toMatchObject({ code: 'COMMON.GENERIC.INTERNAL_ERROR' });
    }
  });

  it('query key includes the scope revision', async () => {
    const fetch = vi.spyOn(QueryClient.prototype, 'fetchQuery');
    const run = async () => {
      const result = api.listNumbering({});
      const key = fetch.mock.calls.at(-1)?.[0].queryKey;
      http.expectOne(path).flush({ success: true, data: [], meta: { ...meta, total: 0 } });
      await result;
      return key;
    };
    const before = await run();
    me.update((value) => ({ ...value, accessibleCompanies: ['new-company'],
      permissionScopes: { 'numbering.read': { tenantWide: false, companyIds: ['new-company'], branchIds: [] } } }));
    const after = await run();
    expect(after?.[0]).toBe('ws-numbering');
    expect(after).not.toEqual(before);
    expect(String(after?.[1])).toContain('new-company');
  });

  it('create key reuse on retry', async () => {
    const key = newIdempotencyKey();
    const body = { code: 'INV', startValue: 9007199254740991 };
    const first = api.createNumbering(body, key);
    let request = http.expectOne(path);
    expect(request.request.headers.get('x-idempotency-key')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(request.request.headers.get('x-csrf-token')).toBe('csrf-proof');
    request.flush({ errorCode: 'INTERNAL_ERROR' }, { status: 500, statusText: 'Error' });
    await expect(first).rejects.toMatchObject({ status: 500 });
    const retry = api.createNumbering(body, key);
    request = http.expectOne(path);
    expect(request.request.headers.get('x-idempotency-key')).toBe(key);
    expect(request.request.body).toEqual(body);
    request.flush({ success: true, data: sequence }, { status: 201, statusText: 'Created' });
    await expect(retry).resolves.toEqual(sequence);
  });

  it('create without CSRF sends nothing', async () => {
    cookie = '';
    await expect(api.createNumbering({ code: 'INV' }, newIdempotencyKey())).rejects.toMatchObject({ code: 'GW.AUTH.CSRF_INVALID' });
    http.expectNone(path);
  });

  it('peek unwraps formatted', async () => {
    const data = { code: 'INV', companyId: 'company', nextValue: '5', formatted: 'INV-00005' };
    for (let n = 0; n < 2; n++) {
      const result = api.peekNumbering('INV', 'company');
      http.expectOne(`${path}/INV/peek?companyId=company`).flush({ success: true, data });
      await expect(result).resolves.toEqual(data);
    }
  });

  it('update uses PATCH and invalidates list queries after writes', async () => {
    const invalidation = vi.spyOn(QueryClient.prototype, 'invalidateQueries');
    const pending = api.updateNumbering('seq', { nextValue: 25 }, newIdempotencyKey());
    const request = http.expectOne(`${path}/seq`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ nextValue: 25 });
    request.flush({ success: true, data: sequence });
    await expect(pending).resolves.toEqual(sequence);
    expect(invalidation).toHaveBeenCalledOnce();
  });

  it('peek returns companyId null for a workspace-wide sequence', async () => {
    const data = { code: 'BUSINESS_LETTER', companyId: null, nextValue: '5', formatted: 'LETTER-00005' };
    const pending = api.peekNumbering('BUSINESS_LETTER', null);
    http.expectOne(`${path}/BUSINESS_LETTER/peek`).flush({ success: true, data });
    await expect(pending).resolves.toEqual(data);
  });
});

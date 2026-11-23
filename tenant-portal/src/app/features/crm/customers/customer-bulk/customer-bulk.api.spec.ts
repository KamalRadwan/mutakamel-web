import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { bindCrmHttpForTest, CrmHttp, crmQueries } from '../../shared/crm-http';
import { fakeSelectCustomers, listCustomerBulkOwners, selectCustomers } from './customer-bulk.api';
import { CUSTOMER_SELECTION_LIMIT } from './customer-bulk.model';

const companyId = '019f0000-0000-7000-8000-000000000010';
const branchId = '019f0000-0000-7000-8000-000000000011';
const otherBranch = '019f0000-0000-7000-8000-000000000012';
const base = '/api/tenant/crm/v1';
const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe.each([['en', 'light'], ['en', 'dark'], ['ar', 'light'], ['ar', 'dark']])('CustomerBulk %s / %s', (lang, theme) => {
  const selection = signal<{ companyId: string; branchId: string | null } | null>(null);
  let http: HttpTestingController;
  let dispose: () => void;
  let attributes: (string | null)[];

  beforeEach(() => {
    attributes = ['lang', 'dir', 'data-theme'].map((name) => document.documentElement.getAttribute(name));
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dataset['theme'] = theme;
    selection.set({ companyId, branchId });
    document.cookie = 'mutakamel-http-tenant-csrf=customer-bulk-test; path=/';
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: TenantScopeState, useValue: { selection, branchCompanies: () => new Map([[branchId, companyId]]) } },
    ] });
    http = TestBed.inject(HttpTestingController);
    dispose = bindCrmHttpForTest(TestBed.inject(CrmHttp));
  });

  afterEach(() => {
    http.verify();
    dispose();
    crmQueries().clear();
    document.cookie = 'mutakamel-http-tenant-csrf=; Max-Age=0; path=/';
    ['lang', 'dir', 'data-theme'].forEach((name, i) => {
      const value = attributes[i];
      if (value == null) document.documentElement.removeAttribute(name);
      else document.documentElement.setAttribute(name, value);
    });
  });

  it('keeps the legacy selection name as an alias to the live API', () => {
    expect(fakeSelectCustomers).toBe(selectCustomers);
  });

  it('propagates backend errors without substituting fake selection rows', async () => {
    const promise = selectCustomers({ branchId }, undefined);
    const rejected = expect(promise).rejects.toMatchObject({ code: 'CRM_SCOPED_PERMISSION_DENIED' });
    http.expectOne(`${base}/customer-profiles/selection`).flush(
      { code: 'CRM_SCOPED_PERMISSION_DENIED', message: 'Denied' },
      { status: 403, statusText: 'Forbidden' },
    );
    await rejected;
  });

  it('selection sends its key and both scope headers, accepts the bare result, and omits page-only fields', async () => {
    const promise = selectCustomers({ branchId, status: 'PROSPECT', page: 3, limit: 20, includeStatusCounts: true }, 'displayName:ASC');
    const req = http.expectOne(`${base}/customer-profiles/selection`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('x-idempotency-key')).toMatch(uuidV7);
    expect(req.request.headers.get('x-mutakamel-company-id')).toBe(companyId);
    expect(req.request.headers.get('x-mutakamel-branch-id')).toBe(branchId);
    expect(req.request.body).toMatchObject({ branchId, status: 'PROSPECT', sort: 'displayName:ASC', limit: CUSTOMER_SELECTION_LIMIT });
    expect(req.request.body).not.toHaveProperty('page');
    expect(req.request.body).not.toHaveProperty('includeStatusCounts');
    const result = { items: [], total: 0, truncated: false };
    req.flush(result);
    await expect(promise).resolves.toEqual(result);
  });

  it('selection makes no request without the current, unambiguous branch', async () => {
    for (const current of [null, { companyId, branchId: null }, { companyId, branchId: otherBranch }]) {
      selection.set(current);
      await expect(selectCustomers({ branchId }, undefined)).rejects.toMatchObject({ code: 'BRANCH_CONTEXT_REQUIRED' });
    }
    http.expectNone(`${base}/customer-profiles/selection`);
  });

  it('selection reports the 10,000 cap before sending', async () => {
    await expect(selectCustomers({ branchId }, undefined, 10001)).rejects.toMatchObject({ code: 'CUSTOMER_PROFILE_SELECTION_TOO_LARGE' });
    http.expectNone(`${base}/customer-profiles/selection`);
  });

  it('owners uses XR-LK with both scope headers and follows the cursor', async () => {
    const promise = listCustomerBulkOwners(branchId);
    const first = http.expectOne((req) => req.url === `${base}/assignable-owners`);
    expect(first.request.params.get('resource')).toBe('customer_profiles');
    expect(first.request.params.get('action')).toBe('update');
    expect(first.request.params.get('limit')).toBe('200');
    expect(first.request.headers.get('x-mutakamel-company-id')).toBe(companyId);
    expect(first.request.headers.get('x-mutakamel-branch-id')).toBe(branchId);
    first.flush({ items: [{ id: 'owner-1', displayName: 'First', avatarUrl: null }], nextCursor: otherBranch });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const next = http.expectOne((req) => req.url === `${base}/assignable-owners`);
    expect(next.request.params.get('cursor')).toBe(otherBranch);
    expect(next.request.headers.get('x-mutakamel-company-id')).toBe(companyId);
    expect(next.request.headers.get('x-mutakamel-branch-id')).toBe(branchId);
    next.flush({ items: [{ id: 'owner-2', displayName: 'Second', avatarUrl: null }], nextCursor: null });
    await expect(promise).resolves.toEqual([
      { userId: 'owner-1', name: 'First', avatarUrl: null },
      { userId: 'owner-2', name: 'Second', avatarUrl: null },
    ]);
  });
});

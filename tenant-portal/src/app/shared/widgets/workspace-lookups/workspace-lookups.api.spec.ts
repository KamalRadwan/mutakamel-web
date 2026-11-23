import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../core/api/api-errors';
import type { CorePageMeta } from '../../../core/api/core-page';
import type { TenantMe } from '../../../core/auth/auth-session.model';
import { TenantScopeState } from '../../../core/scope/tenant-scope';
import { WorkspaceLookups } from './workspace-lookups.api';
import type { WorkspaceApp, WorkspaceBranch, WorkspaceCompany, WorkspaceUser } from './workspace-lookups.model';

const corePath = '/api/tenant/core/v1';
const companiesPath = `${corePath}/organization/companies`;
const branchesPath = `${corePath}/organization/branches`;
const usersPath = `${corePath}/users`;
const appsPath = `${corePath}/apps/overview`;
const company: WorkspaceCompany = {
  id: 'company-1', code: 'HQ', name: 'Company', legalName: null, taxNumber: null,
  countryCode: 'EG', currencyCode: 'EGP', status: 'ACTIVE', createdAt: '2026-11-22', updatedAt: '2026-11-22',
};
const branch: WorkspaceBranch = {
  id: 'branch-1', companyId: company.id, code: 'HQ', name: 'Headquarters', address: null,
  phone: null, isHeadquarters: true, status: 'ACTIVE', createdAt: '2026-11-22', updatedAt: '2026-11-22',
};
const user: WorkspaceUser = {
  id: 'user-1', email: 'user@example.invalid', firstName: 'Test', lastName: 'User', employeeCode: null,
  companyId: company.id, branchId: branch.id, departmentId: 'department-1', teamId: null,
  managerId: null, jobTitle: null, status: 'ACTIVE', isTenantOwner: false, seats: [],
  createdAt: '2026-11-22', updatedAt: '2026-11-22',
};

function pageMeta(page = 1, hasNext = false): CorePageMeta {
  return { page, limit: 100, total: 3, totalPages: 3, hasNext, hasPrev: page > 1 };
}

describe('WorkspaceLookups', () => {
  const me = signal<Pick<TenantMe, 'id' | 'isTenantOwner' | 'permissions' | 'permissionScopes' |
    'accessibleCompanies' | 'accessibleBranches'> | null>(null);
  const selection = signal<{ companyId: string; branchId: string | null } | null>(null);
  let api: WorkspaceLookups;
  let requests: HttpTestingController;

  beforeEach(() => {
    me.set({ id: 'reader-1', isTenantOwner: false, permissions: [], permissionScopes: {},
      accessibleCompanies: [company.id], accessibleBranches: [branch.id] });
    selection.set(null);
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: TenantScopeState, useValue: { me, selection } },
    ] });
    api = TestBed.inject(WorkspaceLookups);
    requests = TestBed.inject(HttpTestingController);
  });

  afterEach(() => requests.verify());

  function expectRead(path: string) {
    const request = requests.expectOne((item) => item.url === path && item.method === 'GET');
    expect(request.request.withCredentials).toBe(true);
    for (const header of ['x-idempotency-key', 'x-csrf-token', 'If-Match']) {
      expect(request.request.headers.has(header)).toBe(false);
    }
    return request;
  }

  it('companies reads one page', async () => {
    const pending = api.companies({ search: 'Company', status: 'ACTIVE', page: 2, limit: 20 });
    const request = expectRead(companiesPath);
    expect(request.request.params.keys().sort()).toEqual(['limit', 'page', 'search', 'status']);
    expect(request.request.params.get('search')).toBe('Company');
    expect(request.request.params.get('status')).toBe('ACTIVE');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('limit')).toBe('20');
    const meta = { ...pageMeta(2), limit: 20 };
    request.flush({ success: true, data: [company], meta });
    await expect(pending).resolves.toEqual({ data: [company], meta });
  });

  it('allCompanies loops until hasNext is false', async () => {
    const pending = api.allCompanies({ search: 'Company', status: 'ACTIVE' });
    const rows = [1, 2, 3].map((page) => ({ ...company, id: `company-${page}` }));
    for (let page = 1; page <= 3; page++) {
      const request = await vi.waitFor(() => expectRead(companiesPath));
      expect(request.request.params.get('page')).toBe(String(page));
      expect(request.request.params.get('limit')).toBe('100');
      expect(request.request.params.get('search')).toBe('Company');
      expect(request.request.params.get('status')).toBe('ACTIVE');
      request.flush({ success: true, data: [rows[page - 1]], meta: pageMeta(page, page < 3) });
    }
    await expect(pending).resolves.toEqual(rows);
    requests.expectNone(companiesPath);
  });

  it('allCompanies stops a runaway loop', async () => {
    const result = expect(api.allCompanies()).rejects.toEqual(new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR'));
    for (let page = 1; page <= 50; page++) {
      const request = await vi.waitFor(() => expectRead(companiesPath));
      expect(request.request.params.get('page')).toBe(String(page));
      expect(request.request.params.get('limit')).toBe('100');
      request.flush({ success: true, data: Array.from({ length: 100 }, () => company), meta: pageMeta(page, true) });
    }
    await result;
    requests.expectNone((item) => item.url === companiesPath);
  });

  it('branches filters by company', async () => {
    const pending = api.branches({ companyId: company.id, search: 'Head', status: 'ACTIVE', page: 1, limit: 10 });
    const request = expectRead(branchesPath);
    expect(request.request.params.keys().sort()).toEqual(['companyId', 'limit', 'page', 'search', 'status']);
    expect(request.request.params.get('companyId')).toBe(company.id);
    expect(request.request.params.get('search')).toBe('Head');
    expect(request.request.params.get('status')).toBe('ACTIVE');
    expect(request.request.params.get('page')).toBe('1');
    expect(request.request.params.get('limit')).toBe('10');
    const meta = { ...pageMeta(), limit: 10 };
    request.flush({ success: true, data: [branch], meta });
    await expect(pending).resolves.toEqual({ data: [branch], meta });
  });

  it('allBranches rethrows the first error', async () => {
    const result = api.allBranches({ companyId: company.id, status: 'ACTIVE' }).catch((error: unknown) => error);
    expectRead(branchesPath).flush({ success: true, data: [branch], meta: pageMeta(1, true) });
    const request = await vi.waitFor(() => expectRead(branchesPath));
    expect(request.request.params.get('companyId')).toBe(company.id);
    expect(request.request.params.get('status')).toBe('ACTIVE');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('limit')).toBe('100');
    request.flush({ errorCode: 'ACCESS_POLICY_UNAVAILABLE', correlationId: 'lookup-failure' },
      { status: 503, statusText: 'Service Unavailable' });
    const error = await result;
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 503, code: 'ACCESS_POLICY_UNAVAILABLE', correlationId: 'lookup-failure' });
    requests.expectNone((item) => item.url === branchesPath);
  });

  it('users sends the search filters', async () => {
    const pending = api.users({ search: 'Test', branchId: branch.id, status: 'ACTIVE', limit: 20 });
    const request = expectRead(usersPath);
    expect(request.request.params.keys().sort()).toEqual(['branchId', 'limit', 'search', 'status']);
    expect(request.request.params.get('search')).toBe('Test');
    expect(request.request.params.get('branchId')).toBe(branch.id);
    expect(request.request.params.get('status')).toBe('ACTIVE');
    expect(request.request.params.get('limit')).toBe('20');
    const meta = { ...pageMeta(), limit: 20 };
    request.flush({ success: true, data: [user], meta });
    await expect(pending).resolves.toEqual({ data: [user], meta });
  });

  it('users passes a 403 to the caller', async () => {
    const result = api.users().catch((error: unknown) => error);
    expectRead(usersPath).flush({ errorCode: 'MISSING_REQUIRED_PERMISSIONS', correlationId: 'denied' },
      { status: 403, statusText: 'Forbidden' });
    const error = await result;
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 403, code: 'MISSING_REQUIRED_PERMISSIONS', correlationId: 'denied' });
  });

  it('user reads one user', async () => {
    const id = 'user/with ?#%';
    const pending = api.user(id);
    expectRead(`${usersPath}/${encodeURIComponent(id)}`).flush({ success: true, data: user });
    await expect(pending).resolves.toEqual(user);
    const failed = api.user('missing').catch((error: unknown) => error);
    expectRead(`${usersPath}/missing`).flush({ errorCode: 'TENANT_USER_NOT_FOUND' },
      { status: 404, statusText: 'Not Found' });
    const error = await failed;
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, code: 'TENANT_USER_NOT_FOUND' });
  });

  it('appsOverview returns the items', async () => {
    const items: WorkspaceApp[] = [{ moduleKey: 'crm', nameI18n: { en: 'CRM', ar: 'إدارة علاقات العملاء' },
      iconKey: null, group: 'SUBSCRIBED', isAddon: false, myAccessState: 'ACTIVE', seats: null },
    { moduleKey: 'trade', nameI18n: { en: 'Trade', ar: 'التجارة' }, iconKey: null,
      group: 'AVAILABLE', isAddon: false, myAccessState: null, seats: { used: 1, total: 2 } }];
    const pending = api.appsOverview();
    const request = expectRead(appsPath);
    expect(request.request.params.keys()).toEqual([]);
    request.flush({ success: true, data: { items } });
    await expect(pending).resolves.toEqual(items);
  });

  it('appsOverview rejects a malformed body', async () => {
    for (const data of [{ items: {} }, { items: null }, {}, null]) {
      const result = expect(api.appsOverview()).rejects.toEqual(new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR'));
      expectRead(appsPath).flush({ success: true, data });
      await result;
    }
  });

  it('rejects a malformed page', async () => {
    const valid = { success: true, data: [], meta: pageMeta() };
    const bodies = [
      { ...valid, data: {} }, { ...valid, meta: null },
      ...[-1, 0.5, Number.MAX_SAFE_INTEGER + 1].map((total) => ({ ...valid, meta: { ...valid.meta, total } })),
      ...[-1, 0.5, Number.MAX_SAFE_INTEGER + 1].map((totalPages) => ({ ...valid, meta: { ...valid.meta, totalPages } })),
      { ...valid, meta: { ...valid.meta, hasNext: 'false' } },
      { data: [], meta: valid.meta }, { success: true, meta: valid.meta },
    ];
    for (const body of bodies) {
      const result = expect(api.companies()).rejects.toEqual(new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR'));
      expectRead(companiesPath).flush(body);
      await result;
    }
  });

  it('passes a lost connection to the caller', async () => {
    const result = api.appsOverview().catch((error: unknown) => error);
    expectRead(appsPath).error(new ProgressEvent('error'));
    const error = await result;
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
    requests.expectNone(appsPath);
  });

  it('keeps concurrent reads separate when the scope changes', async () => {
    const first = api.companies();
    const duplicate = api.companies();
    const firstRequest = expectRead(companiesPath);
    selection.set({ companyId: 'company-2', branchId: null });
    const second = api.companies();
    const secondRequest = expectRead(companiesPath);
    me.update((current) => current && { ...current, permissions: ['users.user.read'],
      permissionScopes: { 'users.user.read': { tenantWide: true, companyIds: [], branchIds: [] } } });
    const third = api.companies();
    const thirdRequest = expectRead(companiesPath);
    firstRequest.flush({ success: true, data: [company], meta: pageMeta() });
    secondRequest.flush({ success: true, data: [], meta: pageMeta() });
    thirdRequest.flush({ success: true, data: [], meta: pageMeta() });
    expect((await first).data).toEqual([company]);
    expect((await duplicate).data).toEqual([company]);
    expect((await second).data).toEqual([]);
    expect((await third).data).toEqual([]);
  });

  it('accepts the last allowed page and caps the requested page size', async () => {
    const pending = api.companies({ limit: 101 });
    const request = expectRead(companiesPath);
    expect(request.request.params.get('limit')).toBe('100');
    request.flush({ success: true, data: [], meta: pageMeta() });
    await expect(pending).resolves.toMatchObject({ data: [] });

    const all = api.allBranches();
    for (let page = 1; page <= 50; page++) {
      const pageRequest = await vi.waitFor(() => expectRead(branchesPath));
      expect(pageRequest.request.params.get('page')).toBe(String(page));
      pageRequest.flush({ success: true, data: [branch], meta: pageMeta(page, page < 50) });
    }
    await expect(all).resolves.toHaveLength(50);
  });
});

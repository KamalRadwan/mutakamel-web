import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { QueryClient } from '@tanstack/angular-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrganizationReadApi } from './organization-read.api';
import { StaffSession } from './staff-session';
import { listAllPages } from './staff.api';
import type { Currency } from './staff.model';

const path = '/api/tenant/core/v1/organization';
const companyId = '019f0000-0000-7000-8000-000000000012';
const branchId = '019f0000-0000-7000-8000-000000000013';
const company = { id: companyId, code: 'C', name: 'Company', status: 'ACTIVE' };
const branch = { id: branchId, companyId, code: 'B', name: 'Branch', status: 'INACTIVE' };
const meta = { page: 2, limit: 20, total: 21, totalPages: 2, hasNext: false, hasPrev: true };
const listReads = [
  ['listCompanies', `${path}/companies`, 'org.company.read'],
  ['listBranches', `${path}/branches`, 'org.branch.read'],
  ['listDepartments', `${path}/departments`, 'org.department.read'],
  ['listTeams', `${path}/teams`, 'org.team.read'],
  ['listCurrencies', '/api/tenant/core/v1/currencies', 'currencies.currency.read'],
] as const;
const detailReads = [
  ['getCompany', 'companies', 'org.company.read'],
  ['getBranch', 'branches', 'org.branch.read'],
  ['getDepartment', 'departments', 'org.department.read'],
  ['getTeam', 'teams', 'org.team.read'],
] as const;

describe('OrganizationReadApi', () => {
  const can = vi.fn<(permission: string) => boolean>();
  const scopeRevision = vi.fn<() => string | null>();
  let api: OrganizationReadApi;
  let http: HttpTestingController;

  beforeEach(() => {
    can.mockReset().mockReturnValue(true);
    scopeRevision.mockReset().mockReturnValue('tenant-actor-access');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: StaffSession, useValue: { can, scopeRevision } },
      ],
    });
    api = TestBed.inject(OrganizationReadApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it.each(listReads)('reads %s as a credentialed Core page with the matching permission', async (method, url, permission) => {
    const query = { page: 2, limit: 20, status: 'ACTIVE' };
    const pending = api[method](query);
    const request = http.expectOne((req) => req.method === 'GET' && req.url === url);
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('limit')).toBe('20');
    expect(request.request.params.get('status')).toBe('ACTIVE');
    request.flush({ success: true, data: [], meta });
    await expect(pending).resolves.toEqual({ data: [], meta });
    expect(can).toHaveBeenCalledWith(permission);
  });

  it.each(detailReads)('reads %s without discarding backend fields or nullable values', async (method, resource, permission) => {
    const record = { id: companyId, legalName: null, leadUserId: null, deletedAt: null };
    const pending = api[method](companyId);
    const request = http.expectOne({ method: 'GET', url: `${path}/${resource}/${companyId}` });
    expect(request.request.withCredentials).toBe(true);
    request.flush({ success: true, data: record });
    await expect(pending).resolves.toEqual(record);
    expect(can).toHaveBeenCalledWith(permission);
  });

  it('passes the parent organization filters to department and team reads', async () => {
    const departmentId = '019f0000-0000-7000-8000-000000000014';
    const filters = { companyId, branchId, search: 'Support', sortBy: 'name', sortDir: 'DESC' } as const;
    const departments = api.listDepartments(filters);
    const teams = api.listTeams({ ...filters, departmentId });
    for (const resource of ['departments', 'teams']) {
      const request = http.expectOne((req) => req.url === `${path}/${resource}`);
      for (const [key, value] of Object.entries(filters)) {
        expect(request.request.params.get(key)).toBe(value);
      }
      expect(request.request.params.get('departmentId')).toBe(resource === 'teams' ? departmentId : null);
      request.flush({ success: true, data: [], meta });
    }
    await expect(departments).resolves.toEqual({ data: [], meta });
    await expect(teams).resolves.toEqual({ data: [], meta });
  });

  it('reuses the existing page accumulator for the complete currency lookup', async () => {
    const first: Currency = { code: 'EGP', name: 'Egyptian Pound', isDefault: true, status: 'ACTIVE' };
    const second: Currency = { code: 'USD', name: 'US Dollar', isDefault: false, status: 'ACTIVE' };
    const url = '/api/tenant/core/v1/currencies';
    const pending = listAllPages((query) => api.listCurrencies(query), { status: 'ACTIVE', limit: 1 });
    http.expectOne(`${url}?status=ACTIVE&limit=1&page=1`).flush({
      success: true, data: [first],
      meta: { page: 1, limit: 1, total: 2, totalPages: 2, hasNext: true, hasPrev: false },
    });
    await vi.waitFor(() => {
      const request = http.expectOne(`${url}?status=ACTIVE&limit=1&page=2`);
      request.flush({
        success: true, data: [second],
        meta: { page: 2, limit: 1, total: 2, totalPages: 2, hasNext: false, hasPrev: true },
      });
    });
    await expect(pending).resolves.toEqual([first, second]);
  });

  it.each(listReads)('blocks %s without its read permission', async (method, url) => {
    can.mockReturnValue(false);
    await expect(api[method]()).rejects.toMatchObject({ status: 403, code: 'COMMON.GENERIC.FORBIDDEN' });
    http.expectNone(url);
  });

  it('blocks every organization read before an authenticated scope is available', async () => {
    scopeRevision.mockReturnValue(null);
    for (const [method] of listReads) {
      await expect(api[method]()).rejects.toMatchObject({ status: 403 });
    }
    for (const [method] of detailReads) {
      await expect(api[method](companyId)).rejects.toMatchObject({ status: 403 });
    }
    await expect(api.getTree()).rejects.toMatchObject({ status: 403 });
    http.expectNone(() => true);
  });

  it.each([
    { ...meta, page: 0 }, { ...meta, page: 1.5 }, { ...meta, page: '2' },
    { ...meta, limit: 0 }, { ...meta, limit: Number.MAX_SAFE_INTEGER + 1 },
    { ...meta, total: -1 }, { ...meta, totalPages: -1 },
    { ...meta, hasNext: 'false' }, { ...meta, hasPrev: undefined },
  ])('rejects malformed page metadata: %j', async (invalidMeta) => {
    const pending = api.listCompanies();
    http.expectOne(`${path}/companies`).flush({ success: true, data: [], meta: invalidMeta });
    await expect(pending).rejects.toMatchObject({ status: 502, code: 'COMMON.GENERIC.INTERNAL_ERROR' });
  });

  it.each([
    { data: [], meta },
    { success: false, data: [], meta },
    { success: true, data: [] },
    { success: true, data: {}, meta },
    { success: true, data: [], meta: null },
  ])('rejects an invalid page envelope instead of substituting an empty result: %j', async (body) => {
    const pending = api.listCompanies();
    http.expectOne(`${path}/companies`).flush(body);
    await expect(pending).rejects.toMatchObject({ status: 502, code: 'COMMON.GENERIC.INTERNAL_ERROR' });
  });

  it.each([
    [401, 'COMMON.GENERIC.UNAUTHORIZED'],
    [403, 'COMMON.GENERIC.FORBIDDEN'],
    [404, 'COMMON.GENERIC.NOT_FOUND'],
    [422, 'COMMON.GENERIC.VALIDATION_FAILED'],
    [500, 'COMMON.GENERIC.INTERNAL_ERROR'],
  ] as const)('preserves Core error %s for the existing error and i18n handling', async (status, errorCode) => {
    const pending = api.getCompany(companyId);
    const details = { sortBy: ['Invalid sort field'] };
    http.expectOne(`${path}/companies/${companyId}`).flush(
      { success: false, errorCode, details, correlationId: 'organization-read-test' },
      { status, statusText: 'Failed' },
    );
    await expect(pending).rejects.toMatchObject({ status, code: errorCode, details, correlationId: 'organization-read-test' });
  });

  it('reads the company directory from Core and retains server pagination metadata', async () => {
    const pending = api.listCompanies({ page: 2, limit: 20, sortBy: 'name', sortDir: 'ASC' });
    const request = http.expectOne((req) => req.method === 'GET' && req.url === `${path}/companies`);
    expect(request.request.params.get('page')).toBe('2');
    request.flush({ success: true, data: [company], meta });
    await expect(pending).resolves.toEqual({ data: [company], meta });
    expect(can).toHaveBeenCalledWith('org.company.read');
  });

  it('sends the chosen real company ID with branch search and status filters', async () => {
    const pending = api.listBranches({ companyId, search: 'Branch', status: 'INACTIVE' });
    const request = http.expectOne((req) => req.method === 'GET' && req.url === `${path}/branches`);
    expect(request.request.params.get('companyId')).toBe(companyId);
    expect(request.request.params.get('search')).toBe('Branch');
    expect(request.request.params.get('status')).toBe('INACTIVE');
    request.flush({ success: true, data: [branch], meta });
    await expect(pending).resolves.toEqual({ data: [branch], meta });
    expect(can).toHaveBeenCalledWith('org.branch.read');
  });

  it('reads company and branch details through their scoped GET endpoints', async () => {
    const pendingCompany = api.getCompany(companyId);
    const pendingBranch = api.getBranch(branchId);
    http.expectOne({ method: 'GET', url: `${path}/companies/${companyId}` }).flush({ success: true, data: company });
    http.expectOne({ method: 'GET', url: `${path}/branches/${branchId}` }).flush({ success: true, data: branch });
    await expect(pendingCompany).resolves.toEqual(company);
    await expect(pendingBranch).resolves.toEqual(branch);
  });

  it('preserves an empty page separately from access denied by the server', async () => {
    const pendingEmpty = api.listCompanies();
    const empty = { data: [], meta: { ...meta, total: 0, page: 1, totalPages: 0, hasPrev: false } };
    http.expectOne(`${path}/companies`).flush({ success: true, ...empty });
    await expect(pendingEmpty).resolves.toEqual(empty);

    const pendingDenied = api.listBranches();
    http.expectOne(`${path}/branches`).flush(
      { code: 'GW.AUTH.FORBIDDEN' },
      { status: 403, statusText: 'Forbidden' },
    );
    await expect(pendingDenied).rejects.toMatchObject({ status: 403, code: 'GW.AUTH.FORBIDDEN' });
  });

  it('skips directory requests when the matching Staff read permission is absent', async () => {
    can.mockImplementation((permission) => permission === 'org.branch.read');
    await expect(api.listCompanies()).rejects.toMatchObject({ status: 403 });
    http.expectNone(`${path}/companies`);
  });

  it('reads the tree', async () => {
    for (const tree of [[{ ...company, children: [] }], []]) {
      const pending = api.getTree();
      const req = http.expectOne({ method: 'GET', url: `${path}/tree` });
      expect(req.request.params.keys()).toEqual([]);
      expect(req.request.body).toBeNull();
      req.flush({ success: true, data: tree });
      await expect(pending).resolves.toEqual(tree);
    }
  });

  it('rejects a tree that is not an array', async () => {
    const pending = api.getTree();
    http.expectOne(`${path}/tree`).flush({ success: true, data: {} });
    await expect(pending).rejects.toMatchObject({ status: 502, code: 'COMMON.GENERIC.INTERNAL_ERROR' });
  });

  it('skips the tree without company read', async () => {
    can.mockReturnValue(false);
    await expect(api.getTree()).rejects.toMatchObject({ status: 403, code: 'COMMON.GENERIC.FORBIDDEN' });
    http.expectNone(`${path}/tree`);
  });

  it('keeps the tree size details', async () => {
    const pending = api.getTree();
    const details = { nodeKind: ['teams'], limit: ['5000'] };
    http.expectOne(`${path}/tree`).flush({ success: false, errorCode: 'ORG_TREE_TOO_LARGE', details },
      { status: 422, statusText: 'Too large' });
    await expect(pending).rejects.toMatchObject({ status: 422, code: 'ORG_TREE_TOO_LARGE', details });
  });

  it.each([
    [403, 'MISSING_REQUIRED_PERMISSIONS'], [403, 'PERMISSION_SCOPE_UNAVAILABLE'],
    [422, 'PERMISSION_SCOPE_AUTHORITY_INCONSISTENT'],
  ])('keeps tree errors: %s %s', async (status, code) => {
    const pending = api.getTree();
    http.expectOne(`${path}/tree`).flush({ success: false, errorCode: code }, { status, statusText: 'Rejected' });
    await expect(pending).rejects.toMatchObject({ status, code });
  });

  it('the tree shares the scope key', async () => {
    const fetch = vi.spyOn(QueryClient.prototype, 'fetchQuery');
    const invalidate = vi.spyOn(QueryClient.prototype, 'invalidateQueries');
    try {
      const first = api.getTree();
      const second = api.getTree();
      http.expectOne(`${path}/tree`).flush({ success: true, data: [] });
      await expect(first).resolves.toEqual([]);
      await expect(second).resolves.toEqual([]);
      expect(fetch).toHaveBeenCalledWith(expect.objectContaining({
        queryKey: ['staff-organization', 'tenant-actor-access', 'tree'],
      }));
      await api.invalidateScope('tenant-actor-access');
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ['staff-organization', 'tenant-actor-access'], refetchType: 'none',
      });
      const refreshed = api.getTree();
      http.expectOne(`${path}/tree`).flush({ success: true, data: [] });
      await refreshed;
    } finally {
      fetch.mockRestore();
      invalidate.mockRestore();
    }
  });
});

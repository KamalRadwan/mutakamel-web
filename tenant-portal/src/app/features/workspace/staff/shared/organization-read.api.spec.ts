import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { QueryClient } from '@tanstack/angular-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrganizationReadApi } from './organization-read.api';
import { StaffSession } from './staff-session';

const path = '/api/tenant/core/v1/organization';
const companyId = '019f0000-0000-7000-8000-000000000012';
const branchId = '019f0000-0000-7000-8000-000000000013';
const company = { id: companyId, code: 'C', name: 'Company', status: 'ACTIVE' };
const branch = { id: branchId, companyId, code: 'B', name: 'Branch', status: 'INACTIVE' };
const meta = { page: 2, limit: 20, total: 21, totalPages: 2, hasNext: false, hasPrev: true };

describe('OrganizationReadApi', () => {
  const can = vi.fn<(permission: string) => boolean>();
  let api: OrganizationReadApi;
  let http: HttpTestingController;

  beforeEach(() => {
    can.mockReset().mockReturnValue(true);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: StaffSession, useValue: { can, scopeRevision: () => 'tenant-actor-access' } },
      ],
    });
    api = TestBed.inject(OrganizationReadApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

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

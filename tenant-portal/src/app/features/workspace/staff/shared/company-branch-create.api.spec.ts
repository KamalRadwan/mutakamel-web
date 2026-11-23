import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { AuthSession } from '../../../../core/auth/auth-session';
import { OrganizationWriteApi } from './organization-write.api';
import { OrganizationReadApi } from './organization-read.api';
import { StaffSession } from './staff-session';

const base = '/api/tenant/core/v1/organization';
const companyId = '019f0000-0000-7000-8000-000000000010';
const csrf = 'test-csrf-proof';
const version = { generation: 1, revision: 0 };

describe('Organization create HTTP contract', () => {
  let api: OrganizationWriteApi;
  let http: HttpTestingController;
  let cookie: string;
  const session = {
    scopeRevision: () => 'active-staff-scope',
    isTenantWide: vi.fn(),
    canCreateBranch: vi.fn(),
    can: vi.fn(),
  };
  const reloadProfile = vi.fn(async () => undefined);
  const invalidateScope = vi.fn(async () => undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    session.isTenantWide.mockReturnValue(true);
    session.canCreateBranch.mockReturnValue(true);
    session.can.mockReturnValue(false);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: StaffSession, useValue: session },
        { provide: AuthSession, useValue: { requestVersion: () => version, reloadProfile } },
        { provide: OrganizationReadApi, useValue: { invalidateScope } },
      ],
    });
    const doc = TestBed.inject(DOCUMENT);
    const name = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    cookie = `${name}=${csrf}`;
    vi.spyOn(doc, 'cookie', 'get').mockImplementation(() => cookie);
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(OrganizationWriteApi);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('posts Company with CSRF and a UUIDv7 key, then refreshes the original profile', async () => {
    const body = { code: 'EG', name: 'Test company', currencyCode: 'EGP' };
    const key = newIdempotencyKey();
    const pending = api.createCompany(body, key);
    const req = http.expectOne({ method: 'POST', url: base + '/companies' });
    const { request } = req;
    expect(request.body).toEqual(body);
    expect(request.withCredentials).toBe(true);
    expect(request.headers.get('x-csrf-token')).toBe(csrf);
    expect(request.headers.get('x-idempotency-key')).toBe(key);
    expect(key).toMatch(/^[a-f\d]{8}-[a-f\d]{4}-7[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i);
    const data = { ...body, id: companyId, status: 'ACTIVE' };
    req.flush({ success: true, data }, { status: 201, statusText: 'Created' });
    await expect(pending).resolves.toEqual(data);
    expect(session.isTenantWide).toHaveBeenCalledWith('org.company.manage');
    expect(invalidateScope).toHaveBeenCalledWith('active-staff-scope');
    expect(reloadProfile).toHaveBeenCalledWith(version);
  });

  it('allows ordinary branch creation under a permitted company and checks headquarters separately', async () => {
    const body = { companyId, code: 'HQ', name: 'Test branch', isHeadquarters: true };
    await expect(api.createBranch(body, newIdempotencyKey())).rejects.toMatchObject({ status: 403 });
    http.expectNone(base + '/branches');
    expect(session.canCreateBranch).toHaveBeenCalledWith(companyId);
    expect(session.can).toHaveBeenCalledWith('org.branch.manage', { companyId });

    const ordinary = { ...body, isHeadquarters: false };
    const key = newIdempotencyKey();
    const pending = api.createBranch(ordinary, key);
    const req = http.expectOne({ method: 'POST', url: base + '/branches' });
    expect(req.request.body).toEqual(ordinary);
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('x-csrf-token')).toBe(csrf);
    expect(req.request.headers.get('x-idempotency-key')).toBe(key);
    const data = { ...ordinary, id: '019f0000-0000-7000-8000-000000000011', status: 'ACTIVE' };
    req.flush({ success: true, data }, { status: 201, statusText: 'Created' });
    await expect(pending).resolves.toEqual(data);
  });

  it('sends neither a write without permission nor a write with no CSRF cookie', async () => {
    session.isTenantWide.mockReturnValue(false);
    await expect(api.createCompany({ code: 'A', name: 'A' }, newIdempotencyKey())).rejects.toMatchObject({ status: 403 });
    session.canCreateBranch.mockReturnValue(false);
    await expect(api.createBranch({ companyId, code: 'B', name: 'B' }, newIdempotencyKey())).rejects.toMatchObject({ status: 403 });
    session.isTenantWide.mockReturnValue(true);
    cookie = '';
    await expect(api.createCompany({ code: 'A', name: 'A' }, newIdempotencyKey())).rejects.toMatchObject({
      code: 'GW.AUTH.CSRF_INVALID',
    });
    http.expectNone((request) => request.method === 'POST');
  });
});

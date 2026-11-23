import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { QueryClient } from '@tanstack/angular-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { StaffSession } from '../shared/staff-session';
import { StaffUserAccessApi } from './user-access.api';

const base = '/api/tenant/core/v1/users/target';
const branch = [{ branchId: 'branch', roleId: 'role' }];
const scopes = [{ scopeTarget: 'TENANT' as const, roleId: 'role' }];
const memberships = [{ teamId: 'team', role: 'MEMBER' as const, isPrimary: true }];
const patch = { expectedRevision: 3, addBranchIds: ['branch'] };
const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('StaffUserAccessApi', () => {
  let api: StaffUserAccessApi;
  let http: HttpTestingController;
  let cookie: string;
  const session = { me: vi.fn(), isOwner: vi.fn(), scopeRevision: vi.fn() };
  const writes = [
    { name: 'setBranchRoles', method: 'PUT', path: '/assignments', body: { assignments: branch }, call: (key: string) => api.setBranchRoles('target', branch, key) },
    { name: 'removeBranchRole', method: 'DELETE', path: '/assignments/assignment', body: undefined, call: (key: string) => api.removeBranchRole('target', 'assignment', key) },
    { name: 'setScopeRoles', method: 'PUT', path: '/scope-role-assignments', body: { assignments: scopes }, call: (key: string) => api.setScopeRoles('target', scopes, key) },
    { name: 'setMemberships', method: 'PUT', path: '/team-memberships', body: { memberships }, call: (key: string) => api.setMemberships('target', memberships, key) },
    { name: 'addMembership', method: 'POST', path: '/team-memberships', body: memberships[0], call: (key: string) => api.addMembership('target', memberships[0], key) },
    { name: 'removeMembership', method: 'DELETE', path: '/team-memberships/membership', body: undefined, call: (key: string) => api.removeMembership('target', 'membership', key) },
    { name: 'patchReportingScopes', method: 'PATCH', path: '/team-memberships/membership/reporting-scopes', body: patch, call: (key: string) => api.patchReportingScopes('target', 'membership', patch, key) },
    { name: 'assignModule', method: 'POST', path: '/modules', body: { moduleKey: 'crm' }, call: (key: string) => api.assignModule('target', 'crm', key) },
    { name: 'unassignModule', method: 'DELETE', path: '/modules/crm', body: undefined, call: (key: string) => api.unassignModule('target', 'crm', key) },
  ];

  beforeEach(() => {
    session.me.mockReturnValue({ id: 'actor' });
    session.isOwner.mockReturnValue(true);
    session.scopeRevision.mockReturnValue('scope');
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(), { provide: StaffSession, useValue: session },
    ] });
    const doc = TestBed.inject(DOCUMENT);
    cookie = `${doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf'}=csrf-proof`;
    vi.spyOn(doc, 'cookie', 'get').mockImplementation(() => cookie);
    api = TestBed.inject(StaffUserAccessApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => { http.verify(); vi.restoreAllMocks(); });

  for (const write of writes) {
    it(`${write.name}: sends the exact contract, security headers and invalidates the target`, async () => {
      const cancel = vi.spyOn(QueryClient.prototype, 'cancelQueries');
      const invalidate = vi.spyOn(QueryClient.prototype, 'invalidateQueries');
      for (const status of [200, 201, 204]) {
        const key = newIdempotencyKey();
        const pending = write.call(key);
        const req = http.expectOne(base + write.path);
        expect(req.request.method).toBe(write.method);
        expect(req.request.body ?? undefined).toEqual(write.body);
        expect(req.request.withCredentials).toBe(true);
        expect(req.request.headers.get('x-idempotency-key')).toBe(key);
        expect(key).toMatch(uuidV7);
        expect(req.request.headers.get('x-csrf-token')).toBe('csrf-proof');
        expect(req.request.params.has('confirmAddonCascade')).toBe(false);
        req.flush(status === 204 ? null : { success: true, data: [] }, { status, statusText: 'OK' });
        await expect(pending).resolves.toEqual(status === 204 ? undefined : []);
        expect(cancel).toHaveBeenCalledWith({ queryKey: ['staff-user-access', 'scope', 'target'] });
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['staff-user-access', 'scope', 'target'], refetchType: 'none' });
      }
    });

    it(`${write.name}: missing CSRF sends no request`, async () => {
      cookie = '';
      await expect(write.call(newIdempotencyKey())).rejects.toMatchObject({ status: 403, code: 'GW.AUTH.CSRF_INVALID' });
      http.expectNone(() => true);
    });

    it(`${write.name}: rejects malformed 2xx and preserves service and gateway errors`, async () => {
      const malformed = write.call(newIdempotencyKey());
      http.expectOne(base + write.path).flush({ data: [] });
      await expect(malformed).rejects.toMatchObject({ code: 'COMMON.GENERIC.INTERNAL_ERROR' });
      for (const [status, code] of [[401, 'AUTH_AUTHORIZATION_STALE'], [409, 'GW.IDEM.IN_FLIGHT'], [422, 'GW.IDEM.MISMATCH'], [500, 'COMMON.GENERIC.INTERNAL_ERROR']] as const) {
        const pending = write.call(newIdempotencyKey());
        http.expectOne(base + write.path).flush({ code, correlationId: 'trace' }, { status, statusText: 'Rejected' });
        await expect(pending).rejects.toMatchObject({ status, code, correlationId: 'trace' });
      }
    });
  }

  it('unwraps every read including the plain modules array and assignment-options query', async () => {
    const reads = [
      { path: '/assignment-options?page=2&limit=20&search=role', call: () => api.listAssignmentOptions('target', { page: 2, limit: 20, search: 'role' }), data: { choices: [], labels: [], hasMore: false } },
      { path: '/assignments', call: () => api.listBranchRoles('target'), data: [] },
      { path: '/scope-role-assignments', call: () => api.listScopeRoles('target'), data: [] },
      { path: '/team-memberships', call: () => api.listMemberships('target'), data: [] },
      { path: '/team-memberships/member/reporting-scopes', call: () => api.getReportingScopes('target', 'member'), data: { membershipId: 'member', revision: 1, items: [], capabilities: { canManage: false } } },
      { path: '/modules', call: () => api.listModules('target'), data: [{ id: 'assignment', moduleKey: 'crm' }] },
    ];
    for (const read of reads) {
      const pending = read.call();
      const req = http.expectOne(base + read.path);
      expect(req.request.method).toBe('GET');
      expect(req.request.withCredentials).toBe(true);
      req.flush({ success: true, data: read.data });
      await expect(pending).resolves.toEqual(read.data);
    }
  });

  it('rejects malformed reads', async () => {
    for (const body of [{}, { success: true }, { success: false, data: [] }, { success: true, data: null }]) {
      const pending = api.listModules('target');
      http.expectOne(base + '/modules').flush(body);
      await expect(pending).rejects.toMatchObject({ code: 'COMMON.GENERIC.INTERNAL_ERROR' });
    }
  });

  it('only role writes accept the explicit cascade flag', async () => {
    for (const call of [
      (key: string) => api.setBranchRoles('target', branch, key, { confirmAddonCascade: true }),
      (key: string) => api.removeBranchRole('target', 'assignment', key, { confirmAddonCascade: true }),
      (key: string) => api.setScopeRoles('target', scopes, key, { confirmAddonCascade: true }),
    ]) {
      const pending = call(newIdempotencyKey());
      const req = http.expectOne((r) => r.params.get('confirmAddonCascade') === 'true');
      req.flush(null, { status: 204, statusText: 'No Content' });
      await pending;
    }
  });

  it('refuses every roles route for self without a request', () => {
    session.me.mockReturnValue({ id: 'target' });
    for (const call of [
      () => api.listAssignmentOptions('target'), () => api.listBranchRoles('target'), () => api.listScopeRoles('target'),
      () => api.setBranchRoles('target', [], newIdempotencyKey()), () => api.removeBranchRole('target', 'id', newIdempotencyKey()),
      () => api.setScopeRoles('target', [], newIdempotencyKey()),
    ]) expect(call).toThrowError('COMMON.GENERIC.FORBIDDEN');
    http.expectNone(() => true);
  });

  it('refuses scope-role reads and writes for non-owners without a request', () => {
    session.isOwner.mockReturnValue(false);
    expect(() => api.listScopeRoles('target')).toThrowError('COMMON.GENERIC.FORBIDDEN');
    expect(() => api.setScopeRoles('target', [], newIdempotencyKey())).toThrowError('COMMON.GENERIC.FORBIDDEN');
    http.expectNone(() => true);
  });

  it('strips membership metadata and encodes path identifiers', async () => {
    const pending = api.setMemberships('a/b', [{ ...memberships[0], id: 'internal', reportingScopeRevision: 7 } as typeof memberships[number]], newIdempotencyKey());
    const req = http.expectOne('/api/tenant/core/v1/users/a%2Fb/team-memberships');
    expect(req.request.body).toEqual({ memberships });
    req.flush({ success: true, data: [] });
    await pending;
  });
});

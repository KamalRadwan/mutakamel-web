import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { AuthSession } from '../../../../core/auth/auth-session';
import { OrganizationReadApi } from './organization-read.api';
import { OrganizationWriteApi } from './organization-write.api';
import { StaffSession } from './staff-session';

const base = '/api/tenant/core/v1/organization';
const id = '019f0000-0000-7000-8000-000000000010';
const version = { generation: 7 };

describe('OrganizationWriteApi', () => {
  let api: OrganizationWriteApi;
  let http: HttpTestingController;
  const session = {
    scopeRevision: vi.fn(), can: vi.fn(), isTenantWide: vi.fn(), canCreateBranch: vi.fn(),
  };
  const auth = { requestVersion: vi.fn(), reloadProfile: vi.fn() };
  const invalidateScope = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    session.scopeRevision.mockReturnValue('original-scope');
    session.can.mockReturnValue(true);
    session.isTenantWide.mockReturnValue(true);
    session.canCreateBranch.mockReturnValue(true);
    auth.requestVersion.mockReturnValue(version);
    auth.reloadProfile.mockResolvedValue(undefined);
    invalidateScope.mockResolvedValue(undefined);
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: StaffSession, useValue: session },
      { provide: AuthSession, useValue: auth },
      { provide: OrganizationReadApi, useValue: { invalidateScope } },
    ] });
    const doc = TestBed.inject(DOCUMENT);
    const name = doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    vi.spyOn(doc, 'cookie', 'get').mockReturnValue(`${name}=write-csrf`);
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(OrganizationWriteApi);
  });

  afterEach(() => { http.verify(); vi.restoreAllMocks(); });

  const kinds = [
    { kind: 'company', resource: 'companies', update: 'updateCompany', remove: 'deleteCompany' },
    { kind: 'branch', resource: 'branches', update: 'updateBranch', remove: 'deleteBranch' },
    { kind: 'department', resource: 'departments', update: 'updateDepartment', remove: 'deleteDepartment' },
    { kind: 'team', resource: 'teams', update: 'updateTeam', remove: 'deleteTeam' },
  ] as const;

  for (const { kind, resource, update, remove } of kinds) {
    it(`updates and deletes ${kind}`, async () => {
      const key = newIdempotencyKey();
      const patch = { name: 'Renamed' };
      const record = { id, ...patch, status: 'ACTIVE' };
      const pending = api[update](id, patch, key);
      const req = http.expectOne({ method: 'PATCH', url: `${base}/${resource}/${id}` });
      expect(auth.requestVersion).toHaveBeenCalledOnce();
      expect(invalidateScope).not.toHaveBeenCalled();
      expect(req.request.body).toEqual(patch);
      expect(req.request.withCredentials).toBe(true);
      expect(req.request.headers.get('x-csrf-token')).toBe('write-csrf');
      expect(req.request.headers.get('x-idempotency-key')).toBe(key);
      req.flush({ success: true, data: record });
      await expect(pending).resolves.toEqual(record);
      expect(invalidateScope).toHaveBeenCalledExactlyOnceWith('original-scope');
      expect(auth.reloadProfile).not.toHaveBeenCalled();

      invalidateScope.mockClear();
      const deleteKey = newIdempotencyKey();
      const deleted = api[remove](id, deleteKey);
      const deletion = http.expectOne({ method: 'DELETE', url: `${base}/${resource}/${id}` });
      expect(deletion.request.body).toBeNull();
      expect(deletion.request.withCredentials).toBe(true);
      expect(deletion.request.headers.get('x-csrf-token')).toBe('write-csrf');
      expect(deletion.request.headers.get('x-idempotency-key')).toBe(deleteKey);
      deletion.flush(null, { status: 204, statusText: 'No Content' });
      await expect(deleted).resolves.toBeUndefined();
      expect(invalidateScope).toHaveBeenCalledExactlyOnceWith('original-scope');
      if (kind === 'company' || kind === 'branch') expect(auth.reloadProfile).toHaveBeenCalledExactlyOnceWith(version);
      else expect(auth.reloadProfile).not.toHaveBeenCalled();
    });

    it(`a failed write changes no cache: ${kind}`, async () => {
      for (const method of ['update', 'delete'] as const) {
        const pending = method === 'update'
          ? api[update](id, { status: 'INACTIVE' }, newIdempotencyKey())
          : api[remove](id, newIdempotencyKey());
        const details = { blockers: ['team has memberships'] };
        http.expectOne(`${base}/${resource}/${id}`).flush({ success: false, errorCode: 'ORG_NODE_NOT_EMPTY', details },
          { status: 409, statusText: 'Conflict' });
        await expect(pending).rejects.toMatchObject({ status: 409, code: 'ORG_NODE_NOT_EMPTY', details });
        expect(invalidateScope).not.toHaveBeenCalled();
        expect(auth.reloadProfile).not.toHaveBeenCalled();
      }
    });

    it(`${kind} 401 keeps the key`, async () => {
      for (const method of ['update', 'delete'] as const) {
        const key = newIdempotencyKey();
        const body = { name: 'Keep this change' };
        for (let attempt = 0; attempt < 2; attempt++) {
          const pending = method === 'update' ? api[update](id, body, key) : api[remove](id, key);
          const requests = http.match(`${base}/${resource}/${id}`);
          expect(requests).toHaveLength(1);
          expect(requests[0].request.headers.get('x-idempotency-key')).toBe(key);
          expect(requests[0].request.body).toEqual(method === 'update' ? body : null);
          requests[0].flush({ type: 'about:blank', title: 'Revoked', status: 401, code: 'GW.AUTH.SESSION_REVOKED' },
            { status: 401, statusText: 'Unauthorized' });
          await expect(pending).rejects.toMatchObject({ status: 401, code: 'GW.AUTH.SESSION_REVOKED' });
          http.expectNone(`${base}/${resource}/${id}`);
        }
      }
      expect(invalidateScope).not.toHaveBeenCalled();
      expect(auth.reloadProfile).not.toHaveBeenCalled();
    });

    it(`rejects an empty scope before writing ${kind}`, async () => {
      session.scopeRevision.mockReturnValue('');
      await expect(api[update](id, {}, newIdempotencyKey())).rejects.toMatchObject({ status: 403 });
      await expect(api[remove](id, newIdempotencyKey())).rejects.toMatchObject({ status: 403 });
      http.expectNone(() => true);
    });
  }

  it('reloads /me only when scopes change', async () => {
    const updates = [
      () => api.updateCompany(id, { status: 'INACTIVE' }, newIdempotencyKey()),
      () => api.updateBranch(id, { status: 'INACTIVE' }, newIdempotencyKey()),
      () => api.updateBranch(id, { isHeadquarters: true }, newIdempotencyKey()),
    ];
    for (const update of updates) {
      session.scopeRevision.mockReturnValue('original-scope');
      auth.requestVersion.mockReturnValue(version);
      auth.reloadProfile.mockClear();
      invalidateScope.mockClear();
      const pending = update();
      session.scopeRevision.mockReturnValue('new-scope');
      auth.requestVersion.mockReturnValue({ generation: 8 });
      http.expectOne((req) => req.method === 'PATCH').flush({ success: true, data: { id } });
      await pending;
      expect(invalidateScope).toHaveBeenCalledExactlyOnceWith('original-scope');
      expect(auth.reloadProfile).toHaveBeenCalledExactlyOnceWith(version);
    }
  });

  it('forwards the cascade flag', async () => {
    for (const resource of ['company', 'branch'] as const) {
      const update = resource === 'company' ? 'updateCompany' : 'updateBranch';
      const remove = resource === 'company' ? 'deleteCompany' : 'deleteBranch';
      const route = resource === 'company' ? 'companies' : 'branches';
      for (const method of ['update', 'delete'] as const) {
        const key = newIdempotencyKey();
        const opts = { confirmAddonCascade: true };
        const pending = method === 'update' ? api[update](id, { status: 'INACTIVE' }, key, opts) : api[remove](id, key, opts);
        const req = http.expectOne(`${base}/${route}/${id}?confirmAddonCascade=true`);
        expect(req.request.headers.get('x-idempotency-key')).toBe(key);
        req.flush(method === 'delete' ? null : { success: true, data: { id } },
          { status: method === 'delete' ? 204 : 200, statusText: 'OK' });
        await pending;
      }
    }
  });

  it('company writes need tenant-wide manage', async () => {
    session.isTenantWide.mockReturnValue(false);
    for (const pending of [api.updateCompany(id, {}, newIdempotencyKey()), api.deleteCompany(id, newIdempotencyKey())]) {
      await expect(pending).rejects.toMatchObject({ status: 403, code: 'COMMON.GENERIC.FORBIDDEN' });
    }
    http.expectNone(() => true);
  });

  it('leaves record scope authorization to the server for other update and delete routes', async () => {
    session.can.mockReturnValue(false);
    session.canCreateBranch.mockReturnValue(false);
    session.isTenantWide.mockReturnValue(false);
    for (const { update, remove, resource } of kinds.slice(1)) {
      const pending = api[update](id, { name: 'Server checks scope' }, newIdempotencyKey());
      http.expectOne(`${base}/${resource}/${id}`).flush({ success: true, data: { id } });
      await pending;
      const deleted = api[remove](id, newIdempotencyKey());
      http.expectOne(`${base}/${resource}/${id}`).flush(null, { status: 204, statusText: 'No Content' });
      await deleted;
    }
    expect(session.can).not.toHaveBeenCalled();
    expect(session.isTenantWide).not.toHaveBeenCalled();
  });

  it('clears a team lead', async () => {
    const pending = api.updateTeam(id, { leadUserId: null }, newIdempotencyKey());
    const req = http.expectOne(`${base}/teams/${id}`);
    expect(req.request.body).toEqual({ leadUserId: null });
    req.flush({ success: true, data: { id, leadUserId: null } });
    await expect(pending).resolves.toMatchObject({ leadUserId: null });
  });

  it('createDepartment and createTeam invalidate the scope', async () => {
    const department = api.createDepartment({ branchId: id, code: 'D', name: 'Department' }, newIdempotencyKey());
    http.expectOne(`${base}/departments`).flush({ success: true, data: { id } }, { status: 201, statusText: 'Created' });
    await department;
    expect(invalidateScope).toHaveBeenCalledExactlyOnceWith('original-scope');
    invalidateScope.mockClear();
    const team = api.createTeam({ departmentId: id, code: 'T', name: 'Team' }, newIdempotencyKey(), id);
    http.expectOne(`${base}/teams`).flush({ success: true, data: { id } }, { status: 201, statusText: 'Created' });
    await team;
    expect(invalidateScope).toHaveBeenCalledExactlyOnceWith('original-scope');
    expect(auth.reloadProfile).not.toHaveBeenCalled();
  });
});

import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { StaffSession } from '../shared/staff-session';
import { RolesApi } from './roles.api';

const base = '/api/tenant/core/v1/roles';
const id = '019f0000-0000-7000-8000-000000000010';
const permissionId = '019f0000-0000-7000-8000-000000000011';
const role = { id, permissionIds: [permissionId] };
const branch = { roleId: id, revision: '1', catalogueRevision: 'c1', profiles: [], catalogue: [] };
const branchBody = {
  expectedRevision: '1',
  catalogueRevision: 'c1',
  profiles: [{ branchId: id, permissionIds: [permissionId] }],
};
const uuid7 = /^[a-f\d]{8}-[a-f\d]{4}-7[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;

describe('RolesApi real Core contract', () => {
  let api: RolesApi;
  let http: HttpTestingController;
  let csrf: string;
  const scope = signal<string | null>('scope-a');
  let allowed: boolean;

  beforeEach(() => {
    scope.set('scope-a');
    allowed = true;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: StaffSession,
          useValue: {
            scopeRevision: scope,
            can: () => allowed,
            isTenantWide: () => allowed,
            canReadBranchPermissions: () => allowed,
            canUpdateBranchPermissions: () => allowed,
          },
        },
      ],
    });
    const doc = TestBed.inject(DOCUMENT);
    csrf = `${doc.location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf'}=proof`;
    Object.defineProperty(doc, 'cookie', { configurable: true, get: () => csrf });
    api = TestBed.inject(RolesApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const writes = [
    {
      name: 'create',
      method: 'POST',
      path: base,
      body: { name: 'Copy', permissionIds: [permissionId] },
      run: (a: RolesApi, key: string) =>
        a.create({ name: 'Copy', permissionIds: [permissionId] }, key),
    },
    {
      name: 'update',
      method: 'PATCH',
      path: `${base}/${id}`,
      body: { description: null },
      run: (a: RolesApi, key: string) => a.update(id, { description: null }, key),
    },
    {
      name: 'global permissions',
      method: 'PUT',
      path: `${base}/${id}/permissions`,
      body: { permissionIds: [permissionId] },
      run: (a: RolesApi, key: string) => a.setPermissions(id, [permissionId], key),
    },
    {
      name: 'delete',
      method: 'DELETE',
      path: `${base}/${id}`,
      body: undefined,
      run: (a: RolesApi, key: string) => a.delete(id, key),
    },
    {
      name: 'branch permissions',
      method: 'PUT',
      path: `${base}/${id}/branch-permissions`,
      body: branchBody,
      run: (a: RolesApi, _key: string) => a.setBranchPermissions(id, branchBody),
    },
  ];

  for (const action of writes) {
    it(`sends the ${action.name} method, path, body, CSRF and gateway key policy`, async () => {
      const key = newIdempotencyKey();
      const pending = action.run(api, key);
      const req = http.expectOne({ method: action.method, url: action.path });
      expect(req.request.body ?? undefined).toEqual(action.body);
      expect(req.request.withCredentials).toBe(true);
      expect(req.request.headers.get('x-csrf-token')).toBe('proof');
      if (action.name === 'branch permissions')
        expect(req.request.headers.has('x-idempotency-key')).toBe(false);
      else expect(req.request.headers.get('x-idempotency-key')).toMatch(uuid7);
      expect(req.request.params.has('confirmAddonCascade')).toBe(false);
      const data = action.name === 'branch permissions' ? branch : role;
      req.flush(action.method === 'DELETE' ? null : { success: true, data }, {
        status: action.method === 'DELETE' ? 204 : action.method === 'POST' ? 201 : 200,
        statusText: 'OK',
      });
      expect(await pending).toEqual(action.method === 'DELETE' ? undefined : data);
    });

    it(`throws without a request when the CSRF cookie is missing on ${action.name}`, async () => {
      csrf = '';
      await expect(action.run(api, newIdempotencyKey())).rejects.toMatchObject({
        code: 'GW.AUTH.CSRF_INVALID',
      });
      http.expectNone(() => true);
    });

    it(`pre-checks ${action.name} authority without a request`, async () => {
      allowed = false;
      await expect(action.run(api, newIdempotencyKey())).rejects.toMatchObject({ status: 403 });
      http.expectNone(() => true);
    });

    it(`rejects a late ${action.name} answer after a scope change`, async () => {
      const pending = action.run(api, newIdempotencyKey());
      const req = http.expectOne(action.path);
      scope.set('scope-b');
      req.flush(
        action.method === 'DELETE'
          ? null
          : { success: true, data: action.name === 'branch permissions' ? branch : role },
        { status: action.method === 'DELETE' ? 204 : 200, statusText: 'OK' },
      );
      await expect(pending).rejects.toMatchObject({ status: 403 });
    });
  }

  it('sends confirmAddonCascade=true only on the confirmed call', async () => {
    for (const send of [
      () =>
        api.setPermissions(id, [permissionId], newIdempotencyKey(), { confirmAddonCascade: true }),
      () => api.delete(id, newIdempotencyKey(), { confirmAddonCascade: true }),
      () => api.setBranchPermissions(id, branchBody, { confirmAddonCascade: true }),
    ]) {
      const pending = send();
      const req = http.expectOne((r) => r.params.get('confirmAddonCascade') === 'true');
      req.flush(
        req.request.method === 'DELETE'
          ? null
          : { success: true, data: req.request.url.endsWith('branch-permissions') ? branch : role },
        { status: req.request.method === 'DELETE' ? 204 : 200, statusText: 'OK' },
      );
      await pending;
    }
  });

  it('passes list and catalogue query parameters and unwraps the paged envelope', async () => {
    for (const [pending, path] of [
      [
        api.list({
          page: 2,
          limit: 100,
          search: 'Inventory',
          isSystem: false,
          sortBy: 'createdAt',
          sortDir: 'DESC',
        }),
        base,
      ],
      [
        api.listPermissions({ page: 2, limit: 100, sortBy: 'group', sortDir: 'ASC' }),
        '/api/tenant/core/v1/permissions',
      ],
    ] as const) {
      const req = http.expectOne((r) => r.url === path);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('page')).toBe('2');
      expect(req.request.params.get('limit')).toBe('100');
      if (path === base) {
        expect(req.request.params.get('search')).toBe('Inventory');
        expect(req.request.params.get('isSystem')).toBe('false');
      }
      const meta = {
        page: 2,
        limit: 100,
        total: 101,
        totalPages: 2,
        hasNext: false,
        hasPrev: true,
      };
      req.flush({ success: true, data: [role], meta });
      expect(await pending).toEqual({ data: [role], meta });
    }
  });

  const reads = [
    { name: 'list', path: base, run: (a: RolesApi) => a.list({}) },
    { name: 'get', path: `${base}/${id}`, run: (a: RolesApi) => a.get(id) },
    {
      name: 'catalogue',
      path: '/api/tenant/core/v1/permissions',
      run: (a: RolesApi) => a.listPermissions(),
    },
    {
      name: 'branch',
      path: `${base}/${id}/branch-permissions`,
      run: (a: RolesApi) => a.getBranchPermissions(id),
    },
  ];
  for (const read of reads) {
    it(`rejects a malformed envelope on ${read.name}`, async () => {
      const pending = read.run(api);
      http.expectOne(read.path).flush({ success: true, data: {} });
      await expect(pending).rejects.toMatchObject({ code: 'COMMON.GENERIC.INTERNAL_ERROR' });
    });
    it(`pre-checks ${read.name} reads without a request`, async () => {
      allowed = false;
      await expect(read.run(api)).rejects.toMatchObject({ status: 403 });
      http.expectNone(() => true);
    });
    it(`rejects a late ${read.name} answer`, async () => {
      const pending = read.run(api);
      const req = http.expectOne(read.path);
      scope.set('scope-b');
      req.flush({ success: true, data: role });
      await expect(pending).rejects.toMatchObject({ status: 403 });
    });
  }

  it('converts gateway code/errors and service errorCode/details through the shared helper', async () => {
    for (const body of [
      { code: 'GW.IDEM.MISMATCH', errors: { _: ['reload'] }, correlationId: 'corr' },
      { errorCode: 'ROLE_NAME_TAKEN', details: { name: ['duplicate'] }, correlationId: 'corr' },
    ]) {
      const pending = api.update(id, { name: 'New' }, newIdempotencyKey());
      http.expectOne(`${base}/${id}`).flush(body, { status: 409, statusText: 'Conflict' });
      await expect(pending).rejects.toMatchObject({
        code: 'code' in body ? body.code : body.errorCode,
        correlationId: 'corr',
      });
    }
  });
});

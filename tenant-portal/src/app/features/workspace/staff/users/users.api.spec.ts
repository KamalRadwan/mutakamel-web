import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { ApiError } from '../../../../core/api/api-errors';
import { StaffSession } from '../shared/staff-session';
import { StaffUsersApi, type InviteUserBody } from './users.api';

const usersPath = '/api/tenant/core/v1/users';
const body: InviteUserBody = {
  email: 'invitee@example.invalid',
  firstName: 'Test',
  lastName: 'Invitee',
  companyId: '018f0000-0000-7000-8000-000000000001',
  branchId: '018f0000-0000-7000-8000-000000000002',
  departmentId: '018f0000-0000-7000-8000-000000000003',
};

describe('Workspace Users API', () => {
  const can = vi.fn();
  let api: StaffUsersApi;
  let requests: HttpTestingController;
  let csrfCookie: string;

  beforeEach(() => {
    csrfCookie = location.protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    document.cookie = `${csrfCookie}=staff-test-proof; path=/${location.protocol === 'https:' ? '; Secure' : ''}`;
    can.mockReset().mockReturnValue(true);
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: StaffSession, useValue: { scopeRevision: () => 'staff-scope', can,
        me: () => ({ permissions: can() ? ['users.user.invite'] : [] }) } },
    ] });
    api = TestBed.inject(StaffUsersApi);
    requests = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    requests.verify();
    document.cookie = `${csrfCookie}=; Max-Age=0; path=/${location.protocol === 'https:' ? '; Secure' : ''}`;
  });

  it('stages invitations with the closed STRICT body and write idempotency header', async () => {
    const key = newIdempotencyKey();
    const payload = { rows: [body], mode: 'STRICT' as const };
    const result = api.createImportBatch(payload, key);
    const request = requests.expectOne({ url: `${usersPath}/import-batches`, method: 'POST' });
    expect(request.request.body).toEqual(payload);
    expect(request.request.headers.get('x-idempotency-key')).toBe(key);
    expect(request.request.headers.get('x-csrf-token')).toBe('staff-test-proof');
    expect(request.request.withCredentials).toBe(true);
    const batch = { batchId: 'batch', total: 1, valid: 1, invalid: 0, expiresAt: '2026-11-24T12:00:00Z' };
    request.flush({ success: true, data: batch }, { status: 201, statusText: 'Created' });
    await expect(result).resolves.toEqual(batch);
  });

  it('lists staging rows through the Core page without a write header', async () => {
    const result = api.listImportBatchRows('batch/id', { page: 2, limit: 100, status: 'VALID' });
    const request = requests.expectOne((item) => item.url === `${usersPath}/import-batches/batch%2Fid/rows`);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('status')).toBe('VALID');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('limit')).toBe('100');
    expect(request.request.headers.has('x-idempotency-key')).toBe(false);
    const row = { id: 'row', rowNo: 1, status: 'VALID', data: body, errors: {}, resultCode: null };
    const meta = { page: 2, limit: 100, total: 101, totalPages: 2, hasNext: false, hasPrev: true };
    request.flush({ success: true, data: [row], meta });
    await expect(result).resolves.toEqual({ data: [row], meta });
  });

  it('surfaces staging expiry 410 as ApiError', async () => {
    const result = expect(api.listImportBatchRows('expired')).rejects.toEqual(new ApiError(410, 'IMPORT_BATCH_EXPIRED'));
    requests.expectOne(`${usersPath}/import-batches/expired/rows`).flush(
      { errorCode: 'IMPORT_BATCH_EXPIRED' }, { status: 410, statusText: 'Gone' },
    );
    await result;
  });

  it('requires invite authority for both staging calls', async () => {
    can.mockReturnValue(false);
    await expect(api.createImportBatch({ rows: [body], mode: 'STRICT' }, newIdempotencyKey())).rejects.toMatchObject({ status: 403 });
    await expect(api.listImportBatchRows('batch')).rejects.toMatchObject({ status: 403 });
    requests.expectNone((request) => request.url.includes('import-batches'));
  });

  it('uses the scoped Core read and its pagination envelope', async () => {
    const result = api.listUsers({ page: 2, limit: 20, branchId: body.branchId, status: 'INVITED' });
    const request = requests.expectOne((item) => item.url === usersPath && item.method === 'GET');
    expect(request.request.params.get('branchId')).toBe(body.branchId);
    expect(request.request.params.get('status')).toBe('INVITED');
    expect(request.request.withCredentials).toBe(true);
    expect(can).toHaveBeenCalledWith('users.user.read', expect.objectContaining({ branchId: body.branchId }));

    const meta = { page: 2, limit: 20, total: 20, totalPages: 1, hasNext: false, hasPrev: true };
    request.flush({ success: true, data: [], meta });
    await expect(result).resolves.toEqual({ data: [], meta });
  });

  it.each([undefined, null, {}])('normalizes missing or non-array seats on both user reads: %s', async (seats) => {
    const row = { ...body, id: 'legacy-user', status: 'ACTIVE', ...(seats === undefined ? {} : { seats }) };
    const normalized = { ...row, seats: [] };
    const meta = { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false };
    const list = api.listUsers();
    requests.expectOne(usersPath).flush({ success: true, data: [row], meta });
    await expect(list).resolves.toEqual({ data: [normalized], meta });

    const detail = api.getUser(row.id);
    requests.expectOne(`${usersPath}/${row.id}`).flush({ success: true, data: row });
    await expect(detail).resolves.toEqual(normalized);
    expect(api['targets'].get(`staff-scope:${row.id}`)).toEqual(normalized);
  });

  it('preserves populated seat arrays on both user reads', async () => {
    const row = { ...body, id: 'seated-user', seats: [{ moduleKey: 'crm', accessState: 'ACTIVE' }] };
    const meta = { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false };
    const list = api.listUsers();
    requests.expectOne(usersPath).flush({ success: true, data: [row], meta });
    await expect(list).resolves.toEqual({ data: [row], meta });
    const detail = api.getUser(row.id);
    requests.expectOne(`${usersPath}/${row.id}`).flush({ success: true, data: row });
    await expect(detail).resolves.toEqual(row);
  });

  it.each([null, {}, { mode: 1, revision: 1, modules: [] },
    { mode: 'DERIVED', revision: '1', modules: [] }, { mode: 'DERIVED', revision: 1, modules: {} },
  ])('rejects malformed seat usage 200 responses: %s', async (data) => {
    const result = expect(api.getSeatUsage()).rejects.toEqual(new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR'));
    requests.expectOne('/api/tenant/core/v1/seats/usage').flush({ success: true, data });
    await result;
  });

  it('preserves a seat usage 404 as an ApiError', async () => {
    const result = expect(api.getSeatUsage()).rejects.toEqual(new ApiError(404, 'COMMON.GENERIC.NOT_FOUND'));
    requests.expectOne('/api/tenant/core/v1/seats/usage').flush(
      { errorCode: 'COMMON.GENERIC.NOT_FOUND' }, { status: 404, statusText: 'Not Found' },
    );
    await result;
  });

  it('normalizes remembered users returned by writes', async () => {
    const pending = api.inviteUser(body, newIdempotencyKey());
    const saved = { ...body, id: 'legacy-invite', status: 'INVITED' };
    requests.expectOne({ url: usersPath, method: 'POST' }).flush({ success: true, data: saved });
    await pending;
    expect(api['targets'].get('staff-scope:legacy-invite')).toEqual({ ...saved, seats: [] });
  });

  it('sends one credentialed, idempotent invite and returns the persisted INVITED user', async () => {
    const key = newIdempotencyKey();
    const pending = api.inviteUser(body, key);
    const request = requests.expectOne({ url: usersPath, method: 'POST' });
    expect(request.request.body).toEqual(body);
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.get('x-csrf-token')).toBe('staff-test-proof');
    expect(request.request.headers.get('x-idempotency-key')).toBe(key);
    expect(can).toHaveBeenCalledWith('users.user.invite', body);

    const saved = { ...body, id: '018f0000-0000-7000-8000-000000000004', status: 'INVITED' };
    request.flush({ success: true, data: saved }, { status: 201, statusText: 'Created' });
    await expect(pending).resolves.toEqual(saved);
  });

  it('does not post when the branch is outside the invitation grant', async () => {
    can.mockReturnValue(false);
    await expect(api.inviteUser(body, newIdempotencyKey())).rejects.toMatchObject({ status: 403 });
    requests.expectNone(usersPath);
  });

  it('does not post without the tenant CSRF proof', async () => {
    document.cookie = `${csrfCookie}=; Max-Age=0; path=/${location.protocol === 'https:' ? '; Secure' : ''}`;
    await expect(api.inviteUser(body, newIdempotencyKey())).rejects.toMatchObject({
      status: 403, code: 'GW.AUTH.CSRF_INVALID',
    });
    requests.expectNone(usersPath);
  });

  it('preserves the Core conflict and only retries when requested with the same key', async () => {
    const key = newIdempotencyKey();
    const first = expect(api.inviteUser(body, key)).rejects.toMatchObject({
      status: 409, code: 'TENANT_EMAIL_TAKEN',
    });
    requests.expectOne({ url: usersPath, method: 'POST' }).flush(
      { errorCode: 'TENANT_EMAIL_TAKEN' },
      { status: 409, statusText: 'Conflict' },
    );
    await first;
    requests.expectNone(usersPath);

    const retried = api.inviteUser(body, key);
    const request = requests.expectOne({ url: usersPath, method: 'POST' });
    expect(request.request.headers.get('x-idempotency-key')).toBe(key);
    const saved = { ...body, id: '018f0000-0000-7000-8000-000000000004', status: 'INVITED' };
    request.flush({ success: true, data: saved }, { status: 201, statusText: 'Created' });
    await expect(retried).resolves.toEqual(saved);
  });
  const user = { ...body, id: '018f0000-0000-7000-8000-000000000004', status: 'ACTIVE' };
  const writes = [
    { name: 'update', method: 'PATCH', suffix: '', status: 200, permission: 'users.user.update',
      call: (key: string, cascade = false) => api.updateUser(user.id, { firstName: 'Changed' }, key) },
    { name: 'suspend', method: 'POST', suffix: '/suspend', status: 201, permission: 'users.user.deactivate',
      call: (key: string, cascade = false) => api.suspendUser(user.id, key, { confirmAddonCascade: cascade }) },
    { name: 'activate', method: 'POST', suffix: '/activate', status: 201, permission: 'users.user.deactivate',
      call: (key: string, cascade = false) => api.activateUser(user.id, key, { confirmAddonCascade: cascade }) },
    { name: 'revoke', method: 'POST', suffix: '/sessions/revoke', status: 200, permission: 'users.user.deactivate',
      call: (key: string, cascade = false) => api.revokeSessions(user.id, key) },
    { name: 'delete', method: 'DELETE', suffix: '', status: 204, permission: 'users.user.delete',
      call: (key: string, cascade = false) => api.deleteUser(user.id, key, { confirmAddonCascade: cascade }) },
    { name: 'resend', method: 'POST', suffix: '/resend-invite', status: 200, permission: 'users.user.invite',
      call: (key: string, cascade = false) => api.resendInvite(user.id, key) },
  ];

  async function loadTarget() {
    const pending = api.getUser(user.id);
    requests.expectOne(`${usersPath}/${user.id}`).flush({ success: true, data: user });
    await pending;
  }

  for (const write of writes) {
    it(`${write.name}: sends the method, URL, UUID v7, CSRF proof and unwraps success`, async () => {
      await loadTarget();
      const cancel = vi.spyOn(api['queries'], 'cancelQueries');
      const invalidate = vi.spyOn(api['queries'], 'invalidateQueries');
      const key = newIdempotencyKey();
      const pending = write.call(key);
      await Promise.resolve();
      const request = requests.expectOne({ method: write.method, url: `${usersPath}/${user.id}${write.suffix}` });
      expect(request.request.headers.get('x-idempotency-key')).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
      expect(request.request.headers.get('x-idempotency-key')).toBe(key);
      expect(request.request.headers.get('x-csrf-token')).toBe('staff-test-proof');
      expect(request.request.withCredentials).toBe(true);
      expect(request.request.params.has('confirmAddonCascade')).toBe(false);
      expect(request.request.body).toEqual(write.name === 'update' ? { firstName: 'Changed' } : null);
      const data = write.name === 'resend' ? { deliveryStatus: 'QUEUED' } : { ...user, status: 'INVITED' };
      request.flush(write.status === 204 ? null : { success: true, data }, { status: write.status, statusText: 'OK' });
      await expect(pending).resolves.toEqual(write.status === 204 ? undefined : data);
      expect(can).toHaveBeenCalledWith(write.permission, expect.objectContaining({ companyId: user.companyId, branchId: user.branchId }));
      expect(cancel).toHaveBeenCalledWith({ queryKey: ['staff-users', 'staff-scope'] });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['staff-users', 'staff-scope'], refetchType: 'none' });
    });

    it(`${write.name}: missing CSRF throws without a write`, async () => {
      await loadTarget();
      document.cookie = `${csrfCookie}=; Max-Age=0; path=/${location.protocol === 'https:' ? '; Secure' : ''}`;
      await expect(write.call(newIdempotencyKey())).rejects.toMatchObject({ code: 'GW.AUTH.CSRF_INVALID' });
      requests.expectNone((request) => request.method !== 'GET');
    });

    it(`${write.name}: a missing target-branch grant skips the write`, async () => {
      await loadTarget();
      can.mockImplementation((permission: string) => permission === 'users.user.read');
      await expect(write.call(newIdempotencyKey())).rejects.toMatchObject({ status: 403 });
      requests.expectNone((request) => request.method !== 'GET');
    });

    it(`${write.name}: preserves gateway error and correlation id`, async () => {
      await loadTarget();
      const rejected = expect(write.call(newIdempotencyKey())).rejects.toMatchObject({ code: 'GW.IDEM.MISMATCH', correlationId: 'proof' });
      await Promise.resolve();
      requests.expectOne((request) => request.method === write.method).flush(
        { code: 'GW.IDEM.MISMATCH', errors: { _: ['changed'] }, correlationId: 'proof' }, { status: 422, statusText: 'Unprocessable' });
      await rejected;
    });

    it(`${write.name}: rejects a malformed 2xx envelope`, async () => {
      await loadTarget();
      const rejected = expect(write.call(newIdempotencyKey())).rejects.toMatchObject({ code: 'COMMON.GENERIC.INTERNAL_ERROR' });
      await Promise.resolve();
      requests.expectOne((request) => request.method === write.method).flush({ data: user }, { status: write.status === 204 ? 200 : write.status, statusText: 'OK' });
      await rejected;
    });

    if (['suspend', 'activate', 'delete'].includes(write.name)) it(`${write.name}: adds the cascade flag only on confirmation`, async () => {
      await loadTarget();
      const pending = write.call(newIdempotencyKey(), true);
      await Promise.resolve();
      const request = requests.expectOne(`${usersPath}/${user.id}${write.suffix}?confirmAddonCascade=true`);
      request.flush(write.status === 204 ? null : { success: true, data: user }, { status: write.status, statusText: 'OK' });
      await pending;
    });
  }

  it('checks both the old and new branch before an update', async () => {
    await loadTarget();
    can.mockImplementation((_permission: string, target?: { branchId?: string }) => target?.branchId !== 'new-branch');
    await expect(api.updateUser(user.id, { branchId: 'new-branch' }, newIdempotencyKey())).rejects.toMatchObject({ status: 403 });
    requests.expectNone((request) => request.method === 'PATCH');
  });

});

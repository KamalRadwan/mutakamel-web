import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
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
      { provide: StaffSession, useValue: { scopeRevision: () => 'staff-scope', can } },
    ] });
    api = TestBed.inject(StaffUsersApi);
    requests = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    requests.verify();
    document.cookie = `${csrfCookie}=; Max-Age=0; path=/${location.protocol === 'https:' ? '; Secure' : ''}`;
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
});

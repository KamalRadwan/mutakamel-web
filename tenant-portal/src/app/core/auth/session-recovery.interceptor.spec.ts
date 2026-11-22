import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Notify } from '../notify/notify';
import { TabLeader } from '../tabs/tab-leader';
import { AuthSession } from './auth-session';
import { FAKE_TENANT_ME } from './auth-session.fake';
import { sessionRecoveryInterceptor } from './session-recovery.interceptor';

describe('session recovery on protected Tenant requests', () => {
  const auth = '/api/tenant/core/v1/auth';
  const records = '/api/tenant/crm/v1/leads';
  let http: HttpClient;
  let requests: HttpTestingController;
  let session: AuthSession;
  const notify = { info: vi.fn() };

  beforeEach(async () => {
    notify.info.mockClear();
    TestBed.configureTestingModule({ providers: [
      provideRouter([]), provideHttpClient(withInterceptors([sessionRecoveryInterceptor])), provideHttpClientTesting(),
      { provide: TabLeader, useValue: { isLeader: signal(false) } },
      { provide: Notify, useValue: notify },
      { provide: TranslocoService, useValue: { translate: (key: string) => key } },
    ] });
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    http = TestBed.inject(HttpClient);
    requests = TestBed.inject(HttpTestingController);
    session = TestBed.inject(AuthSession);
    const bootstrap = session.ensureLoaded();
    requests.expectOne(auth + '/me').flush({ success: true, data: { ...FAKE_TENANT_ME, isTenantOwner: false } });
    await bootstrap;
  });

  afterEach(() => { requests.verify(); });

  it.each(['COMMON.AUTH.TOKEN_EXPIRED', 'AUTH_AUTHORIZATION_STALE'])('coalesces %s reads, refreshes RBAC, and retries each read once', async code => {
    const reads = [1, 2, 3].map(id => firstValueFrom(http.get(records + '/' + id)));
    const originals = requests.match(req => req.url.startsWith(records));
    expect(originals).toHaveLength(3);
    const expired = { status: 401, statusText: 'Unauthorized' };
    originals[0].flush({ code }, expired);
    originals[1].flush({ code }, expired);
    const refresh = requests.expectOne({ method: 'POST', url: auth + '/refresh' });
    refresh.flush({ success: true, data: { expiresIn: 900 } });
    await vi.waitFor(() => {
      requests.expectOne({ method: 'GET', url: auth + '/me' }).flush({
        success: true, data: { ...FAKE_TENANT_ME, isTenantOwner: false, permissions: [] },
      });
    });
    await vi.waitFor(() => expect(session.hasPermission('crm.leads.read')).toBe(false));
    // A delayed failure from the old access generation must join the completed renewal.
    originals[2].flush({ code }, expired);
    for (const id of [1, 2, 3]) {
      await vi.waitFor(() => requests.expectOne({ method: 'GET', url: records + '/' + id }).flush({ id }));
    }
    expect(await Promise.all(reads)).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(session.status()).toBe('signed-in');
    expect(notify.info).not.toHaveBeenCalled();
  });

  it('never resubmits a write after an authentication failure', async () => {
    const write = firstValueFrom(http.post(records, { name: 'sample' }));
    const rejected = expect(write).rejects.toMatchObject({ status: 401 });
    requests.expectOne({ method: 'POST', url: records }).flush({ code: 'AUTH_AUTHORIZATION_STALE' }, { status: 401, statusText: 'Unauthorized' });
    requests.expectOne(auth + '/refresh').flush({ success: true, data: { expiresIn: 120 } });
    await vi.waitFor(() => requests.expectOne(auth + '/me').flush({ success: true, data: FAKE_TENANT_ME }));
    await rejected;
    requests.expectNone(records);
  });

  it.each([
    [401, 'CURRENT_PASSWORD_INVALID'],
    [403, 'COMMON.GENERIC.FORBIDDEN'],
  ])('returns functional error %s %s without entering session recovery', async (status, code) => {
    const response = firstValueFrom(http.get(records));
    const rejected = expect(response).rejects.toMatchObject({ status });
    requests.expectOne(records).flush({ code }, { status, statusText: 'Denied' });

    await rejected;
    requests.expectNone(req => req.url.startsWith(auth));
    expect(session.status()).toBe('signed-in');
  });

  it('leaves the public tenant readiness request outside the recovery flow', async () => {
    const branding = '/api/tenant/core/v1/branding/public';
    const rejected = expect(firstValueFrom(http.get(branding))).rejects.toMatchObject({ status: 401 });
    requests.expectOne(branding).flush({ code: 'COMMON.AUTH.TOKEN_EXPIRED' }, { status: 401, statusText: 'Unauthorized' });

    await rejected;
    requests.expectNone(req => req.url.startsWith(auth));
    expect(session.status()).toBe('signed-in');
  });

  it('recognizes issued login cookies while keeping MFA challenges and auth failures out of recovery', async () => {
    const pendingLogout = 'mutakamel-tenant-logout-pending';
    localStorage.setItem(pendingLogout, '1');
    try {
      const login = () => firstValueFrom(http.post(auth + '/login', {}));
      const failed = expect(login()).rejects.toMatchObject({ status: 401 });
      requests.expectOne(auth + '/login').flush({ code: 'INVALID_CREDENTIALS' }, { status: 401, statusText: 'Unauthorized' });
      await failed;

      const challenge = login();
      requests.expectOne(auth + '/login').flush({ success: true, data: { mfaRequired: true } });
      await challenge;
      expect(localStorage.getItem(pendingLogout)).toBe('1');

      const verified = firstValueFrom(http.post(auth + '/mfa/verify', {}));
      requests.expectOne(auth + '/mfa/verify').flush({ success: true, data: { tokenType: 'Bearer', session: {} } });
      await verified;
      expect(localStorage.getItem(pendingLogout)).toBeNull();
      requests.expectNone(auth + '/refresh');
      requests.expectNone(auth + '/logout');
    } finally {
      localStorage.removeItem(pendingLogout);
    }
  });

  it('returns a second expiry without replaying the same read again', async () => {
    const read = firstValueFrom(http.get(records));
    const rejected = expect(read).rejects.toMatchObject({ status: 401 });
    const error = { errorCode: 'COMMON.AUTH.TOKEN_EXPIRED' };
    const status = { status: 401, statusText: 'Unauthorized' };
    requests.expectOne(records).flush(error, status);
    requests.expectOne(auth + '/refresh').flush({ success: true, data: { expiresIn: 120 } });
    await vi.waitFor(() => requests.expectOne(auth + '/me').flush({ success: true, data: FAKE_TENANT_ME }));
    await vi.waitFor(() => requests.expectOne(records).flush(error, status));
    await rejected;
    requests.expectNone(auth + '/refresh');
    requests.expectNone(records);
  });

  it.each([
    ['COMMON.GENERIC.FORBIDDEN', 'signed-in'],
    ['MISSING_REQUIRED_PERMISSIONS', 'signed-in'],
    ['SESSION_IDENTITY_INACTIVE', 'signed-out'],
  ])('handles 403 %s without replay', async (code, status) => {
    const denied = firstValueFrom(http.get(records));
    requests.expectOne(records).flush({ code }, { status: 403, statusText: 'Forbidden' });
    await expect(denied).rejects.toMatchObject({ status: 403 });
    expect(session.status()).toBe(status);
    requests.expectNone(auth + '/refresh');
  });
});

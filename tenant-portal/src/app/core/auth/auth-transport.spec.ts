import { DOCUMENT } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { login } from '../../features/auth/login/login.api';
import { resendCode, verifyCode } from '../../features/auth/verify/verify.api';
import { acceptLanguageInterceptor } from '../api/accept-language.interceptor';
import { AuthSessionApi } from './auth-session.api';
import { AuthTransport, authTransport } from './auth-transport';

describe('Tenant auth HTTP contract', () => {
  const base = '/api/tenant/core/v1/auth';
  const credentials = { email: 'user@example.test', password: 'test-only-password' };
  const challenge = { mfaRequired: true, challengeId: 'a'.repeat(43), expiresIn: 300, resendAfterSeconds: 60 };
  let http: HttpTestingController;
  let transport: AuthTransport;
  let api: AuthSessionApi;
  let cookie: string;
  let protocol: string;
  let lang: string;

  beforeEach(() => {
    cookie = '';
    lang = 'en';
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([acceptLanguageInterceptor])),
        provideHttpClientTesting(),
        { provide: TranslocoService, useValue: { getActiveLang: () => lang } },
      ],
    });
    const doc = TestBed.inject(DOCUMENT);
    vi.spyOn(doc, 'cookie', 'get').mockImplementation(() => cookie);
    http = TestBed.inject(HttpTestingController);
    transport = TestBed.inject(AuthTransport);
    api = TestBed.inject(AuthSessionApi);
    protocol = doc.location.protocol;
  });

  afterEach(() => { http.verify(); vi.restoreAllMocks(); });

  it('resolves the startup channel in form callbacks and releases it with its injector', () => {
    expect(authTransport()).toBe(transport);
    expect(TestBed.runInInjectionContext(authTransport)).toBe(transport);
    TestBed.resetTestingModule();
    expect(authTransport).toThrow();
  });

  it.each(['forgot-password', 'reset-password'] as const)('sends a body to %s and requires a 204 response', async route => {
    const body = route === 'forgot-password' ? { email: 'user@example.test' } : { token: 'action-token', newPassword: 'password' };
    const result = transport.requestNoContent(route, body);
    const req = http.expectOne({ method: 'POST', url: base + '/' + route });
    expect(req.request.body).toEqual(body);
    expect(req.request.withCredentials).toBe(true);
    req.flush({ success: true, data: {} });
    await expect(result).rejects.toMatchObject({ status: 200 });
    http.expectNone(base + '/' + route);
  });

  it.each([null, { success: true }, { mfaRequired: true }, { success: false, data: challenge }])(
    'rejects malformed invitation success envelopes without replay: %j', async body => {
      const result = transport.requestData('accept-invite', { token: 'action-token', newPassword: 'password' });
      http.expectOne(base + '/accept-invite').flush(body, { status: 200, statusText: 'OK' });
      await expect(result).rejects.toMatchObject({ status: 200 });
      http.expectNone(base + '/accept-invite');
    },
  );

  it.each([true, false])('submits login once with remember=%s and unwraps the MFA step', async remember => {
    lang = remember ? 'ar' : 'en';
    const result = login(credentials, remember, transport);
    const req = http.expectOne({ method: 'POST', url: base + '/login' });
    const request = req.request;
    expect(request.withCredentials).toBe(true);
    expect(request.body).toEqual(credentials);
    expect(request.headers.get('x-auth-remember')).toBe(remember ? '1' : null);
    expect(request.headers.get('Accept-Language')).toBe(lang);
    expect(request.headers.has('x-csrf-token')).toBe(false);
    expect(request.headers.has('Authorization')).toBe(false);
    expect(request.headers.has('x-idempotency-key')).toBe(false);
    req.flush({ success: true, data: challenge });
    await expect(result).resolves.toEqual(challenge);
  });

  it('keeps MFA failure details and does not replay a verify or resend request', async () => {
    const verify = verifyCode(challenge.challengeId, '123456', transport);
    const rejected = http.expectOne({ method: 'POST', url: base + '/mfa/verify' });
    expect(rejected.request.body).toEqual({ challengeId: challenge.challengeId, code: '123456' });
    expect(rejected.request.withCredentials).toBe(true);
    expect(rejected.request.headers.has('x-auth-remember')).toBe(false);
    rejected.flush({ errorCode: 'AUTH_MFA_INVALID_CHALLENGE', correlationId: 'review-id' }, { status: 401, statusText: 'Unauthorized' });
    await expect(verify).rejects.toMatchObject({ status: 401, code: 'AUTH_MFA_INVALID_CHALLENGE', correlationId: 'review-id' });

    const resend = resendCode(challenge.challengeId, transport);
    const limited = http.expectOne({ method: 'POST', url: base + '/mfa/resend' });
    expect(limited.request.body).toEqual({ challengeId: challenge.challengeId });
    expect(limited.request.headers.has('x-idempotency-key')).toBe(false);
    limited.flush({ code: 'GW.RATE.LIMIT_EXCEEDED' }, {
      status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '17', 'x-correlation-id': 'gw-review' },
    });
    await expect(resend).rejects.toMatchObject({ code: 'GW.RATE.LIMIT_EXCEEDED', correlationId: 'gw-review', details: { retryAfterSeconds: ['17'] } });
  });

  it('reads the current realm CSRF cookie for each mutation and omits it from /me', async () => {
    const name = protocol === 'https:' ? '__Host-mutakamel-tenant-csrf' : 'mutakamel-http-tenant-csrf';
    cookie = 'unrelated-csrf=ignore';
    expect(api.hasCsrfCookie()).toBe(false);
    const me = api.getMe();
    const bootstrap = http.expectOne({ method: 'GET', url: base + '/me' });
    expect(bootstrap.request.headers.has('x-csrf-token')).toBe(false);
    bootstrap.flush({ success: true, data: { permissions: ['crm.leads.read'] } });
    await expect(me).resolves.toEqual({ permissions: ['crm.leads.read'] });

    for (const route of ['refresh', 'activity', 'logout'] as const) {
      cookie = 'unrelated-csrf=ignore; ' + name + '=' + route;
      expect(api.hasCsrfCookie()).toBe(true);
      const response = route === 'refresh' ? api.refreshSession() : route === 'activity' ? api.recordActivity() : api.logout();
      const mutation = http.expectOne({ method: 'POST', url: base + '/' + route });
      expect(mutation.request.withCredentials).toBe(true);
      expect(mutation.request.headers.get('x-csrf-token')).toBe(route);
      expect(mutation.request.headers.has('x-idempotency-key')).toBe(false);
      expect(mutation.request.body).toBeNull();
      if (route === 'refresh') mutation.flush({ success: true, data: { expiresIn: 120 } });
      else mutation.flush(null, { status: 204, statusText: 'No Content' });
      await response;
    }
  });
});

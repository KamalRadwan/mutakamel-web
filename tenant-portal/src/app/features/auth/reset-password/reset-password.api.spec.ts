import { DOCUMENT } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { acceptLanguageInterceptor } from '../../../core/api/accept-language.interceptor';
import { ApiError } from '../../../core/api/api-errors';
import { AuthSession } from '../../../core/auth/auth-session';
import { AuthTransport } from '../../../core/auth/auth-transport';
import { sessionRecoveryInterceptor } from '../../../core/auth/session-recovery.interceptor';
import { requestResetLink, resetPassword } from './reset-password.api';
import { resetErrorKey, resetErrorKind } from './reset-password.model';

describe('Password recovery API', () => {
  const base = '/api/tenant/core/v1/auth/';
  const token = 'reset-token-for-http-test';
  const newPassword = 'Strong#Pass2026!';
  let http: HttpTestingController;
  const recoverRequest = vi.fn();

  function send(route: 'forgot-password' | 'reset-password'): Promise<void> {
    return route === 'forgot-password' ? requestResetLink('user@example.test') : resetPassword(token, newPassword);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([acceptLanguageInterceptor, sessionRecoveryInterceptor])),
      provideHttpClientTesting(),
      { provide: TranslocoService, useValue: { getActiveLang: () => 'en' } },
      { provide: AuthSession, useValue: { recoverRequest } },
    ] });
    const document = TestBed.inject(DOCUMENT);
    vi.spyOn(document, 'cookie', 'get').mockReturnValue('');
    TestBed.inject(AuthTransport);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => { http.verify(); vi.restoreAllMocks(); });

  it.each(['known@example.test', 'unknown@example.test'])('keeps reset-link confirmation enumeration-safe for %s', async email => {
    const result = requestResetLink(email);
    const req = http.expectOne({ method: 'POST', url: base + 'forgot-password' });
    expect(req.request.body).toEqual({ email });
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('Accept-Language')).toBe('en');
    for (const header of ['Authorization', 'x-csrf-token', 'x-auth-remember', 'x-idempotency-key']) {
      expect(req.request.headers.has(header)).toBe(false);
    }
    req.flush(null, { status: 204, statusText: 'No Content' });
    await expect(result).resolves.toBeUndefined();
  });

  it('submits the exact reset body once even when a stale session CSRF cookie exists', async () => {
    vi.spyOn(TestBed.inject(DOCUMENT), 'cookie', 'get').mockReturnValue(
      '__Host-mutakamel-tenant-csrf=stale; mutakamel-http-tenant-csrf=stale',
    );
    const result = resetPassword(token, newPassword);
    const req = http.expectOne({ method: 'POST', url: base + 'reset-password' });
    expect(req.request.body).toEqual({ token, newPassword });
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('Accept-Language')).toBe('en');
    for (const header of ['Authorization', 'x-csrf-token', 'x-auth-remember', 'x-idempotency-key']) {
      expect(req.request.headers.has(header)).toBe(false);
    }
    req.flush(null, { status: 204, statusText: 'No Content' });
    await expect(result).resolves.toBeUndefined();
    http.expectNone(base + 'reset-password');
  });

  for (const route of ['forgot-password', 'reset-password'] as const) {
    describe(route, () => {
      it.each([
        [404, 'TENANT_NOT_RESOLVABLE', 'notice', 'auth.shared.errors.TENANT_NOT_RESOLVABLE'],
        [429, 'COMMON.GENERIC.RATE_LIMITED', 'throttle', 'auth.shared.throttle'],
        [429, 'GW.RATE.LIMIT_EXCEEDED', 'throttle', 'auth.shared.throttle'],
        [503, 'PLATFORM_MAINTENANCE', 'notice', 'auth.shared.errors.PLATFORM_MAINTENANCE'],
        [403, 'AUTH_WEB_ORIGIN_NOT_ALLOWED', 'notice', 'auth.shared.errors.generic'],
        [403, 'AUTH_CROSS_SITE_REQUEST_REJECTED', 'notice', 'auth.shared.errors.generic'],
        [403, 'AUTH_GATEWAY_TRUST_REQUIRED', 'notice', 'auth.shared.errors.generic'],
        [403, 'AUTH_NATIVE_NOT_ENABLED', 'notice', 'auth.shared.errors.generic'],
        [401, 'UNAUTHORIZED', 'notice', 'auth.shared.errors.generic'],
      ] as const)('preserves %s %s without session refresh or replay', async (status, code, kind, key) => {
        const result = send(route);
        const failure = result.catch((error: unknown) => error);
        const req = http.expectOne(base + route);
        const body = code.startsWith('GW.') ? { code } : { errorCode: code };
        req.flush(body, { status, statusText: 'Rejected', headers: { 'Retry-After': '13', 'x-correlation-id': 'reset-review' } });
        const error = await failure;
        expect(error).toBeInstanceOf(ApiError);
        expect(error).toMatchObject({ status, code, correlationId: 'reset-review' });
        expect(resetErrorKind(error)).toBe(kind);
        expect(resetErrorKey(error)).toBe(key);
        if (status === 429) expect(error).toMatchObject({ details: { retryAfterSeconds: ['13'] } });
        expect(recoverRequest).not.toHaveBeenCalled();
        http.expectNone(base + route);
      });

      it('uses the existing unavailable message for an uncoded 503', async () => {
        const result = send(route);
        const failure = result.catch((error: unknown) => error);
        http.expectOne(base + route).flush({}, { status: 503, statusText: 'Unavailable' });
        expect(resetErrorKey(await failure)).toBe('auth.shared.errors.unavailable');
        http.expectNone(base + route);
      });

      it('reports network failure without replay', async () => {
        const result = send(route);
        const failure = result.catch((error: unknown) => error);
        http.expectOne(base + route).error(new ProgressEvent('error'));
        const error = await failure;
        expect(error).toMatchObject({ status: 0 });
        expect(resetErrorKey(error)).toBe('auth.shared.errors.network');
        http.expectNone(base + route);
      });
    });
  }

  it.each([
    [400, 'INVALID_ACTION_TOKEN', 'invalid-link', 'authReset.invalid.text'],
    [422, 'WEAK_PASSWORD', 'field-password', 'auth.shared.errors.WEAK_PASSWORD'],
    [422, 'PASSWORD_TOO_LONG', 'field-password', 'auth.shared.errors.PASSWORD_TOO_LONG'],
  ] as const)('preserves reset-token and password errors: %s %s', async (status, code, kind, key) => {
    const result = resetPassword(token, newPassword);
    const failure = result.catch((error: unknown) => error);
    http.expectOne(base + 'reset-password').flush({ errorCode: code }, { status, statusText: 'Rejected' });
    const error = await failure;
    expect(error).toMatchObject({ status, code });
    expect(resetErrorKind(error)).toBe(kind);
    expect(resetErrorKey(error)).toBe(key);
    http.expectNone(base + 'reset-password');
  });

  it.each([
    ['forgot-password', { email: ['is_email'] }, 'field-email', 'authReset.errors.email'],
    ['reset-password', { token: ['min_length'] }, 'invalid-link', 'authReset.invalid.text'],
    ['reset-password', { newPassword: ['min_length'] }, 'field-password', 'auth.shared.errors.WEAK_PASSWORD'],
    ['reset-password', { newPassword: ['max_length'] }, 'field-password', 'auth.shared.errors.PASSWORD_TOO_LONG'],
  ] as const)('preserves %s validation details: %j', async (route, details, kind, key) => {
    const result = send(route);
    const failure = result.catch((error: unknown) => error);
    http.expectOne(base + route).flush({ errorCode: 'CORE_VALIDATION_FAILED', details }, {
      status: 400, statusText: 'Bad Request',
    });
    const error = await failure;
    expect(error).toMatchObject({ code: 'CORE_VALIDATION_FAILED', details });
    expect(resetErrorKind(error)).toBe(kind);
    expect(resetErrorKey(error)).toBe(key);
  });
});

import { DOCUMENT } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { acceptLanguageInterceptor } from '../../../core/api/accept-language.interceptor';
import { ApiError } from '../../../core/api/api-errors';
import { AuthSession } from '../../../core/auth/auth-session';
import { isMfaStep, type LoginSession } from '../../../core/auth/auth-session.model';
import { AuthTransport } from '../../../core/auth/auth-transport';
import { sessionRecoveryInterceptor } from '../../../core/auth/session-recovery.interceptor';
import { acceptInvitation } from './invitation.api';
import { inviteErrorKey, inviteErrorKind } from './invitation.model';

describe('Invitation API', () => {
  const url = '/api/tenant/core/v1/auth/accept-invite';
  const token = 'invitation-token-for-http-test';
  const newPassword = 'Strong#Pass2026!';
  const step = { mfaRequired: true, challengeId: 'a'.repeat(43), expiresIn: 300, resendAfterSeconds: 60 };
  const session: LoginSession = {
    tokenType: 'Bearer', expiresIn: 120, sessionExpiresIn: 3600,
    session: {
      id: 'session-id', clientId: 'client-id', clientType: 'WEB',
      createdAt: '2026-11-23T00:00:00Z', lastRefreshAt: null, lastUserActivityAt: null,
      idleExpiresAt: '2026-11-23T01:00:00Z', absoluteExpiresAt: '2026-11-24T00:00:00Z',
      refreshUseCount: '0', accessIssueCount: '1', credentialVersion: 1, authorizationVersion: 1, profileVersion: 1,
    },
  };
  let http: HttpTestingController;
  const completeSignInRequest = vi.fn((request: () => Promise<unknown>) => request());
  const recoverRequest = vi.fn();

  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([acceptLanguageInterceptor, sessionRecoveryInterceptor])),
      provideHttpClientTesting(),
      { provide: TranslocoService, useValue: { getActiveLang: () => 'ar' } },
      { provide: AuthSession, useValue: { completeSignInRequest, recoverRequest } },
    ] });
    const document = TestBed.inject(DOCUMENT);
    vi.spyOn(document, 'cookie', 'get').mockReturnValue(
      '__Host-mutakamel-tenant-csrf=stale; mutakamel-http-tenant-csrf=stale',
    );
    TestBed.inject(AuthTransport);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => { http.verify(); vi.restoreAllMocks(); TestBed.resetTestingModule(); });

  it.each([session, step])('returns the real cookie session or MFA step unchanged', async data => {
    // Deliberately outside runInInjectionContext, like the existing page submit callback.
    const result = acceptInvitation(token, newPassword);
    const req = http.expectOne({ method: 'POST', url });
    expect(req.request.body).toEqual({ token, newPassword });
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('Accept-Language')).toBe('ar');
    for (const header of ['Authorization', 'x-csrf-token', 'x-auth-remember', 'x-idempotency-key']) {
      expect(req.request.headers.has(header)).toBe(false);
    }
    req.flush({ success: true, data });
    const response = await result;
    expect(response).toEqual(data);
    expect(isMfaStep(response)).toBe('mfaRequired' in data);
    expect(completeSignInRequest).toHaveBeenCalledOnce();
    expect(recoverRequest).not.toHaveBeenCalled();
  });

  it.each([
    [400, 'INVALID_ACTION_TOKEN', 'invalid', 'authInvite.invalid.text'],
    [422, 'WEAK_PASSWORD', 'field-password', 'auth.shared.errors.WEAK_PASSWORD'],
    [422, 'PASSWORD_TOO_LONG', 'field-password', 'auth.shared.errors.PASSWORD_TOO_LONG'],
    [403, 'SUBSCRIPTION_PAST_DUE', 'notice', 'auth.shared.errors.SUBSCRIPTION_PAST_DUE'],
    [409, 'AUTH_SESSION_LIMIT_REACHED', 'notice', 'authInvite.errors.sessionLimit'],
    [429, 'AUTH_MFA_THROTTLED', 'throttle', 'auth.shared.throttle'],
    [429, 'COMMON.GENERIC.RATE_LIMITED', 'throttle', 'auth.shared.throttle'],
    [429, 'GW.RATE.LIMIT_EXCEEDED', 'throttle', 'auth.shared.throttle'],
    [404, 'TENANT_NOT_RESOLVABLE', 'notice', 'auth.shared.errors.TENANT_NOT_RESOLVABLE'],
    [503, 'PLATFORM_MAINTENANCE', 'notice', 'auth.shared.errors.PLATFORM_MAINTENANCE'],
    [503, 'AUTH_MFA_UNAVAILABLE', 'notice', 'authInvite.errors.AUTH_MFA_UNAVAILABLE'],
    [403, 'AUTH_WEB_ORIGIN_NOT_ALLOWED', 'notice', 'auth.shared.errors.generic'],
    [403, 'AUTH_CROSS_SITE_REQUEST_REJECTED', 'notice', 'auth.shared.errors.generic'],
    [403, 'AUTH_GATEWAY_TRUST_REQUIRED', 'notice', 'auth.shared.errors.generic'],
    [403, 'AUTH_NATIVE_NOT_ENABLED', 'notice', 'auth.shared.errors.generic'],
  ] as const)('preserves %s %s for existing error handling without replay', async (status, code, kind, key) => {
    const result = acceptInvitation(token, newPassword);
    const failure = result.catch((error: unknown) => error);
    const req = http.expectOne(url);
    const body = code.startsWith('GW.') ? { code } : { errorCode: code };
    req.flush(body, { status, statusText: 'Rejected', headers: { 'x-correlation-id': 'invite-review', 'Retry-After': '17' } });
    const error = await failure;
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status, code, correlationId: 'invite-review' });
    expect(inviteErrorKind(error)).toBe(kind);
    expect(inviteErrorKey(error)).toBe(key);
    if (status === 429) expect(error).toMatchObject({ details: { retryAfterSeconds: ['17'] } });
    expect(recoverRequest).not.toHaveBeenCalled();
    http.expectNone(url);
  });

  it.each([
    [{ token: ['min_length'] }, 'invalid', 'authInvite.invalid.text'],
    [{ newPassword: ['max_length'] }, 'field-password', 'auth.shared.errors.PASSWORD_TOO_LONG'],
    [{ newPassword: ['min_length'] }, 'field-password', 'auth.validation.server'],
  ] as const)('preserves field-validation details: %j', async (details, kind, key) => {
    const result = acceptInvitation(token, newPassword);
    const failure = result.catch((error: unknown) => error);
    http.expectOne(url).flush({ errorCode: 'CORE_VALIDATION_FAILED', details, correlationId: 'validation-review' }, {
      status: 400, statusText: 'Bad Request',
    });
    const error = await failure;
    expect(error).toMatchObject({ code: 'CORE_VALIDATION_FAILED', details, correlationId: 'validation-review' });
    expect(inviteErrorKind(error)).toBe(kind);
    expect(inviteErrorKey(error)).toBe(key);
  });

  it('keeps an ambiguous network failure visible and never resubmits the token', async () => {
    const result = acceptInvitation(token, newPassword);
    const failure = result.catch((error: unknown) => error);
    http.expectOne(url).error(new ProgressEvent('error'));
    const error = await failure;
    expect(error).toMatchObject({ status: 0 });
    expect(inviteErrorKey(error)).toBe('authInvite.errors.ambiguous');
    http.expectNone(url);
  });
});

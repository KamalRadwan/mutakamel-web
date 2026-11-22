import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/api-errors';
import { REFRESHABLE_CODES, SESSION_ENDED_CODES, isCsrfRejection, isRefreshable, isSessionEnded, refreshFailureKind } from './session-errors';

describe('session-errors allow-lists', () => {
  it('keeps 401 AUTH_MFA_INVALID_CHALLENGE and 401 INVALID_CREDENTIALS on screen', () => {
    for (const code of ['AUTH_MFA_INVALID_CHALLENGE', 'INVALID_CREDENTIALS', 'CURRENT_PASSWORD_INVALID']) {
      const err = new ApiError(401, code);
      expect(isRefreshable(err), code).toBe(false);
      expect(isSessionEnded(err), code).toBe(false);
    }
  });

  it('marks 401 COMMON.AUTH.TOKEN_EXPIRED as refreshable and not session-ended', () => {
    const err = new ApiError(401, 'COMMON.AUTH.TOKEN_EXPIRED');
    expect(REFRESHABLE_CODES.has('COMMON.AUTH.TOKEN_EXPIRED')).toBe(true);
    expect(isRefreshable(err)).toBe(true);
    expect(isSessionEnded(err)).toBe(false);
  });

  it('requires status 401 for isRefreshable', () => {
    expect(isRefreshable(new ApiError(403, 'COMMON.AUTH.TOKEN_EXPIRED'))).toBe(false);
    expect(isRefreshable(new Error('COMMON.AUTH.TOKEN_EXPIRED'))).toBe(false);
  });

  it.each(['COMMON.AUTH.INVALID_ACCESS_TOKEN', 'COMMON.AUTH.MISSING_BEARER_TOKEN', 'GW.AUTH.MISSING_SESSION'])(
    'refreshes %s with CSRF proof',
    (code) => {
      expect(isRefreshable(new ApiError(401, code), true)).toBe(true);
      expect(isRefreshable(new ApiError(401, code), false)).toBe(false);
      expect(isRefreshable(new ApiError(403, code), true)).toBe(false);
    },
  );

  it('renews stale authorization on 401 and leaves an ordinary permission denial on screen', () => {
    const stale = new ApiError(401, 'AUTH_AUTHORIZATION_STALE');
    expect(isRefreshable(stale)).toBe(true);
    expect(isSessionEnded(stale)).toBe(false);

    const forbidden = new ApiError(403, 'COMMON.GENERIC.FORBIDDEN');
    expect(isRefreshable(forbidden)).toBe(false);
    expect(isSessionEnded(forbidden)).toBe(false);
  });

  it.each([...SESSION_ENDED_CODES])('treats terminal code %s on 401 or 403 as session-ended', (code) => {
    expect(isSessionEnded(new ApiError(401, code))).toBe(true);
    expect(isSessionEnded(new ApiError(403, code))).toBe(true);
    expect(isRefreshable(new ApiError(401, code))).toBe(false);
  });

  it('ignores terminal codes on non-401/403 status or non-ApiError values', () => {
    expect(isSessionEnded(new ApiError(500, 'AUTH_SESSION_ENDED'))).toBe(false);
    expect(isSessionEnded(new Error('AUTH_SESSION_ENDED'))).toBe(false);
    expect(isSessionEnded(null)).toBe(false);
  });
});

describe('refresh failure classification', () => {
  const terminalCodes = [
    'INVALID_REFRESH_TOKEN', 'AUTH_SESSION_ENDED', 'AUTH_SESSION_IDLE_EXPIRED',
    'AUTH_SESSION_ABSOLUTE_EXPIRED', 'AUTH_SECURITY_STALE', 'AUTH_SESSION_STALE',
    'SESSION_IDENTITY_INACTIVE',
  ];
  const csrfCodes = ['AUTH_CSRF_INVALID', 'GW.AUTH.CSRF_INVALID', 'GW.AUTH.FORBIDDEN'];

  it.each(terminalCodes)('ends refresh for terminal %s on 401 and 403 only', code => {
    for (const status of [401, 403]) {
      expect(refreshFailureKind(new ApiError(status, code))).toBe('ended');
    }
    expect(refreshFailureKind(new ApiError(500, code))).toBe('transient');
  });

  it.each(['COMMON.GENERIC.UNAUTHORIZED', 'GW.AUTH.SESSION_REVOKED', 'UNKNOWN_CODE'])(
    'ends refresh for any other 401, including %s', code => {
      expect(refreshFailureKind(new ApiError(401, code))).toBe('ended');
    },
  );

  it.each(csrfCodes)('recognizes only 403 %s as a CSRF rejection and ends refresh', code => {
    expect(isCsrfRejection(new ApiError(403, code))).toBe(true);
    expect(refreshFailureKind(new ApiError(403, code))).toBe('ended');
    for (const status of [0, 401, 429, 500]) {
      expect(isCsrfRejection(new ApiError(status, code))).toBe(false);
    }
  });

  it('ends refresh for a past-due subscription only on 401 or 403', () => {
    expect(refreshFailureKind(new ApiError(403, 'SUBSCRIPTION_PAST_DUE'))).toBe('ended');
    expect(refreshFailureKind(new ApiError(503, 'SUBSCRIPTION_PAST_DUE'))).toBe('transient');
    expect(isCsrfRejection(new ApiError(403, 'SUBSCRIPTION_PAST_DUE'))).toBe(false);
  });

  it.each([
    [0, 'NETWORK_ERROR'], [408, 'REQUEST_TIMEOUT'], [429, 'GW.RATE.LIMIT_EXCEEDED'],
    [500, 'COMMON.GENERIC.INTERNAL_ERROR'], [502, 'GW.UPSTREAM.BAD_GATEWAY'],
    [503, 'GW.AUTH.SESSION_CHECK_UNAVAILABLE'], [503, 'GW.AUTH.VERIFICATION_UNAVAILABLE'],
    [503, 'TENANT_INACTIVE'], [503, 'TENANT_MAINTENANCE_ACTIVE'],
    [503, 'PLATFORM_MAINTENANCE'], [504, 'GW.UPSTREAM.TIMEOUT'], [599, 'UNKNOWN_CODE'],
    [403, 'TENANT_MAINTENANCE_ACTIVE'], [403, 'TENANT_MAINTENANCE_RELEASE_REQUIRED'],
    [403, 'GW.AUTH.WEB_ORIGIN_NOT_ALLOWED'], [403, 'GW.AUTH.CROSS_SITE_REQUEST_REJECTED'],
    [404, 'TENANT_NOT_RESOLVABLE'], [403, 'UNKNOWN_CODE'],
  ])('keeps refresh transient for %s %s', (status, code) => {
    const error = new ApiError(status, code);
    expect(refreshFailureKind(error)).toBe('transient');
    expect(isCsrfRejection(error)).toBe(false);
  });

  it.each([new Error('offline'), null, undefined, 'AUTH_CSRF_INVALID', { status: 403, code: 'AUTH_CSRF_INVALID' }])(
    'keeps a non-ApiError transient: %s', error => {
      expect(refreshFailureKind(error)).toBe('transient');
      expect(isCsrfRejection(error)).toBe(false);
    },
  );
});

import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/api-errors';
import { REFRESHABLE_CODES, SESSION_ENDED_CODES, isRefreshable, isSessionEnded } from './session-errors';

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

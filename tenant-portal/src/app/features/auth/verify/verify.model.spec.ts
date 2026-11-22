import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../core/api/api-errors';
import { VERIFY_ERROR_KEYS, formatCountdown, verifyErrorKey } from './verify.model';

describe('verify.model', () => {
  it('maps every documented error code in VERIFY_ERROR_KEYS to its key and kind', () => {
    const cases: Array<[number, string, ReturnType<typeof verifyErrorKey>]> = [
      [401, 'AUTH_MFA_INVALID_CHALLENGE', { key: 'authVerify.errors.AUTH_MFA_INVALID_CHALLENGE', kind: 'field' }],
      [429, 'AUTH_MFA_THROTTLED', { key: 'auth.shared.throttle', kind: 'throttle', tone: 'warning' }],
      [429, 'COMMON.GENERIC.RATE_LIMITED', { key: 'auth.shared.throttle', kind: 'throttle', tone: 'warning' }],
      [429, 'GW.RATE.LIMIT_EXCEEDED', { key: 'auth.shared.throttle', kind: 'throttle', tone: 'warning' }],
      [503, 'AUTH_MFA_UNAVAILABLE', { key: 'authVerify.errors.AUTH_MFA_UNAVAILABLE', kind: 'notice', tone: 'danger' }],
      [503, 'PLATFORM_MAINTENANCE', { key: 'auth.shared.errors.PLATFORM_MAINTENANCE', kind: 'notice', tone: 'danger' }],
      [403, 'SUBSCRIPTION_PAST_DUE', { key: 'auth.shared.errors.SUBSCRIPTION_PAST_DUE', kind: 'notice', tone: 'danger' }],
      [409, 'AUTH_SESSION_LIMIT_REACHED', { key: 'auth.shared.errors.AUTH_SESSION_LIMIT_REACHED', kind: 'notice', tone: 'warning' }],
      [404, 'TENANT_NOT_RESOLVABLE', { key: 'auth.shared.errors.TENANT_NOT_RESOLVABLE', kind: 'notice', tone: 'danger' }],
      [403, 'AUTH_WEB_ORIGIN_NOT_ALLOWED', { key: 'auth.shared.errors.generic', kind: 'notice', tone: 'danger' }],
      [403, 'AUTH_CROSS_SITE_REQUEST_REJECTED', { key: 'auth.shared.errors.generic', kind: 'notice', tone: 'danger' }],
      [403, 'AUTH_GATEWAY_TRUST_REQUIRED', { key: 'auth.shared.errors.generic', kind: 'notice', tone: 'danger' }],
      [403, 'AUTH_NATIVE_NOT_ENABLED', { key: 'auth.shared.errors.generic', kind: 'notice', tone: 'danger' }],
    ];

    expect(Object.keys(VERIFY_ERROR_KEYS).sort()).toEqual(cases.map(([, code]) => code).sort());
    for (const [status, code, expected] of cases) {
      expect(verifyErrorKey(new ApiError(status, code))).toEqual(expected);
    }
  });

  it('maps 400 CORE_VALIDATION_FAILED by field path', () => {
    expect(verifyErrorKey(new ApiError(400, 'CORE_VALIDATION_FAILED', { code: ['matches'] }))).toEqual({
      key: 'authVerify.errors.format',
      kind: 'field',
    });
    expect(verifyErrorKey(new ApiError(400, 'CORE_VALIDATION_FAILED', { challengeId: ['matches'] }))).toEqual({
      key: 'authVerify.restart.text',
      kind: 'restart',
      tone: 'warning',
    });
    expect(verifyErrorKey(new ApiError(400, 'CORE_VALIDATION_FAILED', { _: ['bad'] }))).toEqual({
      key: 'auth.shared.errors.generic',
      kind: 'notice',
      tone: 'danger',
    });
  });

  it('maps 503 without domain code to unavailable and status 0 to ambiguous', () => {
    expect(verifyErrorKey(new ApiError(503, ''))).toEqual({
      key: 'auth.shared.errors.unavailable',
      kind: 'notice',
      tone: 'danger',
    });
    expect(verifyErrorKey(ApiError.fromResponse(503, {}))).toEqual({
      key: 'auth.shared.errors.unavailable',
      kind: 'notice',
      tone: 'danger',
    });
    expect(verifyErrorKey(new ApiError(0, 'NETWORK_ERROR'))).toEqual({
      key: 'authVerify.errors.ambiguous',
      kind: 'notice',
      tone: 'danger',
    });
  });

  it('maps unknown errors and non-ApiError values to generic', () => {
    expect(verifyErrorKey(new ApiError(500, 'COMMON.GENERIC.INTERNAL_ERROR'))).toEqual({
      key: 'auth.shared.errors.generic',
      kind: 'notice',
      tone: 'danger',
    });
    expect(verifyErrorKey(new ApiError(418, 'UNKNOWN_DOMAIN_CODE'))).toEqual({
      key: 'auth.shared.errors.generic',
      kind: 'notice',
      tone: 'danger',
    });
    expect(verifyErrorKey(new Error('unexpected'))).toEqual({
      key: 'auth.shared.errors.generic',
      kind: 'notice',
      tone: 'danger',
    });
  });

  it('formats remaining seconds as m:ss with Latin digits', () => {
    expect(formatCountdown(600)).toBe('10:00');
    expect(formatCountdown(65)).toBe('1:05');
    expect(formatCountdown(9.9)).toBe('0:09');
    expect(formatCountdown(0)).toBe('0:00');
    expect(formatCountdown(-10)).toBe('0:00');
  });
});

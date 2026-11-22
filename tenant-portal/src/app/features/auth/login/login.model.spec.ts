import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../core/api/api-errors';
import { loginErrorKey } from './login.model';

describe('loginErrorKey', () => {
  it.each(['TENANT_MAINTENANCE_ACTIVE', 'TENANT_MAINTENANCE_RELEASE_REQUIRED'])(
    'maps 403 %s to TENANT_MAINTENANCE',
    (code) => {
      expect(loginErrorKey(ApiError.fromResponse(403, { errorCode: code }))).toBe('TENANT_MAINTENANCE');
    },
  );

  it.each([
    [401, 'INVALID_CREDENTIALS', 'INVALID_CREDENTIALS'],
    [429, 'AUTH_LOGIN_THROTTLED', 'AUTH_LOGIN_THROTTLED'],
    [429, 'AUTH_MFA_THROTTLED', 'AUTH_MFA_THROTTLED'],
    [429, 'COMMON.GENERIC.RATE_LIMITED', 'RATE_LIMITED'],
    [429, 'GW.RATE.LIMIT.EXCEEDED', 'RATE_LIMITED'],
    [409, 'AUTH_SESSION_LIMIT_REACHED', 'AUTH_SESSION_LIMIT_REACHED'],
    [403, 'SUBSCRIPTION_PAST_DUE', 'SUBSCRIPTION_PAST_DUE'],
    [503, 'PLATFORM_MAINTENANCE', 'PLATFORM_MAINTENANCE'],
    [503, 'AUTH_MFA_UNAVAILABLE', 'AUTH_MFA_UNAVAILABLE'],
    [404, 'TENANT_NOT_RESOLVABLE', 'TENANT_NOT_RESOLVABLE'],
    [400, 'CORE_VALIDATION_FAILED', 'CORE_VALIDATION_FAILED'],
    [429, 'UNRECOGNIZED_CODE', 'RATE_LIMITED'],
    [403, 'FORBIDDEN', 'UNKNOWN'],
    [503, 'TENANT_INACTIVE', 'UNKNOWN'],
  ] as const)('preserves %s %s as %s', (status, code, expected) => {
    expect(loginErrorKey(ApiError.fromResponse(status, { errorCode: code }))).toBe(expected);
  });

  it('maps a 429 without a service code to RATE_LIMITED', () => {
    expect(loginErrorKey(ApiError.fromResponse(429, null))).toBe('RATE_LIMITED');
  });
});

import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../core/api/api-errors';
import { RESET_ERROR_KEYS, resetErrorKey, resetErrorKind } from './reset-password.model';

describe('reset-password model error mapping', () => {
  it('maps validation field errors by field path', () => {
    const emailErr = new ApiError(400, 'CORE_VALIDATION_FAILED', { email: ['is_email'] });
    expect(resetErrorKind(emailErr)).toBe('field-email');
    expect(resetErrorKey(emailErr)).toBe('authReset.errors.email');

    const tokenErr = new ApiError(400, 'CORE_VALIDATION_FAILED', { token: ['min_length'] });
    expect(resetErrorKind(tokenErr)).toBe('invalid-link');
    expect(resetErrorKey(tokenErr)).toBe('authReset.invalid.text');

    const passwordErr = new ApiError(400, 'CORE_VALIDATION_FAILED', { newPassword: ['min_length'] });
    expect(resetErrorKind(passwordErr)).toBe('field-password');
    expect(resetErrorKey(passwordErr)).toBe('auth.shared.errors.WEAK_PASSWORD');

    const passwordMaxErr = new ApiError(400, 'CORE_VALIDATION_FAILED', { newPassword: ['max_length'] });
    expect(resetErrorKind(passwordMaxErr)).toBe('field-password');
    expect(resetErrorKey(passwordMaxErr)).toBe('auth.shared.errors.PASSWORD_TOO_LONG');

    const unattributed = new ApiError(400, 'CORE_VALIDATION_FAILED', { _: ['bad'] });
    expect(resetErrorKind(unattributed)).toBe('notice');
    expect(resetErrorKey(unattributed)).toBe('auth.shared.errors.generic');
  });

  it('maps token and password 400/422 codes to their kinds and keys', () => {
    const invalidToken = new ApiError(400, 'INVALID_ACTION_TOKEN');
    expect(resetErrorKind(invalidToken)).toBe('invalid-link');
    expect(resetErrorKey(invalidToken)).toBe(RESET_ERROR_KEYS['INVALID_ACTION_TOKEN']);

    const weak = new ApiError(422, 'WEAK_PASSWORD');
    expect(resetErrorKind(weak)).toBe('field-password');
    expect(resetErrorKey(weak)).toBe('auth.shared.errors.WEAK_PASSWORD');

    const tooLong = new ApiError(422, 'PASSWORD_TOO_LONG');
    expect(resetErrorKind(tooLong)).toBe('field-password');
    expect(resetErrorKey(tooLong)).toBe('auth.shared.errors.PASSWORD_TOO_LONG');
  });

  it('maps 429 rate-limit codes to throttle', () => {
    for (const code of ['COMMON.GENERIC.RATE_LIMITED', 'GW.RATE.LIMIT_EXCEEDED']) {
      const err = new ApiError(429, code);
      expect(resetErrorKind(err), code).toBe('throttle');
      expect(resetErrorKey(err), code).toBe('auth.shared.throttle');
    }
  });

  it('maps 503, 404, 403 channel codes, status 0, unexpected 401, and non-API errors to notice', () => {
    const unavailable = ApiError.fromResponse(503, {});
    expect(resetErrorKind(unavailable)).toBe('notice');
    expect(resetErrorKey(unavailable)).toBe('auth.shared.errors.unavailable');

    const maintenance = new ApiError(503, 'PLATFORM_MAINTENANCE');
    expect(resetErrorKind(maintenance)).toBe('notice');
    expect(resetErrorKey(maintenance)).toBe('auth.shared.errors.PLATFORM_MAINTENANCE');

    const notResolvable = new ApiError(404, 'TENANT_NOT_RESOLVABLE');
    expect(resetErrorKind(notResolvable)).toBe('notice');
    expect(resetErrorKey(notResolvable)).toBe('auth.shared.errors.TENANT_NOT_RESOLVABLE');

    for (const channelCode of [
      'AUTH_WEB_ORIGIN_NOT_ALLOWED',
      'AUTH_CROSS_SITE_REQUEST_REJECTED',
      'AUTH_GATEWAY_TRUST_REQUIRED',
      'AUTH_NATIVE_NOT_ENABLED',
    ]) {
      const err = new ApiError(403, channelCode);
      expect(resetErrorKind(err), channelCode).toBe('notice');
      expect(resetErrorKey(err), channelCode).toBe('auth.shared.errors.generic');
    }

    const offline = ApiError.fromResponse(0, {});
    expect(resetErrorKind(offline)).toBe('notice');
    expect(resetErrorKey(offline)).toBe('auth.shared.errors.network');

    const auth401 = new ApiError(401, 'AUTH_MFA_INVALID_CHALLENGE');
    expect(resetErrorKind(auth401)).toBe('notice');
    expect(resetErrorKey(auth401)).toBe('auth.shared.errors.generic');

    const plain = new Error('boom');
    expect(resetErrorKind(plain)).toBe('notice');
    expect(resetErrorKey(plain)).toBe('auth.shared.errors.generic');
  });
});

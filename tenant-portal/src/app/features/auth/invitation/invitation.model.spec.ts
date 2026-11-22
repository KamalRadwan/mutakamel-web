import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../core/api/api-errors';
import { INVITE_ERROR_KEYS, inviteErrorKey, inviteErrorKind, inviteNoticeTone } from './invitation.model';

describe('invitation.model', () => {
  it('maps every documented error code in INVITE_ERROR_KEYS', () => {
    expect(INVITE_ERROR_KEYS['INVALID_ACTION_TOKEN']).toBe('authInvite.invalid.text');
    expect(INVITE_ERROR_KEYS['WEAK_PASSWORD']).toBe('auth.shared.errors.WEAK_PASSWORD');
    expect(INVITE_ERROR_KEYS['PASSWORD_TOO_LONG']).toBe('auth.shared.errors.PASSWORD_TOO_LONG');
    expect(INVITE_ERROR_KEYS['SUBSCRIPTION_PAST_DUE']).toBe('auth.shared.errors.SUBSCRIPTION_PAST_DUE');
    expect(INVITE_ERROR_KEYS['AUTH_SESSION_LIMIT_REACHED']).toBe('authInvite.errors.sessionLimit');
    expect(INVITE_ERROR_KEYS['PLATFORM_MAINTENANCE']).toBe('auth.shared.errors.PLATFORM_MAINTENANCE');
    expect(INVITE_ERROR_KEYS['AUTH_MFA_UNAVAILABLE']).toBe('authInvite.errors.AUTH_MFA_UNAVAILABLE');
    expect(INVITE_ERROR_KEYS['TENANT_NOT_RESOLVABLE']).toBe('auth.shared.errors.TENANT_NOT_RESOLVABLE');
    expect(INVITE_ERROR_KEYS['AUTH_MFA_THROTTLED']).toBe('auth.shared.throttle');
    expect(INVITE_ERROR_KEYS['COMMON.GENERIC.RATE_LIMITED']).toBe('auth.shared.throttle');
    expect(INVITE_ERROR_KEYS['GW.RATE.LIMIT_EXCEEDED']).toBe('auth.shared.throttle');
    expect(INVITE_ERROR_KEYS['NETWORK_ERROR']).toBe('authInvite.errors.ambiguous');
  });

  it('classifies invalid action token and validation errors accurately', () => {
    const invalidToken = new ApiError(400, 'INVALID_ACTION_TOKEN');
    expect(inviteErrorKind(invalidToken)).toBe('invalid');
    expect(inviteErrorKey(invalidToken)).toBe('authInvite.invalid.text');

    const badTokenField = new ApiError(400, 'CORE_VALIDATION_FAILED', { token: ['min_length'] });
    expect(inviteErrorKind(badTokenField)).toBe('invalid');
    expect(inviteErrorKey(badTokenField)).toBe('authInvite.invalid.text');

    const bothFields = new ApiError(400, 'CORE_VALIDATION_FAILED', {
      token: ['min_length'],
      newPassword: ['min_length'],
    });
    expect(inviteErrorKind(bothFields)).toBe('invalid');
    expect(inviteErrorKey(bothFields)).toBe('authInvite.invalid.text');

    const shortPwd = new ApiError(400, 'CORE_VALIDATION_FAILED', { newPassword: ['min_length'] });
    expect(inviteErrorKind(shortPwd)).toBe('field-password');
    expect(inviteErrorKey(shortPwd)).toBe('auth.validation.server');

    const longPwdValidation = new ApiError(400, 'CORE_VALIDATION_FAILED', { newPassword: ['max_length'] });
    expect(inviteErrorKind(longPwdValidation)).toBe('field-password');
    expect(inviteErrorKey(longPwdValidation)).toBe('auth.shared.errors.PASSWORD_TOO_LONG');

    const unattributedValidation = new ApiError(400, 'CORE_VALIDATION_FAILED', { _: ['bad'] });
    expect(inviteErrorKind(unattributedValidation)).toBe('notice');
    expect(inviteErrorKey(unattributedValidation)).toBe('auth.shared.errors.generic');
    expect(inviteNoticeTone(unattributedValidation)).toBe('danger');
  });

  it('classifies 422 password policy errors to the password field', () => {
    const weak = new ApiError(422, 'WEAK_PASSWORD');
    expect(inviteErrorKind(weak)).toBe('field-password');
    expect(inviteErrorKey(weak)).toBe('auth.shared.errors.WEAK_PASSWORD');

    const tooLong = new ApiError(422, 'PASSWORD_TOO_LONG');
    expect(inviteErrorKind(tooLong)).toBe('field-password');
    expect(inviteErrorKey(tooLong)).toBe('auth.shared.errors.PASSWORD_TOO_LONG');
  });

  it('classifies 429 throttle errors', () => {
    for (const code of ['AUTH_MFA_THROTTLED', 'COMMON.GENERIC.RATE_LIMITED', 'GW.RATE.LIMIT_EXCEEDED']) {
      const err = new ApiError(429, code, { retryAfterSeconds: ['30'] });
      expect(inviteErrorKind(err), code).toBe('throttle');
      expect(inviteErrorKey(err), code).toBe('auth.shared.throttle');
    }

    const generic429 = new ApiError(429, 'OTHER_RATE_LIMIT');
    expect(inviteErrorKind(generic429)).toBe('throttle');
    expect(inviteErrorKey(generic429)).toBe('auth.shared.throttle');
  });

  it('classifies inline notices and tones including 503 no-code, status 0, and 409 session limit', () => {
    const pastDue = new ApiError(403, 'SUBSCRIPTION_PAST_DUE');
    expect(inviteErrorKind(pastDue)).toBe('notice');
    expect(inviteErrorKey(pastDue)).toBe('auth.shared.errors.SUBSCRIPTION_PAST_DUE');
    expect(inviteNoticeTone(pastDue)).toBe('danger');

    const sessionLimit = new ApiError(409, 'AUTH_SESSION_LIMIT_REACHED');
    expect(inviteErrorKind(sessionLimit)).toBe('notice');
    expect(inviteErrorKey(sessionLimit)).toBe('authInvite.errors.sessionLimit');
    expect(inviteNoticeTone(sessionLimit)).toBe('warning');

    const maintenance = new ApiError(503, 'PLATFORM_MAINTENANCE');
    expect(inviteErrorKind(maintenance)).toBe('notice');
    expect(inviteErrorKey(maintenance)).toBe('auth.shared.errors.PLATFORM_MAINTENANCE');
    expect(inviteNoticeTone(maintenance)).toBe('danger');

    const mfaUnavailable = new ApiError(503, 'AUTH_MFA_UNAVAILABLE');
    expect(inviteErrorKind(mfaUnavailable)).toBe('notice');
    expect(inviteErrorKey(mfaUnavailable)).toBe('authInvite.errors.AUTH_MFA_UNAVAILABLE');
    expect(inviteNoticeTone(mfaUnavailable)).toBe('danger');

    const storeDown = ApiError.fromResponse(503, null);
    expect(inviteErrorKind(storeDown)).toBe('notice');
    expect(inviteErrorKey(storeDown)).toBe('auth.shared.errors.unavailable');
    expect(inviteNoticeTone(storeDown)).toBe('danger');

    const bare503 = new ApiError(503, '');
    expect(inviteErrorKind(bare503)).toBe('notice');
    expect(inviteErrorKey(bare503)).toBe('auth.shared.errors.unavailable');

    const tenantNotFound = new ApiError(404, 'TENANT_NOT_RESOLVABLE');
    expect(inviteErrorKind(tenantNotFound)).toBe('notice');
    expect(inviteErrorKey(tenantNotFound)).toBe('auth.shared.errors.TENANT_NOT_RESOLVABLE');

    const csrfForbidden = new ApiError(403, 'AUTH_CSRF_INVALID');
    expect(inviteErrorKind(csrfForbidden)).toBe('notice');
    expect(inviteErrorKey(csrfForbidden)).toBe('auth.shared.errors.generic');

    const networkError = ApiError.fromResponse(0, null);
    expect(inviteErrorKind(networkError)).toBe('notice');
    expect(inviteErrorKey(networkError)).toBe('authInvite.errors.ambiguous');
    expect(inviteNoticeTone(networkError)).toBe('danger');

    const unknownError = new Error('boom');
    expect(inviteErrorKind(unknownError)).toBe('notice');
    expect(inviteErrorKey(unknownError)).toBe('auth.shared.errors.generic');
    expect(inviteNoticeTone(unknownError)).toBe('danger');
  });
});

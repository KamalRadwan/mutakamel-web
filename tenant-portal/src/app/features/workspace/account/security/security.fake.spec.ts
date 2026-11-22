import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { changePassword, confirmMfaChange, getSecurityMe, resendMfaCode, startMfaChange } from './security.api';
import { resetSecurityFake, setFakeMfaUnavailable, setFakeThrottleNext } from './security.fake';

// Phase 3 fake values from security.fake.ts.
const CURRENT = 'Current#Pass1';
const STRONG = 'Fresh#Secret42';
const CODE = '123456';

async function settle<T>(promise: Promise<T>): Promise<T> {
  const guarded = promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await vi.runAllTimersAsync();
  const result = await guarded;
  if (!result.ok) throw result.error;
  return result.value;
}

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await settle(promise);
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('expected an ApiError');
}

describe('security fake (backend contract)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetSecurityFake();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('POST auth/change-password', () => {
    it('changes the password', async () => {
      await settle(changePassword({ currentPassword: CURRENT, newPassword: STRONG }));
      const error = await failure(changePassword({ currentPassword: CURRENT, newPassword: STRONG }));
      expect(error.code).toBe('CURRENT_PASSWORD_INVALID');
    });

    it('validates the DTO before checking the current password (400 CORE_VALIDATION_FAILED)', async () => {
      const error = await failure(changePassword({ currentPassword: 'wrong', newPassword: 'short' }));
      expect([error.status, error.code]).toEqual([400, 'CORE_VALIDATION_FAILED']);
      expect(error.details).toEqual({ newPassword: ['min_length', 'is_strong_password'] });
    });

    it('rejects a too long new password with 400, not PASSWORD_TOO_LONG', async () => {
      const error = await failure(changePassword({ currentPassword: CURRENT, newPassword: `Aa1#${'x'.repeat(130)}` }));
      expect([error.status, error.code]).toEqual([400, 'CORE_VALIDATION_FAILED']);
      expect(error.details).toEqual({ newPassword: ['max_length'] });
    });

    it('answers 422 CURRENT_PASSWORD_INVALID before 422 WEAK_PASSWORD', async () => {
      const wrong = await failure(changePassword({ currentPassword: 'Wrong#Pass12', newPassword: 'Password123!' }));
      expect([wrong.status, wrong.code]).toEqual([422, 'CURRENT_PASSWORD_INVALID']);
      const weak = await failure(changePassword({ currentPassword: CURRENT, newPassword: 'Password123!' }));
      expect([weak.status, weak.code]).toEqual([422, 'WEAK_PASSWORD']);
      const identity = await failure(changePassword({ currentPassword: CURRENT, newPassword: 'Kamal#Secret42' }));
      expect(identity.code).toBe('WEAK_PASSWORD');
    });

    it('throttles with 429 COMMON.GENERIC.RATE_LIMITED and no details', async () => {
      setFakeThrottleNext(true);
      const error = await failure(changePassword({ currentPassword: CURRENT, newPassword: STRONG }));
      expect([error.status, error.code, error.details]).toEqual([429, 'COMMON.GENERIC.RATE_LIMITED', undefined]);
    });
  });

  describe('MFA settings', () => {
    it('enables MFA through challenge and confirm', async () => {
      const step = await settle(startMfaChange(true, CURRENT));
      expect(step).toMatchObject({ mfaRequired: true, expiresIn: 600, resendAfterSeconds: 60 });
      expect(step.challengeId).toMatch(/^[A-Za-z0-9_-]{43}$/);
      await settle(confirmMfaChange(step.challengeId, CODE));
      expect((await settle(getSecurityMe())).mfaEnabled).toBe(true);
    });

    it('answers 401 AUTH_MFA_INVALID_CHALLENGE when asking for the current state', async () => {
      const error = await failure(startMfaChange(false, CURRENT));
      expect([error.status, error.code]).toEqual([401, 'AUTH_MFA_INVALID_CHALLENGE']);
    });

    it('answers 422 CURRENT_PASSWORD_INVALID for a wrong password', async () => {
      const error = await failure(startMfaChange(true, 'nope'));
      expect([error.status, error.code]).toEqual([422, 'CURRENT_PASSWORD_INVALID']);
    });

    it('answers 401 AUTH_MFA_INVALID_CHALLENGE for a wrong code', async () => {
      const step = await settle(startMfaChange(true, CURRENT));
      const error = await failure(confirmMfaChange(step.challengeId, '000000'));
      expect([error.status, error.code]).toEqual([401, 'AUTH_MFA_INVALID_CHALLENGE']);
    });

    it('validates challengeId and code format with 400', async () => {
      const error = await failure(confirmMfaChange('short', '12'));
      expect([error.status, error.code]).toEqual([400, 'CORE_VALIDATION_FAILED']);
      expect(error.details).toEqual({ challengeId: ['matches'], code: ['matches'] });
    });

    it('throttles resend with details.retryAfterSeconds as a string array', async () => {
      const step = await settle(startMfaChange(true, CURRENT));
      const error = await failure(resendMfaCode(step.challengeId));
      expect([error.status, error.code]).toEqual([429, 'AUTH_MFA_THROTTLED']);
      const retry = error.details?.['retryAfterSeconds'];
      expect(Array.isArray(retry) && typeof retry[0] === 'string').toBe(true);
    });

    it('answers 503 AUTH_MFA_UNAVAILABLE when MFA is down', async () => {
      setFakeMfaUnavailable(true);
      const error = await failure(startMfaChange(true, CURRENT));
      expect([error.status, error.code]).toEqual([503, 'AUTH_MFA_UNAVAILABLE']);
    });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../core/api/api-errors';
import { resetFakeSession } from '../../../core/auth/auth-session.fake';
import {
  FAKE_MFA_CODE,
  registerFakeChallenge,
  resetFakeChallenges,
  setFakeMfaNext,
} from '../shared/mfa-challenge.fake';
import { resendCode, verifyCode } from './verify.api';
import { resetFakeVerify } from './verify.fake';

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

describe('verify fake (POST /tenant/auth/mfa/verify & resend)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetFakeSession();
    resetFakeChallenges();
    resetFakeVerify();
  });

  afterEach(() => {
    resetFakeVerify();
    resetFakeChallenges();
    resetFakeSession();
    vi.useRealTimers();
  });

  it('returns LoginSession on FAKE_MFA_CODE with no credentials leaked', async () => {
    const step = registerFakeChallenge({ remember: true });

    const session = await settle(verifyCode(step.challengeId, FAKE_MFA_CODE));

    expect(session).toMatchObject({ tokenType: 'Bearer', expiresIn: 600, sessionExpiresIn: 43200 });
    expect(session.session).toMatchObject({ clientId: 'mutakamel-tenant-web', clientType: 'WEB' });
    expect(Object.keys(session).sort()).toEqual(['expiresIn', 'session', 'sessionExpiresIn', 'tokenType']);
  });

  it('validates challengeId and code formats with 400 CORE_VALIDATION_FAILED', async () => {
    const step = registerFakeChallenge({ remember: false });

    const badCode = await failure(verifyCode(step.challengeId, '12a4'));
    expect([badCode.status, badCode.code]).toEqual([400, 'CORE_VALIDATION_FAILED']);
    expect(badCode.details).toEqual({ code: ['matches'] });

    const badChallenge = await failure(verifyCode('short', FAKE_MFA_CODE));
    expect([badChallenge.status, badChallenge.code]).toEqual([400, 'CORE_VALIDATION_FAILED']);
    expect(badChallenge.details).toEqual({ challengeId: ['matches'] });
  });

  it('rejects a wrong code with 401 AUTH_MFA_INVALID_CHALLENGE and burns the challenge after 5 wrong tries', async () => {
    const step = registerFakeChallenge({ remember: false });
    const wrongCode = '000000';

    for (let i = 0; i < 5; i++) {
      const err = await failure(verifyCode(step.challengeId, wrongCode));
      expect([err.status, err.code]).toEqual([401, 'AUTH_MFA_INVALID_CHALLENGE']);
    }

    const sixth = await failure(verifyCode(step.challengeId, FAKE_MFA_CODE));
    expect([sixth.status, sixth.code]).toEqual([401, 'AUTH_MFA_INVALID_CHALLENGE']);
  });

  it('rejects resend before 60 s with 429 retryAfterSeconds and keeps the original deadline afterwards', async () => {
    const step = registerFakeChallenge({ remember: false });

    const early = await failure(resendCode(step.challengeId));
    expect([early.status, early.code]).toEqual([429, 'AUTH_MFA_THROTTLED']);
    const retrySec = Number((early.details?.['retryAfterSeconds'] as string[] | undefined)?.[0]);
    expect(retrySec).toBeGreaterThan(0);

    await vi.advanceTimersByTimeAsync(65_000);
    const refreshed = await settle(resendCode(step.challengeId));
    expect(refreshed.mfaRequired).toBe(true);
    expect(refreshed.challengeId).toBe(step.challengeId);
    expect(refreshed.resendAfterSeconds).toBe(60);
    expect(refreshed.expiresIn).toBeLessThanOrEqual(535);
    expect(refreshed.expiresIn).toBeGreaterThan(530);
  });

  it('surfaces injected MFA failure modes from setFakeMfaNext', async () => {
    const step = registerFakeChallenge({ remember: false });

    setFakeMfaNext('THROTTLED');
    const throttled = await failure(verifyCode(step.challengeId, FAKE_MFA_CODE));
    expect([throttled.status, throttled.code]).toEqual([429, 'AUTH_MFA_THROTTLED']);

    setFakeMfaNext('UNAVAILABLE');
    const unavailable = await failure(verifyCode(step.challengeId, FAKE_MFA_CODE));
    expect([unavailable.status, unavailable.code]).toEqual([503, 'AUTH_MFA_UNAVAILABLE']);

    setFakeMfaNext('PAST_DUE');
    const pastDue = await failure(verifyCode(step.challengeId, FAKE_MFA_CODE));
    expect([pastDue.status, pastDue.code]).toEqual([403, 'SUBSCRIPTION_PAST_DUE']);

    setFakeMfaNext('SESSION_LIMIT');
    const sessionLimit = await failure(verifyCode(step.challengeId, FAKE_MFA_CODE));
    expect([sessionLimit.status, sessionLimit.code]).toEqual([409, 'AUTH_SESSION_LIMIT_REACHED']);
  });
});

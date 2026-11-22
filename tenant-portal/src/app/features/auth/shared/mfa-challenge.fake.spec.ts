import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../core/api/api-errors';
import { resetFakeSession } from '../../../core/auth/auth-session.fake';
import {
  FAKE_MFA_CODE,
  fakeResendChallenge,
  fakeVerifyChallenge,
  registerFakeChallenge,
  resetFakeChallenges,
  setFakeMfaNext,
} from './mfa-challenge.fake';

describe('mfa-challenge.fake', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-22T10:00:00Z'));
    resetFakeSession();
    resetFakeChallenges();
  });

  afterEach(() => {
    resetFakeChallenges();
    resetFakeSession();
    vi.useRealTimers();
  });

  it('registers a 43-char challenge and returns a LoginSession on the right code', () => {
    const step = registerFakeChallenge({ remember: true });
    expect(step.mfaRequired).toBe(true);
    expect(step.challengeId).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(step.expiresIn).toBe(600);
    expect(step.resendAfterSeconds).toBe(60);

    const session = fakeVerifyChallenge(step.challengeId, FAKE_MFA_CODE);
    expect(session.tokenType).toBe('Bearer');

    // Consumed after success.
    expect(() => fakeVerifyChallenge(step.challengeId, FAKE_MFA_CODE)).toThrowError(ApiError);
  });

  it('ends the challenge after 5 wrong codes so the 6th right code fails', () => {
    const step = registerFakeChallenge({ remember: false });

    for (let i = 0; i < 5; i++) {
      try {
        fakeVerifyChallenge(step.challengeId, '000000');
        throw new Error('expected 401');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect([(error as ApiError).status, (error as ApiError).code]).toEqual([401, 'AUTH_MFA_INVALID_CHALLENGE']);
      }
    }

    try {
      fakeVerifyChallenge(step.challengeId, FAKE_MFA_CODE);
      throw new Error('expected 401');
    } catch (error) {
      expect([(error as ApiError).status, (error as ApiError).code]).toEqual([401, 'AUTH_MFA_INVALID_CHALLENGE']);
    }
  });

  it('throttles early resends, keeps the original deadline, and blocks a 4th send', () => {
    const step = registerFakeChallenge({ remember: false });

    vi.advanceTimersByTime(15_000);
    try {
      fakeResendChallenge(step.challengeId);
      throw new Error('expected 429');
    } catch (error) {
      expect([(error as ApiError).status, (error as ApiError).code]).toEqual([429, 'AUTH_MFA_THROTTLED']);
      expect((error as ApiError).details).toEqual({ retryAfterSeconds: ['45'] });
    }

    // 2nd send (60s from start)
    vi.advanceTimersByTime(45_000);
    const resend1 = fakeResendChallenge(step.challengeId);
    expect(resend1.expiresIn).toBe(540);
    expect(resend1.resendAfterSeconds).toBe(60);

    // 3rd send (120s from start)
    vi.advanceTimersByTime(60_000);
    const resend2 = fakeResendChallenge(step.challengeId);
    expect(resend2.expiresIn).toBe(480);

    // 4th send (180s from start) -> device send limit 3 -> 429 with ['300']
    vi.advanceTimersByTime(60_000);
    try {
      fakeResendChallenge(step.challengeId);
      throw new Error('expected 429');
    } catch (error) {
      expect([(error as ApiError).status, (error as ApiError).code]).toEqual([429, 'AUTH_MFA_THROTTLED']);
      expect((error as ApiError).details).toEqual({ retryAfterSeconds: ['300'] });
    }
  });

  it('expires the challenge after 600 seconds and supports error injection flags', () => {
    const step = registerFakeChallenge({ remember: false });

    const cases: Array<['THROTTLED' | 'UNAVAILABLE' | 'PAST_DUE' | 'SESSION_LIMIT', number, string]> = [
      ['THROTTLED', 429, 'AUTH_MFA_THROTTLED'],
      ['UNAVAILABLE', 503, 'AUTH_MFA_UNAVAILABLE'],
      ['PAST_DUE', 403, 'SUBSCRIPTION_PAST_DUE'],
      ['SESSION_LIMIT', 409, 'AUTH_SESSION_LIMIT_REACHED'],
    ];
    for (const [flag, status, code] of cases) {
      setFakeMfaNext(flag);
      try {
        fakeVerifyChallenge(step.challengeId, FAKE_MFA_CODE);
        throw new Error('expected injected ApiError');
      } catch (error) {
        expect([(error as ApiError).status, (error as ApiError).code]).toEqual([status, code]);
      }
    }

    vi.advanceTimersByTime(600_000);
    expect(() => fakeVerifyChallenge(step.challengeId, FAKE_MFA_CODE)).toThrowError(ApiError);
  });
});

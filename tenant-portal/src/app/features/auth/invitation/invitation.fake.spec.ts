import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../core/api/api-errors';
import { resetFakeSession } from '../../../core/auth/auth-session.fake';
import { isMfaStep } from '../../../core/auth/auth-session.model';
import { FAKE_MFA_CODE, fakeVerifyChallenge, resetFakeChallenges } from '../shared/mfa-challenge.fake';
import { acceptInvitation } from './invitation.api';
import { FAKE_INVITE_TOKENS, resetFakeInvitations, setFakeInviteNext } from './invitation.fake';

const STRONG_PASSWORD = 'Valid#Password2026';

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

describe('invitation fake (POST /api/tenant/core/v1/auth/accept-invite)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetFakeSession();
    resetFakeChallenges();
    resetFakeInvitations();
  });

  afterEach(() => {
    resetFakeInvitations();
    resetFakeChallenges();
    resetFakeSession();
    vi.useRealTimers();
  });

  it('activates a valid invitation once and rejects reuse with 400 INVALID_ACTION_TOKEN', async () => {
    const result = await settle(acceptInvitation(FAKE_INVITE_TOKENS.valid, STRONG_PASSWORD));

    expect(isMfaStep(result)).toBe(false);
    expect(result).toMatchObject({ tokenType: 'Bearer', expiresIn: 600, sessionExpiresIn: 43200 });
    expect(Object.keys(result).sort()).toEqual(['expiresIn', 'session', 'sessionExpiresIn', 'tokenType']);
    expect(JSON.stringify(result)).not.toMatch(/accessToken|refreshToken|password/);

    const reuseError = await failure(acceptInvitation(FAKE_INVITE_TOKENS.valid, STRONG_PASSWORD));
    expect([reuseError.status, reuseError.code]).toEqual([400, 'INVALID_ACTION_TOKEN']);
  });

  it('issues an MfaStep for an MFA invitation whose challengeId verifies with FAKE_MFA_CODE', async () => {
    const step = await settle(acceptInvitation(FAKE_INVITE_TOKENS.mfa, STRONG_PASSWORD));

    expect(isMfaStep(step)).toBe(true);
    expect(step).toEqual({
      mfaRequired: true,
      challengeId: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      expiresIn: 600,
      resendAfterSeconds: 60,
    });

    if (!isMfaStep(step)) throw new Error('expected MfaStep');
    const session = fakeVerifyChallenge(step.challengeId, FAKE_MFA_CODE);
    expect(session.tokenType).toBe('Bearer');

    const reuseError = await failure(acceptInvitation(FAKE_INVITE_TOKENS.mfa, STRONG_PASSWORD));
    expect([reuseError.status, reuseError.code]).toEqual([400, 'INVALID_ACTION_TOKEN']);
  });

  it('rejects pastDue with 403 SUBSCRIPTION_PAST_DUE and keeps the token usable', async () => {
    const first = await failure(acceptInvitation(FAKE_INVITE_TOKENS.pastDue, STRONG_PASSWORD));
    expect([first.status, first.code]).toEqual([403, 'SUBSCRIPTION_PAST_DUE']);

    const second = await failure(acceptInvitation(FAKE_INVITE_TOKENS.pastDue, STRONG_PASSWORD));
    expect([second.status, second.code]).toEqual([403, 'SUBSCRIPTION_PAST_DUE']);
  });

  it('rejects used and unknown tokens with 400 INVALID_ACTION_TOKEN', async () => {
    const usedErr = await failure(acceptInvitation(FAKE_INVITE_TOKENS.used, STRONG_PASSWORD));
    expect([usedErr.status, usedErr.code]).toEqual([400, 'INVALID_ACTION_TOKEN']);

    const unknownErr = await failure(acceptInvitation('unknown-invite-token-123456', STRONG_PASSWORD));
    expect([unknownErr.status, unknownErr.code]).toEqual([400, 'INVALID_ACTION_TOKEN']);
  });

  it('enforces DTO length checks with 400 CORE_VALIDATION_FAILED before token lookup', async () => {
    const shortTokenErr = await failure(acceptInvitation('short-token', 'short'));
    expect([shortTokenErr.status, shortTokenErr.code]).toEqual([400, 'CORE_VALIDATION_FAILED']);
    expect(shortTokenErr.details).toEqual({ token: ['min_length'], newPassword: ['min_length'] });

    const longTokenErr = await failure(acceptInvitation('t'.repeat(513), STRONG_PASSWORD));
    expect([longTokenErr.status, longTokenErr.code]).toEqual([400, 'CORE_VALIDATION_FAILED']);
    expect(longTokenErr.details).toEqual({ token: ['max_length'] });
  });

  it('enforces 422 PASSWORD_TOO_LONG and WEAK_PASSWORD (policy, common, identity) without burning the token', async () => {
    const tooLong = await failure(acceptInvitation(FAKE_INVITE_TOKENS.valid, `Aa1!${'x'.repeat(125)}`));
    expect([tooLong.status, tooLong.code]).toEqual([422, 'PASSWORD_TOO_LONG']);

    for (const weak of [
      'alllowercase1!',
      'Password123!',
      'Qwerty123456!',
      'Sara#Pass2026!',
      'Pass#Ahmed2026',
    ]) {
      const err = await failure(acceptInvitation(FAKE_INVITE_TOKENS.valid, weak));
      expect([err.status, err.code], weak).toEqual([422, 'WEAK_PASSWORD']);
    }

    // Token was not consumed by failed password checks.
    const success = await settle(acceptInvitation(FAKE_INVITE_TOKENS.valid, STRONG_PASSWORD));
    expect(isMfaStep(success)).toBe(false);
  });

  it('supports error injection flags via setFakeInviteNext', async () => {
    setFakeInviteNext('THROTTLED');
    const throttled = await failure(acceptInvitation(FAKE_INVITE_TOKENS.valid, STRONG_PASSWORD));
    expect([throttled.status, throttled.code]).toEqual([429, 'AUTH_MFA_THROTTLED']);
    expect(throttled.details).toEqual({ retryAfterSeconds: ['30'] });

    setFakeInviteNext('MAINTENANCE');
    const maintenance = await failure(acceptInvitation(FAKE_INVITE_TOKENS.valid, STRONG_PASSWORD));
    expect([maintenance.status, maintenance.code]).toEqual([503, 'PLATFORM_MAINTENANCE']);

    setFakeInviteNext('MFA_UNAVAILABLE');
    const mfaUnavailable = await failure(acceptInvitation(FAKE_INVITE_TOKENS.valid, STRONG_PASSWORD));
    expect([mfaUnavailable.status, mfaUnavailable.code]).toEqual([503, 'AUTH_MFA_UNAVAILABLE']);

    setFakeInviteNext('SESSION_LIMIT');
    const sessionLimit = await failure(acceptInvitation(FAKE_INVITE_TOKENS.valid, STRONG_PASSWORD));
    expect([sessionLimit.status, sessionLimit.code]).toEqual([409, 'AUTH_SESSION_LIMIT_REACHED']);
  });
});

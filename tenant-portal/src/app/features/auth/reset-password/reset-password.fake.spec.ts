import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../core/api/api-errors';
import { fakeRequestResetLink as requestResetLink, fakeResetPassword as resetPassword } from './reset-password.fake';
import {
  FAKE_RATE_LIMITED_EMAIL,
  FAKE_RESET_TOKENS,
  FAKE_RESET_USER,
  fakeResetCallCounts,
  resetFakeResetPassword,
  setFakeResetNext,
} from './reset-password.fake';

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

describe('reset-password fake (forgot-password & reset-password)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetFakeResetPassword();
  });

  afterEach(() => {
    resetFakeResetPassword();
    vi.useRealTimers();
  });

  it('forgot resolves identically (undefined / 204) for known and unknown emails alike', async () => {
    const known = await settle(requestResetLink(`  ${FAKE_RESET_USER.email.toUpperCase()}  `));
    const unknown = await settle(requestResetLink('nobody@example.com'));

    expect(known).toBeUndefined();
    expect(unknown).toBeUndefined();
    expect(fakeResetCallCounts().request).toBe(2);
  });

  it('forgot validates email shape/length and throttles busy@mutakamel.io', async () => {
    const invalid = await failure(requestResetLink('not-an-email'));
    expect([invalid.status, invalid.code]).toEqual([400, 'CORE_VALIDATION_FAILED']);
    expect(invalid.details).toEqual({ email: ['is_email'] });

    const tooLong = await failure(requestResetLink(`${'a'.repeat(251)}@b.co`));
    expect([tooLong.status, tooLong.code]).toEqual([400, 'CORE_VALIDATION_FAILED']);
    expect(tooLong.details).toEqual({ email: ['max_length'] });

    const throttled = await failure(requestResetLink(FAKE_RATE_LIMITED_EMAIL));
    expect([throttled.status, throttled.code, throttled.details]).toEqual([
      429,
      'COMMON.GENERIC.RATE_LIMITED',
      undefined,
    ]);
  });

  it('setFakeResetNext("UNAVAILABLE") throws a bare 503 once and clears', async () => {
    setFakeResetNext('UNAVAILABLE');
    const first = await failure(requestResetLink(FAKE_RESET_USER.email));
    expect(first.status).toBe(503);
    expect(first.code).toBe('COMMON.GENERIC.INTERNAL_ERROR');

    await expect(settle(requestResetLink(FAKE_RESET_USER.email))).resolves.toBeUndefined();

    setFakeResetNext('UNAVAILABLE');
    const onReset = await failure(resetPassword(FAKE_RESET_TOKENS.valid, 'Strong#Pass2026!'));
    expect(onReset.status).toBe(503);
  });

  it('valid token works once, then fails with 400 INVALID_ACTION_TOKEN', async () => {
    await expect(settle(resetPassword(FAKE_RESET_TOKENS.valid, 'Strong#Pass2026!'))).resolves.toBeUndefined();

    const reused = await failure(resetPassword(FAKE_RESET_TOKENS.valid, 'Another#Pass2026!'));
    expect([reused.status, reused.code]).toEqual([400, 'INVALID_ACTION_TOKEN']);

    const expired = await failure(resetPassword(FAKE_RESET_TOKENS.expired, 'Another#Pass2026!'));
    expect([expired.status, expired.code]).toEqual([400, 'INVALID_ACTION_TOKEN']);
  });

  it('rejects out-of-range tokens with 400 CORE_VALIDATION_FAILED', async () => {
    const short = await failure(resetPassword('short-token', 'Strong#Pass2026!'));
    expect([short.status, short.code]).toEqual([400, 'CORE_VALIDATION_FAILED']);
    expect(short.details).toEqual({ token: ['min_length'] });

    const long = await failure(resetPassword('t'.repeat(513), 'Strong#Pass2026!'));
    expect([long.status, long.code]).toEqual([400, 'CORE_VALIDATION_FAILED']);
    expect(long.details).toEqual({ token: ['max_length'] });
  });

  it('returns 422 WEAK_PASSWORD and PASSWORD_TOO_LONG without consuming the valid token', async () => {
    const policyFail = await failure(resetPassword(FAKE_RESET_TOKENS.valid, 'weak'));
    expect([policyFail.status, policyFail.code]).toEqual([422, 'WEAK_PASSWORD']);

    for (const bad of ['Password123!', 'Qwerty123456!', 'MyOwner#2026!', 'PassKamal!2026', 'Radwan#Pass2026']) {
      const err = await failure(resetPassword(FAKE_RESET_TOKENS.valid, bad));
      expect([err.status, err.code], bad).toEqual([422, 'WEAK_PASSWORD']);
    }

    const tooLong = await failure(resetPassword(FAKE_RESET_TOKENS.valid, `Aa1!${'x'.repeat(125)}`));
    expect([tooLong.status, tooLong.code]).toEqual([422, 'PASSWORD_TOO_LONG']);

    // Token is still usable after validation/weak rejections.
    await expect(settle(resetPassword(FAKE_RESET_TOKENS.valid, 'Strong#Pass2026!'))).resolves.toBeUndefined();
  });
});

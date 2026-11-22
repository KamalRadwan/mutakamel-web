import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../core/api/api-errors';
import { resetFakeSession } from '../../../core/auth/auth-session.fake';
import { isMfaStep } from '../../../core/auth/auth-session.model';
import { resetFakeChallenges } from '../shared/mfa-challenge.fake';
import { FAKE_ACCOUNTS, FAKE_LOCKOUT_SECONDS, fakeLogin as login } from './login.fake';
import { LoginResult, loginErrorKey, retryAfterMinutes } from './login.model';

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

describe('login fake (POST /tenant/auth/login)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetFakeSession();
    resetFakeChallenges();
  });
  afterEach(() => {
    resetFakeChallenges();
    resetFakeSession();
    vi.useRealTimers();
  });

  it('returns the AuthCookieSessionResponse data part, with no credential in it', async () => {
    const result = await settle(login(FAKE_ACCOUNTS.valid, false));

    expect(isMfaStep(result)).toBe(false);
    expect(result).toMatchObject({ tokenType: 'Bearer', expiresIn: 600, sessionExpiresIn: 43200 });
    const session = (result as Extract<LoginResult, { session: unknown }>).session;
    expect(session).toMatchObject({ clientId: 'mutakamel-tenant-web', clientType: 'WEB', refreshUseCount: '0' });
    expect(Object.keys(result).sort()).toEqual(['expiresIn', 'session', 'sessionExpiresIn', 'tokenType']);
    expect(JSON.stringify(result)).not.toMatch(/accessToken|refreshToken|password/);
  });

  it('trims and lower-cases the email like LoginDto', async () => {
    const body = { email: `  ${FAKE_ACCOUNTS.valid.email.toUpperCase()} `, password: FAKE_ACCOUNTS.valid.password };
    await expect(settle(login(body, true))).resolves.toMatchObject({ tokenType: 'Bearer' });
  });

  it('gives an enrolled user the MFA step and no session', async () => {
    const result = await settle(login(FAKE_ACCOUNTS.mfa, false));

    expect(result).toEqual({ mfaRequired: true, challengeId: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/), expiresIn: 600, resendAfterSeconds: 60 });
  });

  it('rejects a wrong password with 401 INVALID_CREDENTIALS', async () => {
    const error = await failure(login({ email: FAKE_ACCOUNTS.valid.email, password: 'wrong' }, false));

    expect([error.status, error.code]).toEqual([401, 'INVALID_CREDENTIALS']);
    expect(loginErrorKey(error)).toBe('INVALID_CREDENTIALS');
  });

  it('locks out with 429 AUTH_LOGIN_THROTTLED and retryAfterSeconds as a string array', async () => {
    const error = await failure(login({ email: FAKE_ACCOUNTS.throttled.email, password: 'any' }, false));

    expect([error.status, error.code]).toEqual([429, 'AUTH_LOGIN_THROTTLED']);
    expect(error.details).toEqual({ retryAfterSeconds: [String(FAKE_LOCKOUT_SECONDS)] });
    expect(retryAfterMinutes(error)).toBe(15);
  });

  it('rate-limits with 429 COMMON.GENERIC.RATE_LIMITED and no details, before validation', async () => {
    const error = await failure(login({ email: FAKE_ACCOUNTS.rateLimited.email, password: '' }, false));

    expect([error.status, error.code, error.details]).toEqual([429, 'COMMON.GENERIC.RATE_LIMITED', undefined]);
    expect(loginErrorKey(error)).toBe('RATE_LIMITED');
    expect(retryAfterMinutes(error)).toBe(0);
  });

  it('fails validation with 400 CORE_VALIDATION_FAILED keyed by field', async () => {
    const error = await failure(login({ email: 'not-an-email', password: 'x'.repeat(129) }, false));

    expect([error.status, error.code]).toEqual([400, 'CORE_VALIDATION_FAILED']);
    expect(error.details).toEqual({ email: ['is_email'], password: ['max_length'] });
  });
});

describe('login error helpers', () => {
  it('maps unknown codes and non-API errors to UNKNOWN', () => {
    expect(loginErrorKey(new ApiError(503, 'COMMON.GENERIC.INTERNAL_ERROR'))).toBe('UNKNOWN');
    expect(loginErrorKey(new Error('boom'))).toBe('UNKNOWN');
  });

  it('rounds retryAfterSeconds up to whole minutes', () => {
    expect(retryAfterMinutes(new ApiError(429, 'AUTH_MFA_THROTTLED', { retryAfterSeconds: ['30'] }))).toBe(1);
    expect(retryAfterMinutes(new ApiError(429, 'AUTH_MFA_THROTTLED', { retryAfterSeconds: ['bad'] }))).toBe(0);
  });
});

import { ApiError } from '../../../core/api/api-errors';
import { fakeMarkSignedIn } from '../../../core/auth/auth-session.fake';
import { registerFakeChallenge } from '../shared/mfa-challenge.fake';
import { LOGIN_LIMITS, LoginBody, LoginResult } from './login.model';

/** Phase 3 test accounts. Test passwords live only in this fake. */
export const FAKE_ACCOUNTS = {
  valid: { email: 'owner@mutakamel.io', password: 'Mutakamel@2026' },
  mfa: { email: 'mfa@mutakamel.io', password: 'Mutakamel@2026' },
  throttled: { email: 'locked@mutakamel.io' },
  rateLimited: { email: 'busy@mutakamel.io' },
};

/** LoginThrottledException carries the lockout window in seconds. */
export const FAKE_LOCKOUT_SECONDS = 900;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HOUR_MS = 3_600_000;

/**
 * POST /tenant/auth/login, in the backend order: IP throttler guard, then the
 * ValidationPipe, then the service (lockout budget, then the credentials).
 * `remember` is the x-auth-remember header; it only changes cookie lifetimes.
 */
export async function fakeLogin(body: LoginBody, remember: boolean): Promise<LoginResult> {
  await new Promise((resolve) => setTimeout(resolve, 600));
  const email = body.email.trim().toLowerCase();

  // Nest throttler: the filter falls back to the status code; Retry-After header, no details.
  if (email === FAKE_ACCOUNTS.rateLimited.email) throw new ApiError(429, 'COMMON.GENERIC.RATE_LIMITED');
  assertLoginBody(email, body.password);
  if (email === FAKE_ACCOUNTS.throttled.email) {
    throw new ApiError(429, 'AUTH_LOGIN_THROTTLED', { retryAfterSeconds: [String(FAKE_LOCKOUT_SECONDS)] });
  }
  if (email === FAKE_ACCOUNTS.mfa.email && body.password === FAKE_ACCOUNTS.mfa.password) {
    return registerFakeChallenge({ remember });
  }
  if (email === FAKE_ACCOUNTS.valid.email && body.password === FAKE_ACCOUNTS.valid.password) {
    fakeMarkSignedIn();
    return fakeSession();
  }
  throw new ApiError(401, 'INVALID_CREDENTIALS');
}

/** Core ValidationPipe: 400 CORE_VALIDATION_FAILED, details keyed by DTO property. */
function assertLoginBody(email: string, password: string): void {
  const details: Record<string, string[]> = {};
  if (email.length > LOGIN_LIMITS.emailMax) details['email'] = ['max_length'];
  else if (!EMAIL_PATTERN.test(email)) details['email'] = ['is_email'];
  if (password.length < 1) details['password'] = ['min_length'];
  else if (password.length > LOGIN_LIMITS.passwordMax) details['password'] = ['max_length'];
  if (Object.keys(details).length) throw new ApiError(400, 'CORE_VALIDATION_FAILED', details);
}

function fakeSession(): LoginResult {
  const now = Date.now();
  return {
    tokenType: 'Bearer',
    expiresIn: 600,
    sessionExpiresIn: 43200,
    session: {
      id: '019f0000-0000-7000-8000-000000000001',
      clientId: 'mutakamel-tenant-web',
      clientType: 'WEB',
      createdAt: new Date(now).toISOString(),
      lastRefreshAt: null,
      lastUserActivityAt: null,
      idleExpiresAt: new Date(now + 12 * HOUR_MS).toISOString(),
      absoluteExpiresAt: new Date(now + 24 * HOUR_MS).toISOString(),
      refreshUseCount: '0',
      accessIssueCount: '1',
      credentialVersion: 1,
      authorizationVersion: 1,
      profileVersion: 1,
    },
  };
}

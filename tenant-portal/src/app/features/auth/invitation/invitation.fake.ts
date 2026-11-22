import { ApiError } from '../../../core/api/api-errors';
import { fakeMarkSignedIn } from '../../../core/auth/auth-session.fake';
import type { LoginSession, MfaStep } from '../../../core/auth/auth-session.model';
import { fakeDelay } from '../../../core/fake/fake-utils';
import { ACTION_TOKEN_MAX, ACTION_TOKEN_MIN } from '../shared/action-token';
import { registerFakeChallenge } from '../shared/mfa-challenge.fake';
import { PASSWORD_MAX, PASSWORD_MIN, allChecksPass, passwordChecks } from '../shared/password-policy';

// FAKE-ONLY: Phase 3 test invitation tokens and invited user. Tokens live only in this fake.
export const FAKE_INVITE_TOKENS = {
  valid: 'fake-invite-token-valid-000000001',
  mfa: 'fake-invite-token-mfa-0000000001',
  pastDue: 'fake-invite-token-pastdue-000001',
  used: 'fake-invite-token-used-000000001',
} as const;

export type FakeInviteNext = 'THROTTLED' | 'MAINTENANCE' | 'MFA_UNAVAILABLE' | 'SESSION_LIMIT' | null;

const FAKE_INVITED_USER = {
  email: 'sara@mutakamel.io',
  firstName: 'Sara',
  lastName: 'Ahmed',
} as const;

const USABLE_TOKENS: ReadonlySet<string> = new Set([
  FAKE_INVITE_TOKENS.valid,
  FAKE_INVITE_TOKENS.mfa,
  FAKE_INVITE_TOKENS.pastDue,
]);

const COMMON_WEAK_PASSWORDS: ReadonlySet<string> = new Set([
  'Password123!',
  'Qwerty123456!',
]);

const IDENTITY_TERMS: readonly string[] = Array.from(
  new Set([
    FAKE_INVITED_USER.email.split('@')[0].toLowerCase(),
    FAKE_INVITED_USER.firstName.toLowerCase(),
    FAKE_INVITED_USER.lastName.toLowerCase(),
  ]),
);

const HOUR_MS = 3_600_000;

const usedTokens = new Set<string>();
let nextFlag: FakeInviteNext = null;
let nextError: unknown = null;
let callCount = 0;

function consumeInjectedFailure(): void {
  if (nextError !== null) {
    const err = nextError;
    nextError = null;
    throw err;
  }

  const flag = nextFlag;
  nextFlag = null;
  if (flag === 'THROTTLED') {
    throw new ApiError(429, 'AUTH_MFA_THROTTLED', { retryAfterSeconds: ['30'] });
  }
  if (flag === 'MAINTENANCE') {
    throw new ApiError(503, 'PLATFORM_MAINTENANCE');
  }
  if (flag === 'MFA_UNAVAILABLE') {
    throw new ApiError(503, 'AUTH_MFA_UNAVAILABLE');
  }
  if (flag === 'SESSION_LIMIT') {
    throw new ApiError(409, 'AUTH_SESSION_LIMIT_REACHED');
  }
}

function buildFakeSession(now: number): LoginSession {
  return {
    tokenType: 'Bearer',
    expiresIn: 600,
    sessionExpiresIn: 43200,
    session: {
      id: '019f0000-0000-7000-8000-000000000002',
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

export function setFakeInviteNext(code: FakeInviteNext): void {
  nextFlag = code;
}

export function setFakeInviteError(error: unknown): void {
  nextError = error;
}

export function fakeInviteCallCount(): number {
  return callCount;
}

export function resetFakeInvitations(): void {
  usedTokens.clear();
  nextFlag = null;
  nextError = null;
  callCount = 0;
}

/**
 * FAKE-ONLY: mocks POST /api/tenant/core/v1/auth/accept-invite in backend evaluation order.
 */
export async function fakeAcceptInvitation(token: string, newPassword: string): Promise<LoginSession | MfaStep> {
  callCount += 1;
  await fakeDelay(600);
  consumeInjectedFailure();

  // 1. DTO length checks (passwords > PASSWORD_MAX fall through to step 4 for 422 PASSWORD_TOO_LONG).
  const validationDetails: Record<string, string[]> = {};
  if (token.length < ACTION_TOKEN_MIN) {
    validationDetails['token'] = ['min_length'];
  } else if (token.length > ACTION_TOKEN_MAX) {
    validationDetails['token'] = ['max_length'];
  }
  if (newPassword.length < PASSWORD_MIN) {
    validationDetails['newPassword'] = ['min_length'];
  }
  if (Object.keys(validationDetails).length > 0) {
    throw new ApiError(400, 'CORE_VALIDATION_FAILED', validationDetails);
  }

  // 2. Token validity & single-use check.
  if (!USABLE_TOKENS.has(token) || usedTokens.has(token)) {
    throw new ApiError(400, 'INVALID_ACTION_TOKEN');
  }

  // 3. Past-due subscription check (token stays usable).
  if (token === FAKE_INVITE_TOKENS.pastDue) {
    throw new ApiError(403, 'SUBSCRIPTION_PAST_DUE');
  }

  // 4. Password policy checks.
  if (newPassword.length > PASSWORD_MAX) {
    throw new ApiError(422, 'PASSWORD_TOO_LONG');
  }
  const lower = newPassword.toLowerCase();
  if (
    !allChecksPass(passwordChecks(newPassword)) ||
    COMMON_WEAK_PASSWORDS.has(newPassword) ||
    IDENTITY_TERMS.some((term) => lower.includes(term))
  ) {
    throw new ApiError(422, 'WEAK_PASSWORD');
  }

  // 5. Claim token and issue session or MFA challenge.
  usedTokens.add(token);
  if (token === FAKE_INVITE_TOKENS.mfa) {
    return registerFakeChallenge({ remember: false });
  }

  fakeMarkSignedIn();
  return buildFakeSession(Date.now());
}

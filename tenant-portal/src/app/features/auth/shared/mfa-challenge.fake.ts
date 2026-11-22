import { ApiError } from '../../../core/api/api-errors';
import { fakeMarkSignedIn } from '../../../core/auth/auth-session.fake';
import type { LoginSession, MfaStep } from '../../../core/auth/auth-session.model';

// FAKE-ONLY: Phase 3 shared MFA challenge registry for login, verify and invitation fakes.
export const FAKE_MFA_CODE = '123456';

export type FakeMfaNext = 'THROTTLED' | 'UNAVAILABLE' | 'PAST_DUE' | 'SESSION_LIMIT' | null;

interface FakeMfaChallenge {
  remember: boolean;
  deadline: number;
  attempts: number;
  resendAt: number;
  sends: number;
}

const CHALLENGE_TTL_MS = 600_000;
const RESEND_COOLDOWN_MS = 60_000;
const SEND_LIMIT_COOLDOWN_SECONDS = 300;
const MAX_ATTEMPTS = 5;
const MAX_SENDS = 3;
const HOUR_MS = 3_600_000;
const URL_SAFE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const challenges = new Map<string, FakeMfaChallenge>();
let nextFlag: FakeMfaNext = null;

function generateChallengeId(): string {
  const bytes = new Uint8Array(43);
  crypto.getRandomValues(bytes);
  let id = '';
  for (const byte of bytes) {
    id += URL_SAFE_CHARS[byte & 63];
  }
  return id;
}

function consumeNextFlag(): void {
  const flag = nextFlag;
  nextFlag = null;
  if (flag === 'THROTTLED') {
    throw new ApiError(429, 'AUTH_MFA_THROTTLED', { retryAfterSeconds: ['30'] });
  }
  if (flag === 'UNAVAILABLE') {
    throw new ApiError(503, 'AUTH_MFA_UNAVAILABLE');
  }
  if (flag === 'PAST_DUE') {
    throw new ApiError(403, 'SUBSCRIPTION_PAST_DUE');
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

export function setFakeMfaNext(code: FakeMfaNext): void {
  nextFlag = code;
}

export function resetFakeChallenges(): void {
  challenges.clear();
  nextFlag = null;
}

export function registerFakeChallenge(opts: { remember: boolean }): MfaStep {
  const now = Date.now();
  const challengeId = generateChallengeId();
  challenges.set(challengeId, {
    remember: opts.remember,
    deadline: now + CHALLENGE_TTL_MS,
    attempts: MAX_ATTEMPTS,
    resendAt: now + RESEND_COOLDOWN_MS,
    sends: 1,
  });
  return {
    mfaRequired: true,
    challengeId,
    expiresIn: Math.floor(CHALLENGE_TTL_MS / 1000),
    resendAfterSeconds: Math.floor(RESEND_COOLDOWN_MS / 1000),
  };
}

export function fakeVerifyChallenge(challengeId: string, code: string): LoginSession {
  consumeNextFlag();
  const now = Date.now();
  const challenge = challenges.get(challengeId);
  if (!challenge || now >= challenge.deadline) {
    if (challenge) challenges.delete(challengeId);
    throw new ApiError(401, 'AUTH_MFA_INVALID_CHALLENGE');
  }

  if (code !== FAKE_MFA_CODE) {
    challenge.attempts -= 1;
    if (challenge.attempts <= 0) {
      challenges.delete(challengeId);
    }
    throw new ApiError(401, 'AUTH_MFA_INVALID_CHALLENGE');
  }

  challenges.delete(challengeId);
  fakeMarkSignedIn();
  return buildFakeSession(now);
}

export function fakeResendChallenge(challengeId: string): MfaStep {
  consumeNextFlag();
  const now = Date.now();
  const challenge = challenges.get(challengeId);
  if (!challenge || now >= challenge.deadline) {
    if (challenge) challenges.delete(challengeId);
    throw new ApiError(401, 'AUTH_MFA_INVALID_CHALLENGE');
  }

  if (now < challenge.resendAt) {
    const remaining = Math.max(1, Math.ceil((challenge.resendAt - now) / 1000));
    throw new ApiError(429, 'AUTH_MFA_THROTTLED', { retryAfterSeconds: [String(remaining)] });
  }

  if (challenge.sends >= MAX_SENDS) {
    throw new ApiError(429, 'AUTH_MFA_THROTTLED', { retryAfterSeconds: [String(SEND_LIMIT_COOLDOWN_SECONDS)] });
  }

  challenge.sends += 1;
  challenge.resendAt = now + RESEND_COOLDOWN_MS;
  return {
    mfaRequired: true,
    challengeId,
    expiresIn: Math.max(1, Math.ceil((challenge.deadline - now) / 1000)),
    resendAfterSeconds: Math.floor(RESEND_COOLDOWN_MS / 1000),
  };
}

import { ApiError } from '../../../../core/api/api-errors';
import { fakeDelay } from '../../../../core/fake/fake-utils';
import {
  ChangePasswordBody,
  MFA_CODE_PATTERN,
  MfaStep,
  PASSWORD_MAX,
  PASSWORD_MIN,
  SecurityMe,
  allPasswordChecksPass,
  passwordChecks,
} from './security.model';

export let FAKE_MFA_UNAVAILABLE = false;
export let FAKE_THROTTLE_NEXT = false;
export let FAKE_SECURITY_FAIL_NEXT = false;

export function setFakeMfaUnavailable(value: boolean): void {
  FAKE_MFA_UNAVAILABLE = value;
}

export function setFakeThrottleNext(value: boolean): void {
  FAKE_THROTTLE_NEXT = value;
}

export function setFakeSecurityFailNext(value: boolean): void {
  FAKE_SECURITY_FAIL_NEXT = value;
}

interface FakeMfaChallenge {
  id: string;
  enabled: boolean;
  deadline: number;
  attempts: number;
  resendAt: number;
}

const CHALLENGE_TTL_MS = 600_000;
const RESEND_COOLDOWN_MS = 60_000;
const MAX_MFA_ATTEMPTS = 5;
const URL_SAFE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const CHALLENGE_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;
// Stand-ins for the backend common-password list and the "contains your name or e-mail" rule.
const WEAK_PASSWORDS = new Set(['Password123!', 'Qwerty123456!']);
const FAKE_IDENTITY_PARTS = ['owner', 'kamal', 'radwan'];

// Fake credentials for Phase 3 mock state only; never shipped to production.
const INITIAL_FAKE_PASSWORD = 'Current#Pass1';
const FAKE_MFA_CODE = '123456';

let meState: SecurityMe = {
  id: 'usr-owner-1',
  email: 'owner@mutakamel.io',
  mfaEnabled: false,
  mfaUpdatedAt: null,
};

let storedPassword = INITIAL_FAKE_PASSWORD;
const challenges = new Map<string, FakeMfaChallenge>();

export function resetSecurityFake(): void {
  meState = {
    id: 'usr-owner-1',
    email: 'owner@mutakamel.io',
    mfaEnabled: false,
    mfaUpdatedAt: null,
  };
  storedPassword = INITIAL_FAKE_PASSWORD;
  challenges.clear();
  FAKE_MFA_UNAVAILABLE = false;
  FAKE_THROTTLE_NEXT = false;
  FAKE_SECURITY_FAIL_NEXT = false;
}

function generateChallengeId(): string {
  const bytes = new Uint8Array(43);
  crypto.getRandomValues(bytes);
  let id = '';
  for (const byte of bytes) {
    id += URL_SAFE_CHARS[byte & 63];
  }
  return id;
}

// Core ValidationPipe: 400 CORE_VALIDATION_FAILED, details keyed by DTO property (string arrays).
function validationFailed(details: Record<string, string[]>): ApiError {
  return new ApiError(400, 'CORE_VALIDATION_FAILED', details);
}

// Nest throttler (5/min on change-password): no app code, so the filter falls back to the status code.
function rateLimited(): ApiError {
  return new ApiError(429, 'COMMON.GENERIC.RATE_LIMITED');
}

// MfaThrottledException: details values are string arrays, like every backend detail.
function mfaThrottled(retryAfterSeconds: number): ApiError {
  return new ApiError(429, 'AUTH_MFA_THROTTLED', { retryAfterSeconds: [String(retryAfterSeconds)] });
}

// Backend `invalid()`: UnauthorizedException('AUTH_MFA_INVALID_CHALLENGE'), 401 in the error catalogue.
function invalidChallenge(): ApiError {
  return new ApiError(401, 'AUTH_MFA_INVALID_CHALLENGE');
}

function assertChallengeId(challengeId: string): void {
  if (!CHALLENGE_ID_PATTERN.test(challengeId)) throw validationFailed({ challengeId: ['matches'] });
}

function isWeakPassword(password: string): boolean {
  const lower = password.toLowerCase();
  return WEAK_PASSWORDS.has(password) || FAKE_IDENTITY_PARTS.some((part) => lower.includes(part));
}

function consumeFailNext(): void {
  if (!FAKE_SECURITY_FAIL_NEXT) return;
  FAKE_SECURITY_FAIL_NEXT = false;
  throw new ApiError(500, 'INTERNAL_ERROR');
}

export async function fakeGetSecurityMe(): Promise<SecurityMe> {
  await fakeDelay();
  consumeFailNext();
  return { ...meState };
}

export async function fakeChangePassword(body: ChangePasswordBody): Promise<void> {
  await fakeDelay();
  consumeFailNext();
  // Guards (throttle) run before the ValidationPipe, which runs before the service.
  if (FAKE_THROTTLE_NEXT) {
    FAKE_THROTTLE_NEXT = false;
    throw rateLimited();
  }
  const details: Record<string, string[]> = {};
  if (!body.currentPassword || body.currentPassword.length > PASSWORD_MAX) {
    details['currentPassword'] = [body.currentPassword ? 'max_length' : 'min_length'];
  }
  const newChecks: string[] = [];
  if (body.newPassword.length < PASSWORD_MIN) newChecks.push('min_length');
  if (body.newPassword.length > PASSWORD_MAX) newChecks.push('max_length');
  // IsStrongPassword covers the character classes; the length rules are their own constraints above.
  if (!allPasswordChecksPass({ ...passwordChecks(body.newPassword), length: true })) newChecks.push('is_strong_password');
  if (newChecks.length > 0) details['newPassword'] = newChecks;
  if (Object.keys(details).length > 0) throw validationFailed(details);

  if (body.currentPassword !== storedPassword) {
    throw new ApiError(422, 'CURRENT_PASSWORD_INVALID');
  }
  if (isWeakPassword(body.newPassword)) {
    throw new ApiError(422, 'WEAK_PASSWORD');
  }
  storedPassword = body.newPassword;
}

export async function fakeStartMfa(enabled: boolean, currentPassword: string): Promise<MfaStep> {
  await fakeDelay();
  consumeFailNext();
  if (FAKE_MFA_UNAVAILABLE) {
    throw new ApiError(503, 'AUTH_MFA_UNAVAILABLE');
  }
  if (FAKE_THROTTLE_NEXT) {
    FAKE_THROTTLE_NEXT = false;
    throw mfaThrottled(30);
  }
  if (!currentPassword || currentPassword.length > 1024) {
    throw validationFailed({ currentPassword: [currentPassword ? 'max_length' : 'min_length'] });
  }
  // Asking for the state the account already has is an invalid challenge (checked before the password).
  if (meState.mfaEnabled === enabled) {
    throw invalidChallenge();
  }
  if (currentPassword !== storedPassword) {
    throw new ApiError(422, 'CURRENT_PASSWORD_INVALID');
  }

  const now = Date.now();
  const challenge: FakeMfaChallenge = {
    id: generateChallengeId(),
    enabled,
    deadline: now + CHALLENGE_TTL_MS,
    attempts: MAX_MFA_ATTEMPTS,
    resendAt: now + RESEND_COOLDOWN_MS,
  };
  challenges.set(challenge.id, challenge);
  return {
    mfaRequired: true,
    challengeId: challenge.id,
    expiresIn: Math.floor(CHALLENGE_TTL_MS / 1000),
    resendAfterSeconds: Math.floor(RESEND_COOLDOWN_MS / 1000),
  };
}

export async function fakeResendMfa(challengeId: string): Promise<MfaStep> {
  await fakeDelay();
  consumeFailNext();
  assertChallengeId(challengeId);
  if (FAKE_MFA_UNAVAILABLE) {
    throw new ApiError(503, 'AUTH_MFA_UNAVAILABLE');
  }
  if (FAKE_THROTTLE_NEXT) {
    FAKE_THROTTLE_NEXT = false;
    throw mfaThrottled(30);
  }

  const now = Date.now();
  const challenge = challenges.get(challengeId);
  if (!challenge || now >= challenge.deadline) {
    if (challenge) challenges.delete(challengeId);
    throw invalidChallenge();
  }
  if (now < challenge.resendAt) {
    throw mfaThrottled(Math.max(1, Math.ceil((challenge.resendAt - now) / 1000)));
  }

  challenge.resendAt = now + RESEND_COOLDOWN_MS;
  return {
    mfaRequired: true,
    challengeId: challenge.id,
    expiresIn: Math.max(1, Math.ceil((challenge.deadline - now) / 1000)),
    resendAfterSeconds: Math.floor(RESEND_COOLDOWN_MS / 1000),
  };
}

export async function fakeConfirmMfa(challengeId: string, code: string): Promise<void> {
  await fakeDelay();
  consumeFailNext();
  const details: Record<string, string[]> = {};
  if (!CHALLENGE_ID_PATTERN.test(challengeId)) details['challengeId'] = ['matches'];
  if (!MFA_CODE_PATTERN.test(code)) details['code'] = ['matches'];
  if (Object.keys(details).length > 0) throw validationFailed(details);
  if (FAKE_MFA_UNAVAILABLE) {
    throw new ApiError(503, 'AUTH_MFA_UNAVAILABLE');
  }
  if (FAKE_THROTTLE_NEXT) {
    FAKE_THROTTLE_NEXT = false;
    throw mfaThrottled(30);
  }

  const now = Date.now();
  const challenge = challenges.get(challengeId);
  if (!challenge || now >= challenge.deadline) {
    if (challenge) challenges.delete(challengeId);
    throw invalidChallenge();
  }
  if (code !== FAKE_MFA_CODE) {
    challenge.attempts -= 1;
    if (challenge.attempts <= 0) {
      challenges.delete(challengeId);
    }
    throw invalidChallenge();
  }

  meState = {
    ...meState,
    mfaEnabled: challenge.enabled,
    mfaUpdatedAt: new Date(now).toISOString(),
  };
  challenges.delete(challengeId);
}

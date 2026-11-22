import { ApiError } from '../../../core/api/api-errors';
import { fakeDelay } from '../../../core/fake/fake-utils';
import { ACTION_TOKEN_MAX, ACTION_TOKEN_MIN } from '../shared/action-token';
import { PASSWORD_MAX, allChecksPass, passwordChecks } from '../shared/password-policy';
import { RESET_LIMITS } from './reset-password.model';

/** FAKE-ONLY: Phase 3 password reset test tokens. Real tokens arrive only in email fragments. */
export const FAKE_RESET_TOKENS = {
  valid: 'fake-reset-token-valid-0000000001',
  expired: 'fake-reset-token-expired-000000001',
} as const;

/** FAKE-ONLY: identity details used to simulate server-side WEAK_PASSWORD identity checks. */
export const FAKE_RESET_USER = {
  email: 'owner@mutakamel.io',
  firstName: 'Kamal',
  lastName: 'Radwan',
} as const;

/** FAKE-ONLY: email address that triggers 429 COMMON.GENERIC.RATE_LIMITED on forgot-password. */
export const FAKE_RATE_LIMITED_EMAIL = 'busy@mutakamel.io';

export type FakeResetNext = 'UNAVAILABLE' | 'RATE_LIMITED' | 'NETWORK' | null;

const COMMON_PASSWORDS = new Set(['password123!', 'qwerty123456!']);
const IDENTITY_TERMS = ['owner', 'kamal', 'radwan'] as const;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const usedTokens = new Set<string>();
let nextFailure: FakeResetNext = null;
const calls = { request: 0, reset: 0 };

/** FAKE-ONLY: injects a one-shot error for the next forgot-password or reset-password call. */
export function setFakeResetNext(next: FakeResetNext): void {
  nextFailure = next;
}

export function fakeResetCallCounts(): { request: number; reset: number } {
  return { ...calls };
}

export function resetFakeResetPassword(): void {
  usedTokens.clear();
  nextFailure = null;
  calls.request = 0;
  calls.reset = 0;
}

function consumeNextFailure(): void {
  const injected = nextFailure;
  nextFailure = null;
  if (injected === 'UNAVAILABLE') {
    throw ApiError.fromResponse(503, {});
  }
  if (injected === 'RATE_LIMITED') {
    throw new ApiError(429, 'COMMON.GENERIC.RATE_LIMITED');
  }
  if (injected === 'NETWORK') {
    throw ApiError.fromResponse(0, {});
  }
}

/**
 * FAKE-ONLY: POST /api/tenant/core/v1/auth/forgot-password (204 -> undefined).
 * Pads latency to 650 ms and resolves identically for known and unknown emails.
 */
export async function fakeRequestResetLink(email: string): Promise<void> {
  calls.request += 1;
  await fakeDelay(650);
  consumeNextFailure();

  const normalized = email.trim().toLowerCase();
  if (normalized === FAKE_RATE_LIMITED_EMAIL) {
    throw new ApiError(429, 'COMMON.GENERIC.RATE_LIMITED');
  }
  if (normalized.length > RESET_LIMITS.emailMax) {
    throw new ApiError(400, 'CORE_VALIDATION_FAILED', { email: ['max_length'] });
  }
  if (!EMAIL_PATTERN.test(normalized)) {
    throw new ApiError(400, 'CORE_VALIDATION_FAILED', { email: ['is_email'] });
  }
}

/**
 * FAKE-ONLY: POST /api/tenant/core/v1/auth/reset-password (204 -> undefined).
 * Valid token works once, then behaves as expired (400 INVALID_ACTION_TOKEN).
 */
export async function fakeResetPassword(token: string, newPassword: string): Promise<void> {
  calls.reset += 1;
  await fakeDelay(500);
  consumeNextFailure();

  if (token.length < ACTION_TOKEN_MIN) {
    throw new ApiError(400, 'CORE_VALIDATION_FAILED', { token: ['min_length'] });
  }
  if (token.length > ACTION_TOKEN_MAX) {
    throw new ApiError(400, 'CORE_VALIDATION_FAILED', { token: ['max_length'] });
  }
  if (token !== FAKE_RESET_TOKENS.valid || usedTokens.has(token)) {
    throw new ApiError(400, 'INVALID_ACTION_TOKEN');
  }
  if (newPassword.length > PASSWORD_MAX) {
    throw new ApiError(422, 'PASSWORD_TOO_LONG');
  }

  const lower = newPassword.toLowerCase();
  if (
    !allChecksPass(passwordChecks(newPassword)) ||
    COMMON_PASSWORDS.has(lower) ||
    IDENTITY_TERMS.some((term) => lower.includes(term))
  ) {
    throw new ApiError(422, 'WEAK_PASSWORD');
  }

  usedTokens.add(token);
}

import { ApiError } from '../../../core/api/api-errors';
import type { LoginSession, MfaStep } from '../../../core/auth/auth-session.model';
import { fakeDelay } from '../../../core/fake/fake-utils';
import { fakeResendChallenge, fakeVerifyChallenge } from '../shared/mfa-challenge.fake';
import { MFA_CHALLENGE_ID_PATTERN, MFA_CODE_PATTERN } from './verify.model';

// FAKE-ONLY: Phase 3 wrapper around the shared MFA challenge registry.
let nextError: unknown = null;
const calls = { verify: 0, resend: 0 };

export function setFakeVerifyError(error: unknown): void {
  nextError = error;
}

export function fakeVerifyCallCounts(): { verify: number; resend: number } {
  return { ...calls };
}

export function resetFakeVerify(): void {
  nextError = null;
  calls.verify = 0;
  calls.resend = 0;
}

function consumeInjectedError(): void {
  if (nextError === null) return;
  const err = nextError;
  nextError = null;
  throw err;
}

export async function fakeVerifyCode(challengeId: string, code: string): Promise<LoginSession> {
  calls.verify += 1;
  await fakeDelay(600);
  consumeInjectedError();

  const details: Record<string, string[]> = {};
  if (!MFA_CHALLENGE_ID_PATTERN.test(challengeId)) {
    details['challengeId'] = ['matches'];
  }
  if (!MFA_CODE_PATTERN.test(code)) {
    details['code'] = ['matches'];
  }
  if (Object.keys(details).length > 0) {
    throw new ApiError(400, 'CORE_VALIDATION_FAILED', details);
  }

  return fakeVerifyChallenge(challengeId, code);
}

export async function fakeResendCode(challengeId: string): Promise<MfaStep> {
  calls.resend += 1;
  await fakeDelay(300);
  consumeInjectedError();

  if (!MFA_CHALLENGE_ID_PATTERN.test(challengeId)) {
    throw new ApiError(400, 'CORE_VALIDATION_FAILED', { challengeId: ['matches'] });
  }

  return fakeResendChallenge(challengeId);
}

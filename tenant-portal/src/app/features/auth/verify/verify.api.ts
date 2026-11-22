import type { LoginSession, MfaStep } from '../../../core/auth/auth-session.model';
import { fakeResendCode, fakeVerifyCode } from './verify.fake';

/**
 * POST /api/tenant/core/v1/auth/mfa/verify → `data` (`LoginSession`).
 * - Gateway row `core.tenant.auth.mfa.verify`: PUBLIC, idempotencyMode NONE, transportRetryMode NEVER.
 * - Sends `{ challengeId, code }` with `credentials: 'include'` (HttpOnly MFA cookie); no `x-idempotency-key`,
 *   no `x-auth-remember`, never retry automatically, never log `code`.
 */
export function verifyCode(challengeId: string, code: string): Promise<LoginSession> {
  return fakeVerifyCode(challengeId, code);
}

/**
 * POST /api/tenant/core/v1/auth/mfa/resend → `data` (`MfaStep` keeping the original deadline).
 * - Gateway row `core.tenant.auth.mfa.resend`: PUBLIC, idempotencyMode NONE, transportRetryMode NEVER.
 * - Sends `{ challengeId }` with `credentials: 'include'`; no `x-idempotency-key`, never retry automatically.
 */
export function resendCode(challengeId: string): Promise<MfaStep> {
  return fakeResendCode(challengeId);
}

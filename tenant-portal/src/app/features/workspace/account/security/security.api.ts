import {
  fakeChangePassword,
  fakeConfirmMfa,
  fakeGetSecurityMe,
  fakeResendMfa,
  fakeStartMfa,
} from './security.fake';
import { ChangePasswordBody, MfaStep, SecurityMe } from './security.model';

// Real browser base: /api/tenant/core/v1 (envelope { data }). Self-service. Security writes use the
// credentialed CSRF channel and must NEVER be replayed or auto-retried (no idempotency key).

export function getSecurityMe(): Promise<SecurityMe> {
  // GET /auth/me (private, no-store)
  return fakeGetSecurityMe();
}

export function changePassword(body: ChangePasswordBody): Promise<void> {
  // POST /auth/change-password → 200 (safe session metadata, not used); ends OTHER sessions;
  // 400 CORE_VALIDATION_FAILED (newPassword 12..128 + policy); 422 CURRENT_PASSWORD_INVALID|WEAK_PASSWORD;
  // 429 COMMON.GENERIC.RATE_LIMITED (5/min, Retry-After header, no details)
  return fakeChangePassword(body);
}

export function startMfaChange(enabled: boolean, currentPassword: string): Promise<MfaStep> {
  // POST /auth/mfa/settings/challenge → 200 step; 401 AUTH_MFA_INVALID_CHALLENGE (already in that state);
  // 422 CURRENT_PASSWORD_INVALID; 503 AUTH_MFA_UNAVAILABLE; 429 AUTH_MFA_THROTTLED (details.retryAfterSeconds: ['n'])
  return fakeStartMfa(enabled, currentPassword);
}

export function resendMfaCode(challengeId: string): Promise<MfaStep> {
  // POST /auth/mfa/settings/resend → same deadline; 401 AUTH_MFA_INVALID_CHALLENGE; 429 AUTH_MFA_THROTTLED
  return fakeResendMfa(challengeId);
}

export function confirmMfaChange(challengeId: string, code: string): Promise<void> {
  // POST /auth/mfa/settings/confirm → 204; ENDS EVERY SESSION incl. this one; 401 AUTH_MFA_INVALID_CHALLENGE
  return fakeConfirmMfa(challengeId, code);
}

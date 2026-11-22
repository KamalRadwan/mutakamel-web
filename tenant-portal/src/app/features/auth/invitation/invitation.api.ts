import type { LoginSession, MfaStep } from '../../../core/auth/auth-session.model';
import { fakeAcceptInvitation } from './invitation.fake';

/**
 * POST /api/tenant/core/v1/auth/accept-invite → the `data` part of the Core envelope.
 * - Gateway row: `core.tenant.auth.accept-invite`, `routeClass: PUBLIC`, `idempotent: false`.
 * - No `x-idempotency-key`; never retry automatically (token is single-use).
 * - Phase 5 adds `x-csrf-token` on non-GET auth writes. Never log the token or `newPassword`.
 * - Success (200): `LoginSession` (remember is always false) or `MfaStep` (MFA cookie set).
 * - Errors: 400 INVALID_ACTION_TOKEN, 400 CORE_VALIDATION_FAILED, 422 WEAK_PASSWORD / PASSWORD_TOO_LONG,
 *   403 SUBSCRIPTION_PAST_DUE, 409 AUTH_SESSION_LIMIT_REACHED, 429 AUTH_MFA_THROTTLED / COMMON.GENERIC.RATE_LIMITED /
 *   GW.RATE.LIMIT_EXCEEDED, 404 TENANT_NOT_RESOLVABLE, 503 PLATFORM_MAINTENANCE / AUTH_MFA_UNAVAILABLE.
 */
export function acceptInvitation(token: string, newPassword: string): Promise<LoginSession | MfaStep> {
  return fakeAcceptInvitation(token, newPassword);
}

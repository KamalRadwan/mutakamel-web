import { authTransport } from '../../../core/auth/auth-transport';
import type { ForgotPasswordBody, ResetPasswordBody } from './reset-password.model';

/**
 * POST /api/tenant/core/v1/auth/forgot-password → 204 (`undefined`).
 * - Gateway row `core.tenant.auth.forgot-password`: `routeClass: PUBLIC`, `idempotent: false`.
 * - No `x-idempotency-key` and no automatic retry.
 * - Public cookie channel; no session CSRF header is required.
 * - Errors: 400 CORE_VALIDATION_FAILED (email), 404 TENANT_NOT_RESOLVABLE,
 *   429 COMMON.GENERIC.RATE_LIMITED / GW.RATE.LIMIT_EXCEEDED, 503 (no code).
 */
export function requestResetLink(email: string, transport = authTransport()): Promise<void> {
  const body: ForgotPasswordBody = { email };
  return transport.requestNoContent('forgot-password', body);
}

/**
 * POST /api/tenant/core/v1/auth/reset-password → 204 (`undefined`).
 * - Gateway row `core.tenant.auth.reset-password`: `routeClass: PUBLIC`, `idempotent: false`.
 * - Body: `{ token, newPassword }`; never log either value.
 * - No `x-idempotency-key` and no automatic retry.
 * - Public cookie channel; no session CSRF header is required.
 * - Errors: 400 INVALID_ACTION_TOKEN, 400 CORE_VALIDATION_FAILED (token | newPassword),
 *   422 WEAK_PASSWORD / PASSWORD_TOO_LONG, 404 TENANT_NOT_RESOLVABLE,
 *   429 COMMON.GENERIC.RATE_LIMITED / GW.RATE.LIMIT_EXCEEDED, 503 (no code).
 */
export function resetPassword(token: string, newPassword: string, transport = authTransport()): Promise<void> {
  const body: ResetPasswordBody = { token, newPassword };
  return transport.requestNoContent('reset-password', body);
}

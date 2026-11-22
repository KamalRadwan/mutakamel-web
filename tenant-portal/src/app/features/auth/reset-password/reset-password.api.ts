import { fakeRequestResetLink, fakeResetPassword } from './reset-password.fake';

/**
 * POST /api/tenant/core/v1/auth/forgot-password → 204 (`undefined`).
 * - Gateway row `core.tenant.auth.forgot-password`: `routeClass: PUBLIC`, `idempotent: false`.
 * - No `x-idempotency-key` and no automatic retry.
 * - Phase 5 HTTP client sends `x-csrf-token` from the readable CSRF cookie.
 * - Errors: 400 CORE_VALIDATION_FAILED (email), 404 TENANT_NOT_RESOLVABLE,
 *   429 COMMON.GENERIC.RATE_LIMITED / GW.RATE.LIMIT_EXCEEDED, 503 (no code).
 */
export function requestResetLink(email: string): Promise<void> {
  return fakeRequestResetLink(email);
}

/**
 * POST /api/tenant/core/v1/auth/reset-password → 204 (`undefined`).
 * - Gateway row `core.tenant.auth.reset-password`: `routeClass: PUBLIC`, `idempotent: false`.
 * - Body: `{ token, newPassword }`; never log either value.
 * - No `x-idempotency-key` and no automatic retry.
 * - Phase 5 HTTP client sends `x-csrf-token` from the readable CSRF cookie.
 * - Errors: 400 INVALID_ACTION_TOKEN, 400 CORE_VALIDATION_FAILED (token | newPassword),
 *   422 WEAK_PASSWORD / PASSWORD_TOO_LONG, 404 TENANT_NOT_RESOLVABLE,
 *   429 COMMON.GENERIC.RATE_LIMITED / GW.RATE.LIMIT_EXCEEDED, 503 (no code).
 */
export function resetPassword(token: string, newPassword: string): Promise<void> {
  return fakeResetPassword(token, newPassword);
}

import type { LoginSession, TenantMe } from './auth-session.model';
import { fakeGetMe, fakeLogout, fakeRefreshSession } from './auth-session.fake';

/**
 * GET /api/tenant/core/v1/auth/me → the `data` part of the Core envelope (`Cache-Control: private, no-store`).
 * - Gateway row `core.tenant.auth.me`: AUTHENTICATED, `transportRetryMode: NEVER`, no permission.
 * - Errors: 401 (COMMON.AUTH.*), 403 SESSION_IDENTITY_INACTIVE, 403 SUBSCRIPTION_PAST_DUE.
 */
export function getMe(): Promise<TenantMe> {
  return fakeGetMe();
}

/**
 * POST /api/tenant/core/v1/auth/refresh → the `data` part of the Core envelope (empty body).
 * - Gateway row `core.tenant.auth.refresh`: PUBLIC, `idempotent: false`.
 * - No `x-idempotency-key` and no automatic retry; single-flight per tab/browser via `AuthSession.refresh()`.
 * - Phase 5 HTTP client must send header `x-csrf-token` from readable cookie `__Host-mutakamel-tenant-csrf`
 *   (plain-http dev: `mutakamel-http-tenant-csrf`).
 * - Errors: 401 INVALID_REFRESH_TOKEN / AUTH_SESSION_IDLE_EXPIRED / AUTH_SESSION_ABSOLUTE_EXPIRED,
 *   403 SESSION_IDENTITY_INACTIVE / AUTH_CSRF_INVALID / SUBSCRIPTION_PAST_DUE, 429 COMMON.GENERIC.RATE_LIMITED.
 */
export function refreshSession(): Promise<LoginSession> {
  return fakeRefreshSession();
}

/**
 * POST /api/tenant/core/v1/auth/logout → 204 (`undefined`), empty body.
 * - Gateway row `core.tenant.auth.logout`: PUBLIC, `idempotent: true`.
 * - No `x-idempotency-key` and no automatic retry.
 * - Phase 5 HTTP client must send header `x-csrf-token` from readable cookie `__Host-mutakamel-tenant-csrf`
 *   (plain-http dev: `mutakamel-http-tenant-csrf`).
 * - Errors: 403 AUTH_CSRF_INVALID, 429.
 */
export function logout(): Promise<void> {
  return fakeLogout();
}

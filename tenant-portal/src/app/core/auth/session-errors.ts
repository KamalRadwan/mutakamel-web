import { ApiError } from '../api/api-errors';

/** Recoverable access failures. Missing or invalid access needs a CSRF cookie. */
export const REFRESHABLE_CODES: ReadonlySet<string> = new Set([
  'COMMON.AUTH.TOKEN_EXPIRED',
  'AUTH_AUTHORIZATION_STALE',
  'AUTH_PROFILE_STALE',
]);
const ACCESS_REQUIRING_CSRF = [
  'COMMON.AUTH.MISSING_BEARER_TOKEN',
  'GW.AUTH.MISSING_SESSION',
  'COMMON.AUTH.INVALID_ACCESS_TOKEN',
];

// Core's refresh controller expires the cookies for these responses.
const TERMINAL_REFRESH_CODES = new Set([
  'INVALID_REFRESH_TOKEN',
  'AUTH_SESSION_ENDED',
  'AUTH_SESSION_IDLE_EXPIRED',
  'AUTH_SESSION_ABSOLUTE_EXPIRED',
  'AUTH_SECURITY_STALE',
  'AUTH_SESSION_STALE',
  'SESSION_IDENTITY_INACTIVE',
]);

/**
 * Allow-list of error codes that end the session and route to /login?returnUrl=….
 * Other 401/403 codes (e.g. AUTH_MFA_INVALID_CHALLENGE, INVALID_CREDENTIALS) stay on their screen.
 */
export const SESSION_ENDED_CODES: ReadonlySet<string> = new Set([
  ...TERMINAL_REFRESH_CODES,
  ...ACCESS_REQUIRING_CSRF,
  'GW.AUTH.SESSION_REVOKED',
]);

export function isRefreshable(error: unknown, hasCsrfCookie = false): boolean {
  return error instanceof ApiError && error.status === 401 && (
    REFRESHABLE_CODES.has(error.code) || (hasCsrfCookie && ACCESS_REQUIRING_CSRF.includes(error.code))
  );
}

export function isSessionEnded(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403) && SESSION_ENDED_CODES.has(error.code);
}

export function refreshExpiresCookies(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403) &&
    TERMINAL_REFRESH_CODES.has(error.code);
}

export type RefreshFailureKind = 'ended' | 'transient';

/** 403 CSRF proof that can never match. A logout call would fail the same check. */
export function isCsrfRejection(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403 && [
    'AUTH_CSRF_INVALID', 'GW.AUTH.CSRF_INVALID', 'GW.AUTH.FORBIDDEN',
  ].includes(error.code);
}

export function refreshFailureKind(error: unknown): RefreshFailureKind {
  if (refreshExpiresCookies(error) || isCsrfRejection(error)) return 'ended';
  if (error instanceof ApiError && (error.status === 401 ||
      (error.status === 403 && error.code === 'SUBSCRIPTION_PAST_DUE'))) return 'ended';
  return 'transient';
}

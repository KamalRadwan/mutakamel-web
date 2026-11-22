import { ApiError } from '../api/api-errors';

/** Codes that mean "the access token expired; refresh once, then retry the request". */
export const REFRESHABLE_CODES: ReadonlySet<string> = new Set(['COMMON.AUTH.TOKEN_EXPIRED']);

/**
 * Allow-list of error codes that end the session and route to /login?returnUrl=….
 * Other 401/403 codes (e.g. AUTH_MFA_INVALID_CHALLENGE, INVALID_CREDENTIALS) stay on their screen.
 */
export const SESSION_ENDED_CODES: ReadonlySet<string> = new Set([
  'INVALID_REFRESH_TOKEN',
  'AUTH_SESSION_ENDED',
  'AUTH_SESSION_IDLE_EXPIRED',
  'AUTH_SESSION_ABSOLUTE_EXPIRED',
  'AUTH_SECURITY_STALE',
  'AUTH_SESSION_STALE',
  'SESSION_IDENTITY_INACTIVE',
  'COMMON.AUTH.INVALID_ACCESS_TOKEN',
  'COMMON.AUTH.MISSING_BEARER_TOKEN',
  'COMMON.GENERIC.UNAUTHORIZED',
]);

export function isRefreshable(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401 && REFRESHABLE_CODES.has(error.code);
}

export function isSessionEnded(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403) && SESSION_ENDED_CODES.has(error.code);
}

export type AuthFailureDisposition =
  | "refresh"
  | "end"
  | "forbidden"
  | "retain"
  | "none";

const SESSION_ENDING_AUTH_CODES = new Set([
  "AUTH_SESSION_ENDED",
  "AUTH_SESSION_IDLE_EXPIRED",
  "AUTH_SESSION_ABSOLUTE_EXPIRED",
  "AUTH_SECURITY_STALE",
  "AUTH_SESSION_STALE",
  "SESSION_IDENTITY_INACTIVE",
  "INVALID_REFRESH_TOKEN",
]);

export function getAuthErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as {
    status?: unknown;
    response?: { status?: unknown };
  };
  const status = candidate.status ?? candidate.response?.status;
  return typeof status === "number" ? status : undefined;
}

export function getAuthErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as {
    code?: unknown;
    errorCode?: unknown;
    response?: { data?: { code?: unknown; errorCode?: unknown } };
  };
  const code =
    candidate.code ??
    candidate.errorCode ??
    candidate.response?.data?.errorCode ??
    candidate.response?.data?.code;
  return typeof code === "string" ? code : undefined;
}

export function classifyAuthFailure(
  status: number | undefined,
  code?: string,
): AuthFailureDisposition {
  if (
    (status === 401 || status === 403) &&
    isSessionEndingAuthCode(code)
  ) {
    return "end";
  }
  if (status === 403) return "forbidden";
  if (status === 401) return "refresh";
  if (
    status === 404 ||
    status === 409 ||
    status === 429 ||
    status === undefined ||
    (status >= 500 && status <= 599)
  ) {
    return "retain";
  }
  return "none";
}

/**
 * Codes that mean "you presented no credentials", as distinct from "your
 * session ended". A visitor who has never signed in is not in a degraded
 * state — they are simply signed out, and belong on the login form.
 *
 * Without this distinction the bootstrap treated a plain 401 as "cannot verify
 * the session" and rendered the degraded retry screen, so a first-time visitor
 * never reached the login form at all. Verified against the running Gateway,
 * which answers `GET /auth/me` with exactly this code when no cookie is sent.
 */
const MISSING_CREDENTIAL_AUTH_CODES = new Set([
  "COMMON.AUTH.MISSING_BEARER_TOKEN",
  "MISSING_BEARER_TOKEN",
]);

export function isMissingCredentialsFailure(error: unknown): boolean {
  const code = getAuthErrorCode(error);
  return (
    getAuthErrorStatus(error) === 401 &&
    code !== undefined &&
    MISSING_CREDENTIAL_AUTH_CODES.has(code)
  );
}

export function isDefinitiveAuthFailure(error: unknown): boolean {
  const status = getAuthErrorStatus(error);
  return (
    (status === 401 || status === 403) &&
    isSessionEndingAuthCode(getAuthErrorCode(error))
  );
}

export function isSessionEndingAuthCode(code?: string): boolean {
  return code !== undefined && SESSION_ENDING_AUTH_CODES.has(code);
}

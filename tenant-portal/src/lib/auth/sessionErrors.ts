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
  if (status === 403) return "forbidden";
  if (status === 401 && isSessionEndingAuthCode(code)) return "end";
  if (status === 401) return "refresh";
  if (status === 429 || status === undefined || (status >= 500 && status <= 599)) {
    return "retain";
  }
  return "none";
}

export function isSessionEndingAuthCode(code?: string): boolean {
  return code !== undefined && SESSION_ENDING_AUTH_CODES.has(code);
}

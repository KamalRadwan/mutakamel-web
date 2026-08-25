import {
  axiosClient,
  ensureAdminCookieSessionFresh,
  type AuthSessionClientType,
  unwrapCoreData,
  withAuthLock,
} from "../api/axiosClient";

export interface AuthSessionSummary {
  id: string;
  clientId: string;
  clientType: AuthSessionClientType;
  deviceLabel: string | null;
  current: boolean;
  createdAt: string;
  lastRefreshAt: string | null;
  lastAccessIssuedAt: string;
  lastUserActivityAt: string | null;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  endedAt: string | null;
  endReason: string | null;
  refreshUseCount: string;
  accessIssueCount: string;
  credentialVersion: number;
  sessionEpoch: number;
}

interface AuthSessionList {
  items: AuthSessionSummary[];
}

export async function listAdminAuthSessions(): Promise<AuthSessionSummary[]> {
  const response = await axiosClient.get(
    "/api/admin/core/v1/auth/sessions",
    { cache: "no-store" },
  );
  const payload = unwrapCoreData<unknown>(response.data);
  return readAuthSessionList(payload).items;
}

export async function revokeAdminAuthSession(
  sessionId: string,
  currentSession: boolean,
): Promise<void> {
  const endpoint =
    `/api/admin/core/v1/auth/sessions/${encodeURIComponent(sessionId)}`;
  if (!currentSession) {
    await axiosClient.delete(endpoint, {
      skipAutoIdempotency: true,
      replayAfterRefresh: true,
    });
    return;
  }

  // Revoking the current session returns Clear-Cookie. Seed a fresh access
  // cookie first, then serialize the response with login/refresh/logout so a
  // delayed revocation cannot erase a newer session's fixed-name cookies.
  await ensureAdminCookieSessionFresh();
  await withAuthLock(() =>
    axiosClient.delete(endpoint, {
      skipAuthRefresh: true,
      skipAutoIdempotency: true,
    }));
}

function readAuthSessionList(value: unknown): AuthSessionList {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("INVALID_AUTH_SESSION_LIST");
  }

  const items = (value as { items?: unknown }).items;
  if (!Array.isArray(items)) throw new Error("INVALID_AUTH_SESSION_LIST");

  return { items: items.map(readAuthSessionSummary) };
}

function readAuthSessionSummary(value: unknown): AuthSessionSummary {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("INVALID_AUTH_SESSION");
  }
  const item = value as Record<string, unknown>;
  if (
    typeof item.id !== "string" ||
    !isClientId(item.clientId) ||
    !isClientType(item.clientType) ||
    !nullableString(item.deviceLabel) ||
    typeof item.current !== "boolean" ||
    typeof item.createdAt !== "string" ||
    !nullableString(item.lastRefreshAt) ||
    typeof item.lastAccessIssuedAt !== "string" ||
    !nullableString(item.lastUserActivityAt) ||
    typeof item.idleExpiresAt !== "string" ||
    typeof item.absoluteExpiresAt !== "string" ||
    !nullableString(item.endedAt) ||
    !nullableString(item.endReason) ||
    !decimalCounter(item.refreshUseCount) ||
    !decimalCounter(item.accessIssueCount) ||
    !positiveInteger(item.credentialVersion) ||
    !positiveInteger(item.sessionEpoch)
  ) {
    throw new Error("INVALID_AUTH_SESSION");
  }

  return {
    id: item.id,
    clientId: item.clientId,
    clientType: item.clientType,
    deviceLabel: item.deviceLabel as string | null,
    current: item.current,
    createdAt: item.createdAt,
    lastRefreshAt: item.lastRefreshAt as string | null,
    lastAccessIssuedAt: item.lastAccessIssuedAt,
    lastUserActivityAt: item.lastUserActivityAt as string | null,
    idleExpiresAt: item.idleExpiresAt,
    absoluteExpiresAt: item.absoluteExpiresAt,
    endedAt: item.endedAt as string | null,
    endReason: item.endReason as string | null,
    refreshUseCount: item.refreshUseCount,
    accessIssueCount: item.accessIssueCount,
    credentialVersion: item.credentialVersion,
    sessionEpoch: item.sessionEpoch,
  };
}

function nullableString(value: unknown): boolean {
  return value === null || typeof value === "string";
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function decimalCounter(value: unknown): value is string {
  return typeof value === "string" && /^(0|[1-9]\d*)$/.test(value);
}

function isClientId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/.test(value);
}

function isClientType(value: unknown): value is AuthSessionClientType {
  return value === "WEB" || value === "IOS" || value === "ANDROID" || value === "DESKTOP";
}

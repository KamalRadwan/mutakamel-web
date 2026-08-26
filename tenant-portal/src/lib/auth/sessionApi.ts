import {
  axiosClient,
  clearLocalTenantAuthState,
  getStoredTenantSessionMeta,
  type AuthSessionClientType,
  unwrapCoreData,
} from "../api/axiosClient";
import { publishTenantAuthEvent } from "./sessionCoordinator";

export interface TenantAuthSessionSummary {
  id: string;
  clientId: string;
  clientType: AuthSessionClientType;
  deviceLabel: string | null;
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
  current: boolean;
}

export async function listTenantAuthSessions(): Promise<TenantAuthSessionSummary[]> {
  const response = await axiosClient.get(
    "/api/tenant/core/v1/auth/sessions",
    { cache: "no-store" },
  );
  const payload = unwrapCoreData<unknown>(response.data);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("INVALID_AUTH_SESSION_LIST");
  }
  const items = (payload as { items?: unknown }).items;
  if (!Array.isArray(items)) throw new Error("INVALID_AUTH_SESSION_LIST");
  return items.map(readSession);
}

export async function revokeTenantAuthSession(
  session: TenantAuthSessionSummary,
): Promise<void> {
  await axiosClient.delete(
    `/api/tenant/core/v1/auth/sessions/${encodeURIComponent(session.id)}`,
    { skipAutoIdempotency: true, replayAfterRefresh: true },
  );
  if (!session.current || getStoredTenantSessionMeta()?.sessionId !== session.id) {
    return;
  }

  publishTenantAuthEvent("session-ended", session.id, true);
  if (getStoredTenantSessionMeta()?.sessionId === session.id) {
    clearLocalTenantAuthState();
  }
}

function readSession(value: unknown): TenantAuthSessionSummary {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("INVALID_AUTH_SESSION");
  }
  const item = value as Record<string, unknown>;
  if (
    typeof item.id !== "string" ||
    !isClientId(item.clientId) ||
    !isClientType(item.clientType) ||
    !nullableString(item.deviceLabel) ||
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
    !positiveInteger(item.sessionEpoch) ||
    typeof item.current !== "boolean"
  ) {
    throw new Error("INVALID_AUTH_SESSION");
  }
  return {
    id: item.id,
    clientId: item.clientId,
    clientType: item.clientType,
    deviceLabel: item.deviceLabel as string | null,
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
    current: item.current,
  };
}

function nullableString(value: unknown): boolean {
  return value === null || typeof value === "string";
}

function decimalCounter(value: unknown): value is string {
  return typeof value === "string" && /^(0|[1-9]\d*)$/.test(value);
}

function isClientId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/.test(value);
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function isClientType(value: unknown): value is AuthSessionClientType {
  return value === "WEB" || value === "IOS" || value === "ANDROID" || value === "DESKTOP";
}

import { safeSessionStorage } from "@/lib/safeStorage";

export const TENANT_CREATE_RECOVERY_STORAGE_KEY =
  "admin.tenants.pending-create-status.v1";

const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TENANT_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const TENANT_STATUSES = new Set([
  "ACTIVE",
  "PROVISIONING",
  "PROVISIONING_FAILED",
  "SUSPENDED",
  "DELETED",
]);
const ATTEMPT_KEYS = new Set([
  "version",
  "idempotencyKey",
  "tenantName",
  "savedAt",
]);

export interface PendingTenantCreateStatusAttempt {
  version: 1;
  idempotencyKey: string;
  tenantName: string;
  savedAt: string;
}

export interface TenantCreateStatusView {
  id: string;
  name: string;
  status:
    | "ACTIVE"
    | "PROVISIONING"
    | "PROVISIONING_FAILED"
    | "SUSPENDED"
    | "DELETED";
}

export function readPendingTenantCreateStatusAttempt(
  value = safeSessionStorage.getItem(TENANT_CREATE_RECOVERY_STORAGE_KEY),
): PendingTenantCreateStatusAttempt | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<PendingTenantCreateStatusAttempt>;
    if (
      parsed.version !== 1 ||
      !Object.keys(parsed).every((key) => ATTEMPT_KEYS.has(key)) ||
      typeof parsed.idempotencyKey !== "string" ||
      !UUID_V7_PATTERN.test(parsed.idempotencyKey) ||
      typeof parsed.tenantName !== "string" ||
      !TENANT_NAME_PATTERN.test(parsed.tenantName) ||
      typeof parsed.savedAt !== "string" ||
      Number.isNaN(Date.parse(parsed.savedAt))
    ) {
      return null;
    }
    return parsed as PendingTenantCreateStatusAttempt;
  } catch {
    return null;
  }
}

export function persistPendingTenantCreateStatusAttempt(
  attempt: PendingTenantCreateStatusAttempt,
): void {
  safeSessionStorage.setItem(
    TENANT_CREATE_RECOVERY_STORAGE_KEY,
    JSON.stringify(attempt),
  );
  const persisted = readPendingTenantCreateStatusAttempt();
  if (
    !persisted ||
    persisted.idempotencyKey !== attempt.idempotencyKey ||
    persisted.tenantName !== attempt.tenantName
  ) {
    throw new Error("TENANT_CREATE_RECOVERY_STORAGE_UNAVAILABLE");
  }
}

export function clearPendingTenantCreateStatusAttempt(): void {
  safeSessionStorage.removeItem(TENANT_CREATE_RECOVERY_STORAGE_KEY);
}

export function readTenantCreateStatus(
  payload: unknown,
  expectedTenantName: string,
): TenantCreateStatusView | null {
  if (!Array.isArray(payload)) {
    throw new Error("INVALID_TENANT_CREATE_STATUS_RESPONSE");
  }
  const exact = payload.find((value) => {
    const row = asRecord(value);
    return row?.name === expectedTenantName;
  });
  if (!exact) return null;

  const row = asRecord(exact);
  if (
    !row ||
    !UUID_V7_PATTERN.test(String(row.id)) ||
    row.name !== expectedTenantName ||
    !TENANT_STATUSES.has(String(row.status))
  ) {
    throw new Error("INVALID_TENANT_CREATE_STATUS_RESPONSE");
  }
  return {
    id: String(row.id),
    name: expectedTenantName,
    status: row.status as TenantCreateStatusView["status"],
  };
}

export function isTenantCreateDraftCurrent(
  submittedFingerprint: string,
  liveFingerprint: string,
): boolean {
  return submittedFingerprint === liveFingerprint;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

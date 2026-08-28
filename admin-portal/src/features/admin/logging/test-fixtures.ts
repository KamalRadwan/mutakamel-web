export const OVERRIDE_ID = "019f1000-0000-7000-8000-000000000001";
const HISTORY_ID = "019f1000-0000-7000-8000-000000000002";
export const TENANT_ID = "019f1000-0000-7000-8000-000000000003";
const ACTOR_ID = "019f1000-0000-7000-8000-000000000004";
export const CORRELATION_ID = "019f1000-0000-7000-8000-000000000005";
export const IDEMPOTENCY_KEY = "019f1000-0000-7000-8000-000000000006";

export const OVERRIDE_ROW = {
  id: OVERRIDE_ID,
  scope: "TENANT_APP",
  appName: "crm-app",
  tenantId: TENANT_ID,
  level: "debug",
  reason: "Investigate CRM latency",
  expiresAt: "2026-08-12T15:00:00.000Z",
  createdBy: ACTOR_ID,
  updatedBy: ACTOR_ID,
  createdAt: "2026-08-12T12:00:00.000Z",
  updatedAt: "2026-08-12T12:30:00.000Z",
  deletedAt: null,
} as const;

export const HISTORY_ROW = {
  id: HISTORY_ID,
  overrideId: OVERRIDE_ID,
  action: "UPDATE",
  scope: "TENANT_APP",
  appName: "crm-app",
  tenantId: TENANT_ID,
  previousLevel: "warn",
  level: "debug",
  previousReason: "Initial investigation",
  reason: "Investigate CRM latency",
  previousExpiresAt: "2026-08-12T14:00:00.000Z",
  expiresAt: "2026-08-12T15:00:00.000Z",
  actorId: ACTOR_ID,
  createdAt: "2026-08-12T12:30:00.000Z",
  updatedAt: "2026-08-12T12:30:00.000Z",
  deletedAt: null,
} as const;

export function envelope<T>(data: T) {
  return {
    success: true,
    data,
    correlationId: CORRELATION_ID,
    timestamp: "2026-08-12T12:31:00.000Z",
  };
}

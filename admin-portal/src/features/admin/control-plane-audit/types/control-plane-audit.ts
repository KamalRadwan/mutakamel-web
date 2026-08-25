export const CONTROL_PLANE_AUDIT_ACTOR_TYPES = [
  "SUPER_ADMIN",
  "TENANT_USER",
  "SYSTEM",
  "WORKER",
  "WEBHOOK",
  "UNKNOWN",
] as const;

export type ControlPlaneAuditActorType =
  (typeof CONTROL_PLANE_AUDIT_ACTOR_TYPES)[number];

export const CONTROL_PLANE_AUDIT_OUTCOMES = ["SUCCESS", "FAILURE"] as const;

export type ControlPlaneAuditOutcome =
  (typeof CONTROL_PLANE_AUDIT_OUTCOMES)[number];

export const CONTROL_PLANE_AUDIT_SOURCE_TYPES = [
  "LIVE",
  "TYPEORM_SUBSCRIBER",
  "DATABASE_TRIGGER",
  "DELEGATED",
  "BACKFILL",
] as const;

export type ControlPlaneAuditSourceType =
  (typeof CONTROL_PLANE_AUDIT_SOURCE_TYPES)[number];

export interface ControlPlaneAuditDiff {
  field: string;
  before?: unknown;
  after?: unknown;
}

export interface ControlPlaneAuditEvent {
  id: string;
  schemaVersion: number;
  actorType: ControlPlaneAuditActorType;
  actorId: string | null;
  actorLabel: string | null;
  tenantId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  outcome: ControlPlaneAuditOutcome;
  sourceApp: string;
  sourceType: string;
  sourceId: string | null;
  sourceRoute: string | null;
  operationId: string | null;
  correlationId: string | null;
  requestId: string | null;
  idempotencyKey: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  diff: ControlPlaneAuditDiff[];
  reason: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  occurredAt: string;
}

export interface ControlPlaneAuditPage {
  items: ControlPlaneAuditEvent[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ControlPlaneAuditQuery {
  page?: number;
  limit?: number;
  actorType?: ControlPlaneAuditActorType;
  actorId?: string;
  tenantId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  outcome?: ControlPlaneAuditOutcome;
  sourceApp?: string;
  sourceType?: string;
  correlationId?: string;
  from?: string;
  to?: string;
}

export type ControlPlaneAuditMode = "ALL_EVENTS" | "ENTITY_HISTORY";

export interface ControlPlaneAuditFilterDraft {
  actorType: "" | ControlPlaneAuditActorType;
  actorId: string;
  tenantId: string;
  action: string;
  entityType: string;
  entityId: string;
  outcome: "" | ControlPlaneAuditOutcome;
  sourceApp: string;
  sourceType: string;
  correlationId: string;
  from: string;
  to: string;
}

export type ControlPlaneAuditFilterErrors = Partial<
  Record<keyof ControlPlaneAuditFilterDraft | "dateRange", string>
>;

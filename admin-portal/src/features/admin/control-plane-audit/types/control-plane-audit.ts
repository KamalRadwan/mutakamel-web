import type { PageResult } from "@/types/common";

export const CONTROL_PLANE_AUDIT_ACTOR_TYPES = [
  "SUPER_ADMIN",
  "TENANT_USER",
  "SYSTEM",
  "WORKER",
  "WEBHOOK",
  "UNKNOWN",
] as const;

type ControlPlaneAuditActorType =
  (typeof CONTROL_PLANE_AUDIT_ACTOR_TYPES)[number];

export const CONTROL_PLANE_AUDIT_OUTCOMES = ["SUCCESS", "FAILURE"] as const;

type ControlPlaneAuditOutcome =
  (typeof CONTROL_PLANE_AUDIT_OUTCOMES)[number];

export const CONTROL_PLANE_AUDIT_SOURCE_TYPES = [
  "LIVE",
  "TYPEORM_SUBSCRIBER",
  "DATABASE_TRIGGER",
  "DELEGATED",
  "BACKFILL",
] as const;

export interface ControlPlaneAuditDiff {
  field: string;
  before?: unknown;
  after?: unknown;
}

/**
 * List-row shape. The list/entity-history endpoints omit the before/after
 * snapshots, diff, and metadata to keep page payloads small; fetch
 * {@link ControlPlaneAuditEventDetail} by id to inspect them.
 */
export interface ControlPlaneAuditEventSummary {
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
  reason: string | null;
  ip: string | null;
  userAgent: string | null;
  occurredAt: string;
  /**
   * How Core classified this failure, `null` on a successful event. Exactly
   * one domain — `APPLICATION` — means the platform is at fault. Without it
   * a reader scanning this log has only a reason code, and a reason code
   * alone cannot separate an expired session from a crash.
   */
  faultDomain: ControlPlaneAuditFaultDomain | null;
  disposition: ControlPlaneAuditDisposition | null;
  codeQuality: ControlPlaneAuditCodeQuality | null;
}

export const CONTROL_PLANE_AUDIT_FAULT_DOMAINS = [
  "APPLICATION",
  "DEPENDENCY",
  "CAPACITY",
  "CLIENT",
  "INDETERMINATE",
  "UNCLASSIFIED",
] as const;

export type ControlPlaneAuditFaultDomain =
  (typeof CONTROL_PLANE_AUDIT_FAULT_DOMAINS)[number];

export type ControlPlaneAuditDisposition =
  (typeof CONTROL_PLANE_AUDIT_DISPOSITIONS)[number];

export type ControlPlaneAuditCodeQuality =
  (typeof CONTROL_PLANE_AUDIT_CODE_QUALITIES)[number];

export interface ControlPlaneAuditEventDetail extends ControlPlaneAuditEventSummary {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  diff: ControlPlaneAuditDiff[];
  metadata: Record<string, unknown> | null;
}

export type ControlPlaneAuditPage = PageResult<ControlPlaneAuditEventSummary>;

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

export const CONTROL_PLANE_AUDIT_DISPOSITIONS = [
  "REFUSED",
  "FAILED",
  "UNREACHABLE",
  "INDETERMINATE",
] as const;

export const CONTROL_PLANE_AUDIT_CODE_QUALITIES = [
  "DESIGNED",
  "GENERIC",
  "LEAKED",
] as const;

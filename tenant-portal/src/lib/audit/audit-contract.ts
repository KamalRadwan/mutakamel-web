import { z } from "zod";
import { readCoreData, type CorePath } from "@/lib/api/envelope";

// Core TenantAuditQueryDto and TenantAuditService; common audit-event-v1.type.ts.
export const AUDIT_SOURCE_APPS = ["CORE", "CRM", "TRADE", "WORKER", "GATEWAY", "REALTIME", "ACCOUNTING", "HR"] as const;
export const AUDIT_SOURCE_KINDS = ["HTTP_COMMAND", "DOMAIN_MUTATION", "BROKER_CONSUMER", "CRON_JOB", "DB_FALLBACK", "SECURITY_EVENT"] as const;
export const AUDIT_SENSITIVITIES = ["LOW", "NORMAL", "HIGH"] as const;
export const AUDIT_OUTCOMES = ["SUCCESS", "FAILURE"] as const;
const AUDIT_PAGE_SIZE = 25;
const AUDIT_PATH = "/api/tenant/core/v1/audit";
const nullableText = z.string().nullable().optional().transform((value) => value ?? null);

const changeSchema = z.object({
  field: z.string().min(1), before: z.unknown(), after: z.unknown(),
  subjectId: z.string().optional(), subjectLabel: z.string().optional(),
});
const snapshotSchema = z.record(z.string(), z.unknown()).nullable().optional();
const eventSchema = z.object({
  id: z.string().min(1), action: z.string().min(1), entityType: z.string().min(1),
  entityId: nullableText, entityLabel: nullableText,
  actorUserId: nullableText, actorType: z.string(), actorLabel: nullableText,
  branchId: nullableText, subjectOwnerUserId: nullableText,
  sourceApp: nullableText, sourceKind: nullableText, sensitivity: nullableText,
  outcome: nullableText, reason: nullableText, correlationId: nullableText,
  createdAt: z.iso.datetime({ offset: true }),
  before: snapshotSchema, after: snapshotSchema,
  diff: z.array(changeSchema).nullable().optional().transform((value) => value ?? []),
});
const pageSchema = z.object({
  items: z.array(eventSchema).max(100),
  nextCursor: z.string().min(1).max(512).nullable(),
});
export type AuditEvent = z.infer<typeof eventSchema>;
export type AuditPage = z.infer<typeof pageSchema>;
export interface AuditFilters {
  entityType?: string; entityId?: string; action?: string; actorUserId?: string;
  correlationId?: string; branchId?: string; ownerUserId?: string;
  sourceApp?: typeof AUDIT_SOURCE_APPS[number];
  sourceKind?: typeof AUDIT_SOURCE_KINDS[number];
  sensitivity?: typeof AUDIT_SENSITIVITIES[number];
  outcome?: typeof AUDIT_OUTCOMES[number];
  from?: string; to?: string; q?: string;
}

export function auditLedgerPath(cursor: string | null, filters: AuditFilters, deletedOnly = false): CorePath {
  const query = new URLSearchParams({ limit: String(AUDIT_PAGE_SIZE) });
  if (cursor !== null) query.set("cursor", cursor);
  for (const [key, value] of Object.entries(filters)) {
    if (value && (key !== "q" || deletedOnly)) query.set(key, value);
  }
  return `${AUDIT_PATH}${deletedOnly ? "/deleted" : ""}?${query}`;
}

export function parseAuditPage(payload: unknown): AuditPage { return pageSchema.parse(payload); }
export function parseAuditEvent(payload: unknown): AuditEvent { return eventSchema.parse(payload); }

export async function fetchAuditLedger(cursor: string | null, filters: AuditFilters, deletedOnly: boolean, signal: AbortSignal) {
  return parseAuditPage(await readCoreData(auditLedgerPath(cursor, filters, deletedOnly), {
    signal, cache: "no-store", maxResponseBytes: 1024 * 1024,
  }));
}

export async function fetchAuditEvent(id: string, signal: AbortSignal) {
  return parseAuditEvent(await readCoreData(`${AUDIT_PATH}/events/${encodeURIComponent(id)}`, {
    signal, cache: "no-store", maxResponseBytes: 1024 * 1024,
  }));
}

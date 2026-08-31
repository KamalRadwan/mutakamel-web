import { readCoreData } from "@/lib/api/envelope";
import type { CorePath } from "@/lib/api/envelope";
import {
  CORE_LIST_RESPONSE_LIMIT_BYTES,
  invalidCoreResponse,
  isMember,
  nullableText,
  record,
  requiredText,
  requiredTimestamp,
} from "./core-page";

// The tenant audit ledger, shared by `/core/audit` and by the per-record
// history embedded on every Core detail screen that has one. It sits at the
// Core segment root for the same reason `core-page.ts` does: three route
// folders read one backend resource, and a sibling-screen import of a whole
// module is more than the dependency rules allow.
//
// Source: core-app/src/tenant/audit/tenant-audit.controller.ts and
// tenant-audit.service.ts.

export const AUDIT_PATH = "/api/tenant/core/v1/audit";

/** `audit.read` guards both routes — there is no separate write grant. */
export const AUDIT_READ_PERMISSION = "audit.read";

/** shared-libs/packages/common/src/types/audit-event-v1.type.ts. */
export const AUDIT_OUTCOMES = ["SUCCESS", "FAILURE"] as const;
export const AUDIT_SOURCE_APPS = [
  "CORE",
  "CRM",
  "TRADE",
  "WORKER",
  "GATEWAY",
  "REALTIME",
] as const;
export const AUDIT_SOURCE_KINDS = [
  "HTTP_COMMAND",
  "DOMAIN_MUTATION",
  "BROKER_CONSUMER",
  "CRON_JOB",
  "DB_FALLBACK",
  "SECURITY_EVENT",
] as const;

type AuditOutcome = (typeof AUDIT_OUTCOMES)[number];
type AuditSourceApp = (typeof AUDIT_SOURCE_APPS)[number];
type AuditSourceKind = (typeof AUDIT_SOURCE_KINDS)[number];

export interface AuditEvent {
  id: string;
  actorUserId: string | null;
  actorType: string;
  actorLabel: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  correlationId: string | null;
  /** Unpacked from the `_audit` metadata block; absent on pre-contract rows. */
  sourceApp: AuditSourceApp | null;
  sourceKind: AuditSourceKind | null;
  outcome: AuditOutcome | null;
  requestId: string | null;
  operationId: string | null;
  idempotencyKey: string | null;
  reason: string | null;
  createdAt: string;
}

/**
 * The audit page, with `hasNext`/`hasPrev` **derived**.
 *
 * `TenantAuditService.query` returns `{ items, total, page, limit, totalPages }`
 * and nothing else, so `ResponseEnvelopeInterceptor.isPaginated` does not
 * recognise it, no `meta` block is emitted, and the two flags every other Core
 * list carries simply are not there. Deriving them here is what stops the pager
 * rendering a live "next" control on the last page.
 */
export interface AuditPage {
  items: AuditEvent[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface AuditFilters {
  entityType?: string;
  entityId?: string;
  action?: string;
  actorUserId?: string;
  correlationId?: string;
  sourceApp?: AuditSourceApp;
  sourceKind?: AuditSourceKind;
  outcome?: AuditOutcome;
  from?: string;
  to?: string;
}

export const AUDIT_PAGE_SIZE = 25;
/** `TenantAuditService.query` clamps `limit` to 100. */
const AUDIT_MAX_LIMIT = 100;
const AUDIT_ACTION_MAX_LENGTH = 64;
const AUDIT_ENTITY_TYPE_MAX_LENGTH = 128;
const AUDIT_ENTITY_ID_MAX_LENGTH = 512;
const AUDIT_FREE_TEXT_MAX_LENGTH = 2048;

function auditListQuery(page: number, limit: number, filters: AuditFilters): string {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(Math.min(limit, AUDIT_MAX_LIMIT)),
  });
  for (const [key, value] of Object.entries(filters)) {
    if (value) query.set(key, value);
  }
  return query.toString();
}

export function auditLedgerPath(
  page: number,
  limit: number,
  filters: AuditFilters,
): CorePath {
  return `${AUDIT_PATH}?${auditListQuery(page, limit, filters)}`;
}

export function auditEntityHistoryPath(
  entityType: string,
  entityId: string,
  page: number,
  limit: number,
): CorePath {
  // The whole route is one literal: there is no endpoint that stops at
  // `/entities`, and both path parameters are required.
  const type = encodeURIComponent(entityType);
  const id = encodeURIComponent(entityId);
  const query = auditListQuery(page, limit, {});
  return `/api/tenant/core/v1/audit/entities/${type}/${id}?${query}`;
}

export function parseAuditEvent(payload: unknown): AuditEvent {
  const row = record(payload);
  if (!row) invalidCoreResponse();
  return {
    id: requiredText(row, "id", AUDIT_ENTITY_ID_MAX_LENGTH),
    actorUserId: nullableText(row, "actorUserId", AUDIT_ENTITY_ID_MAX_LENGTH),
    actorType: requiredText(row, "actorType", AUDIT_ACTION_MAX_LENGTH),
    actorLabel: nullableText(row, "actorLabel", AUDIT_FREE_TEXT_MAX_LENGTH),
    action: requiredText(row, "action", AUDIT_ACTION_MAX_LENGTH),
    entityType: requiredText(row, "entityType", AUDIT_ENTITY_TYPE_MAX_LENGTH),
    entityId: nullableText(row, "entityId", AUDIT_ENTITY_ID_MAX_LENGTH),
    correlationId: nullableText(row, "correlationId", AUDIT_ENTITY_ID_MAX_LENGTH),
    // Unknown enum values stay recoverable — a new source app must not take the
    // whole ledger down (docs/architecture/data-layer.md#runtime-response-validation).
    sourceApp: isMember(AUDIT_SOURCE_APPS, row.sourceApp) ? row.sourceApp : null,
    sourceKind: isMember(AUDIT_SOURCE_KINDS, row.sourceKind) ? row.sourceKind : null,
    outcome: isMember(AUDIT_OUTCOMES, row.outcome) ? row.outcome : null,
    requestId: nullableText(row, "requestId", AUDIT_ENTITY_ID_MAX_LENGTH),
    operationId: nullableText(row, "operationId", AUDIT_ENTITY_ID_MAX_LENGTH),
    idempotencyKey: nullableText(row, "idempotencyKey", AUDIT_ENTITY_ID_MAX_LENGTH),
    reason: nullableText(row, "reason", AUDIT_FREE_TEXT_MAX_LENGTH),
    createdAt: requiredTimestamp(row, "createdAt"),
  };
}

function safeCount(source: Record<string, unknown>, key: string, minimum: number): number {
  const value = source[key];
  if (!Number.isSafeInteger(value) || (value as number) < minimum) invalidCoreResponse();
  return value as number;
}

export function parseAuditPage(payload: unknown): AuditPage {
  const body = record(payload);
  if (!body || !Array.isArray(body.items)) invalidCoreResponse();
  const items = body.items.map(parseAuditEvent);
  const page = safeCount(body, "page", 1);
  const limit = safeCount(body, "limit", 1);
  const total = safeCount(body, "total", 0);
  const totalPages = safeCount(body, "totalPages", 0);
  if (limit > AUDIT_MAX_LIMIT || items.length > limit || items.length > total) {
    invalidCoreResponse();
  }
  return {
    items,
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1 && totalPages > 0,
  };
}

export async function fetchAuditLedger(options: {
  page: number;
  limit?: number;
  filters: AuditFilters;
  signal?: AbortSignal;
}): Promise<AuditPage> {
  return parseAuditPage(
    await readCoreData(
      auditLedgerPath(options.page, options.limit ?? AUDIT_PAGE_SIZE, options.filters),
      {
        signal: options.signal,
        cache: "no-store",
        maxResponseBytes: CORE_LIST_RESPONSE_LIMIT_BYTES,
      },
    ),
  );
}

export async function fetchEntityHistory(options: {
  entityType: string;
  entityId: string;
  page: number;
  limit?: number;
  signal?: AbortSignal;
}): Promise<AuditPage> {
  return parseAuditPage(
    await readCoreData(
      auditEntityHistoryPath(
        options.entityType,
        options.entityId,
        options.page,
        options.limit ?? AUDIT_PAGE_SIZE,
      ),
      {
        signal: options.signal,
        cache: "no-store",
        maxResponseBytes: CORE_LIST_RESPONSE_LIMIT_BYTES,
      },
    ),
  );
}

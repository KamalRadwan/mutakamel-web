import {
  fakeGetAuditEvent,
  fakeListAuditEvents,
  fakeListDeletedRecords,
  fakeListEntityAuditEvents,
  fakeListRecordHistory,
  fakeListRelatedEntityHistory,
} from './audit-log.fake';
import {
  AuditDeletedQuery,
  AuditEvent,
  AuditHistoryPage,
  AuditPage,
  AuditQuery,
  AuditRelatedHistoryQuery,
  RecordHistoryQuery,
  RecordHistoryTarget,
} from './audit-log.model';

export { ApiError, errorCodeOf } from '../../staff/shared/staff.api';
export * from './audit-log.model';

// Backend: core-app/src/tenant/audit (tenant-audit.controller.ts, record-history.controller.ts).
// Every route: `Cache-Control: no-store`; cursor page `{ items, nextCursor }`.
// Errors: 400 AUDIT_QUERY_INVALID, 403 MISSING_REQUIRED_PERMISSIONS, 404 AUDIT_EVENT_NOT_FOUND / ACTIVITY_NOT_FOUND.

/**
 * Lists tenant audit events in newest-first cursor order.
 *
 * Real route: `GET /api/tenant/core/v1/audit`
 * Query params: `cursor, limit, entityType, entityId, action, actorUserId, correlationId, branchId, ownerUserId, sourceApp, sourceKind, outcome, sensitivity, deletedOnly, q, from, to`
 * `q` requires `deletedOnly=true`. Permission: ANY of `audit.read`, `audit.read.branch`, `audit.read.own`.
 */
export function listAuditEvents(q: AuditQuery = {}): Promise<AuditPage> {
  return fakeListAuditEvents(q);
}

/**
 * Lists deleted-record audit events (`SOFT_DELETE` / `DELETE`) in newest-first cursor order.
 *
 * Real route: `GET /api/tenant/core/v1/audit/deleted` (the controller forces `deletedOnly=true`)
 * Query params: `AuditQuery` plus `q` (literal, case-sensitive prefix on `entity_label`, max 256 chars)
 */
export function listDeletedRecords(q: AuditDeletedQuery = {}): Promise<AuditPage> {
  return fakeListDeletedRecords(q);
}

/**
 * Fetches a single audit event with full before/after, diff, and technical request evidence.
 *
 * Real route: `GET /api/tenant/core/v1/audit/events/:id`
 */
export function getAuditEvent(id: string): Promise<AuditEvent> {
  return fakeGetAuditEvent(id);
}

/**
 * One entity's flat audit history.
 *
 * Real route: `GET /api/tenant/core/v1/audit/entities/:entityType/:entityId` (no `relatedPartyIds`)
 * Query params: `AuditQuery`. `historyCategory` without `relatedPartyIds` is a 400.
 */
export function listEntityAuditEvents(
  entityType: string,
  entityId: string,
  q: AuditQuery = {},
): Promise<AuditPage> {
  return fakeListEntityAuditEvents(entityType, entityId, q);
}

/**
 * One entity's grouped history including related parties (contact methods, addresses, relationships).
 *
 * Real route: `GET /api/tenant/core/v1/audit/entities/:entityType/:entityId?relatedPartyIds=<csv>`
 * `relatedPartyIds`: 1 to 21 unique UUIDv7 IDs, comma-separated. `historyCategory`: lead | contact | quotation | salesOrder | invoice | activity.
 */
export function listRelatedEntityHistory(
  entityType: string,
  entityId: string,
  q: AuditRelatedHistoryQuery,
): Promise<AuditHistoryPage> {
  return fakeListRelatedEntityHistory(entityType, entityId, q);
}

/**
 * Grouped history of an authorized CRM lead; related parties come from CRM projections only.
 *
 * Real route: `GET /api/tenant/core/v1/audit/records/CRM/LEAD/:targetId/history`
 * Query params: `cursor, limit (1-100, default 25), historyCategory`
 * Permission: ANY of `crm.leads.read.own`, `crm.leads.read.team`, `crm.leads.read.all`. Unknown lead: 404 ACTIVITY_NOT_FOUND.
 */
export function listRecordHistory(
  target: RecordHistoryTarget,
  q: RecordHistoryQuery = {},
): Promise<AuditHistoryPage> {
  return fakeListRecordHistory(target, q);
}

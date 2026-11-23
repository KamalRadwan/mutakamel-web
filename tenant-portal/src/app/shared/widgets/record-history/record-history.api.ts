import { inject, Service } from '@angular/core';
// Backend: core-app/src/tenant/audit (tenant-audit.controller.ts, record-history.controller.ts). The routes are
// wrapped once, in the Audit log feature; this widget maps their pages to the timeline's `HistoryPage`.
// NOTE: shared/widgets importing a feature goes against the folder rule (imports go down); the owner asked for one
// wrapper per route, so the audit-log api stays the single source until it moves to shared/.
import {
  AUDIT_HISTORY_CATEGORIES,
  AUDIT_LIMITS,
  AuditEvent,
  AuditHistoryCategory,
  AuditHistoryGroup,
  computeEventDiff,
  AuditLogApi,
} from '../../../features/workspace/operations/audit-log/audit-log.api';
import { HistoryItem, HistoryPage, HistorySubjectKind, ListRecordHistoryOptions } from './record-history.model';

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BACKEND_CATEGORIES = new Set<string>(AUDIT_HISTORY_CATEGORIES);
/** `related-history-priority.ts` CRM_ROOT_TYPES: every CRM root record is grouped as subject kind `lead`. */
const CRM_ROOT_TYPES = new Set(['Lead', 'CustomerProfile', 'Opportunity']);
const PARTY_TYPES = new Set(['Party', 'PartyContactMethod', 'PartyAddress', 'PartyRelationship']);
/** Fields the grouped view drops (`relatedHistoryView`). */
const TECHNICAL_FIELDS = new Set(['id', 'tenantId', 'createdAt', 'updatedAt', 'version']);

export interface HistoryCategoryPlan {
  /** Sent as `historyCategory` (grouped routes only). */
  backend?: AuditHistoryCategory;
  /** Applied to the returned page when the backend has no matching filter. */
  keep?: (item: HistoryItem) => boolean;
}

/**
 * Widget filter id -> backend `historyCategory` (lead | contact | quotation | salesOrder | invoice | activity).
 * Host ids without a backend category: `record`/`details` = the CRM root record (`lead`), `stages` = root
 * stage changes (no backend category: filtered on the page), anything else = filtered by subject kind.
 */
export function planHistoryCategory(category: string | undefined): HistoryCategoryPlan {
  if (!category) return {};
  if (BACKEND_CATEGORIES.has(category)) return { backend: category as AuditHistoryCategory };
  if (category === 'record' || category === 'details') return { backend: 'lead' };
  if (category === 'stages') {
    return { backend: 'lead', keep: (item) => item.action.toUpperCase().endsWith('_STAGE_CHANGED') };
  }
  return { keep: (item) => item.subjectKind === category };
}

function subjectKindOf(entityType: string): HistorySubjectKind {
  const canonical = entityType.endsWith('Entity') ? entityType.slice(0, -6) : entityType;
  if (CRM_ROOT_TYPES.has(canonical)) return 'lead';
  if (PARTY_TYPES.has(canonical)) return 'contact';
  if (canonical === 'Quotation') return 'quotation';
  if (canonical === 'SalesOrder') return 'salesOrder';
  if (canonical === 'Invoice') return 'invoice';
  if (canonical === 'Activity') return 'activity';
  if (canonical === 'CrmNote' || canonical === 'Note') return 'note';
  if (canonical === 'CrmAttachment' || canonical === 'Attachment') return 'attachment';
  return 'record';
}

/** A grouped row already has the timeline shape. */
export function historyItemFromGroup(group: AuditHistoryGroup): HistoryItem {
  return { ...group, diff: group.diff.map((change) => ({ ...change })) };
}

/** A flat audit event (entity route without related parties) as one timeline row. */
export function historyItemFromEvent(event: AuditEvent): HistoryItem {
  return {
    id: event.id,
    action: event.action,
    subjectKind: subjectKindOf(event.entityType),
    subjectId: event.entityId,
    referenceLabel: event.entityLabel,
    createdAt: event.createdAt,
    actorLabel: event.actorLabel,
    actorType: event.actorType,
    outcome: event.outcome,
    reason: event.reason,
    diff: computeEventDiff(event)
      .filter((change) => !TECHNICAL_FIELDS.has(change.field))
      .map((change) => ({ field: change.field, before: change.before, after: change.after })),
  };
}

/** `relatedPartyIds`: 1 to 21 unique UUIDv7 ids (anything else is 400 AUDIT_QUERY_INVALID). */
export function relatedPartyIdsFor(partyIds: readonly string[]): string[] {
  const unique = Array.from(
    new Set(partyIds.map((id) => id.trim().toLowerCase()).filter((id) => UUID_V7.test(id))),
  );
  return unique.slice(0, AUDIT_LIMITS.maxRelatedPartyIds);
}

function keepPage(items: HistoryItem[], nextCursor: string | null, plan: HistoryCategoryPlan): HistoryPage {
  return { items: plan.keep ? items.filter(plan.keep) : items, nextCursor };
}

/**
 * Timeline page for one record.
 * - `Lead`: GET tenant/audit/records/CRM/LEAD/:id/history?cursor&limit&historyCategory (crm.leads.read.*;
 *   related parties come from CRM projections, so `partyIds` is not sent).
 * - other types with valid party ids: GET tenant/audit/entities/:entityType/:entityId?relatedPartyIds&historyCategory&cursor&limit
 * - other types without: the same route without `relatedPartyIds` (flat events; `historyCategory` would be 400).
 * Errors pass through as the audit-log `ApiError(status, code)`: 400 AUDIT_QUERY_INVALID,
 * 403 MISSING_REQUIRED_PERMISSIONS, 404 ACTIVITY_NOT_FOUND (unknown lead).
 */
@Service()
export class RecordHistoryApi {
  private readonly audit = inject(AuditLogApi);

  listRecordHistory(entityType: string, entityId: string, partyIds: readonly string[], options: ListRecordHistoryOptions = {}): Promise<HistoryPage> {
    return readHistory(this.audit, entityType, entityId, partyIds, options);
  }
}

async function readHistory(
  audit: Pick<AuditLogApi, 'listRecordHistory' | 'listRelatedEntityHistory' | 'listEntityAuditEvents'>,
  entityType: string,
  entityId: string,
  partyIds: readonly string[],
  options: ListRecordHistoryOptions = {},
): Promise<HistoryPage> {
  const plan = planHistoryCategory(options.category);
  const cursor = options.cursor ?? undefined;
  const limit = options.limit ?? AUDIT_LIMITS.defaultLimit;

  if (entityType === 'Lead') {
    const page = await audit.listRecordHistory(
      { targetApp: 'CRM', targetType: 'LEAD', targetId: entityId },
      { cursor, limit, historyCategory: plan.backend },
    );
    return keepPage(page.items.map(historyItemFromGroup), page.nextCursor, plan);
  }

  const relatedPartyIds = relatedPartyIdsFor(partyIds);
  if (relatedPartyIds.length > 0) {
    const page = await audit.listRelatedEntityHistory(entityType, entityId, {
      relatedPartyIds,
      historyCategory: plan.backend,
      cursor,
      limit,
    });
    return keepPage(page.items.map(historyItemFromGroup), page.nextCursor, plan);
  }

  const page = await audit.listEntityAuditEvents(entityType, entityId, { cursor, limit });
  const flatPlan: HistoryCategoryPlan = plan.backend
    ? { keep: (item) => item.subjectKind === plan.backend && (!plan.keep || plan.keep(item)) }
    : plan;
  return keepPage(page.items.map(historyItemFromEvent), page.nextCursor, flatPlan);
}

/**
 * Compatibility export for the unused legacy adapters. Requires an Angular injection
 * context; active widgets inject RecordHistoryApi directly. Uses the same real transport.
 */
export function listRecordHistory(
  entityType: string,
  entityId: string,
  partyIds: readonly string[],
  options: ListRecordHistoryOptions = {},
): Promise<HistoryPage> {
  return inject(RecordHistoryApi).listRecordHistory(entityType, entityId, partyIds, options);
}

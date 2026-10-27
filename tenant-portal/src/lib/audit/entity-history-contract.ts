// One record's audit history, for any screen that shows one.
//
//   GET /api/tenant/core/v1/audit/entities/:entityType/:entityId?cursor=&limit=
//
// Shared by Core, CRM and Trade. Related-party history has a grouped event
// shape distinct from ledger rows; both readers use Core's opaque cursor.

import { readCorePage, type CorePath } from "@/lib/api/envelope";

const AUDIT_RESPONSE_LIMIT_BYTES = 256 * 1024;

export const AUDIT_HISTORY_PAGE_SIZE = 10;

/**
 * One entry: who, when, and what happened. Everything else the ledger carries
 * is deliberately unread — a card tells a story, it does not dump a row.
 */
/** One field that moved, as `computeDiff` in the audit-log package writes it. */
interface EntityAuditChange {
  field: string;
  before: unknown;
  after: unknown;
  subjectId?: string;
  subjectLabel?: string;
}

export interface EntityAuditEvent {
  id: string;
  /** What was done, as the server names it — `LEAD_STAGE_CHANGED` and the like. */
  action: string;
  /** Who did it: the person's name where the ledger has one, else the actor kind. */
  actorLabel: string;
  occurredAt: string;
  outcome: "SUCCESS" | "FAILURE" | null;
  /** A failure's own reason, which is the half that matters in an incident. */
  reason: string | null;
  /**
   * What actually changed, old value beside new.
   *
   * The ledger stores `before`, `after` AND a precomputed `diff`; this reads
   * the diff, because it is the one the server derived with the redaction rules
   * applied — recomputing it here from two snapshots would print a secret the
   * server had deliberately masked.
   */
  changes: EntityAuditChange[];
}

export interface EntityAuditPage {
  events: EntityAuditEvent[];
  nextCursor: string | null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

/**
 * The `diff` column: `[{ field, before, after }]`, bounded and already
 * redacted by the writer.
 *
 * A row that is not that shape contributes no changes rather than throwing —
 * the event still happened, and "we cannot show what moved" is a smaller loss
 * than a history card that refuses to render. Multi-party events must preserve
 * every recorded change; the response is bounded at the transport boundary.
 */
// One request can edit the company and 20 contacts. Never truncate its fields
// silently; the transport's byte limit bounds the entire response instead.

function parseChanges(value: unknown): EntityAuditChange[] {
  if (!Array.isArray(value)) return [];
  const changes: EntityAuditChange[] = [];
  for (const entry of value) {
    const row = record(entry);
    const field = row ? text(row.field) : null;
    if (!row || !field) continue;
    changes.push({ field, before: row.before, after: row.after,
      subjectId: text(row.subjectId) ?? undefined,
      subjectLabel: text(row.subjectLabel) ?? undefined });
  }
  return changes;
}

/**
 * Stage moves written before CRM supplied snapshots have no `diff`, but their
 * metadata still carries the safe semantic transition. Reading only these
 * named enum fields keeps old history useful without reconstructing arbitrary
 * before/after objects that the ledger may have redacted.
 */
function legacyStageChanges(action: string, value: unknown): EntityAuditChange[] {
  if (action !== "LEAD_STAGE_CHANGED") return [];
  const metadata = record(value);
  if (!metadata) return [];

  const changes: EntityAuditChange[] = [];
  const beforeStage = text(metadata.fromStageFlag);
  const afterStage = text(metadata.toStageFlag);
  if ((beforeStage || afterStage) && beforeStage !== afterStage) {
    changes.push({ field: "stageFlag", before: beforeStage, after: afterStage });
  }

  const beforeStatus = text(metadata.fromStatus);
  const afterStatus = text(metadata.toStatus);
  if ((beforeStatus || afterStatus) && beforeStatus !== afterStatus) {
    changes.push({ field: "status", before: beforeStatus, after: afterStatus });
  }
  return changes;
}

/** The query half, kept out of the path for `CorePath`'s sake. */
export function entityHistoryQuery(cursor: string | null, limit: number, relatedPartyIds?: readonly string[]): string {
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor !== null) query.set("cursor", cursor);
  if (relatedPartyIds?.length) query.set("relatedPartyIds", [...new Set(relatedPartyIds)].sort().join(","));
  return query.toString();
}

function entityHistoryPath(entityType: string, entityId: string): CorePath {
  return `/api/tenant/core/v1/audit/entities/${encodeURIComponent(
    entityType,
  )}/${encodeURIComponent(entityId)}` as CorePath;
}

/**
 * The ledger's rows, defensively.
 *
 * A history card is the one surface that must not take a screen down — it is
 * read when something has already gone wrong. So an unreadable ROW is dropped
 * rather than thrown, because the rest of the story is still worth showing, and
 * only a body that is not a list at all is a failure.
 *
 * Core's data envelope holds { items, nextCursor }; no page totals are inferred.
 */
export function parseEntityHistory(
  data: unknown,
): EntityAuditPage {
  const body = record(data);
  const items = body?.items;
  const nextCursor = body?.nextCursor;
  if (!Array.isArray(items) || (nextCursor !== null &&
    (typeof nextCursor !== "string" || !nextCursor || nextCursor.length > 512))) {
    throw new Error("Invalid audit response.");
  }
  const events: EntityAuditEvent[] = [];
  for (const item of items) {
    const row = record(item);
    if (!row) continue;
    const id = text(row.id);
    const action = text(row.action);
    const occurredAt = text(row.createdAt) ?? text(row.occurredAt);
    if (!id || !action || !occurredAt) continue;
    const outcome = text(row.outcome);
    const parsedChanges = parseChanges(row.diff);
    events.push({
      id,
      action,
      actorLabel: text(row.actorLabel) ?? text(row.actorType) ?? "",
      occurredAt,
      outcome: outcome === "SUCCESS" || outcome === "FAILURE" ? outcome : null,
      reason: text(row.reason),
      changes:
        parsedChanges.length > 0
          ? parsedChanges
          : legacyStageChanges(action, row.metadata),
    });
  }
  return { events, nextCursor };
}

export async function fetchEntityHistory(
  entityType: string,
  entityId: string,
  cursor: string | null,
  limit: number,
  signal?: AbortSignal,
  relatedPartyIds?: readonly string[],
): Promise<EntityAuditPage> {
  const { data } = await readCorePage(
    entityHistoryPath(entityType, entityId),
    entityHistoryQuery(cursor, limit, relatedPartyIds),
    { signal, cache: "no-store", maxResponseBytes: AUDIT_RESPONSE_LIMIT_BYTES },
  );
  return parseEntityHistory(data);
}

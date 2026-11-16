import { isUUIDv7 } from "@/lib/uuid";
import { boundedArray, invalidResponse, record, timestamp } from "../dashboards/dashboard-parse";
import { parseBox, widgetPath } from "../dashboards/widget-contract";
import { isWidgetRevision } from "../dashboards/widget-library-contract";
import type { WidgetDraftState } from "./widget-draft-contract";

// crm-app widget-publication-plan.ts caps consumers and checks each board's placement limit.
const CONSUMER_LIMIT = 1000;
const ADJUSTMENT_LIMIT = CONSUMER_LIMIT * 20;

export function widgetImpactPath(id: string) {
  return `${widgetPath(id)}/publish-impact`;
}

export function widgetPublishPath(id: string) {
  return `${widgetPath(id)}/publish`;
}

export function publicationPrecondition(state: WidgetDraftState) {
  if (!state.draft) return null;
  return { expectedWidgetRevision: state.widgetRevision, expectedGovernanceRevision: state.governanceRevision,
    expectedDraftId: state.draft.draftId, expectedDraftRevision: state.draft.revision };
}

export function parseWidgetImpact(value: unknown, state: WidgetDraftState) {
  const source = record(value);
  const expected = publicationPrecondition(state);
  if (!expected || !source || !isUUIDv7(source.impactId) || !timestamp(source.expiresAt)
    || source.widgetId !== state.widgetId || source.widgetRevision !== expected.expectedWidgetRevision
    || source.governanceRevision !== expected.expectedGovernanceRevision
    || source.draftId !== expected.expectedDraftId || source.draftRevision !== expected.expectedDraftRevision
    || !isWidgetRevision(source.nextVersionNumber) || source.nextVersionNumber !== (state.activeVersionNumber ?? 0) + 1
    || !boundedArray(source.dashboards, CONSUMER_LIMIT) || !boundedArray(source.layoutAdjustments, ADJUSTMENT_LIMIT)) {
    invalidResponse("widget publication impact");
  }
  const seenDashboards = new Set<string>();
  const dashboards = source.dashboards.map((value) => {
    const row = record(value);
    if (!row || !isUUIDv7(row.id) || seenDashboards.has(row.id) || typeof row.name !== "string"
      || !isWidgetRevision(row.revision) || typeof row.affected !== "boolean") invalidResponse("widget publication dashboard");
    seenDashboards.add(row.id);
    return { id: row.id, name: row.name, revision: row.revision, affected: row.affected };
  });
  const affectedIds = new Set(dashboards.filter((dashboard) => dashboard.affected).map((dashboard) => dashboard.id));
  const seenPlacements = new Set<string>();
  const layoutAdjustments = source.layoutAdjustments.map((value) => {
    const row = record(value);
    const box = parseBox(value);
    if (!row || !box || !isUUIDv7(row.placementId) || seenPlacements.has(row.placementId)
      || !isUUIDv7(row.dashboardId) || !affectedIds.has(row.dashboardId)) invalidResponse("widget publication layout");
    seenPlacements.add(row.placementId);
    return { placementId: row.placementId, dashboardId: row.dashboardId, ...box };
  });
  return { expiresAt: source.expiresAt, nextVersionNumber: source.nextVersionNumber, dashboards, layoutAdjustments,
    body: { ...expected, impactId: source.impactId } };
}

export type WidgetImpact = ReturnType<typeof parseWidgetImpact>;

export function parseWidgetPublicationReceipt(value: unknown, widgetId: string, impact: WidgetImpact) {
  const row = record(value);
  const { body, nextVersionNumber } = impact;
  if (!row || row.widgetId !== widgetId || row.versionNumber !== nextVersionNumber
    || row.widgetRevision !== body.expectedWidgetRevision + 1 || row.sourceDraftId !== body.expectedDraftId
    || row.sourceDraftRevision !== body.expectedDraftRevision || !timestamp(row.publishedAt)
    || typeof row.replayed !== "boolean") invalidResponse("widget publication receipt");
  const revisions = record(row.dashboardRevisions);
  if (!revisions) invalidResponse("widget publication revisions");
  const entries = Object.entries(revisions);
  if (entries.length > CONSUMER_LIMIT || entries.some(([id, revision]) => !isUUIDv7(id) || !isWidgetRevision(revision))) {
    invalidResponse("widget publication revisions");
  }
  return { versionNumber: nextVersionNumber, publishedAt: row.publishedAt, replayed: row.replayed };
}

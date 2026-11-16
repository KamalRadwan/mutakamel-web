import { isUUIDv7 } from "@/lib/uuid";
import { boundedArray, invalidResponse, record, timestamp } from "../dashboards/dashboard-parse";
import { widgetPath } from "../dashboards/widget-contract";
import { isWidgetRevision, type WidgetLibraryItem } from "../dashboards/widget-library-contract";

export type WidgetGovernanceAction = "ARCHIVE" | "RESTORE";
export const WIDGET_ARCHIVE_REASON_LIMIT = 500;
const CONSUMER_LIMIT = 1000;

export function governancePath(id: string, inspect: boolean) {
  return `${widgetPath(id)}/${inspect ? "lifecycle-impact" : "lifecycle"}`;
}

export function governancePrecondition(head: WidgetLibraryItem, action: WidgetGovernanceAction) {
  return { action, expectedWidgetRevision: head.revision, expectedGovernanceRevision: head.governanceRevision };
}

export function parseWidgetGovernanceImpact(value: unknown, head: WidgetLibraryItem, action: WidgetGovernanceAction) {
  const row = record(value);
  if (!row || row.widgetId !== head.id || row.action !== action || !isUUIDv7(row.impactId) || !timestamp(row.expiresAt)
    || row.widgetRevision !== head.revision || row.governanceRevision !== head.governanceRevision
    || row.activeVersionNumber !== head.versionNumber || !boundedArray(row.placements, CONSUMER_LIMIT)
    || typeof row.hiddenPlacementCount !== "number" || !Number.isSafeInteger(row.hiddenPlacementCount) || row.hiddenPlacementCount < 0
    || row.hiddenPlacementCount + row.placements.length > CONSUMER_LIMIT) invalidResponse("widget lifecycle impact");
  const dashboardIds = new Set<string>();
  const placementIds = new Set<string>();
  const placements = row.placements.map((value) => {
    const placement = record(value);
    if (!placement || !isUUIDv7(placement.dashboardId) || dashboardIds.has(placement.dashboardId)
      || !isUUIDv7(placement.placementId) || placementIds.has(placement.placementId) || typeof placement.dashboardName !== "string"
      || !isWidgetRevision(placement.dashboardRevision) || (placement.versionPolicy !== "FOLLOW_ACTIVE" && placement.versionPolicy !== "PINNED")
      || (placement.versionNumber !== null && !isWidgetRevision(placement.versionNumber))
      || (placement.versionNumber !== null && (head.versionNumber === null || placement.versionNumber > head.versionNumber
        || (placement.versionPolicy === "FOLLOW_ACTIVE" && placement.versionNumber !== head.versionNumber)))
      || typeof placement.eligibleToResume !== "boolean"
      || (placement.eligibleToResume && (action === "ARCHIVE" || placement.versionNumber === null))) {
      invalidResponse("widget lifecycle placement");
    }
    dashboardIds.add(placement.dashboardId);
    placementIds.add(placement.placementId);
    return { dashboardId: placement.dashboardId, placementId: placement.placementId, dashboardName: placement.dashboardName,
      versionPolicy: placement.versionPolicy, versionNumber: placement.versionNumber, eligibleToResume: placement.eligibleToResume } as const;
  });
  return { impactId: row.impactId, expiresAt: row.expiresAt, placements, hiddenPlacementCount: row.hiddenPlacementCount,
    body: { ...governancePrecondition(head, action), impactId: row.impactId } };
}

export type WidgetGovernanceImpact = ReturnType<typeof parseWidgetGovernanceImpact>;

export function verifyWidgetGovernanceReceipt(value: unknown, head: WidgetLibraryItem, impact: WidgetGovernanceImpact) {
  const row = record(value);
  const status = impact.body.action === "ARCHIVE" ? "ARCHIVED" : head.versionNumber === null ? "DRAFT" : "PUBLISHED";
  if (!row || row.widgetId !== head.id || row.status !== status || row.activeVersionNumber !== head.versionNumber
    || row.widgetRevision !== head.revision + 1 || row.governanceRevision !== head.governanceRevision + 1
    || row.affectedDashboardCount !== impact.placements.length + impact.hiddenPlacementCount) invalidResponse("widget lifecycle receipt");
}

import { boundedArray, invalidResponse, nonEmptyString, optionalString, record } from "./dashboard-parse";

// `CRM_DASHBOARD_DRILLDOWN_PROJECTION_FIELDS`, in server order.
export const DRILLDOWN_FIELDS = [
  "id", "entityType", "title", "status", "stageName", "ownerName", "branchName",
  "pipelineName", "sourceName", "activityType", "reason", "amount",
  "currencyCode", "rank", "value", "occurredAt", "createdAt", "updatedAt",
  "dueAt", "closedAt", "convertedAt",
] as const;
type DrilldownField = (typeof DRILLDOWN_FIELDS)[number];

export interface DrilldownRecord {
  id: string;
  fields: Partial<Record<DrilldownField, string | number | boolean | null>>;
}

export interface DrilldownPage {
  dashboardId: string;
  widgetId: string;
  widgetRevision: number;
  pointKey: string;
  seriesKey: string | null;
  records: DrilldownRecord[];
  hasMore: boolean;
  nextCursor: string | null;
}

export function parseDrilldownResponse(payload: unknown): DrilldownPage {
  const source = record(payload);
  const pageInfo = record(source?.pageInfo);
  const selection = record(source?.selection);
  if (
    !source ||
    !pageInfo ||
    !selection || !nonEmptyString(selection.pointKey) ||
    (selection.seriesKey !== undefined && !nonEmptyString(selection.seriesKey)) ||
    !nonEmptyString(source.dashboardId) || !nonEmptyString(source.placementId) ||
    !nonEmptyString(source.widgetId) ||
    !Number.isSafeInteger(source.widgetRevision) || Number(source.widgetRevision) < 1 ||
    typeof pageInfo.hasMore !== "boolean" ||
    (pageInfo.nextCursor !== null && (!nonEmptyString(pageInfo.nextCursor) || !/^[A-Za-z0-9_-]+$/.test(pageInfo.nextCursor) || pageInfo.nextCursor.length > 1024)) ||
    (pageInfo.hasMore === true && !pageInfo.nextCursor) ||
    (pageInfo.hasMore === false && pageInfo.nextCursor !== null) ||
    !boundedArray(source.records, 100)
  ) {
    invalidResponse("drill-down");
  }
  return {
    dashboardId: source.dashboardId,
    widgetId: source.widgetId,
    widgetRevision: Number(source.widgetRevision),
    pointKey: selection.pointKey,
    seriesKey: optionalString(selection.seriesKey),
    records: source.records.flatMap((entry) => {
      const row = record(entry);
      if (!row || !nonEmptyString(row.id)) invalidResponse("drill-down record");
      const fields: DrilldownRecord["fields"] = {};
      for (const field of DRILLDOWN_FIELDS) {
        const value = row[field];
        if (
          value === null ||
          typeof value === "string" ||
          (typeof value === "number" && Number.isFinite(value)) ||
          typeof value === "boolean"
        ) {
          fields[field] = value;
        }
      }
      return [{ id: row.id, fields }];
    }),
    hasMore: pageInfo.hasMore === true,
    nextCursor: optionalString(pageInfo.nextCursor),
  };
}



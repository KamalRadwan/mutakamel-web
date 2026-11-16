import { boundedArray, invalidResponse, nonEmptyString, record, timestamp } from "../dashboards/dashboard-parse";
import { widgetPath } from "../dashboards/widget-contract";
import { isWidgetRevision } from "../dashboards/widget-library-contract";

const PROVENANCE = ["EXISTING_DEFINITION_BACKFILL", "USER_PUBLISH", "TEMPLATE_INSTALL", "DASHBOARD_COPY"] as const;
type Provenance = typeof PROVENANCE[number];

export interface WidgetHistoryEntry {
  versionNumber: number;
  name: string;
  publishedAt: string | null;
  provenance: Provenance;
}

export function widgetHistoryPath(widgetId: string, beforeVersion?: number) {
  const path = `${widgetPath(widgetId)}/versions`;
  return beforeVersion === undefined ? path : `${path}?beforeVersion=${beforeVersion}`;
}

function isProvenance(value: unknown): value is Provenance {
  return (PROVENANCE as readonly unknown[]).includes(value);
}

export function parseWidgetHistoryEntry(value: unknown): WidgetHistoryEntry {
  const row = record(value);
  if (!row || !isWidgetRevision(row.versionNumber) || !nonEmptyString(row.name) || !isProvenance(row.provenance)) {
    invalidResponse("widget history entry");
  }
  const publishedAt = row.publishedAt;
  if (row.provenance === "EXISTING_DEFINITION_BACKFILL" ? publishedAt !== null || row.versionNumber !== 1 : !timestamp(publishedAt)) {
    invalidResponse("widget history publication date");
  }
  return { versionNumber: row.versionNumber, name: row.name, provenance: row.provenance, publishedAt: typeof publishedAt === "string" ? publishedAt : null };
}

export function parseWidgetHistory(value: unknown, widgetId: string, revision: number, activeVersion: number | null, beforeVersion?: number) {
  const source = record(value);
  if (!source || source.widgetId !== widgetId || source.widgetRevision !== revision || source.activeVersionNumber !== activeVersion
    || !boundedArray(source.items, 50) || (source.nextBeforeVersion !== null && !isWidgetRevision(source.nextBeforeVersion))) {
    invalidResponse("widget publication history");
  }
  let upperBound = Math.min(beforeVersion ?? Infinity, (activeVersion ?? 0) + 1);
  const items = source.items.map((entry) => {
    const row = parseWidgetHistoryEntry(entry);
    if (row.versionNumber >= upperBound) invalidResponse("widget history page order");
    upperBound = row.versionNumber;
    return row;
  });
  if ((beforeVersion === undefined && activeVersion !== null && items[0]?.versionNumber !== activeVersion)
    || (source.nextBeforeVersion !== null && source.nextBeforeVersion !== items.at(-1)?.versionNumber)) {
    invalidResponse("widget history page boundary");
  }
  return { items, nextBeforeVersion: source.nextBeforeVersion };
}

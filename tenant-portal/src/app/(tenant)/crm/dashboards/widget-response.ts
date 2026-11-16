import { isUUIDv7 } from "@/lib/uuid";
import { boundedArray, finiteNumber, invalidResponse, nonEmptyString, optionalString, record, timestamp } from "./dashboard-parse";
import { TIME_GRAINS, isVisualization, isAccessLevel, parseBox, type WidgetDefinition, type WidgetQuerySpec, type WidgetUsage } from "./widget-contract";
import { DATE_PRESETS } from "./dashboard-run-contract";
import { isGovernedTargetBinding } from "./won-target-evidence";

export function parseWidgetDefinition(payload: unknown): WidgetDefinition {
  const source = record(payload);
  if (
    !source ||
    !isUUIDv7(source.id) ||
    !isUUIDv7(source.ownerUserId) ||
    !nonEmptyString(source.name) ||
    !isVisualization(source.visualizationType) ||
    !timestamp(source.updatedAt) ||
    !Number.isSafeInteger(source.revision) || (source.revision as number) < 1
    || (source.accessLevel !== undefined && !isAccessLevel(source.accessLevel))
  ) {
    invalidResponse("widget");
  }
  return {
    id: source.id,
    ownerUserId: source.ownerUserId,
    ownerName: optionalString(source.ownerName),
    name: source.name,
    visualizationType: source.visualizationType,
    querySpec: parseQuerySpec(source.querySpec),
    displaySpec: record(source.displaySpec) ?? {},
    schemaVersion: finiteNumber(source.schemaVersion) ? source.schemaVersion : 1,
    revision: source.revision as number,
    createdAt: timestamp(source.createdAt) ? source.createdAt : source.updatedAt,
    updatedAt: source.updatedAt,
    // Dashboard placement projections omit authority; they may only be viewed.
    // Mutation receipts separately require explicit OWNER/EDIT authority.
    accessLevel: isAccessLevel(source.accessLevel) ? source.accessLevel : "VIEW",
    isShared: source.isShared === true,
  };
}

/**
 * Preserve stored fields the renderer and editor do not own.
 */
export function parseQuerySpec(payload: unknown, allowEmptySeries = false): WidgetQuerySpec {
  const source = record(payload);
  if (!source || !boundedArray(source.series, 4) || (!allowEmptySeries && source.series.length === 0)) {
    invalidResponse("widget query spec");
  }
  const series = source.series.map((entry) => {
    const item = record(entry);
    if (!item || !nonEmptyString(item.metricKey)
      || (item.axis !== undefined && item.axis !== "LEFT" && item.axis !== "RIGHT")
      || (item.label !== undefined && (typeof item.label !== "string" || item.label.length > 80))
      || (item.color !== undefined && (typeof item.color !== "string" || !/^#[0-9a-f]{6}$/i.test(item.color)))) invalidResponse("widget query spec");
    return { ...item, metricKey: item.metricKey } as WidgetQuerySpec["series"][number];
  });
  if (source.dimension !== undefined) {
    const dimension = record(source.dimension);
    if (!dimension || !nonEmptyString(dimension.key) || (dimension.grain !== undefined && !(TIME_GRAINS as readonly unknown[]).includes(dimension.grain))) invalidResponse("widget dimension");
  }
  if (source.filters !== undefined && !record(source.filters)) invalidResponse("widget filters");
  if (source.comparison !== undefined) {
    const comparison = record(source.comparison);
    if (!comparison || !["NONE", "TARGET", "PREVIOUS_PERIOD", "PREVIOUS_YEAR", "DATASETS", "GOVERNED_TARGET"].includes(String(comparison.type))
      || (comparison.target !== undefined && !finiteNumber(comparison.target))) invalidResponse("widget comparison");
    if (comparison.type === "DATASETS") {
      if ((comparison.basis !== "PERIOD" && comparison.basis !== "BRANCH") || !boundedArray(comparison.datasets, 3)
        || comparison.datasets.length < 2 || comparison.datasets.some((dataset) => !validDatasetSelection(dataset, comparison.basis))) {
        invalidResponse("widget comparison datasets");
      }
    }
    if (comparison.type === "GOVERNED_TARGET"
      ? !isGovernedTargetBinding(comparison.governedTarget) || comparison.target !== undefined || comparison.basis !== undefined || comparison.datasets !== undefined
      : comparison.governedTarget !== undefined) invalidResponse("widget governed target");
  }
  return { ...(source as object), series } as WidgetQuerySpec;
}

function validDatasetSelection(value: unknown, basis: unknown): boolean {
  const selection = record(value);
  if (!selection) return false;
  if (basis === "BRANCH") return isUUIDv7(selection.branchId);
  if (!(DATE_PRESETS as readonly unknown[]).includes(selection.datePreset)) return false;
  if (selection.datePreset !== "CUSTOM") return selection.dateFrom === undefined && selection.dateTo === undefined;
  const civil = (date: unknown): date is string => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
    && timestamp(`${date}T00:00:00Z`) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
  return civil(selection.dateFrom) && civil(selection.dateTo) && selection.dateFrom <= selection.dateTo;
}

export function parseUsage(payload: unknown): WidgetUsage {
  const source = record(payload);
  if (!source || !boundedArray(source.placements, 20)
    || [source.placementCount, source.dashboardCount, source.hiddenPlacementCount].some((value) => !Number.isSafeInteger(value) || (value as number) < 0)
    || (source.activeShareCount !== undefined && (!Number.isSafeInteger(source.activeShareCount) || (source.activeShareCount as number) < 0))
    || (source.nextCursor != null && !isUUIDv7(source.nextCursor))) invalidResponse("widget usage");
  const placements = source.placements.map((entry) => {
      const row = record(entry);
      const box = parseBox(entry);
      if (!row || !box || !isUUIDv7(row.placementId) || !isUUIDv7(row.dashboardId) || !nonEmptyString(row.dashboardName)) invalidResponse("widget placement usage");
      return {
        placementId: row.placementId,
        dashboardId: row.dashboardId,
        dashboardName: row.dashboardName,
        dashboardRevision: finiteNumber(row.dashboardRevision) ? row.dashboardRevision : 0,
        ...box,
      };
  });
  const { placementCount, dashboardCount, hiddenPlacementCount } = source as Record<"placementCount" | "dashboardCount" | "hiddenPlacementCount", number>;
  const nextCursor = source.nextCursor ?? null;
  if (dashboardCount > placementCount || hiddenPlacementCount + placements.length > placementCount
    || new Set(placements.map(item => item.placementId)).size !== placements.length
    || (nextCursor && (placements.length !== 20 || placements.at(-1)?.placementId !== nextCursor))) invalidResponse("widget usage page");
  return { placementCount, dashboardCount, hiddenPlacementCount, placements,
    activeShareCount: finiteNumber(source.activeShareCount) ? source.activeShareCount : null, nextCursor: nextCursor as string | null,
  };
}


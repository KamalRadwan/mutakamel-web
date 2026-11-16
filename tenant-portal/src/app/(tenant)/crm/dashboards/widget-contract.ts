// Wire contract for CRM widget definitions.
//
// Transcribed from crm-app/src/crm/dashboards/dashboard-widgets.controller.ts,
// dashboard-widgets.service.ts, dashboard-catalog.ts and
// dto/dashboard-builder.dto.ts. The vocabulary lives here rather than beside
// the /crm/widgets screen because crm-app declares it inside the *dashboards*
// module and a placement carries a whole widget — the same
// pipelines-owns-the-stage-vocabulary precedent as
// `pipelines/pipeline-contract.ts`.

import { isUUIDv7 } from "@/lib/uuid";
export { parseWidgetDefinition } from "./widget-response";
import {
  finiteNumber,
  invalidResponse,
  record,
} from "./dashboard-parse";

export const WIDGETS_PATH = "/api/tenant/crm/v1/widgets";
export const WIDGET_CATALOG_PATH = "/api/tenant/crm/v1/widgets/catalog";
export const WIDGET_PREVIEW_PATH = "/api/tenant/crm/v1/widgets/preview";
export const WIDGET_SHARE_TARGETS_PATH =
  "/api/tenant/crm/v1/widgets/share-targets";
export const CRM_WIDGET_SOURCE_RESOURCES = ["leads", "opportunities", "activities", "customer_profiles", "targets"] as const;
export type WidgetSourceResource = typeof CRM_WIDGET_SOURCE_RESOURCES[number];

/** `@MaxLength(120)` on every `name` in dashboard-builder.dto.ts. */
const WIDGET_NAME_MAX_LENGTH = 120;
/** DashboardDisplaySpecDto trims these two strings, and no scalar option. */
export function normalizeWidgetDisplaySpec(display: Record<string, unknown>): Record<string, unknown> {
  return { ...display,
    ...(typeof display.title === "string" ? { title: display.title.trim() } : {}),
    ...(typeof display.subtitle === "string" ? { subtitle: display.subtitle.trim() } : {}) };
}
/** `LIMIT 21` guards on every placement query; more than 20 is a 409. */
export const DASHBOARD_WIDGET_LIMIT = 20;

/** `CRM_DASHBOARD_VISUALIZATIONS` — dashboard-catalog.ts. */
const CRM_VISUALIZATIONS = [
  "METRIC_CARD", "LINE", "AREA", "LINE_AREA", "COLUMN", "BAR", "STACKED_BAR",
  "PIE", "DONUT", "SCATTER", "BUBBLE", "GANTT", "FLOWCHART",
  "SEMI_CIRCLE_GAUGE", "THREE_QUARTER_GAUGE", "CIRCULAR_PROGRESS_GAUGE",
  "DETAILED_SPEEDOMETER", "TABLE", "FUNNEL", "HEATMAP", "MULTI_KPI",
  "PROGRESS_CARD", "BULLET", "STACKED_BAR_100", "COMBO", "WATERFALL",
  "TREEMAP", "LEADERBOARD", "SCORECARD", "HISTOGRAM", "BOX_PLOT", "CALENDAR", "TIMELINE",
  "CALENDAR_HEATMAP", "ALERT_LIST", "ACTIVITY_FEED",
] as const;
export type CrmVisualization = (typeof CRM_VISUALIZATIONS)[number];

/** `CrmDashboardDataShape` — dashboard-catalog.ts. */
const CRM_DATA_SHAPES = [
  "SCALAR", "TIME_SERIES", "CATEGORY", "XY", "INTERVAL", "GRAPH", "ROWS",
  "HIERARCHY", "BINNED_DISTRIBUTION", "DURATION_DISTRIBUTION", "WATERFALL", "EVENT_STREAM",
] as const;
export type CrmDataShape = (typeof CRM_DATA_SHAPES)[number];

/** `CrmDashboardMetricUnit` — dashboard-catalog.ts. */
const CRM_METRIC_UNITS = ["COUNT", "MONEY", "PERCENT", "DURATION", "SCORE"] as const;
export type CrmMetricUnit = (typeof CRM_METRIC_UNITS)[number];

export const TIME_GRAINS = ["DAY", "WEEK", "MONTH", "QUARTER", "YEAR"] as const;
export type TimeGrain = (typeof TIME_GRAINS)[number];

export type ComparisonType = "PREVIOUS_PERIOD" | "PREVIOUS_YEAR" | "TARGET" | "NONE" | "DATASETS" | "GOVERNED_TARGET";
export type ComparisonDatasetBasis = "PERIOD" | "BRANCH";
export interface ComparisonDatasetSelection { datePreset?: string; dateFrom?: string; dateTo?: string; branchId?: string }

const ACCESS_LEVELS = ["OWNER", "EDIT", "VIEW"] as const;
export type ResourceAccessLevel = (typeof ACCESS_LEVELS)[number];

/**
 * `DashboardWidgetQuerySpecDto`.
 *
 * Held as an opaque-but-typed record on read and echoed back byte-for-byte on
 * update: `DashboardWidgetsService.update` merges `dto.querySpec ?? current`,
 * so a partial spec would silently drop the parts the form does not edit.
 */
export interface WidgetQuerySpec {
  engine?: "LEGACY_V1" | "SEMANTIC_V1";
  semanticVersion?: 1;
  source?: "leads" | "opportunities";
  semanticFilters?: Array<{
    field: "status" | "stageId" | "sourceId";
    operator: "EQ" | "IN";
    values: string[];
  }>;
  series: Array<{ metricKey: string; axis?: "LEFT" | "RIGHT"; label?: string; color?: string }>;
  dimension?: { key: string; grain?: TimeGrain };
  filters?: Record<string, unknown>;
  comparison?: { type: ComparisonType; target?: number; basis?: ComparisonDatasetBasis; datasets?: ComparisonDatasetSelection[];
    governedTarget?: import("./won-target-evidence").GovernedTargetBinding };
  topN?: number;
  maxPoints?: number;
}

export interface WidgetDefinition {
  id: string;
  ownerUserId: string;
  ownerName: string | null;
  name: string;
  visualizationType: CrmVisualization;
  querySpec: WidgetQuerySpec;
  displaySpec: Record<string, unknown>;
  schemaVersion: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
  /** Present on every read path; the list adds `isShared` beside it. */
  accessLevel: ResourceAccessLevel;
  isShared: boolean;
}

interface WidgetPlacementUsage {
  placementId: string;
  dashboardId: string;
  dashboardName: string;
  dashboardRevision: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** `DashboardWidgetsService.usage` — `activeShareCount` is OWNER-only. */
export interface WidgetUsage {
  placementCount: number;
  dashboardCount: number;
  activeShareCount: number | null;
  hiddenPlacementCount: number;
  placements: WidgetPlacementUsage[];
  nextCursor: string | null;
}

export function widgetPath(id: string): string {
  return `${WIDGETS_PATH}/${encodeId(id)}`;
}

export function widgetUsagePath(id: string, cursor: string | null): string {
  return cursor ? `${widgetPath(id)}?usageCursor=${encodeId(cursor)}` : widgetPath(id);
}

export function widgetClonePath(id: string): string {
  return `${widgetPath(id)}/clone`;
}

/**
 * Definition fields for `POST /widgets/preview`.
 *
 * `displaySpec` is omitted rather than sent as `{}`: it is `@IsOptional()`, and
 * the service already stores `{}` when it is absent.
 */
export function buildCreateWidgetRequest(input: {
  name: string;
  visualizationType: CrmVisualization;
  querySpec: WidgetQuerySpec;
  displaySpec?: Record<string, unknown>;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    name: requiredName(input.name),
    visualizationType: input.visualizationType,
    querySpec: input.querySpec,
  };
  if (input.displaySpec && Object.keys(input.displaySpec).length > 0) {
    body.displaySpec = normalizeWidgetDisplaySpec(input.displaySpec);
  }
  return body;
}

/** `POST /widgets/:id/clone` — `name` is optional; the server appends " Copy". */
export function buildCloneWidgetRequest(name: string): Record<string, unknown> {
  const trimmed = name.trim();
  return trimmed.length > 0 ? { name: requiredName(trimmed) } : {};
}

export function parseBox(
  payload: unknown,
): { x: number; y: number; width: number; height: number } | null {
  const source = record(payload);
  if (
    !source ||
    !finiteNumber(source.x) ||
    !finiteNumber(source.y) ||
    !finiteNumber(source.width) ||
    !finiteNumber(source.height)
  ) {
    return null;
  }
  return { x: source.x, y: source.y, width: source.width, height: source.height };
}

export function isVisualization(value: unknown): value is CrmVisualization {
  return CRM_VISUALIZATIONS.includes(value as CrmVisualization);
}

export function isDataShape(value: unknown): value is CrmDataShape {
  return CRM_DATA_SHAPES.includes(value as CrmDataShape);
}

export function isMetricUnit(value: unknown): value is CrmMetricUnit {
  return CRM_METRIC_UNITS.includes(value as CrmMetricUnit);
}

export function isAccessLevel(value: unknown): value is ResourceAccessLevel {
  return ACCESS_LEVELS.includes(value as ResourceAccessLevel);
}

export function encodeId(id: string): string {
  if (!isUUIDv7(id)) invalidResponse("identifier");
  return encodeURIComponent(id);
}

function requiredName(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > WIDGET_NAME_MAX_LENGTH) {
    throw new Error("CRM_WIDGET_NAME_INVALID");
  }
  return trimmed;
}

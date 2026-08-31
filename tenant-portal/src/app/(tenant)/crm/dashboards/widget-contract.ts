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
import {
  boundedArray,
  finiteNumber,
  invalidResponse,
  nonEmptyString,
  optionalString,
  record,
  timestamp,
} from "./dashboard-parse";

export const WIDGETS_PATH = "/api/tenant/crm/v1/widgets";
export const WIDGET_PREVIEW_PATH = "/api/tenant/crm/v1/widgets/preview";
export const WIDGET_SHARE_TARGETS_PATH =
  "/api/tenant/crm/v1/widgets/share-targets";

/** `@MaxLength(120)` on every `name` in dashboard-builder.dto.ts. */
export const WIDGET_NAME_MAX_LENGTH = 120;
/** `LIMIT 21` guards on every placement query; more than 20 is a 409. */
export const DASHBOARD_WIDGET_LIMIT = 20;
const MAX_WIDGETS_IN_RESPONSE = 500;

/** `CRM_DASHBOARD_VISUALIZATIONS` — dashboard-catalog.ts. */
const CRM_VISUALIZATIONS = [
  "METRIC_CARD", "LINE", "AREA", "LINE_AREA", "COLUMN", "BAR", "STACKED_BAR",
  "PIE", "DONUT", "SCATTER", "BUBBLE", "GANTT", "FLOWCHART",
  "SEMI_CIRCLE_GAUGE", "THREE_QUARTER_GAUGE", "CIRCULAR_PROGRESS_GAUGE",
  "DETAILED_SPEEDOMETER", "TABLE", "FUNNEL", "HEATMAP", "MULTI_KPI",
  "PROGRESS_CARD", "BULLET", "STACKED_BAR_100", "COMBO", "WATERFALL",
  "TREEMAP", "LEADERBOARD", "SCORECARD", "HISTOGRAM", "CALENDAR", "TIMELINE",
  "CALENDAR_HEATMAP", "ALERT_LIST", "ACTIVITY_FEED",
] as const;
export type CrmVisualization = (typeof CRM_VISUALIZATIONS)[number];

/** `CrmDashboardDataShape` — dashboard-catalog.ts. */
const CRM_DATA_SHAPES = [
  "SCALAR", "TIME_SERIES", "CATEGORY", "XY", "INTERVAL", "GRAPH", "ROWS",
  "HIERARCHY", "BINNED_DISTRIBUTION", "WATERFALL", "EVENT_STREAM",
] as const;
export type CrmDataShape = (typeof CRM_DATA_SHAPES)[number];

/** `CrmDashboardMetricUnit` — dashboard-catalog.ts. */
const CRM_METRIC_UNITS = ["COUNT", "MONEY", "PERCENT", "DURATION", "SCORE"] as const;
export type CrmMetricUnit = (typeof CRM_METRIC_UNITS)[number];

export const TIME_GRAINS = ["DAY", "WEEK", "MONTH", "QUARTER", "YEAR"] as const;
export type TimeGrain = (typeof TIME_GRAINS)[number];

type ComparisonType = "PREVIOUS_PERIOD" | "PREVIOUS_YEAR" | "TARGET" | "NONE";

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
  comparison?: { type: ComparisonType; target?: number };
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
interface WidgetUsage {
  placementCount: number;
  dashboardCount: number;
  activeShareCount: number | null;
  hiddenPlacementCount: number;
  placements: WidgetPlacementUsage[];
}

export interface WidgetDetail extends WidgetDefinition {
  usage: WidgetUsage | null;
}

/** `PATCH /widgets/:id` also reports what it did to other dashboards. */
export interface WidgetUpdateResult extends WidgetDefinition {
  dashboardRevisions: Record<string, number>;
  layoutAdjustments: Array<{
    placementId: string;
    dashboardId: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}

export function widgetPath(id: string): string {
  return `${WIDGETS_PATH}/${encodeId(id)}`;
}

export function widgetClonePath(id: string): string {
  return `${widgetPath(id)}/clone`;
}

/**
 * `POST /widgets` body — `CreateWidgetDto`.
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
    body.displaySpec = input.displaySpec;
  }
  return body;
}

/**
 * `PATCH /widgets/:id` body — `UpdateWidgetDto`.
 *
 * `revision` is **required** and is the optimistic-concurrency token; a stale
 * one is a `409 CRM_WIDGET_REVISION_CONFLICT`. There is no `If-Match` and no
 * `ETag` anywhere in crm-app.
 */
export function buildUpdateWidgetRequest(input: {
  revision: number;
  name?: string;
  visualizationType?: CrmVisualization;
  querySpec?: WidgetQuerySpec;
  displaySpec?: Record<string, unknown>;
}): Record<string, unknown> {
  const body: Record<string, unknown> = { revision: input.revision };
  if (input.name !== undefined) body.name = requiredName(input.name);
  if (input.visualizationType !== undefined) body.visualizationType = input.visualizationType;
  if (input.querySpec !== undefined) body.querySpec = input.querySpec;
  if (input.displaySpec !== undefined) body.displaySpec = input.displaySpec;
  return body;
}

/** `POST /widgets/:id/clone` — `name` is optional; the server appends " Copy". */
export function buildCloneWidgetRequest(name: string): Record<string, unknown> {
  const trimmed = name.trim();
  return trimmed.length > 0 ? { name: requiredName(trimmed) } : {};
}

export function parseWidgetsResponse(payload: unknown): WidgetDefinition[] {
  if (!boundedArray(payload, MAX_WIDGETS_IN_RESPONSE)) invalidResponse("widgets");
  return payload.map(parseWidgetDefinition);
}

export function parseWidgetDetailResponse(payload: unknown): WidgetDetail {
  const source = record(payload);
  if (!source) invalidResponse("widget");
  return {
    ...parseWidgetDefinition(source),
    usage: source.usage === undefined ? null : parseUsage(source.usage),
  };
}

export function parseWidgetUpdateResponse(payload: unknown): WidgetUpdateResult {
  const source = record(payload);
  if (!source) invalidResponse("widget");
  const revisions = record(source.dashboardRevisions) ?? {};
  const adjustments = boundedArray(source.layoutAdjustments, DASHBOARD_WIDGET_LIMIT)
    ? source.layoutAdjustments
    : [];
  return {
    ...parseWidgetDefinition(source),
    dashboardRevisions: Object.fromEntries(
      Object.entries(revisions).filter(
        (entry): entry is [string, number] => finiteNumber(entry[1]),
      ),
    ),
    layoutAdjustments: adjustments.flatMap((entry) => {
      const box = parseBox(entry);
      const row = record(entry);
      return box && row && isUUIDv7(row.placementId) && isUUIDv7(row.dashboardId)
        ? [{ placementId: row.placementId, dashboardId: row.dashboardId, ...box }]
        : [];
    }),
  };
}

export function parseWidgetDefinition(payload: unknown): WidgetDefinition {
  const source = record(payload);
  if (
    !source ||
    !isUUIDv7(source.id) ||
    !isUUIDv7(source.ownerUserId) ||
    !nonEmptyString(source.name) ||
    !isVisualization(source.visualizationType) ||
    !timestamp(source.createdAt) ||
    !timestamp(source.updatedAt) ||
    !finiteNumber(source.revision)
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
    revision: source.revision,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
    accessLevel: isAccessLevel(source.accessLevel) ? source.accessLevel : "VIEW",
    isShared: source.isShared === true,
  };
}

/**
 * The stored spec is echoed back on update, so it is preserved verbatim and
 * only `series` — the one part the screen reads — is validated.
 */
function parseQuerySpec(payload: unknown): WidgetQuerySpec {
  const source = record(payload);
  if (!source || !boundedArray(source.series, 4) || source.series.length === 0) {
    invalidResponse("widget query spec");
  }
  const series = source.series.map((entry) => {
    const item = record(entry);
    if (!item || !nonEmptyString(item.metricKey)) invalidResponse("widget query spec");
    return { ...item, metricKey: item.metricKey } as WidgetQuerySpec["series"][number];
  });
  return { ...(source as object), series } as WidgetQuerySpec;
}

function parseUsage(payload: unknown): WidgetUsage {
  const source = record(payload);
  if (!source || !Array.isArray(source.placements)) invalidResponse("widget usage");
  return {
    placementCount: finiteNumber(source.placementCount) ? source.placementCount : 0,
    dashboardCount: finiteNumber(source.dashboardCount) ? source.dashboardCount : 0,
    activeShareCount: finiteNumber(source.activeShareCount) ? source.activeShareCount : null,
    hiddenPlacementCount: finiteNumber(source.hiddenPlacementCount)
      ? source.hiddenPlacementCount
      : 0,
    placements: source.placements.flatMap((entry) => {
      const row = record(entry);
      const box = parseBox(entry);
      if (!row || !box || !isUUIDv7(row.placementId) || !isUUIDv7(row.dashboardId)) return [];
      return [{
        placementId: row.placementId,
        dashboardId: row.dashboardId,
        dashboardName: nonEmptyString(row.dashboardName) ? row.dashboardName : row.dashboardId,
        dashboardRevision: finiteNumber(row.dashboardRevision) ? row.dashboardRevision : 0,
        ...box,
      }];
    }),
  };
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

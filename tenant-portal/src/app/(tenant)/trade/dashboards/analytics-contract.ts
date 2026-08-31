import type { TradePath } from "@/lib/api/envelope";
import type { NormalizedApiError } from "@/lib/api/errors";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import {
  isBoundedInteger,
  isDecimalString,
  isMemberOf,
  isNonEmptyString,
  isTimestamp,
  isUuidV7,
  record,
} from "../trade-advanced-validation";

// Trade dashboards and widgets — 31 routes.
// docs/api/trade-advanced.md#dashboards--20-routes and #widgets--11-routes,
// verified against trade-app/src/modules/dashboards/{dashboard.controller.ts,
// widget.controller.ts,dashboard-definition.service.ts,
// dashboard-widget.service.ts,dashboard-execution.service.ts,
// dashboard-metric-provider.service.ts,dto/dashboard.dto.ts}.
//
// Four departures from the rest of Trade, all load-bearing:
//
//   1. **Concurrency is `revision`, not `version`.** The controllers set
//      `ETag: "<revision>"` themselves; the interceptor's automatic ETag never
//      fires because these payloads carry no `version`. The conflict code is
//      409 `TRADE.DASHBOARD.REVISION_CONFLICT`, not
//      `TRADE.CONCURRENCY.STALE_VERSION`. The If-Match parser is the same one.
//   2. **Write responses are not unwrapped.** Services return
//      `{ created, replayed, dashboard }`, which fails the interceptor's
//      `value`+`replayed` test and passes through verbatim — so `data.dashboard`
//      is the record and `data.replayed` is a boolean in the BODY.
//   3. **`GET /dashboards` uses `limit`+`offset`** and answers
//      `{ items, pagination: { limit, offset, nextOffset } }` — there is **no
//      `total`**, so `derivePageInfo` does not apply and no page count exists.
//   4. **`DASHBOARD_CONTEXT` bypasses `TradePermissionsGuard` entirely.** The
//      declared permission strings are not enforced by the guard; the dashboard
//      service authorizes each resolved company itself. A 403 here carries a
//      `TRADE.DASHBOARD.*` code, and two real permission failures arrive as
//      **422** (`METRIC_PERMISSION_REQUIRED`, and `SCOPE_DENIED` on one path).

export const DASHBOARDS_PATH = "/api/tenant/trade/v1/dashboards";
export const DASHBOARDS_CATALOG_PATH = "/api/tenant/trade/v1/dashboards/catalog";
export const DASHBOARDS_NAVIGATION_PATH = "/api/tenant/trade/v1/dashboards/navigation";
export const DASHBOARDS_DEFAULT_PATH = "/api/tenant/trade/v1/dashboards/default";
export const DASHBOARDS_SHARE_TARGETS_PATH =
  "/api/tenant/trade/v1/dashboards/share-targets";
export const WIDGETS_PATH = "/api/tenant/trade/v1/widgets";
export const WIDGETS_PREVIEW_PATH = "/api/tenant/trade/v1/widgets/preview";
export const WIDGETS_SHARE_TARGETS_PATH = "/api/tenant/trade/v1/widgets/share-targets";

export const DASHBOARD_LIST_LIMIT = 50;

/** `TRADE_DASHBOARD_LIMITS` — the server's own numbers. */
export const DASHBOARD_LIMITS = {
  nameMaxLength: 120,
  descriptionMaxLength: 500,
  gridColumns: 12,
  maxPlacements: 20,
  maxWidgetSeries: 4,
  maxExplicitCompanyScopes: 25,
  maxShareTargets: 100,
  maxWidgetHeight: 24,
  maxLayoutY: 10_000,
} as const;

// The rest of the dashboard enums — scope coverage, preference kind, run
// status, widget execution status, unavailable-placement reason, metric unit,
// data shape, time grain, aggregation, series axis, widget comparison and
// legend position — are rendered through `t.tradeStatus`, which holds every
// value. They are not restated as arrays here because nothing narrows against
// them: an unmapped value must render as itself, which `tradeStatusLabel`
// already does.
export const DASHBOARD_ACCESS_LEVELS = ["OWNER", "EDIT", "VIEW"] as const;
/** `ShareChangeDto.accessLevel` is `@IsIn(["VIEW","EDIT"])` — **not OWNER**. */
export const DASHBOARD_SHAREABLE_ACCESS_LEVELS = ["VIEW", "EDIT"] as const;
export const DASHBOARD_SHARE_SUBJECT_TYPES = ["USER", "TEAM"] as const;
/** Twenty types. A widget editor offering fewer silently drops metrics. */
export const DASHBOARD_VISUALIZATION_TYPES = [
  "METRIC_CARD",
  "LINE",
  "AREA",
  "LINE_AREA",
  "COLUMN",
  "BAR",
  "STACKED_BAR",
  "PIE",
  "DONUT",
  "SCATTER",
  "BUBBLE",
  "GANTT",
  "FLOWCHART",
  "SEMI_CIRCLE_GAUGE",
  "THREE_QUARTER_GAUGE",
  "CIRCULAR_PROGRESS_GAUGE",
  "DETAILED_SPEEDOMETER",
  "TABLE",
  "FUNNEL",
  "HEATMAP",
] as const;

export type DashboardVisualizationType = (typeof DASHBOARD_VISUALIZATION_TYPES)[number];
export type DashboardShareableAccessLevel =
  (typeof DASHBOARD_SHAREABLE_ACCESS_LEVELS)[number];
export type DashboardShareSubjectType = (typeof DASHBOARD_SHARE_SUBJECT_TYPES)[number];

/**
 * The `scalar` union.
 *
 * `scalarResult()` writes
 * `metric.unit === COUNT ? safeCount(value) : decimal(value)`, so the type is
 * discriminated by `unit`, not by the field: a COUNT metric sends a JavaScript
 * number, and **every other unit — MONEY included — sends a decimal string**.
 * One validator cannot type both, so this is a tagged union and the money
 * branch never touches `Number()`.
 *
 * `decimal()` silently answers `"0"` for anything it cannot parse, so a `"0"`
 * here is not proof the metric really is zero.
 */
export type DashboardScalar =
  | { kind: "count"; value: number }
  | { kind: "decimal"; value: string };

export function parseDashboardScalar(
  value: unknown,
  unit: string,
): DashboardScalar | null {
  if (unit === "COUNT") {
    return isBoundedInteger(value, 0, Number.MAX_SAFE_INTEGER)
      ? { kind: "count", value }
      : null;
  }
  return isDecimalString(value) ? { kind: "decimal", value } : null;
}

export interface DashboardListEntry {
  id: string;
  name: string;
  description: string | null;
  sourceTemplateKey: string | null;
  accessLevel: string;
  isShared: boolean;
  isDefault: boolean;
  isFavorite: boolean;
  revision: number;
  updatedAt: string;
}

/**
 * `{ items, pagination }` — the only Trade list with an `offset` cursor and no
 * `total`. "How many pages?" is unanswerable; `nextOffset` is the only signal
 * that more exist, and it is `null` at the end.
 */
export interface DashboardListPage {
  items: DashboardListEntry[];
  limit: number;
  offset: number;
  nextOffset: number | null;
}

interface DashboardPlacementWidget {
  id: string;
  name: string;
  visualizationType: string;
  revision: number;
}

export interface DashboardPlacement {
  id: string;
  widgetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  sortOrder: number;
  widget: DashboardPlacementWidget;
}

interface UnavailablePlacement {
  placementId: string;
  reasonCode: string;
}

export interface DashboardDetail {
  id: string;
  name: string;
  description: string | null;
  scopeCoverage: string;
  accessLevel: string;
  isShared: boolean;
  isDefault: boolean;
  isFavorite: boolean;
  revision: number;
  updatedAt: string;
  placements: DashboardPlacement[];
  unavailablePlacements: UnavailablePlacement[];
}

interface DashboardPoint {
  key: string;
  /** Same union as `scalar`, for the same reason. */
  value: DashboardScalar | null;
}

interface DashboardSeries {
  key: string;
  unit: string;
  currencyCode: string | null;
  points: DashboardPoint[];
}

export interface DashboardPartition {
  companyId: string;
  currencyCode: string | null;
  scalar: DashboardScalar | null;
  series: DashboardSeries[];
}

export interface WidgetExecutionResult {
  widgetId: string;
  status: string;
  shape: string;
  completeness: string;
  partitions: DashboardPartition[];
  /**
   * Present only on a `FAILED` tile inside a **200** run. A grid that keys on
   * the request status alone renders a broken widget as loaded.
   */
  errorCode: string | null;
  asOf: string | null;
}

export interface DashboardRunResult {
  dashboardId: string;
  dashboardRevision: number;
  status: string;
  generatedAt: string;
  widgets: WidgetExecutionResult[];
  unavailablePlacements: UnavailablePlacement[];
}

interface WidgetSeriesSpec {
  metricKey: string;
  label: string | null;
  axis: string | null;
  aggregation: string | null;
}

export interface WidgetRecord {
  id: string;
  name: string;
  visualizationType: string;
  revision: number;
  accessLevel: string;
  isShared: boolean;
  updatedAt: string;
  series: WidgetSeriesSpec[];
  displayTitle: string | null;
  legendPosition: string | null;
  precision: number | null;
}

export interface ShareTarget {
  subjectId: string;
  subjectType: string;
  label: string;
}

export interface ShareRecord {
  id: string;
  subjectId: string;
  subjectType: string;
  accessLevel: string;
}

interface CatalogMetric {
  key: string;
  unit: string;
  shape: string;
  compatibleVisualizations: string[];
}

export interface DashboardCatalog {
  catalogVersion: number;
  metrics: CatalogMetric[];
  templates: Array<{ templateKey: string; name: string | null }>;
}

// ---- paths ---------------------------------------------------------------

export function dashboardsListPath(offset: number): TradePath {
  // `page` is a 400 here: DashboardListQueryDto whitelists limit and offset.
  const query = new URLSearchParams({
    limit: String(DASHBOARD_LIST_LIMIT),
    offset: String(offset),
  });
  return `${DASHBOARDS_PATH}?${query.toString()}` as TradePath;
}

export function dashboardPath(id: string): TradePath {
  if (!isUuidV7(id)) invalidAnalyticsResponse();
  return `${DASHBOARDS_PATH}/${encodeURIComponent(id)}` as TradePath;
}

export function dashboardActionPath(
  id: string,
  action: "duplicate" | "set-default" | "set-favorite" | "run" | "layout" | "placements" | "shares",
): TradePath {
  return `${dashboardPath(id)}/${action}` as TradePath;
}

export function dashboardSharesBulkPath(id: string): TradePath {
  return `${dashboardPath(id)}/shares/bulk-upsert` as TradePath;
}

export function dashboardSharePath(id: string, shareId: string): TradePath {
  if (!isUuidV7(shareId)) invalidAnalyticsResponse();
  return `${dashboardPath(id)}/shares/${encodeURIComponent(shareId)}` as TradePath;
}

export function dashboardPlacementPath(id: string, placementId: string): TradePath {
  if (!isUuidV7(placementId)) invalidAnalyticsResponse();
  return `${dashboardPath(id)}/placements/${encodeURIComponent(placementId)}` as TradePath;
}

export function dashboardFromTemplatePath(templateKey: string): TradePath {
  return `${DASHBOARDS_PATH}/from-template/${encodeURIComponent(templateKey)}` as TradePath;
}

export function widgetPath(id: string): TradePath {
  if (!isUuidV7(id)) invalidAnalyticsResponse();
  return `${WIDGETS_PATH}/${encodeURIComponent(id)}` as TradePath;
}

export function widgetClonePath(id: string): TradePath {
  return `${widgetPath(id)}/clone` as TradePath;
}

export function widgetSharesPath(id: string): TradePath {
  return `${widgetPath(id)}/shares` as TradePath;
}

export function widgetSharesBulkPath(id: string): TradePath {
  return `${widgetPath(id)}/shares/bulk-upsert` as TradePath;
}

export function widgetSharePath(id: string, shareId: string): TradePath {
  if (!isUuidV7(shareId)) invalidAnalyticsResponse();
  return `${widgetPath(id)}/shares/${encodeURIComponent(shareId)}` as TradePath;
}

export function shareTargetsPath(base: string, search: string): TradePath {
  const query = new URLSearchParams({ limit: "50" });
  if (search.trim().length > 0) query.set("search", search.trim());
  return `${base}?${query.toString()}` as TradePath;
}

// ---- parsers -------------------------------------------------------------

/**
 * A dashboard or widget **write** answers `{ created?, replayed, <record> }`
 * rather than the record alone, because the interceptor leaves that shape
 * alone. This pulls the record back out.
 */
export function unwrapAnalyticsWrite(payload: unknown, key: "dashboard" | "widget"): unknown {
  const row = record(payload);
  if (row && "replayed" in row && row[key] !== undefined) return row[key];
  return payload;
}

/** `data.replayed` is a boolean in the BODY here, not only a header. */
export function isAnalyticsBodyReplay(payload: unknown): boolean {
  const row = record(payload);
  return row?.replayed === true;
}

export interface DashboardNavigation {
  items: DashboardListEntry[];
  activeDashboardId: string | null;
}

/**
 * `GET /dashboards/navigation` answers a compact switcher, not a page: the
 * same accessible rows the list returns, plus the id that opens first and the
 * preference context they were resolved under. It carries no pagination at
 * all — the service caps it at 100 rows.
 */
export function parseDashboardNavigation(payload: unknown): DashboardNavigation {
  const body = record(payload);
  if (!body || !Array.isArray(body.items)) invalidAnalyticsResponse();
  return {
    items: body.items.map(parseDashboardListEntry),
    activeDashboardId: isUuidV7(body.activeDashboardId) ? body.activeDashboardId : null,
  };
}

/**
 * `GET /dashboards/default` answers `{ dashboard, ensureTemplate }`.
 *
 * When the caller has no dashboard at all, `dashboard` is null and
 * `ensureTemplate.templateKey` names the template the server suggests
 * creating — which is why the screen offers that create rather than an empty
 * state with no way forward.
 */
export function parseDashboardDefault(payload: unknown): {
  dashboardId: string | null;
  ensureTemplateKey: string | null;
} {
  const body = record(payload);
  if (!body) invalidAnalyticsResponse();
  const dashboard = record(body.dashboard);
  const ensure = record(body.ensureTemplate);
  return {
    dashboardId: dashboard && isUuidV7(dashboard.id) ? dashboard.id : null,
    ensureTemplateKey:
      ensure && typeof ensure.templateKey === "string" ? ensure.templateKey : null,
  };
}

export function parseDashboardListPage(payload: unknown): DashboardListPage {
  const body = record(payload);
  const pagination = body ? record(body.pagination) : null;
  if (
    !body ||
    !pagination ||
    !Array.isArray(body.items) ||
    !isBoundedInteger(pagination.limit, 1, 100) ||
    !isBoundedInteger(pagination.offset, 0, Number.MAX_SAFE_INTEGER)
  ) {
    invalidAnalyticsResponse();
  }
  return {
    items: body.items.map(parseDashboardListEntry),
    limit: pagination.limit,
    offset: pagination.offset,
    nextOffset: isBoundedInteger(pagination.nextOffset, 0, Number.MAX_SAFE_INTEGER)
      ? pagination.nextOffset
      : null,
  };
}

function parseDashboardListEntry(payload: unknown): DashboardListEntry {
  const row = record(payload);
  if (
    !row ||
    !isUuidV7(row.id) ||
    !isNonEmptyString(row.name, DASHBOARD_LIMITS.nameMaxLength) ||
    !isNonEmptyString(row.accessLevel, 16) ||
    !isBoundedInteger(row.revision, 0, Number.MAX_SAFE_INTEGER) ||
    !isTimestamp(row.updatedAt)
  ) {
    invalidAnalyticsResponse();
  }
  return {
    id: row.id,
    name: row.name,
    description: typeof row.description === "string" ? row.description : null,
    sourceTemplateKey:
      typeof row.sourceTemplateKey === "string" ? row.sourceTemplateKey : null,
    accessLevel: row.accessLevel,
    isShared: row.isShared === true,
    isDefault: row.isDefault === true,
    isFavorite: row.isFavorite === true,
    revision: row.revision,
    updatedAt: row.updatedAt,
  };
}

export function parseDashboardDetail(payload: unknown): DashboardDetail {
  const row = record(payload);
  if (
    !row ||
    !isUuidV7(row.id) ||
    !isNonEmptyString(row.name, DASHBOARD_LIMITS.nameMaxLength) ||
    !isNonEmptyString(row.scopeCoverage, 40) ||
    !isNonEmptyString(row.accessLevel, 16) ||
    !isBoundedInteger(row.revision, 0, Number.MAX_SAFE_INTEGER) ||
    !isTimestamp(row.updatedAt) ||
    !Array.isArray(row.placements)
  ) {
    invalidAnalyticsResponse();
  }
  return {
    id: row.id,
    name: row.name,
    description: typeof row.description === "string" ? row.description : null,
    scopeCoverage: row.scopeCoverage,
    accessLevel: row.accessLevel,
    isShared: row.isShared === true,
    isDefault: row.isDefault === true,
    isFavorite: row.isFavorite === true,
    revision: row.revision,
    updatedAt: row.updatedAt,
    placements: row.placements.map(parseDashboardPlacement),
    unavailablePlacements: Array.isArray(row.unavailablePlacements)
      ? row.unavailablePlacements.flatMap(parseUnavailablePlacement)
      : [],
  };
}

function parseDashboardPlacement(payload: unknown): DashboardPlacement {
  const row = record(payload);
  const widget = row ? record(row.widget) : null;
  if (
    !row ||
    !widget ||
    !isUuidV7(row.id) ||
    !isUuidV7(row.widgetId) ||
    !isBoundedInteger(row.x, 0, 11) ||
    !isBoundedInteger(row.y, 0, DASHBOARD_LIMITS.maxLayoutY) ||
    !isBoundedInteger(row.width, 1, DASHBOARD_LIMITS.gridColumns) ||
    !isBoundedInteger(row.height, 1, DASHBOARD_LIMITS.maxWidgetHeight) ||
    !isBoundedInteger(row.sortOrder, 0, Number.MAX_SAFE_INTEGER) ||
    !isNonEmptyString(widget.name, DASHBOARD_LIMITS.nameMaxLength) ||
    !isNonEmptyString(widget.visualizationType, 40) ||
    !isBoundedInteger(widget.revision, 0, Number.MAX_SAFE_INTEGER)
  ) {
    invalidAnalyticsResponse();
  }
  return {
    id: row.id,
    widgetId: row.widgetId,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    sortOrder: row.sortOrder,
    widget: {
      id: row.widgetId,
      name: widget.name,
      visualizationType: widget.visualizationType,
      revision: widget.revision,
    },
  };
}

function parseUnavailablePlacement(payload: unknown): UnavailablePlacement[] {
  const row = record(payload);
  return row && isUuidV7(row.placementId) && typeof row.reasonCode === "string"
    ? [{ placementId: row.placementId, reasonCode: row.reasonCode }]
    : [];
}

export function parseDashboardRunResult(payload: unknown): DashboardRunResult {
  const row = record(payload);
  if (
    !row ||
    !isUuidV7(row.dashboardId) ||
    !isBoundedInteger(row.dashboardRevision, 0, Number.MAX_SAFE_INTEGER) ||
    !isNonEmptyString(row.status, 16) ||
    !isTimestamp(row.generatedAt) ||
    !Array.isArray(row.widgets)
  ) {
    invalidAnalyticsResponse();
  }
  return {
    dashboardId: row.dashboardId,
    dashboardRevision: row.dashboardRevision,
    status: row.status,
    generatedAt: row.generatedAt,
    widgets: row.widgets.map(parseWidgetExecutionResult),
    unavailablePlacements: Array.isArray(row.unavailablePlacements)
      ? row.unavailablePlacements.flatMap(parseUnavailablePlacement)
      : [],
  };
}

/**
 * A widget result carries its own `unit` inside each series; a SCALAR result
 * carries the unit on the metric, which the run echoes per partition. The
 * caller passes the unit it read from the catalogue so `scalar` can be typed.
 */
export function parseWidgetExecutionResult(payload: unknown): WidgetExecutionResult {
  const row = record(payload);
  if (
    !row ||
    !isUuidV7(row.widgetId) ||
    !isNonEmptyString(row.status, 24) ||
    !isNonEmptyString(row.shape, 24) ||
    !isNonEmptyString(row.completeness, 16) ||
    !Array.isArray(row.partitions)
  ) {
    invalidAnalyticsResponse();
  }
  return {
    widgetId: row.widgetId,
    status: row.status,
    shape: row.shape,
    completeness: row.completeness,
    errorCode: typeof row.errorCode === "string" ? row.errorCode : null,
    asOf: isTimestamp(row.asOf) ? row.asOf : null,
    partitions: row.partitions.flatMap((entry) => {
      const partition = record(entry);
      if (!partition || !isUuidV7(partition.companyId)) return [];
      const currencyCode =
        typeof partition.currencyCode === "string" ? partition.currencyCode : null;
      const seriesUnit = firstSeriesUnit(partition.series);
      return [
        {
          companyId: partition.companyId,
          currencyCode,
          // The unit decides the scalar's type. When the payload carries no
          // series to read it from, a currency code means money, which is a
          // decimal string — never a number.
          scalar:
            partition.scalar === undefined
              ? null
              : parseDashboardScalar(
                  partition.scalar,
                  seriesUnit ?? (currencyCode === null ? "COUNT" : "MONEY"),
                ),
          series: parseSeries(partition.series),
        },
      ];
    }),
  };
}

function parseSeries(payload: unknown): DashboardSeries[] {
  if (!Array.isArray(payload)) return [];
  return payload.flatMap((entry) => {
    const series = record(entry);
    if (!series || typeof series.key !== "string" || typeof series.unit !== "string") return [];
    const unit = series.unit;
    return [
      {
        key: series.key,
        unit,
        currencyCode: typeof series.currencyCode === "string" ? series.currencyCode : null,
        points: Array.isArray(series.points)
          ? series.points.flatMap((pointEntry) => {
              const point = record(pointEntry);
              if (!point || typeof point.key !== "string") return [];
              // Every point value is the same union as `scalar`: a number for
              // COUNT and a decimal string for everything else.
              return [{ key: point.key, value: parseDashboardScalar(point.value, unit) }];
            })
          : [],
      },
    ];
  });
}

function firstSeriesUnit(series: unknown): string | null {
  if (!Array.isArray(series)) return null;
  for (const entry of series) {
    const row = record(entry);
    if (row && typeof row.unit === "string") return row.unit;
  }
  return null;
}

export function parseWidgetList(payload: unknown): WidgetRecord[] {
  const body = record(payload);
  if (!body || !Array.isArray(body.items)) invalidAnalyticsResponse();
  return body.items.map(parseWidgetRecord);
}

export function parseWidgetRecord(payload: unknown): WidgetRecord {
  const row = record(payload);
  const querySpec = row ? record(row.querySpec) : null;
  const displaySpec = row ? record(row.displaySpec) : null;
  if (
    !row ||
    !isUuidV7(row.id) ||
    !isNonEmptyString(row.name, DASHBOARD_LIMITS.nameMaxLength) ||
    !isNonEmptyString(row.visualizationType, 40) ||
    !isBoundedInteger(row.revision, 0, Number.MAX_SAFE_INTEGER) ||
    !isTimestamp(row.updatedAt)
  ) {
    invalidAnalyticsResponse();
  }
  return {
    id: row.id,
    name: row.name,
    visualizationType: row.visualizationType,
    revision: row.revision,
    accessLevel: typeof row.accessLevel === "string" ? row.accessLevel : "VIEW",
    isShared: row.isShared === true,
    updatedAt: row.updatedAt,
    series: Array.isArray(querySpec?.series)
      ? querySpec.series.flatMap((entry) => {
          const series = record(entry);
          return series && typeof series.metricKey === "string"
            ? [
                {
                  metricKey: series.metricKey,
                  label: typeof series.label === "string" ? series.label : null,
                  axis: typeof series.axis === "string" ? series.axis : null,
                  aggregation:
                    typeof series.aggregation === "string" ? series.aggregation : null,
                },
              ]
            : [];
        })
      : [],
    displayTitle: typeof displaySpec?.title === "string" ? displaySpec.title : null,
    legendPosition:
      typeof displaySpec?.legendPosition === "string" ? displaySpec.legendPosition : null,
    precision: isBoundedInteger(displaySpec?.precision, 0, 8) ? displaySpec.precision : null,
  };
}

export function parseShareTargets(payload: unknown): ShareTarget[] {
  const body = record(payload);
  const items = body && Array.isArray(body.items) ? body.items : Array.isArray(payload) ? payload : null;
  if (!items) invalidAnalyticsResponse();
  return items.flatMap((entry) => {
    const row = record(entry);
    if (!row || !isUuidV7(row.subjectId) || typeof row.subjectType !== "string") return [];
    return [
      {
        subjectId: row.subjectId,
        subjectType: row.subjectType,
        label: typeof row.label === "string" ? row.label : row.subjectId,
      },
    ];
  });
}

export function parseShares(payload: unknown): ShareRecord[] {
  const body = record(payload);
  const items = body && Array.isArray(body.items) ? body.items : Array.isArray(payload) ? payload : null;
  if (!items) invalidAnalyticsResponse();
  return items.flatMap((entry) => {
    const row = record(entry);
    if (
      !row ||
      !isUuidV7(row.id) ||
      !isUuidV7(row.subjectId) ||
      typeof row.subjectType !== "string" ||
      typeof row.accessLevel !== "string"
    ) {
      return [];
    }
    return [
      {
        id: row.id,
        subjectId: row.subjectId,
        subjectType: row.subjectType,
        accessLevel: row.accessLevel,
      },
    ];
  });
}

export function parseDashboardCatalog(payload: unknown): DashboardCatalog {
  const body = record(payload);
  if (!body || !Array.isArray(body.metrics) || !isBoundedInteger(body.catalogVersion, 0, 100_000)) {
    invalidAnalyticsResponse();
  }
  return {
    catalogVersion: body.catalogVersion,
    metrics: body.metrics.flatMap((entry) => {
      const metric = record(entry);
      if (!metric || typeof metric.key !== "string" || typeof metric.unit !== "string") return [];
      return [
        {
          key: metric.key,
          unit: metric.unit,
          shape: typeof metric.shape === "string" ? metric.shape : "SCALAR",
          compatibleVisualizations: Array.isArray(metric.compatibleVisualizations)
            ? metric.compatibleVisualizations.filter(
                (value): value is string => typeof value === "string",
              )
            : [],
        },
      ];
    }),
    templates: Array.isArray(body.templates)
      ? body.templates.flatMap((entry) => {
          const template = record(entry);
          return template && typeof template.templateKey === "string"
            ? [
                {
                  templateKey: template.templateKey,
                  name: typeof template.name === "string" ? template.name : null,
                },
              ]
            : [];
        })
      : [],
  };
}

/**
 * `TRADE.DASHBOARD.SCOPE_DENIED` and `METRIC_PERMISSION_REQUIRED` are
 * authorization failures the server reports as **422**, so S7's
 * 403-to-`PermissionGate` rule never fires for them. A caller must treat both
 * as permission states regardless of status.
 */
export function isDashboardPermissionRefusal(error: NormalizedApiError): boolean {
  return (
    error.code === "TRADE.DASHBOARD.SCOPE_DENIED" ||
    error.code === "TRADE.DASHBOARD.METRIC_PERMISSION_REQUIRED" ||
    error.code === "TRADE.DASHBOARD.SOURCE_PERMISSION_REQUIRED" ||
    error.code === "TRADE.DASHBOARD.TRANSITIVE_SHARE_FORBIDDEN"
  );
}

export function analyticsMessage(
  error: NormalizedApiError,
  t: Dictionary,
): string | undefined {
  switch (error.code) {
    case "TRADE.DASHBOARD.NOT_FOUND":
      return t.tradeAnalytics.errorNotFound;
    case "TRADE.DASHBOARD.SCOPE_DENIED":
      return t.tradeAnalytics.errorScopeDenied;
    case "TRADE.DASHBOARD.SOURCE_PERMISSION_REQUIRED":
      return t.tradeAnalytics.errorSourcePermission;
    case "TRADE.DASHBOARD.METRIC_PERMISSION_REQUIRED":
      return t.tradeAnalytics.errorMetricPermission;
    case "TRADE.DASHBOARD.TRANSITIVE_SHARE_FORBIDDEN":
      return t.tradeAnalytics.errorTransitiveShare;
    case "TRADE.DASHBOARD.WIDGET_UNAVAILABLE":
      return t.tradeAnalytics.errorWidgetUnavailable;
    case "TRADE.DASHBOARD.REVISION_CONFLICT":
      return t.tradeAnalytics.errorRevisionConflict;
    case "TRADE.DASHBOARD.NAME_CONFLICT":
      return t.tradeAnalytics.errorNameConflict;
    case "TRADE.DASHBOARD.LAYOUT_OVERLAP":
      return t.tradeAnalytics.errorLayoutOverlap;
    case "TRADE.DASHBOARD.WIDGET_ALREADY_PLACED":
      return t.tradeAnalytics.errorWidgetAlreadyPlaced;
    case "TRADE.DASHBOARD.SCOPE_EMPTY":
      return t.tradeAnalytics.errorScopeEmpty;
    case "TRADE.DASHBOARD.COMPANY_BRANCH_MISMATCH":
      return t.tradeAnalytics.errorCompanyBranchMismatch;
    case "TRADE.DASHBOARD.FILTER_INVALID":
      return t.tradeAnalytics.errorFilterInvalid;
    case "TRADE.DASHBOARD.DEFINITION_INVALID":
      return t.tradeAnalytics.errorDefinitionInvalid;
    case "TRADE.DASHBOARD.LAYOUT_INVALID":
      return t.tradeAnalytics.errorLayoutInvalid;
    case "TRADE.DASHBOARD.LIMIT_EXCEEDED":
      return t.tradeAnalytics.errorLimitExceeded;
    case "TRADE.DASHBOARD.METRIC_NOT_REGISTERED":
      return t.tradeAnalytics.errorMetricNotRegistered;
    case "TRADE.DASHBOARD.METRIC_INCOMPATIBLE":
      return t.tradeAnalytics.errorMetricIncompatible;
    case "TRADE.DASHBOARD.VISUALIZATION_INCOMPATIBLE":
      return t.tradeAnalytics.errorVisualizationIncompatible;
    case "TRADE.DASHBOARD.EXECUTION_BUDGET_EXCEEDED":
      return t.tradeAnalytics.errorExecutionBudget;
    case "TRADE.DASHBOARD.SHARE_TARGET_INVALID":
      return t.tradeAnalytics.errorShareTargetInvalid;
    case "TRADE.DASHBOARD.SHARE_ACCESS_INVALID":
      return t.tradeAnalytics.errorShareAccessInvalid;
    case "TRADE.DASHBOARD.CURRENCY_MERGE_FORBIDDEN":
      return t.tradeAnalytics.errorCurrencyMerge;
    case "TRADE.DASHBOARD.MULTI_COMPANY_AGGREGATION_FORBIDDEN":
      return t.tradeAnalytics.errorMultiCompanyAggregation;
    case "TRADE.DASHBOARD.SOURCE_UNAVAILABLE":
      return t.tradeAnalytics.errorSourceUnavailable;
    case "TRADE.IDEMPOTENCY.KEY_REQUIRED":
      return t.tradeAnalytics.errorIdempotencyKeyRequired;
    case "TRADE.CONCURRENCY.IF_MATCH_REQUIRED":
      return t.tradeCommon.errorIfMatchRequired;
    default:
      return undefined;
  }
}

export function analyticsFormMessage(error: unknown, t: Dictionary): string {
  const reason = error instanceof Error ? error.message : "";
  switch (reason) {
    case "ANALYTICS_FORM_NAME":
      return t.tradeAnalytics.formNameInvalid;
    case "ANALYTICS_FORM_SCOPE":
      return t.tradeAnalytics.formScopeInvalid;
    case "ANALYTICS_FORM_METRIC":
      return t.tradeAnalytics.formMetricInvalid;
    case "ANALYTICS_FORM_SHARE":
      return t.tradeAnalytics.formShareInvalid;
    case "ANALYTICS_FORM_LAYOUT":
      return t.tradeAnalytics.formLayoutInvalid;
    default:
      return t.tradeCommon.actionFailed;
  }
}

export function isDashboardVisualizationType(
  value: unknown,
): value is DashboardVisualizationType {
  return isMemberOf(value, DASHBOARD_VISUALIZATION_TYPES);
}

function invalidAnalyticsResponse(): never {
  throw new Error("Invalid Trade analytics response.");
}

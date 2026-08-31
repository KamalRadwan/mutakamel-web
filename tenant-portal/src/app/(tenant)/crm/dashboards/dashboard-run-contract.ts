// Wire contract for dashboard execution and drill-down.
//
// Transcribed from crm-app/src/crm/dashboards/dashboard-execution.service.ts
// (`run`, `preview`, `executeWidget`, `toPoints`, `serializeFilters`,
// `safeWidgetError`), dashboard-drilldown.service.ts and
// dto/dashboard-drilldown.dto.ts.

import {
  boundedArray,
  finiteNumber,
  invalidResponse,
  nonEmptyString,
  optionalString,
  record,
  stringArray,
  timestamp,
} from "./dashboard-parse";
import { DASHBOARD_WIDGET_LIMIT, isDataShape, isMetricUnit, type CrmDataShape, type CrmMetricUnit } from "./widget-contract";

/** `DashboardFiltersDto.datePreset`. */
export const DATE_PRESETS = ["CURRENT_MONTH", "CURRENT_QUARTER", "CURRENT_YEAR", "LAST_30_DAYS"] as const;
type DatePreset = (typeof DATE_PRESETS)[number];

/** `DashboardFiltersDto.compare`. */
export const COMPARE_MODES = ["NONE", "PREVIOUS_PERIOD", "PREVIOUS_YEAR"] as const;
type CompareMode = (typeof COMPARE_MODES)[number];

/**
 * `CURRENCIES:` is a **prefix carrying data**, not a constant warning — the
 * codes present follow it, comma-separated. The eleven keys
 * `validateDashboardFilters` allows are documented in
 * docs/api/crm-dashboards.md; the four this screen offers are above.
 */
const WIDGET_WARNING_CURRENCIES_PREFIX = "CURRENCIES:";

/** `@Max(100)` on the drill-down `limit`; the DTO default is 25. */
const DRILLDOWN_PAGE_SIZE = 25;

/** `CRM_DASHBOARD_DRILLDOWN_PROJECTION_FIELDS`, in server order. */
export const DRILLDOWN_FIELDS = [
  "id", "entityType", "title", "status", "stageName", "ownerName", "branchName",
  "pipelineName", "sourceName", "activityType", "reason", "amount",
  "currencyCode", "rank", "value", "occurredAt", "createdAt", "updatedAt",
  "dueAt", "closedAt", "convertedAt",
] as const;
type DrilldownField = (typeof DRILLDOWN_FIELDS)[number];

export interface DashboardFilterSelection {
  datePreset: DatePreset | null;
  compare: CompareMode | null;
  branchId: string | null;
  currencyCode: string | null;
}

/**
 * One plotted point.
 *
 * `value` is always a **JS number** — `toPoints` runs every row through
 * `Number()`, including money. See
 * docs/api/crm-dashboards.md#money-is-a-number-here-not-a-decimal-string.
 */
interface WidgetPoint {
  key: string;
  label: string;
  value: number;
  /** `XY` shapes only. */
  secondaryValue: number | null;
  /** `INTERVAL` shapes only. */
  start: string | null;
  end: string | null;
  /** The row the point was built from — the drill-down selection reads `key`. */
  meta: Record<string, unknown>;
}

export interface WidgetSeries {
  key: string;
  label: string;
  unit: CrmMetricUnit | null;
  axis: "LEFT" | "RIGHT";
  currency: string | null;
  points: WidgetPoint[];
  /**
   * True when the server appended this series as a period comparison — its key
   * ends `:PREVIOUS_PERIOD` or `:PREVIOUS_YEAR` (`canonicalSeries` keySuffix).
   */
  isComparison: boolean;
}

export interface WidgetResult {
  widgetId: string;
  shape: CrmDataShape;
  /** SCALAR widgets only, and only when the metric produced exactly one point. */
  value: number | null;
  previousValue: number | null;
  target: number | null;
  series: WidgetSeries[];
  /** `TABLE` visualizations and `ROWS` metrics. */
  rows: Array<Record<string, unknown>>;
  /** The typed P2 result for HIERARCHY / BINNED_DISTRIBUTION / WATERFALL / EVENT_STREAM / ROWS. */
  typedResult: Record<string, unknown> | null;
  unit: CrmMetricUnit | null;
  currency: string | null;
  generatedAt: string;
  warnings: string[];
  /**
   * Set only on the failure path, where the server rolls back to a savepoint
   * and still returns the widget. `null` means the widget executed.
   */
  errorCode: string | null;
}

export interface DashboardRunResult {
  dashboardId: string;
  revision: number | null;
  generatedAt: string;
  filters: Record<string, unknown>;
  widgets: Record<string, WidgetResult>;
  unavailablePlacementCount: number;
}

export interface DrilldownRecord {
  id: string;
  fields: Partial<Record<DrilldownField, string | number | boolean | null>>;
}

export interface DrilldownPage {
  widgetId: string;
  widgetRevision: number;
  records: DrilldownRecord[];
  hasMore: boolean;
  nextCursor: string | null;
}

/**
 * `RunDashboardDto`.
 *
 * A filter is omitted when unset rather than sent as `null` —
 * `forbidNonWhitelisted` plus `@IsOptional()` means a `null` is a 422, and the
 * server merges dashboard defaults under whatever is sent.
 */
export function buildRunRequest(selection: DashboardFilterSelection): Record<string, unknown> {
  const filters = buildFilters(selection);
  return Object.keys(filters).length > 0 ? { filters } : {};
}

function buildFilters(selection: DashboardFilterSelection): Record<string, unknown> {
  const filters: Record<string, unknown> = {};
  if (selection.datePreset) filters.datePreset = selection.datePreset;
  if (selection.compare) filters.compare = selection.compare;
  if (selection.branchId) filters.branchId = selection.branchId;
  if (selection.currencyCode) filters.currencyCode = selection.currencyCode;
  return filters;
}

/**
 * `DashboardDrilldownRequestDto`.
 *
 * `expectedWidgetRevision` is sent so a widget edited in another tab answers
 * `409 CRM_WIDGET_REVISION_CONFLICT` instead of silently drilling into a
 * different query than the one on screen.
 */
export function buildDrilldownRequest(input: {
  pointKey: string;
  seriesKey: string | null;
  cursor: string | null;
  expectedWidgetRevision: number;
  selection: DashboardFilterSelection;
}): Record<string, unknown> {
  const pointKey = input.pointKey.trim();
  if (pointKey.length === 0 || pointKey.length > 256) throw new Error("CRM_DRILLDOWN_SELECTION_INVALID");
  const body: Record<string, unknown> = {
    pointKey,
    limit: DRILLDOWN_PAGE_SIZE,
    expectedWidgetRevision: input.expectedWidgetRevision,
  };
  if (input.seriesKey) body.seriesKey = input.seriesKey.slice(0, 160);
  if (input.cursor) body.cursor = input.cursor;
  const filters = buildFilters(input.selection);
  if (Object.keys(filters).length > 0) body.filters = filters;
  return body;
}

export function parseRunResponse(payload: unknown): DashboardRunResult {
  const source = record(payload);
  const widgets = record(source?.widgets);
  if (!source || !widgets || !nonEmptyString(source.dashboardId) || !timestamp(source.generatedAt)) {
    invalidResponse("dashboard run");
  }
  return {
    dashboardId: source.dashboardId,
    revision: finiteNumber(source.revision) ? source.revision : null,
    generatedAt: source.generatedAt,
    filters: record(source.filters) ?? {},
    widgets: Object.fromEntries(
      Object.entries(widgets).map(([widgetId, result]) => [widgetId, parseWidgetResult(result)]),
    ),
    unavailablePlacementCount: Array.isArray(source.unavailablePlacements)
      ? source.unavailablePlacements.length
      : 0,
  };
}

export function parseWidgetResult(payload: unknown): WidgetResult {
  const source = record(payload);
  const meta = record(source?.meta);
  if (!source || !meta || !nonEmptyString(source.widgetId) || !boundedArray(source.series, 32)) {
    invalidResponse("widget result");
  }
  const error = record(source.error);
  return {
    widgetId: source.widgetId,
    // A widget that failed before its metric resolved falls back to `ROWS`.
    shape: isDataShape(source.shape) ? source.shape : "ROWS",
    value: finiteNumber(source.value) ? source.value : null,
    previousValue: finiteNumber(source.previousValue) ? source.previousValue : null,
    target: finiteNumber(source.target) ? source.target : null,
    series: source.series.map(parseSeries),
    rows: boundedArray(source.rows, 1000)
      ? source.rows.flatMap((row) => (record(row) ? [record(row) as Record<string, unknown>] : []))
      : [],
    typedResult: record(source.result),
    unit: isMetricUnit(meta.unit) ? meta.unit : null,
    currency: optionalString(meta.currency),
    generatedAt: timestamp(meta.generatedAt) ? meta.generatedAt : new Date().toISOString(),
    warnings: stringArray(meta.warnings, 32) ? meta.warnings : [],
    errorCode: error && nonEmptyString(error.code) ? error.code : null,
  };
}

function parseSeries(payload: unknown): WidgetSeries {
  const source = record(payload);
  if (!source || !nonEmptyString(source.key) || !boundedArray(source.points, 2000)) {
    invalidResponse("widget series");
  }
  return {
    key: source.key,
    label: nonEmptyString(source.label) ? source.label : source.key,
    unit: isMetricUnit(source.unit) ? source.unit : null,
    axis: source.axis === "RIGHT" ? "RIGHT" : "LEFT",
    currency: optionalString(source.currency),
    points: source.points.map(parsePoint),
    isComparison: source.key.endsWith(":PREVIOUS_PERIOD") || source.key.endsWith(":PREVIOUS_YEAR"),
  };
}

function parsePoint(payload: unknown): WidgetPoint {
  const source = record(payload);
  if (!source || !nonEmptyString(source.key)) invalidResponse("widget point");
  return {
    key: source.key,
    label: nonEmptyString(source.label) ? source.label : source.key,
    value: finiteNumber(source.value) ? source.value : 0,
    secondaryValue: finiteNumber(source.secondaryValue) ? source.secondaryValue : null,
    start: optionalString(source.start),
    end: optionalString(source.end),
    meta: record(source.meta) ?? {},
  };
}

export function parseDrilldownResponse(payload: unknown): DrilldownPage {
  const source = record(payload);
  const pageInfo = record(source?.pageInfo);
  if (
    !source ||
    !pageInfo ||
    !nonEmptyString(source.widgetId) ||
    !boundedArray(source.records, 100)
  ) {
    invalidResponse("drill-down");
  }
  return {
    widgetId: source.widgetId,
    widgetRevision: finiteNumber(source.widgetRevision) ? source.widgetRevision : 0,
    records: source.records.flatMap((entry) => {
      const row = record(entry);
      if (!row || !nonEmptyString(row.id)) return [];
      const fields: DrilldownRecord["fields"] = {};
      for (const field of DRILLDOWN_FIELDS) {
        const value = row[field];
        if (
          value === null ||
          typeof value === "string" ||
          typeof value === "number" ||
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

/**
 * The currencies a run reported, gathered from every widget's
 * `CURRENCIES:EGP,USD` warning plus its resolved `meta.currency`.
 *
 * This is the **only** honest source for a currency filter on this screen: the
 * portal has no reachable currency catalogue from `/crm`, and
 * `CURRENCY_FILTER_REQUIRED` blanks a widget until one is chosen.
 */
export function currenciesInRun(run: DashboardRunResult | null): string[] {
  if (!run) return [];
  const codes = new Set<string>();
  for (const widget of Object.values(run.widgets)) {
    if (widget.currency) codes.add(widget.currency);
    for (const warning of widget.warnings) {
      if (!warning.startsWith(WIDGET_WARNING_CURRENCIES_PREFIX)) continue;
      for (const code of warning.slice(WIDGET_WARNING_CURRENCIES_PREFIX.length).split(",")) {
        const trimmed = code.trim();
        if (/^[A-Z]{3}$/u.test(trimmed)) codes.add(trimmed);
      }
    }
  }
  return [...codes].sort();
}

/** Warnings minus the machine-readable `CURRENCIES:` carrier. */
export function displayWarnings(warnings: readonly string[]): string[] {
  return warnings.filter((warning) => !warning.startsWith(WIDGET_WARNING_CURRENCIES_PREFIX));
}

export function failedWidgetIds(run: DashboardRunResult | null): string[] {
  if (!run) return [];
  return Object.values(run.widgets)
    .filter((widget) => widget.errorCode !== null)
    .map((widget) => widget.widgetId)
    .slice(0, DASHBOARD_WIDGET_LIMIT);
}

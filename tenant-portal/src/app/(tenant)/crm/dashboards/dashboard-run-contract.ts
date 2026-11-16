// Wire contract for dashboard execution and drill-down.
//
// Transcribed from crm-app/src/crm/dashboards/dashboard-execution.service.ts
// (`run`, `preview`, `executeWidget`, `toPoints`, `serializeFilters`,
// `safeWidgetError`), dashboard-drilldown.service.ts and
// dto/dashboard-drilldown.dto.ts.

import {
  boundedArray,
  civilDateRange,
  finiteNumber,
  invalidResponse,
  nonEmptyString,
  optionalString,
  record,
  stringArray,
  timestamp,
} from "./dashboard-parse";
export { DRILLDOWN_FIELDS, parseDrilldownResponse, type DrilldownRecord } from "./dashboard-drilldown-response";
import { DASHBOARD_WIDGET_LIMIT, isDataShape, isMetricUnit, type CrmDataShape, type CrmMetricUnit } from "./widget-contract";
import { parseCurrencyValues, parseScalarComparison, parseWidgetSeries, type WidgetCurrencyValue, type WidgetScalarComparison, type WidgetSeries } from "./dashboard-series-contract";
import { parseGovernedTargetEvidence, type GovernedTargetEvidence } from "./won-target-evidence";
import { LEAD_INQUIRY_CLASSIFICATION, readInquiryClassification } from "./widget-acquisition-quality";
import { isLifecycleTimeZone, isLifecycleWidget, readLeadLifecycle } from "./widget-lead-lifecycle";
import { canonicalOrganizationIds, matchesOrganizationIds, parseDashboardOrganizationScope,
  type DashboardOrganizationSelection } from "./dashboard-organization-scope";
import { isUUIDv7 } from "@/lib/uuid";
export type { WidgetPoint, WidgetSeries } from "./dashboard-series-contract";

// `DashboardFiltersDto.datePreset`.
export const DATE_PRESETS = [
  "TODAY", "CURRENT_WEEK", "CURRENT_MONTH", "CURRENT_QUARTER", "CURRENT_YEAR",
  "LAST_MONTH", "LAST_3_COMPLETE_MONTHS", "LAST_QUARTER", "LAST_YEAR", "LAST_7_DAYS", "LAST_30_DAYS", "LAST_90_DAYS", "CUSTOM",
] as const;
type DatePreset = (typeof DATE_PRESETS)[number];

// `DashboardFiltersDto.compare`.
export const COMPARE_MODES = ["NONE", "PREVIOUS_PERIOD", "PREVIOUS_YEAR"] as const;
type CompareMode = (typeof COMPARE_MODES)[number];

// `@Max(100)` on the drill-down `limit`; the DTO default is 25.
const DRILLDOWN_PAGE_SIZE = 25;

interface DashboardPopulationSelection {
  teamIds?: string[];
  ownerUserIds?: string[];
}

export interface DashboardFilterSelection extends DashboardOrganizationSelection, DashboardPopulationSelection {
  datePreset: DatePreset | null;
  compare: CompareMode | null;
  branchId: string | null;
  currencyCode: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}

const WIDGET_STATES = ["READY", "EMPTY", "UNAVAILABLE", "RETIRED", "FAILED", "DEADLINE_EXCEEDED"] as const;
export type WidgetState = typeof WIDGET_STATES[number];

export interface WidgetResult {
  widgetId: string;
  state?: WidgetState;
  shape: CrmDataShape;
  // SCALAR widgets only, and only when the metric produced exactly one point.
  value: number | null;
  previousValue: number | null;
  target: number | null;
  governedTarget?: GovernedTargetEvidence;
  series: WidgetSeries[];
  // `TABLE` visualizations and `ROWS` metrics.
  rows: Array<Record<string, unknown>>;
  // The typed P2 result for hierarchy, distributions, waterfall, event stream and rows.
  typedResult: Record<string, unknown> | null;
  unit: CrmMetricUnit | null;
  currency: string | null;
  generatedAt: string;
  warnings: string[];
  // A failed widget is returned beside successful widgets.
  errorCode: string | null;
  comparison?: WidgetScalarComparison;
  details?: Record<string, unknown>;
  otherCurrencies?: WidgetCurrencyValue[];
  breakdown?: WidgetCurrencyValue[];
  partialAccess?: boolean;
  ignoredFilters?: string[];
  timeBasis?: string;
  effectivePeriod?: { from: string; to: string; timeZone: string };
}

export interface DashboardExecutionResult {
  generatedAt: string;
  filters: Record<string, unknown>;
  widgets: Record<string, WidgetResult>;
  organizationScope?: DashboardOrganizationScope;
  populationScope?: DashboardPopulationScope;
}

export interface DashboardRunResult extends DashboardExecutionResult {
  dashboardId: string;
  revision: number | null;
  unavailablePlacementCount: number;
}

export type DashboardOrganizationScope = Pick<ReturnType<typeof parseDashboardOrganizationScope>, "companies" | "branches">;
interface DashboardPopulationOption { id: string; name: string; branchIds: string[] }
export interface DashboardPopulationScope {
  state: "READY" | "SOURCE_NOT_READY" | "TOO_BROAD";
  teams: DashboardPopulationOption[];
  owners: DashboardPopulationOption[];
}

// `RunDashboardDto`.
export function buildRunRequest(selection: DashboardFilterSelection, includePopulationOptions = false): Record<string, unknown> {
  const filters = buildFilters(selection);
  return { ...(Object.keys(filters).length > 0 ? { filters } : {}), ...(includePopulationOptions ? { includePopulationOptions } : {}) };
}

export function customDateRangeError(from: string, to: string): "required" | "invalid" | null {
  if (!from || !to) return "required";
  const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  return !valid(from) || !valid(to) || from > to ? "invalid" : null;
}

function buildFilters(selection: DashboardFilterSelection): Record<string, unknown> {
  const filters: Record<string, unknown> = {};
  if (selection.datePreset) filters.datePreset = selection.datePreset;
  if (selection.datePreset === "CUSTOM") {
    if (customDateRangeError(selection.dateFrom ?? "", selection.dateTo ?? "")) {
      throw new Error("CRM_DASHBOARD_DATE_RANGE_INVALID");
    }
    filters.dateFrom = selection.dateFrom;
    filters.dateTo = selection.dateTo;
  }
  if (selection.compare) filters.compare = selection.compare;
  if (selection.branchId) filters.branchId = selection.branchId;
  const fail = () => { throw new Error("CRM_DASHBOARD_FILTER_INVALID"); };
  const companyIds = canonicalOrganizationIds(selection.companyIds, fail);
  const branchIds = canonicalOrganizationIds(selection.branchIds, fail);
  const teamIds = canonicalOrganizationIds(selection.teamIds, fail);
  const ownerUserIds = canonicalOrganizationIds(selection.ownerUserIds, fail);
  if ((selection.companyId && companyIds) || (selection.branchId && branchIds)) return fail();
  if (companyIds) filters.companyIds = companyIds;
  if (branchIds) filters.branchIds = branchIds;
  if (teamIds) filters.teamIds = teamIds;
  if (ownerUserIds) filters.ownerUserIds = ownerUserIds;
  if (selection.companyId) {
    if (!isUUIDv7(selection.companyId)) throw new Error("CRM_DASHBOARD_FILTER_INVALID");
    filters.companyId = selection.companyId;
  }
  if (selection.currencyCode) filters.currencyCode = selection.currencyCode;
  return filters;
}

// `DashboardDrilldownRequestDto`.
export function buildDrilldownRequest(input: {
  pointKey: string;
  seriesKey: string | null;
  cursor: string | null;
  expectedWidgetRevision: number;
  selection: DashboardFilterSelection;
}): Record<string, unknown> {
  const pointKey = input.pointKey.trim();
  if (pointKey.length === 0 || pointKey.length > 256 || /[\u0000-\u001f\u007f]/u.test(pointKey)
    || !Number.isSafeInteger(input.expectedWidgetRevision) || input.expectedWidgetRevision < 1
    || (input.seriesKey !== null && (!input.seriesKey.trim() || input.seriesKey.length > 160 || /[\u0000-\u001f\u007f]/u.test(input.seriesKey)))
    || (input.cursor !== null && (!/^[A-Za-z0-9_-]+$/.test(input.cursor) || input.cursor.length > 1024))) {
    throw new Error("CRM_DRILLDOWN_SELECTION_INVALID");
  }
  const body: Record<string, unknown> = {
    pointKey,
    limit: DRILLDOWN_PAGE_SIZE,
    expectedWidgetRevision: input.expectedWidgetRevision,
  };
  if (input.seriesKey) body.seriesKey = input.seriesKey.trim();
  if (input.cursor) body.cursor = input.cursor;
  const filters = buildFilters(input.selection);
  if (Object.keys(filters).length > 0) body.filters = filters;
  return body;
}

export function parseRunResponse(payload: unknown, selection?: DashboardOrganizationSelection & DashboardPopulationSelection): DashboardRunResult {
  const source = record(payload);
  if (!source || !nonEmptyString(source.dashboardId)) invalidResponse("dashboard run");
  return {
    ...parseDashboardExecutionResponse(source, selection),
    dashboardId: source.dashboardId,
    revision: finiteNumber(source.revision) ? source.revision : null,
    unavailablePlacementCount: Array.isArray(source.unavailablePlacements) ? source.unavailablePlacements.length : 0,
  };
}

export function parseDashboardExecutionResponse(payload: unknown, selection?: DashboardOrganizationSelection & DashboardPopulationSelection,
  requireScope = false): DashboardExecutionResult {
  const source = record(payload);
  const widgets = record(source?.widgets);
  if (!source || !widgets || !timestamp(source.generatedAt)) {
    invalidResponse("dashboard run");
  }
  const filters = record(source.filters) ?? {};
  const fail = () => invalidResponse("dashboard organization scope");
  const organization = source.organizationScope === undefined ? undefined
    : parseDashboardOrganizationScope(source.organizationScope, selection ?? {}, fail);
  const hasScopeSelection = selection?.companyId || selection?.companyIds || selection?.branchIds || selection?.teamIds || selection?.ownerUserIds;
  if (requireScope || hasScopeSelection) {
    if (!organization || filters.companyId !== (organization.companyId ?? undefined)
      || (organization.branchId && filters.branchId !== organization.branchId)
      || !matchesOrganizationIds(filters.companyIds, organization.companyIds) || !matchesOrganizationIds(filters.branchIds, organization.branchIds)
      || !boundedArray(source.scope, 500)) return fail();
    const expected = new Set(organization.selectedBranches.map(branch => branch.id));
    if ((hasScopeSelection && !expected.size) || source.scope.length !== expected.size || source.scope.some(value => {
      const entry = record(value);
      return !entry || !isUUIDv7(entry.branchId) || !["own", "team", "all"].includes(String(entry.scope)) || !expected.delete(entry.branchId);
    })) return fail();
  } else if (filters.companyId !== undefined || filters.companyIds !== undefined || filters.branchIds !== undefined) return fail();
  const populationScope = parsePopulationScope(source.populationScope, filters, selection,
    organization?.selectedBranches.map(branch => branch.id));
  return {
    generatedAt: source.generatedAt,
    filters,
    ...(organization ? { organizationScope: { companies: organization.companies, branches: organization.branches } } : {}),
    ...(populationScope ? { populationScope } : {}),
    widgets: Object.fromEntries(
      Object.entries(widgets).map(([widgetId, result]) => [widgetId, parseWidgetResult(result)]),
    ),
  };
}

function parsePopulationScope(value: unknown, filters: Record<string, unknown>, selection: DashboardPopulationSelection | undefined,
  branchIds: string[] | undefined): DashboardPopulationScope | undefined {
  const fail = () => invalidResponse("dashboard population scope");
  const teams = canonicalOrganizationIds(selection?.teamIds, fail);
  const owners = canonicalOrganizationIds(selection?.ownerUserIds, fail);
  if (!matchesOrganizationIds(filters.teamIds, teams) || !matchesOrganizationIds(filters.ownerUserIds, owners)) return fail();
  if (value === undefined && !teams && !owners) return undefined;
  const scope = record(value);
  if (!scope || !branchIds || (scope.state !== "READY" && scope.state !== "SOURCE_NOT_READY" && scope.state !== "TOO_BROAD")
    || !matchesOrganizationIds(scope.teamIds, teams ?? []) || !matchesOrganizationIds(scope.ownerUserIds, owners ?? [])) return fail();

  const branches = new Set(branchIds);
  const options = (entries: unknown): DashboardPopulationOption[] => {
    if (!boundedArray(entries, 500) || (scope.state !== "READY" && entries.length > 0)) return fail();
    const ids = new Set<string>();
    return entries.map(entry => {
      const option = record(entry);
      if (!option || !isUUIDv7(option.id) || ids.has(option.id.toLowerCase()) || !nonEmptyString(option.name)
        || !boundedArray(option.branchIds, 500) || !option.branchIds.length || new Set(option.branchIds).size !== option.branchIds.length
        || !option.branchIds.every((id): id is string => isUUIDv7(id) && branches.has(id))) return fail();
      ids.add(option.id.toLowerCase());
      return { id: option.id, name: option.name, branchIds: option.branchIds };
    });
  };
  return { state: scope.state, teams: options(scope.teams), owners: options(scope.owners) };
}

export function parseWidgetResult(payload: unknown): WidgetResult {
  const source = record(payload);
  const meta = record(source?.meta);
  if (!source || !meta || !nonEmptyString(source.widgetId) || !boundedArray(source.series, 32)) {
    invalidResponse("widget result");
  }
  const error = record(source.error);
  const period = record(meta.effectivePeriod);
  const range = civilDateRange(period);
  if (meta.effectivePeriod !== undefined && (!range || !nonEmptyString(period?.timeZone))) invalidResponse("widget effective period");
  if (source.state !== undefined && !(WIDGET_STATES as readonly unknown[]).includes(source.state)) invalidResponse("widget state");
  if (meta.partialAccess !== undefined && typeof meta.partialAccess !== "boolean") invalidResponse("widget source coverage");
  if (meta.ignoredFilters !== undefined && !stringArray(meta.ignoredFilters, 32)) invalidResponse("widget ignored filters");
  const governedTarget = source.governedTarget === undefined ? undefined : parseGovernedTargetEvidence(source.governedTarget, meta.generatedAt);
  if (governedTarget) {
    const pace = governedTarget.measure === "DAILY_PACE";
    const trajectory = governedTarget.measure === "TRAJECTORY";
    const exactValue = trajectory ? null : pace ? governedTarget.workingPace?.requiredPerWorkday : governedTarget.amounts?.actualValue;
    const ready = trajectory ? !!governedTarget.trajectory : exactValue != null;
    const target = !pace && !trajectory && ready ? Number(governedTarget.amounts!.targetValue) : undefined;
    if (source.shape !== (trajectory ? "TIME_SERIES" : "SCALAR") || source.state !== (ready ? "READY" : "UNAVAILABLE") || meta.unit !== "MONEY"
      || meta.currency !== governedTarget.currencyCode || meta.timeBasis !== (pace || trajectory ? "SNAPSHOT" : "EVENT") || source.series.length || error
      || source.value !== (exactValue == null ? null : Number(exactValue)) || source.target !== target) invalidResponse("widget governed target result");
  }
  const result: WidgetResult = {
    widgetId: source.widgetId,
    ...(source.state === undefined ? {} : { state: source.state as WidgetState }),
    // A widget that failed before its metric resolved falls back to `ROWS`.
    shape: isDataShape(source.shape) ? source.shape : "ROWS",
    value: finiteNumber(source.value) ? source.value : null,
    previousValue: finiteNumber(source.previousValue) ? source.previousValue : null,
    target: finiteNumber(source.target) ? source.target : null,
    ...(governedTarget ? { governedTarget } : {}),
    series: source.series.map(parseWidgetSeries),
    rows: boundedArray(source.rows, 1000)
      ? source.rows.flatMap((row) => (record(row) ? [record(row) as Record<string, unknown>] : []))
      : [],
    typedResult: record(source.result),
    unit: isMetricUnit(meta.unit) ? meta.unit : null,
    currency: optionalString(meta.currency),
    generatedAt: timestamp(meta.generatedAt) ? meta.generatedAt : new Date().toISOString(),
    warnings: stringArray(meta.warnings, 32) ? meta.warnings : [],
    errorCode: error && nonEmptyString(error.code) ? error.code : null,
    comparison: parseScalarComparison(source.comparison),
    details: record(source.details) ?? undefined,
    otherCurrencies: parseCurrencyValues(meta.otherCurrencies),
    breakdown: parseCurrencyValues(meta.breakdown),
    partialAccess: meta.partialAccess === true,
    ignoredFilters: meta.ignoredFilters as string[] | undefined,
    timeBasis: optionalString(meta.timeBasis) ?? undefined,
    ...(range && nonEmptyString(period?.timeZone) ? { effectivePeriod: { ...range, timeZone: period.timeZone } } : {}),
  };
  const classification = result.series.some(series => series.key === LEAD_INQUIRY_CLASSIFICATION)
    || result.details?.inquiryClassification !== undefined;
  if (classification && (result.state === "READY" || result.state === "EMPTY") && !readInquiryClassification(result)) {
    invalidResponse("widget inquiry classification");
  }
  if (isLifecycleWidget(result) && (result.state === "READY" || result.state === "EMPTY")
    && (!isLifecycleTimeZone(result.effectivePeriod?.timeZone) || !readLeadLifecycle(result))) {
    invalidResponse("widget lead lifecycle");
  }
  return result;
}

// The currencies a run reported, gathered from every widget's
export function currenciesInRun(run: DashboardRunResult | null): string[] {
  if (!run) return [];
  const codes = new Set<string>();
  const add = (code: string | null) => { if (code && /^[A-Z]{3}$/u.test(code)) codes.add(code); };
  for (const widget of Object.values(run.widgets)) {
    add(widget.currency);
    widget.series.forEach((series) => add(series.currency));
    widget.otherCurrencies?.forEach((item) => add(item.currencyCode));
    widget.breakdown?.forEach((item) => add(item.currencyCode));
  }
  return [...codes].sort();
}

export function displayWarnings(warnings: readonly string[]): string[] {
  return [...warnings];
}

export function failedWidgetIds(run: DashboardRunResult | null): string[] {
  if (!run) return [];
  return Object.values(run.widgets)
    .filter((widget) => widget.errorCode !== null && widget.state !== "UNAVAILABLE")
    .map((widget) => widget.widgetId)
    .slice(0, DASHBOARD_WIDGET_LIMIT);
}

import type { DashboardCatalog } from "../dashboards/dashboard-catalog-contract";
import { DATE_PRESETS } from "../dashboards/dashboard-run-contract";
import { TIME_GRAINS } from "../dashboards/widget-contract";
import { isUUIDv7 } from "@/lib/uuid";
import { isGovernedTargetBinding } from "../dashboards/won-target-evidence";
import { FILTER_KEYS, LEGEND_POSITIONS, NUMBER_FORMATS, datasetComparisonFor, findMetric, findVisualization, metricsFor, supportsGovernedTarget, type WidgetFormState } from "./widget-form";

export type WidgetFormError = "NAME_REQUIRED" | "VISUALIZATION_REQUIRED" | "METRIC_REQUIRED" | "DIMENSION_REQUIRED" | "TARGET_REQUIRED" | "TARGET_INVALID" | "COMPARISON_UNSUPPORTED"
  | "SERIES_INVALID" | "SHAPE_INVALID" | "UNITS_INVALID" | "AXIS_REQUIRED" | "SERIES_STYLE_INVALID" | "GRAIN_REQUIRED" | "FILTER_INVALID" | "DISPLAY_INVALID" | "DATASETS_INVALID"
  | "GOVERNED_TARGET_INVALID";
const HEX = /^#[0-9a-f]{6}$/i;
export const invalidWidgetColor = (value: unknown) => typeof value !== "string" || (!!value && !HEX.test(value));
export function invalidWidgetFilter(key: string, value: unknown, filters: Record<string, unknown>) {
  if (value === "" || value === undefined) return false;
  if (["dateFrom", "dateTo"].includes(key)) return !Number.isFinite(Date.parse(String(value))) || (!!filters.dateFrom && !!filters.dateTo && Date.parse(String(filters.dateFrom)) > Date.parse(String(filters.dateTo)));
  if (key === "currencyCode") return !/^[A-Z]{3}$/.test(String(value));
  if (["staleDays", "closingWindowDays", "limit"].includes(key)) return !Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > (key === "limit" ? 100 : 365);
  return false;
}
export function validateWidgetForm(form: WidgetFormState, catalog: DashboardCatalog | null): WidgetFormError | null {
  if (!form.name.trim() || form.name.trim().length > 120) return "NAME_REQUIRED";
  const visualization = findVisualization(catalog, form.visualizationType);
  if (!visualization) return "VISUALIZATION_REQUIRED";
  const metrics = form.series.map((series) => findMetric(catalog, series.metricKey));
  const standalone = metrics.find((metric) => metric?.standalone);
  const minSeries = standalone?.visualizations?.includes(visualization.key) ? 1 : visualization.minSeries;
  if (form.series.length < minSeries || form.series.length > Math.min(4, visualization.maxSeries)
    || (standalone && form.series.length !== 1)) return "SERIES_INVALID";
  if (metrics.some((metric) => !metric)) return "METRIC_REQUIRED";
  if (metrics.some(metric => metric?.requiredGrain && form.grain !== metric.requiredGrain)) return "GRAIN_REQUIRED";
  if (metrics.some(metric => metric?.requiredComparison && form.comparison !== metric.requiredComparison)) return "GOVERNED_TARGET_INVALID";
  if (standalone && form.comparison !== "INHERIT" && !metrics[0]?.comparisonTypes?.includes(form.comparison)) return "COMPARISON_UNSUPPORTED";
  if (form.series.some((series) => series.label.length > 80 || (series.label !== "" && !series.label.trim()) || (series.color !== "" && !HEX.test(series.color)))) return "SERIES_STYLE_INVALID";
  if (!metrics.every((metric) => metric!.dimensions.includes(form.dimensionKey))) return "DIMENSION_REQUIRED";
  const admitted = metricsFor(catalog, visualization);
  if (new Set(metrics.map((metric) => metric!.shape)).size !== 1 || metrics.some((metric) => !admitted.includes(metric!))) return "SHAPE_INVALID";
  if (metrics[0]!.shape === "ROWS") {
    const required = ({ ALERT_LIST: "ALERT", LEADERBOARD: "RANKED", SCORECARD: "SCORECARD" } as Record<string, string>)[form.visualizationType];
    const kinds = new Set<string>(metrics.flatMap((metric) => metric!.rowKind ? [metric!.rowKind] : []));
    if ((required && (kinds.size !== 1 || !kinds.has(required))) || (!required && kinds.size)) return "SHAPE_INVALID";
  }
  const units = new Set(metrics.map((metric) => metric!.unit));
  if (units.size > 2 || (units.size > 1 && !visualization.supportsDualAxis && !visualization.supportsMixedUnits)) return "UNITS_INVALID";
  if (units.size > 1 && !visualization.supportsMixedUnits) {
    const axes = form.series.map(({ axis }, index) => ({ axis, unit: metrics[index]!.unit }));
    if (axes.some((entry) => !entry.axis || axes.some((other) => other.axis === entry.axis && other.unit !== entry.unit))) return "AXIS_REQUIRED";
  }
  if (form.dimensionKey === "time" && (!TIME_GRAINS.includes(form.grain as typeof TIME_GRAINS[number]) || !catalog?.dimensions.find((d) => d.key === "time")?.grains.includes(form.grain))) return "GRAIN_REQUIRED";
  const populationShare = visualization.key === "PROGRESS_CARD" && metrics.length === 1 && metrics[0]?.populationShare === true;
  if (visualization.requiresTarget && !populationShare && form.comparison !== "TARGET" && form.comparison !== "GOVERNED_TARGET") return "TARGET_REQUIRED";
  if (form.comparison === "TARGET" && (!form.target.trim() || !Number.isFinite(Number(form.target)) || Number(form.target) < 0.000001)) return "TARGET_INVALID";
  if (["PREVIOUS_PERIOD", "PREVIOUS_YEAR"].includes(form.comparison) && (!visualization.supportsPeriodComparison || metrics.some((metric) => !metric!.supportsPeriodComparison))) return "COMPARISON_UNSUPPORTED";
  if (form.comparison === "DATASETS") {
    const capability = datasetComparisonFor(form, catalog);
    if (!form.datasetBasis || !capability?.bases.includes(form.datasetBasis)) return "COMPARISON_UNSUPPORTED";
    if (!form.datasets || form.datasets.length < 2 || form.datasets.length > 3) return "DATASETS_INVALID";
    const keys = form.datasets.map(({ branchId, datePreset, dateFrom, dateTo }) => form.datasetBasis === "BRANCH"
      ? isUUIDv7(branchId) ? branchId.toLowerCase() : null
      : datePreset && validFilters({ datePreset, dateFrom, dateTo }) ? `${datePreset}:${dateFrom ?? ""}:${dateTo ?? ""}` : null);
    if (keys.some((key) => key === null) || new Set(keys).size !== keys.length) return "DATASETS_INVALID";
  }
  if (!validFilters(form.filters)) return "FILTER_INVALID";
  if (form.comparison === "GOVERNED_TARGET") {
    if (!supportsGovernedTarget(form, catalog)) return "COMPARISON_UNSUPPORTED";
    const binding = form.governedTarget;
    if (!isGovernedTargetBinding(binding)) return "GOVERNED_TARGET_INVALID";
    const { branchId, ownerUserId, currencyCode, pipelineId } = form.filters;
    if (pipelineId || (branchId && String(branchId).toLowerCase() !== binding.branchId.toLowerCase()) || (currencyCode && currencyCode !== binding.currencyCode)
      || (ownerUserId && (binding.subjectType !== "USER" || String(ownerUserId).toLowerCase() !== binding.subjectId.toLowerCase()))) return "FILTER_INVALID";
  }
  if (!validDisplay(form.displaySpec)) return "DISPLAY_INVALID";
  return null;
}
function validFilters(filters: Record<string, unknown>) {
  for (const [key, value] of Object.entries(filters)) {
    if (!(FILTER_KEYS as readonly string[]).includes(key)) return false;
    if (value === "" || value === undefined) continue;
    if (["branchId", "ownerUserId", "pipelineId"].includes(key) && !isUUIDv7(value)) return false;
    if (["dateFrom", "dateTo"].includes(key) && (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) || !Number.isFinite(Date.parse(value))
      || (/^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value).toISOString().slice(0, 10) !== value))) return false;
    if (key === "currencyCode" && (typeof value !== "string" || !/^[A-Z]{3}$/.test(value))) return false;
    if (key === "datePreset" && !(DATE_PRESETS as readonly unknown[]).includes(value)) return false;
    if (key === "compare" && !["NONE", "PREVIOUS_PERIOD", "PREVIOUS_YEAR"].includes(String(value))) return false;
    if (["staleDays", "closingWindowDays", "limit"].includes(key) && (!Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > (key === "limit" ? 100 : 365))) return false;
  }
  if (filters.datePreset === "CUSTOM") return !!filters.dateFrom && !!filters.dateTo && Date.parse(String(filters.dateFrom)) <= Date.parse(String(filters.dateTo));
  return !filters.dateFrom && !filters.dateTo;
}
function validDisplay(display: Record<string, unknown>) {
  if (Object.keys(display).some((key) => !["title", "subtitle", "color", "targetColor", "numberFormat", "legendPosition", "options"].includes(key))) return false;
  for (const key of ["title", "subtitle"]) if (display[key] !== undefined && (typeof display[key] !== "string" || (display[key] as string).length > (key === "title" ? 120 : 300))) return false;
  for (const key of ["color", "targetColor"]) if (display[key] !== undefined && (typeof display[key] !== "string" || !HEX.test(display[key] as string))) return false;
  if (display.numberFormat !== undefined && !(NUMBER_FORMATS as readonly unknown[]).includes(display.numberFormat)) return false;
  if (display.legendPosition !== undefined && !(LEGEND_POSITIONS as readonly unknown[]).includes(display.legendPosition)) return false;
  if (display.options !== undefined) {
    if (!display.options || typeof display.options !== "object" || Array.isArray(display.options)) return false;
    const entries = Object.entries(display.options);
    if (entries.length > 32 || entries.some(([, value]) => value !== null && typeof value !== "string" && typeof value !== "boolean" && !(typeof value === "number" && Number.isFinite(value)))) return false;
    if (new TextEncoder().encode(JSON.stringify(display.options)).length > 4096) return false;
  }
  return true;
}


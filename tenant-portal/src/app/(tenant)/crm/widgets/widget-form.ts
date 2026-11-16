import type { DashboardCatalog, VisualizationCapability } from "../dashboards/dashboard-catalog-contract";
import type { ComparisonDatasetBasis, ComparisonDatasetSelection, ComparisonType, CrmVisualization, TimeGrain, WidgetQuerySpec } from "../dashboards/widget-contract";
import { normalizeWidgetDisplaySpec } from "../dashboards/widget-contract";
import type { GovernedTargetBinding } from "../dashboards/won-target-evidence";
export { validateWidgetForm } from "./widget-form-validation";

export interface WidgetSeriesDraft { metricKey: string; axis: "" | "LEFT" | "RIGHT"; label: string; color: string; }
export interface WidgetFormState {
  name: string;
  visualizationType: CrmVisualization | "";
  series: WidgetSeriesDraft[];
  dimensionKey: string;
  grain: TimeGrain | "";
  /** INHERIT is editor-only: it omits comparison on the wire. */
  comparison: "INHERIT" | ComparisonType;
  datasetBasis?: ComparisonDatasetBasis;
  datasets?: ComparisonDatasetSelection[];
  target: string;
  governedTarget?: GovernedTargetBinding;
  filters: Record<string, unknown>;
  displaySpec: Record<string, unknown>;
}
export interface WidgetAuthoringInput { name: string; visualizationType: CrmVisualization; querySpec: WidgetQuerySpec; displaySpec?: Record<string, unknown>; }
export const EMPTY_SERIES: WidgetSeriesDraft = { metricKey: "", axis: "", label: "", color: "" };
export const EMPTY_WIDGET_FORM: WidgetFormState = { name: "", visualizationType: "", series: [{ ...EMPTY_SERIES }], dimensionKey: "none", grain: "DAY", comparison: "INHERIT", target: "", filters: {}, displaySpec: {} };
export const NUMBER_FORMATS = ["auto", "compact", "full", "duration-auto", "duration-minutes", "duration-hours", "duration-days"] as const;
export const LEGEND_POSITIONS = ["top", "bottom", "start", "end", "none"] as const;
export const FILTER_KEYS = ["datePreset", "compare", "dateFrom", "dateTo", "branchId", "ownerUserId", "pipelineId", "currencyCode", "staleDays", "closingWindowDays", "limit"] as const;
export const findVisualization = (catalog: DashboardCatalog | null, key: string) => catalog?.visualizations.find((v) => v.key === key);
export const findMetric = (catalog: DashboardCatalog | null, key: string) => catalog?.metrics.find((m) => m.key === key);
export const buildableVisualizations = (catalog: DashboardCatalog | null) => catalog?.visualizations ?? [];
export function datasetComparisonFor(form: WidgetFormState, catalog: DashboardCatalog | null) {
  const capability = form.series.length === 1 ? findMetric(catalog, form.series[0].metricKey)?.datasetComparison : undefined;
  return form.visualizationType && capability?.visualizations.includes(form.visualizationType) ? capability : undefined;
}
export function supportsGovernedTarget(form: WidgetFormState, catalog: DashboardCatalog | null) {
  if (form.series.length !== 1) return false;
  const metric = findMetric(catalog, form.series[0].metricKey);
  const visualization = findVisualization(catalog, form.visualizationType);
  return !!visualization && !!metric?.comparisonTypes?.includes("GOVERNED_TARGET")
    && (visualization.requiresTarget || (metric.requiredComparison === "GOVERNED_TARGET" && !!metric.visualizations?.includes(visualization.key)));
}
export const grainsFor = (catalog: DashboardCatalog | null, key: string) => catalog?.dimensions.find((d) => d.key === key)?.grains ?? [];
export function metricsFor(catalog: DashboardCatalog | null, visualization: VisualizationCapability | undefined) {
  if (!visualization) return [];
  // DashboardCatalogService.validateWidget restricts typed ROWS to their own renderer.
  const rowKinds: Partial<Record<CrmVisualization, "ALERT" | "RANKED" | "SCORECARD">> = {
    ALERT_LIST: "ALERT", LEADERBOARD: "RANKED", SCORECARD: "SCORECARD",
  };
  const rowKind = rowKinds[visualization.key];
  return (catalog?.metrics ?? []).filter((metric) => visualization.shapes.includes(metric.shape)
    && (!metric.visualizations || metric.visualizations.includes(visualization.key))
    && (metric.shape !== "ROWS" || metric.rowKind === rowKind));
}
export function commonDimensions(form: WidgetFormState, catalog: DashboardCatalog | null) {
  const metrics = form.series.map((series) => findMetric(catalog, series.metricKey));
  return metrics.length && metrics.every(Boolean) ? metrics[0]!.dimensions.filter((key) => metrics.every((metric) => metric!.dimensions.includes(key))) : [];
}
/** The current renderer cannot plot mixed units or a second value axis. */
export function presentationVisualization(form: WidgetFormState, catalog: DashboardCatalog | null): CrmVisualization | "" {
  const units = new Set(form.series.map((series) => findMetric(catalog, series.metricKey)?.unit).filter(Boolean));
  const dualAxis = ["LINE", "LINE_AREA", "COLUMN", "COMBO"].includes(form.visualizationType);
  return units.size > 1 && !dualAxis ? "TABLE" : form.visualizationType;
}

export function buildQuerySpec(form: WidgetFormState): WidgetQuerySpec {
  const filters = Object.fromEntries(Object.entries(form.filters).filter(([, value]) => value !== "" && value !== undefined).map(([key, value]) =>
    [key, ["staleDays", "closingWindowDays", "limit"].includes(key) ? Number(value) : value]));
  return {
    series: form.series.map((series) => ({ metricKey: series.metricKey,
      ...(series.axis ? { axis: series.axis } : {}), ...(series.label ? { label: series.label.trim() } : {}), ...(series.color ? { color: series.color } : {}) })),
    dimension: form.dimensionKey === "time" ? { key: "time", grain: form.grain as TimeGrain } : { key: form.dimensionKey },
    ...(Object.keys(filters).length ? { filters } : {}),
    ...(form.comparison === "DATASETS" ? { comparison: { type: "DATASETS", basis: form.datasetBasis, datasets: form.datasets } }
      : form.comparison === "TARGET" ? { comparison: { type: "TARGET", target: Number(form.target) } }
      : form.comparison === "GOVERNED_TARGET" ? { comparison: { type: "GOVERNED_TARGET", governedTarget: form.governedTarget } }
      : form.comparison === "INHERIT" ? {} : { comparison: { type: form.comparison } }),
  };
}
export function widgetInput(form: WidgetFormState): WidgetAuthoringInput {
  return { name: form.name.trim(), visualizationType: form.visualizationType as CrmVisualization, querySpec: buildQuerySpec(form), displaySpec: normalizeWidgetDisplaySpec(form.displaySpec) };
}
export type StoredWidget = { name: string; visualizationType: CrmVisualization | null; querySpec: WidgetQuerySpec; displaySpec?: Record<string, unknown> };
export function widgetToForm(widget: StoredWidget): WidgetFormState {
  return { name: widget.name, visualizationType: widget.visualizationType ?? "",
    series: widget.querySpec.series.length ? widget.querySpec.series.map((series) => ({ metricKey: series.metricKey, axis: series.axis ?? "", label: series.label ?? "", color: series.color ?? "" })) : [{ ...EMPTY_SERIES }],
    dimensionKey: widget.querySpec.dimension?.key ?? "none", grain: widget.querySpec.dimension?.grain ?? "DAY",
    comparison: widget.querySpec.comparison?.type ?? "INHERIT", target: widget.querySpec.comparison?.target?.toString() ?? "",
    datasetBasis: widget.querySpec.comparison?.basis,
    governedTarget: widget.querySpec.comparison?.governedTarget,
    datasets: widget.querySpec.comparison?.datasets?.map((dataset) => ({ ...dataset })),
    filters: { ...widget.querySpec.filters }, displaySpec: { ...widget.displaySpec, ...(widget.displaySpec?.options ? { options: { ...(widget.displaySpec.options as Record<string, unknown>) } } : {}) } };
}
export function buildWidgetUpdate(form: WidgetFormState, stored: StoredWidget) {
  const original = widgetToForm(stored);
  return { name: form.name.trim(), ...(form.visualizationType !== stored.visualizationType ? { visualizationType: form.visualizationType as CrmVisualization } : {}),
    ...(JSON.stringify(buildQuerySpec(form)) !== JSON.stringify(buildQuerySpec(original)) ? { querySpec: buildQuerySpec(form) } : {}),
    ...(JSON.stringify(normalizeWidgetDisplaySpec(form.displaySpec)) !== JSON.stringify(normalizeWidgetDisplaySpec(original.displaySpec)) ? { displaySpec: normalizeWidgetDisplaySpec(form.displaySpec) } : {}) };
}

export type WidgetSpecLimitation = "SEMANTIC_ENGINE" | "RESULT_LIMITS" | "UNKNOWN_FIELDS";
export function widgetSpecLimitations(spec: WidgetQuerySpec, display: Record<string, unknown> = {}): WidgetSpecLimitation[] {
  const result: WidgetSpecLimitation[] = [];
  if ((spec.engine !== undefined && spec.engine !== "LEGACY_V1") || spec.semanticVersion !== undefined || spec.source !== undefined || spec.semanticFilters !== undefined) result.push("SEMANTIC_ENGINE");
  if (spec.topN !== undefined || spec.maxPoints !== undefined) result.push("RESULT_LIMITS");
  const queryKeys = ["engine", "series", "dimension", "filters", "comparison", "semanticVersion", "source", "semanticFilters", "topN", "maxPoints"];
  if (Object.keys(spec).some((key) => !queryKeys.includes(key)) || spec.series.some((series) => Object.keys(series).some((key) => !["metricKey", "axis", "label", "color"].includes(key)))
    || Object.keys(spec.dimension ?? {}).some((key) => !["key", "grain"].includes(key))
    || Object.keys(spec.comparison ?? {}).some((key) => !["type", "target", "basis", "datasets", "governedTarget"].includes(key))
    || (spec.comparison?.datasets !== undefined && (!Array.isArray(spec.comparison.datasets) || spec.comparison.datasets.some((dataset) =>
      !dataset || typeof dataset !== "object" || Object.keys(dataset).some((key) => !["datePreset", "dateFrom", "dateTo", "branchId"].includes(key)))))
    || Object.keys(spec.filters ?? {}).some((key) => !(FILTER_KEYS as readonly string[]).includes(key))
    || Object.keys(display).some((key) => !["title", "subtitle", "color", "targetColor", "numberFormat", "legendPosition", "options"].includes(key))) result.push("UNKNOWN_FIELDS");
  return result;
}
export const isSpecEditable = (spec: WidgetQuerySpec, display?: Record<string, unknown>) => widgetSpecLimitations(spec, display).length === 0;

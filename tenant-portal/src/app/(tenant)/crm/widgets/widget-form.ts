// The widget form's state, and the `querySpec` it builds.
//
// Every rule enforced here is read from `GET /dashboards/catalog`, never
// hardcoded: which visualizations exist, how many series each takes, which
// data shapes it accepts, which dimensions a metric supports, and whether a
// target is required. `DashboardCatalogService.validateWidget` re-checks all
// of it and answers 422 — this only stops the user reaching that.

import type {
  DashboardCatalog,
  MetricDefinition,
  VisualizationCapability,
} from "../dashboards/dashboard-catalog-contract";
import type { CrmVisualization, TimeGrain, WidgetQuerySpec } from "../dashboards/widget-contract";

export interface WidgetFormState {
  name: string;
  visualizationType: CrmVisualization | "";
  metricKey: string;
  dimensionKey: string;
  grain: TimeGrain;
  comparison: "NONE" | "PREVIOUS_PERIOD" | "PREVIOUS_YEAR" | "TARGET";
  target: string;
}

export const EMPTY_WIDGET_FORM: WidgetFormState = {
  name: "",
  visualizationType: "",
  metricKey: "",
  dimensionKey: "none",
  grain: "DAY",
  comparison: "NONE",
  target: "",
};

/**
 * The visualizations this form can build.
 *
 * `minSeries > 1` — `MULTI_KPI` and `COMBO` — are excluded: a one-metric form
 * cannot satisfy them, and offering a control whose every submission is a
 * `422 CRM_WIDGET_SERIES_INVALID` is worse than not offering it. Recorded as
 * Q104.
 */
export function buildableVisualizations(
  catalog: DashboardCatalog | null,
): VisualizationCapability[] {
  return (catalog?.visualizations ?? []).filter((visualization) => visualization.minSeries <= 1);
}

/** Metrics whose shape the chosen visualization accepts. */
export function metricsFor(
  catalog: DashboardCatalog | null,
  visualization: VisualizationCapability | undefined,
): MetricDefinition[] {
  if (!catalog || !visualization) return [];
  return catalog.metrics.filter((metric) => visualization.shapes.includes(metric.shape));
}

export function findVisualization(
  catalog: DashboardCatalog | null,
  key: string,
): VisualizationCapability | undefined {
  return catalog?.visualizations.find((visualization) => visualization.key === key);
}

export function findMetric(
  catalog: DashboardCatalog | null,
  key: string,
): MetricDefinition | undefined {
  return catalog?.metrics.find((metric) => metric.key === key);
}

export function grainsFor(catalog: DashboardCatalog | null, dimensionKey: string): string[] {
  return catalog?.dimensions.find((dimension) => dimension.key === dimensionKey)?.grains ?? [];
}

export type WidgetFormError =
  | "NAME_REQUIRED"
  | "VISUALIZATION_REQUIRED"
  | "METRIC_REQUIRED"
  | "DIMENSION_REQUIRED"
  | "TARGET_REQUIRED"
  | "TARGET_INVALID"
  | "COMPARISON_UNSUPPORTED";

export function validateWidgetForm(
  form: WidgetFormState,
  catalog: DashboardCatalog | null,
): WidgetFormError | null {
  if (form.name.trim().length === 0) return "NAME_REQUIRED";
  const visualization = findVisualization(catalog, form.visualizationType);
  if (!visualization) return "VISUALIZATION_REQUIRED";
  const metric = findMetric(catalog, form.metricKey);
  if (!metric) return "METRIC_REQUIRED";
  if (!metric.dimensions.includes(form.dimensionKey)) return "DIMENSION_REQUIRED";

  if (visualization.requiresTarget && form.comparison !== "TARGET") return "TARGET_REQUIRED";
  if (form.comparison === "TARGET") {
    const target = Number(form.target);
    // `@Min(0.000001)` plus a service check that the target is finite and > 0.
    if (!Number.isFinite(target) || target <= 0) return "TARGET_INVALID";
  }
  if (
    (form.comparison === "PREVIOUS_PERIOD" || form.comparison === "PREVIOUS_YEAR") &&
    (!visualization.supportsPeriodComparison || !metric.supportsPeriodComparison)
  ) {
    return "COMPARISON_UNSUPPORTED";
  }
  return null;
}

/**
 * The `querySpec` body.
 *
 * `engine` is left unset, which the server reads as `LEGACY_V1`. `SEMANTIC_V1`
 * is deliberately not offered: it accepts a strict subset of metrics and adds
 * `source`, `semanticFilters`, `topN` and `maxPoints`, and sending any of
 * those without the engine is a `422 CRM_WIDGET_ENGINE_INVALID`. Recorded as
 * Q105.
 */
export function buildQuerySpec(form: WidgetFormState): WidgetQuerySpec {
  const dimension =
    form.dimensionKey === "time"
      ? { key: form.dimensionKey, grain: form.grain }
      : { key: form.dimensionKey };
  const spec: WidgetQuerySpec = {
    series: [{ metricKey: form.metricKey }],
    dimension,
  };
  if (form.comparison === "TARGET") {
    spec.comparison = { type: "TARGET", target: Number(form.target) };
  } else if (form.comparison !== "NONE") {
    spec.comparison = { type: form.comparison };
  }
  return spec;
}

/**
 * The parts of a stored `querySpec` this one-metric form cannot represent.
 *
 * D23: `buildQuerySpec` emits a *fresh* object. Anything the form does not
 * model is absent from what it builds, and `PATCH /widgets/:id` replaces
 * `querySpec` wholesale rather than merging it — so sending a rebuilt spec
 * deletes whatever is listed here. See
 * `docs/api/crm-dashboards.md#patch-widgetsid-replaces-queryspec-wholesale--it-never-merges`.
 */
export type WidgetSpecLimitation =
  | "MULTI_SERIES"
  | "SERIES_STYLING"
  | "FILTERS"
  | "SEMANTIC_ENGINE"
  | "RESULT_LIMITS";

export function widgetSpecLimitations(spec: WidgetQuerySpec): WidgetSpecLimitation[] {
  const limitations: WidgetSpecLimitation[] = [];
  if (spec.series.length > 1) limitations.push("MULTI_SERIES");
  // `axis`, `label` and `color` are per-series presentation the form has no
  // control for, so a rebuilt series carries none of them.
  if (spec.series.some((entry) => entry.axis || entry.label || entry.color)) {
    limitations.push("SERIES_STYLING");
  }
  if (spec.filters && Object.keys(spec.filters).length > 0) limitations.push("FILTERS");
  if (
    spec.engine === "SEMANTIC_V1" ||
    spec.semanticVersion !== undefined ||
    spec.source !== undefined ||
    spec.semanticFilters !== undefined
  ) {
    limitations.push("SEMANTIC_ENGINE");
  }
  if (spec.topN !== undefined || spec.maxPoints !== undefined) limitations.push("RESULT_LIMITS");
  return limitations;
}

/** Whether the editor may open this widget at all. */
export function isSpecEditable(spec: WidgetQuerySpec): boolean {
  return widgetSpecLimitations(spec).length === 0;
}

/**
 * The `PATCH /widgets/:id` body the form owns, minus its revision.
 *
 * **`querySpec` is omitted unless the user edited the query.** The server reads
 * an absent key as "leave the stored spec alone" — `dto.querySpec ??
 * current.querySpec` in `dashboard-widgets.service.ts` — and that is the only
 * way to rename a widget without rewriting its spec. Omitting is also safer
 * than echoing the stored spec back, because crm-app runs
 * `forbidNonWhitelisted` and would answer 400 for any stored key its DTO does
 * not model.
 *
 * This is the second of two independent guards on D23. `isSpecEditable` stops
 * an unrepresentable widget reaching the form; this stops a rename touching the
 * spec even if it did.
 */
export function buildWidgetUpdate(
  form: WidgetFormState,
  stored: { name: string; visualizationType: CrmVisualization; querySpec: WidgetQuerySpec },
): { name: string; visualizationType: CrmVisualization; querySpec?: WidgetQuerySpec } {
  const original = widgetToForm(stored);
  const queryUnchanged =
    form.metricKey === original.metricKey &&
    form.dimensionKey === original.dimensionKey &&
    form.grain === original.grain &&
    form.comparison === original.comparison &&
    form.target === original.target;
  return {
    name: form.name,
    visualizationType: form.visualizationType as CrmVisualization,
    ...(queryUnchanged ? {} : { querySpec: buildQuerySpec(form) }),
  };
}

/** Reads an existing widget back into the form. */
export function widgetToForm(widget: {
  name: string;
  visualizationType: CrmVisualization;
  querySpec: WidgetQuerySpec;
}): WidgetFormState {
  const comparison = widget.querySpec.comparison?.type;
  return {
    name: widget.name,
    visualizationType: widget.visualizationType,
    metricKey: widget.querySpec.series[0]?.metricKey ?? "",
    dimensionKey: widget.querySpec.dimension?.key ?? "none",
    grain: widget.querySpec.dimension?.grain ?? "DAY",
    comparison:
      comparison === "TARGET" ||
      comparison === "PREVIOUS_PERIOD" ||
      comparison === "PREVIOUS_YEAR"
        ? comparison
        : "NONE",
    target:
      widget.querySpec.comparison?.target === undefined
        ? ""
        : String(widget.querySpec.comparison.target),
  };
}

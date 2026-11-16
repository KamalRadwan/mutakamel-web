import type { DashboardCatalog } from "../dashboards/dashboard-catalog-contract";
import { findMetric, findVisualization, metricsFor, type WidgetFormState } from "./widget-form";

export type WidgetMetricChoice = DashboardCatalog["metrics"][number];

export function metricChoiceAllowed(metric: WidgetMetricChoice, form: WidgetFormState, index: number, catalog: DashboardCatalog | null) {
  const capability = findVisualization(catalog, form.visualizationType);
  return metricsFor(catalog, capability).includes(metric)
    && (!metric.standalone || form.series.length === 1
      || (!!capability && capability.minSeries > 1 && metric.visualizations?.includes(capability.key) === true))
    && !form.series.some((series, other) => other !== index && findMetric(catalog, series.metricKey)?.standalone);
}

export function metricVisualizations(metric: WidgetMetricChoice, catalog: DashboardCatalog | null) {
  return (catalog?.visualizations ?? []).filter((visualization) => metricsFor(catalog, visualization).includes(metric)
    && (!metric.standalone || visualization.minSeries <= 1 || metric.visualizations?.includes(visualization.key)));
}

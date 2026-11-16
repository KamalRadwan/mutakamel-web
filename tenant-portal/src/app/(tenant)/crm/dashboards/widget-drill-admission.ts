import type { DashboardCatalog } from "./dashboard-catalog-contract";
import type { WidgetDefinition } from "./widget-contract";

export function currentWidgetDrillAdmission(widget: WidgetDefinition, catalog: DashboardCatalog | null | undefined,
  explicitCurrency?: unknown): "SUPPORTED" | "CURRENCY_REQUIRED" | "UNSUPPORTED" {
  const query = widget.querySpec;
  if (query.comparison?.type === "DATASETS" || query.comparison?.type === "GOVERNED_TARGET" || query.series.length !== 1 || (query.engine ?? "LEGACY_V1") !== "LEGACY_V1"
    || [query.semanticVersion, query.source, query.semanticFilters, query.topN, query.maxPoints].some((value) => value !== undefined)) return "UNSUPPORTED";
  const strategy = catalog?.metrics.find((metric) => metric.key === query.series[0].metricKey)?.drilldown;
  if (!strategy || (query.dimension?.key ?? "none") !== strategy.dimensionKey) return "UNSUPPORTED";
  const currency = explicitCurrency === undefined ? query.filters?.currencyCode : explicitCurrency;
  return strategy.requiresCurrency && !(typeof currency === "string" && /^[A-Z]{3}$/i.test(currency)) ? "CURRENCY_REQUIRED" : "SUPPORTED";
}
/** Same currency precedence as current backend mergeFilterLayers; omitted runtime controls do not clear defaults. */
export function currentDrillCurrency(defaults: Record<string, unknown>, widgetFilters: Record<string, unknown> | undefined, runtimeCurrency: string | null): string | null {
  let currency = defaults.currencyCode;
  if (widgetFilters?.currencyCode !== undefined) currency = widgetFilters.currencyCode;
  if (runtimeCurrency) currency = runtimeCurrency;
  return typeof currency === "string" ? currency : null;
}

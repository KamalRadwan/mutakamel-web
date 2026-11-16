import type { Language } from "@/i18n/useLanguage";
import { localizedName } from "@/lib/format/localized";
import { INTL_LOCALE } from "@/lib/format/locale";
import type { DashboardCatalog } from "./dashboard-catalog-contract";
import type { WidgetResult } from "./dashboard-run-contract";
import type { WidgetQuerySpec } from "./widget-contract";
import { datasetComparisonDetails, datasetComparisonLabel, type DatasetComparisonLabels } from "./widget-dataset-comparison";

export function localizeWidgetResult(result: WidgetResult, catalog: DashboardCatalog | null | undefined, lang: Language, query?: WidgetQuerySpec, labels?: DatasetComparisonLabels): WidgetResult;
export function localizeWidgetResult(result: WidgetResult | undefined, catalog: DashboardCatalog | null | undefined, lang: Language, query?: WidgetQuerySpec, labels?: DatasetComparisonLabels): WidgetResult | undefined;
export function localizeWidgetResult(result: WidgetResult | undefined, catalog: DashboardCatalog | null | undefined, lang: Language, query?: WidgetQuerySpec, labels?: DatasetComparisonLabels) {
  if (!result) return result;
  const dataset = labels ? datasetComparisonDetails(result.details) : null;
  const monthFormat = (result.shape === "TIME_SERIES" && query?.dimension?.grain === "MONTH") || query?.dimension?.key === "cohort_month"
    ? new Intl.DateTimeFormat(INTL_LOCALE[lang], { month: "short", year: "numeric", timeZone: "UTC" }) : null;
  return { ...result, series: result.series.map((series) => {
    const points = series.points.map((point) => {
      if (dataset?.basis === "PERIOD" && labels && /^P\d+$/.test(point.key)) {
        return { ...point, label: `${labels.grains[dataset.grain]} ${point.key.slice(1)}` };
      }
      if (lang === "ar" && result.shape === "CATEGORY" && typeof point.meta.labelAr === "string" && point.meta.labelAr.trim()) {
        return { ...point, label: point.meta.labelAr };
      }
      if (monthFormat && point.label === point.key && /^\d{4}-(?:0[1-9]|1[0-2])-01$/.test(point.key)) {
        return { ...point, label: monthFormat.format(new Date(`${point.key}T00:00:00Z`)) };
      }
      return point;
    });
    const entry = dataset?.entries.find(({ key }) => key === series.key);
    if (entry && dataset && labels) return { ...series, label: datasetComparisonLabel(entry, dataset.basis, lang, labels), points };
    const metric = catalog?.metrics.find((item) => series.key === item.key || series.key.startsWith(`${item.key}:`));
    if (metric && query?.series.some((item) => item.metricKey === metric.key && item.label?.trim())) return { ...series, points };
    const runtimeLabel = points[0]?.meta;
    if (lang === "ar" && runtimeLabel?.seriesLabel === series.label
      && typeof runtimeLabel.seriesLabelAr === "string" && runtimeLabel.seriesLabelAr.trim()) {
      return { ...series, points, label: runtimeLabel.seriesLabelAr };
    }
    if (!metric) return { ...series, points };
    // Runtime group/record names are business data. Translate only the known
    // catalogue-default label, including its unchanged currency suffix.
    const suffix = series.currency && series.label === `${metric.nameEn} (${series.currency})` ? ` (${series.currency})` : "";
    return series.label === metric.nameEn || suffix
      ? { ...series, points, label: localizedName(metric, lang) + suffix } : { ...series, points };
  }) };
}

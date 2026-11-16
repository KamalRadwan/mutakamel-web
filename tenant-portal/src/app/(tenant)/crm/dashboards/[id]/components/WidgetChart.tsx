"use client";
import { DonutChart, topNWithOther } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { formatNumber } from "@/lib/format/number";
import type { CrmVisualization, WidgetQuerySpec } from "../../widget-contract";
import type { WidgetResult } from "../../dashboard-run-contract";
import { COLORFUL_SWATCH_FILLS, hasSingleMeasureCurrencyFacets, primarySeries, type WidgetRenderMode } from "../../widget-view";
import { formatWidgetValue, widgetOption, widgetSeriesColor } from "../../widget-presentation";
import { WidgetLegend } from "./WidgetLegend";
import { GaugeChartView } from "./WidgetGaugeChart";
import { FunnelChartView } from "./WidgetFunnelChart";
import { ScatterBubbleChartView } from "./WidgetScatterChart";
import { HeatmapChartView } from "./WidgetHeatmapChart";
import { HistogramChartView } from "./WidgetHistogramChart";
import { BoxPlotChartView } from "./WidgetBoxPlotChart";
import { AlertListView, ActivityFeedView } from "./WidgetEventViews";
import { WidgetCartesianChart } from "./WidgetCartesianChart";
import { WidgetTypedCharts } from "./WidgetTypedCharts";
import { WidgetTemporalCharts } from "./WidgetTemporalCharts";
import { WidgetCategoryLeaderboard } from "./WidgetCategoryLeaderboard";
import { cohortMaturitySummary } from "../../widget-cohort-maturity";
import { LEAD_SOURCE_GROWTH_METRIC, readSourceGrowth } from "../../widget-source-growth";
import { readSourceMix } from "../../widget-source-mix";
import { LEAD_CURRENT_RATING_MIX, LEAD_INQUIRY_CLASSIFICATION } from "../../widget-acquisition-quality";
import { WidgetCurrentRatingChart, WidgetInquiryClassificationChart } from "./WidgetAcquisitionQuality";

interface WidgetChartProps {
  mode: Exclude<WidgetRenderMode, "SCALAR" | "MULTI_KPI" | "TABLE">;
  visualizationType?: CrmVisualization;
  result: WidgetResult;
  label: string;
  displaySpec?: Record<string, unknown>;
  querySpec?: WidgetQuerySpec;
  onDrilldown?: (pointKey: string, pointLabel: string, seriesKey?: string | null) => void;
}

const CHART_HEIGHT = 220;

export function WidgetChart({
  mode,
  visualizationType,
  result,
  label,
  displaySpec = {},
  querySpec,
  onDrilldown,
}: WidgetChartProps) {
  const { t, lang } = useI18n();
  const series = primarySeries(result);
  if (visualizationType === "STACKED_BAR" && series[0]?.key === LEAD_CURRENT_RATING_MIX) return <WidgetCurrentRatingChart result={result} label={label} displaySpec={displaySpec} />;
  if (series[0]?.key === LEAD_INQUIRY_CLASSIFICATION) return <WidgetInquiryClassificationChart
    result={result} label={label} horizontal={visualizationType === "BAR"} displaySpec={displaySpec} />;

  if (series[0]?.key === LEAD_SOURCE_GROWTH_METRIC
    && !readSourceGrowth(result)?.rows.some(({ growthPercent }) => growthPercent !== null)) return null;

  if ((mode === "DONUT" || mode === "FUNNEL") && hasSingleMeasureCurrencyFacets(series)) return <div className="space-y-4"><p className="text-2xs text-muted-foreground">{t.crmDashboards.currencyFacetNotice}</p>{series.map((entry) => <section key={entry.key} className="space-y-2"><h4 className="text-xs font-semibold"><bdi>{entry.currency}</bdi></h4><WidgetChart mode={mode} visualizationType={visualizationType} result={{ ...result, series: [entry], currency: entry.currency }} label={`${label} · ${entry.currency}`} displaySpec={displaySpec} querySpec={querySpec} onDrilldown={onDrilldown} /></section>)}</div>;

  const summary = formatTemplate(t.crmDashboards.chartSummary, {
    series: series.length,
    points: series[0]?.points.length ?? 0,
  });

  if (mode === "GANTT" || mode === "FLOWCHART" || mode === "CALENDAR" || mode === "TIMELINE" || mode === "CALENDAR_HEATMAP") return <WidgetTemporalCharts mode={mode} result={result} label={label} displaySpec={displaySpec} querySpec={querySpec} />;

  if (mode === "GAUGE") {
    return (
      <GaugeChartView
        visualizationType={visualizationType}
        result={result}
        label={label}
        displaySpec={displaySpec}
      />
    );
  }

  if (mode === "FUNNEL" && series[0]) {
    return (
      <FunnelChartView
        series={series[0]}
        currency={result.currency}
        label={label}
        summary={summary}
        onDrilldown={onDrilldown}
      />
    );
  }

  if (mode === "SCATTER" && series[0]) {
    return (
      <ScatterBubbleChartView
        visualizationType={visualizationType}
        series={series[0]}
        currency={result.currency}
        label={label}
        summary={summary}
        displaySpec={displaySpec}
        querySpec={querySpec}
      />
    );
  }

  if (mode === "HEATMAP" && series[0]) {
    return (
      <HeatmapChartView
        allSeries={series}
        label={label}
        summary={summary}
        currency={result.currency}
        displaySpec={displaySpec}
        cohortTimeZone={cohortMaturitySummary(result.details)?.timeZone}
        leadArrival={querySpec?.dimension?.key === "lead_arrival_slot"}
        onDrilldown={onDrilldown}
      />
    );
  }

  if (mode === "HISTOGRAM") {
    return (
      <HistogramChartView
        result={result}
        label={label}
        displaySpec={displaySpec}
      />
    );
  }

  if (mode === "BOX_PLOT") return <BoxPlotChartView data={result.typedResult} label={label} displaySpec={displaySpec} />;

  if (mode === "WATERFALL" || mode === "TREEMAP" || mode === "LEADERBOARD" || mode === "SCORECARD") {
    if (mode === "LEADERBOARD" && result.typedResult === null) return <WidgetCategoryLeaderboard result={result} label={label} displaySpec={displaySpec} querySpec={querySpec} onDrilldown={onDrilldown} />;
    return <WidgetTypedCharts mode={mode} result={result} label={label} displaySpec={displaySpec} />;
  }

  if (mode === "ALERT_LIST") {
    return <AlertListView result={result} label={label} />;
  }

  if (mode === "ACTIVITY_FEED") {
    return <ActivityFeedView result={result} label={label} />;
  }

  if (mode === "DONUT" && series[0]) {
    if (series[0].points.some((point) => point.value === null)) return <p className="text-xs text-muted-foreground">{t.crmDashboards.missingChartValues}</p>;
    const completePoints = series[0].points.flatMap((point) => point.value === null ? [] : [{ ...point, value: point.value }]);
    const sourceMix = readSourceMix(result);
    const storedOther = sourceMix ? completePoints.find(point => point.key === "OTHER") : undefined;
    const baseSlices = topNWithOther(
      completePoints.filter(point => point !== storedOther).map((point) => ({
        key: point.key,
        label: point.label,
        value: point.value,
      })),
      t.crmDashboards.otherSlice,
    );
    if (storedOther) {
      const folded = baseSlices.find(slice => slice.isOther);
      if (folded) folded.value += storedOther.value;
      else baseSlices.push({ key: "__other__", label: t.crmDashboards.otherSlice,
        value: storedOther.value, fill: "var(--swatch-slate)", isOther: true });
    }
    const slices = baseSlices.map((slice, index) => ({
      ...slice,
      fill: slice.isOther
        ? "var(--swatch-slate)"
        : widgetSeriesColor(series[0].key, querySpec, displaySpec) ?? COLORFUL_SWATCH_FILLS[index % COLORFUL_SWATCH_FILLS.length],
    }));
    const total = completePoints.reduce((sum, point) => sum + point.value, 0);
    const formattedTotal = formatWidgetValue(
      total,
      series[0].unit,
      series[0].currency ?? result.currency,
      lang, displaySpec,
    );
    return (
      <WidgetLegend position={displaySpec.legendPosition ?? "bottom"} entries={slices}>
      <DonutChart
        variant={visualizationType === "PIE" ? "pie" : "donut"}
        slices={slices}
        label={label}
        summary={summary}
        centerValue={series[0].unit === "COUNT" ? formattedTotal : undefined}
        centerLabel={t.crmDashboards.displayedTotal}
        height={CHART_HEIGHT}
        showLegend={false}
        showValues={widgetOption(displaySpec, "showValues")}
        valueFormatter={(value) => sourceMix?.total
          ? `${formatNumber(value, lang)} · ${formatNumber(value / sourceMix.total, lang, { style: "percent", maximumFractionDigits: 2 })}`
          : formatWidgetValue(value, series[0].unit, series[0].currency ?? result.currency, lang, displaySpec)}
      />
      </WidgetLegend>
    );
  }

  return <WidgetCartesianChart result={result} visualizationType={visualizationType ?? (mode === "LINE" ? "LINE" : mode === "AREA" ? "AREA" : mode === "STACKED_BAR" ? "STACKED_BAR" : "COLUMN")}
    label={label} summary={summary} displaySpec={displaySpec} querySpec={querySpec} onDrilldown={onDrilldown} />;
}



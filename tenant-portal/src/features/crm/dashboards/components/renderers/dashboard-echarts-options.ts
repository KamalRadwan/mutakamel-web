import type { EChartsOption } from "echarts";
import { formatDashboardValue } from "../../models/dashboard-utils";
import type {
  CrmDashboardWidget,
  DashboardDataPoint,
  DashboardWidgetSeriesData,
  DashboardWidgetResult,
} from "../../models/dashboard-types";

export type DashboardPointSelection = {
  pointKey: string;
  seriesKey?: string;
};

export type DashboardEChartsDatum = {
  value: number | number[];
  name?: string;
  pointKey: string;
  seriesKey?: string;
  drilldownCapable: boolean;
  formattedValue: string;
  itemStyle?: { color: string };
  children?: DashboardEChartsDatum[];
};

export type DashboardEChartsBuildContext = {
  widget: CrmDashboardWidget;
  series: DashboardWidgetSeriesData[];
  palette: string[];
  selectionFor: (
    series: DashboardWidgetSeriesData,
    point: DashboardDataPoint,
    seriesIndex: number,
  ) => DashboardPointSelection | undefined;
};

type HierarchyNode = {
  id: string;
  parentId?: string;
  label: string;
  value: number;
  depth: number;
};

type DistributionBin = {
  key: string;
  label: string;
  count: number;
};

type WaterfallStep = {
  key: string;
  label: string;
  value: number;
  cumulativeValue: number;
  kind: "START" | "DELTA" | "SUBTOTAL" | "TOTAL";
};

const transparent = "rgba(0,0,0,0)";
const axisColor = "#e5e7eb"; // fallback from var(--tenant-border)
const textColor = "#9ca3af"; // fallback from var(--tenant-muted)

export function buildCartesianOption(
  context: DashboardEChartsBuildContext,
  mode: "LINE" | "AREA" | "LINE_AREA" | "COLUMN" | "BAR" | "STACKED_BAR" | "STACKED_BAR_100" | "COMBO",
): EChartsOption {
  const categories = categoryDomain(context.series);
  const horizontal = mode === "BAR";
  const normalizeToPercent = mode === "STACKED_BAR_100";
  const totals = new Map(categories.map(({ key }) => [
    key,
    context.series.reduce((total, item) => {
      const value = item.points.find((point: DashboardDataPoint) => point.key === key)?.value ?? 0;
      return total + Math.max(0, value);
    }, 0),
  ]));
  const chartSeries = context.series.map((item, seriesIndex) => {
    const comparison = isComparisonSeries(item);
    const seriesType: "line" | "bar" = mode === "LINE" || mode === "AREA" || mode === "LINE_AREA"
      ? "line"
      : mode === "COMBO" && (item.axis === "RIGHT" || seriesIndex === context.series.length - 1)
        ? "line"
        : "bar";
    const data = categories.map(({ key }) => {
      const point = item.points.find((candidate: DashboardDataPoint) => candidate.key === key);
      if (!point) return null;
      const rawValue = normalizeToPercent
        ? (Math.max(0, point.value) / Math.max(Number.EPSILON, totals.get(key) ?? 0)) * 100
        : point.value;
      return datum(context, item, point, seriesIndex, rawValue);
    });
    const area = mode === "AREA" || (mode === "LINE_AREA" && seriesIndex === 0);
    return {
      id: item.key,
      name: item.label,
      type: seriesType,
      yAxisIndex: horizontal ? undefined : item.axis === "RIGHT" ? 1 : 0,
      xAxisIndex: horizontal && item.axis === "RIGHT" ? 1 : 0,
      data,
      smooth: seriesType === "line" ? 0.34 : undefined,
      connectNulls: false,
      showSymbol: data.length <= 40,
      symbolSize: 7,
      stack: mode === "STACKED_BAR" || normalizeToPercent ? "dashboard-total" : undefined,
      areaStyle: area && !comparison ? { opacity: 0.14 } : undefined,
      lineStyle: comparison ? { type: "dashed", width: 2 } : { width: 3 },
      itemStyle: { color: context.palette[seriesIndex % context.palette.length] },
      emphasis: { focus: "series" },
    };
  });
  const hasRightAxis = context.series.some((item) => item.axis === "RIGHT");
  const valueAxis = (right = false) => ({
    type: "value" as const,
    position: right ? "right" as const : "left" as const,
    splitLine: { lineStyle: { color: axisColor, type: "dashed" as const, opacity: 0.6 } },
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: textColor, formatter: normalizeToPercent ? "{value}%" : undefined },
  });
  const categoryAxis = {
    type: "category" as const,
    data: categories.map(({ label }) => label),
    axisLine: { lineStyle: { color: axisColor } },
    axisTick: { show: false },
    axisLabel: { color: textColor, hideOverlap: true, overflow: "truncate" as const, width: 84 },
  };
  return baseOption({
    grid: { left: 14, right: hasRightAxis ? 14 : 8, top: 12, bottom: 4, containLabel: true },
    xAxis: horizontal
      ? [valueAxis(false), ...(hasRightAxis ? [valueAxis(true)] : [])]
      : categoryAxis,
    yAxis: horizontal
      ? categoryAxis
      : [valueAxis(false), ...(hasRightAxis ? [valueAxis(true)] : [])],
    series: chartSeries,
  });
}

export function buildPieOption(
  context: DashboardEChartsBuildContext,
  pie: boolean,
): EChartsOption {
  const primary = context.series[0];
  const points = collapseCategoricalPoints(
    (primary?.points ?? []).filter((point: DashboardDataPoint) => point.value > 0),
    8,
  );
  return baseOption({
    tooltip: dashboardTooltip("item"),
    series: [{
      id: primary?.key ?? "pie",
      name: primary?.label,
      type: "pie",
      radius: pie ? ["0%", "72%"] : ["46%", "76%"],
      center: ["50%", "50%"],
      avoidLabelOverlap: true,
      minAngle: 2,
      label: { show: false },
      emphasis: { scale: true, scaleSize: 5 },
      data: points.map((point, index) => ({
        ...datum(context, primary, point, 0, point.value, point.key !== "__other__"),
        itemStyle: { color: point.color ?? context.palette[index % context.palette.length] },
      })),
    }],
  });
}

export function buildScatterOption(
  context: DashboardEChartsBuildContext,
  bubble: boolean,
): EChartsOption {
  const probabilityOnX = displayOption<string>(context.widget, "xyOrientation") !== "VALUE_X";
  const sizes = context.series.flatMap((item) => item.points.map((point: DashboardDataPoint) => Math.max(0, point.size ?? 0)));
  const minSize = Math.min(...sizes, 0);
  const maxSize = Math.max(...sizes, 1);
  const xLabel = displayOption<string>(context.widget, "xLabel") ?? (probabilityOnX ? "Probability" : "Value");
  const yLabel = displayOption<string>(context.widget, "yLabel") ?? (probabilityOnX ? "Value" : "Probability");
  return baseOption({
    grid: { left: 18, right: 12, top: 14, bottom: 12, containLabel: true },
    xAxis: valueAxis(xLabel),
    yAxis: valueAxis(yLabel),
    series: context.series.map((item, seriesIndex) => ({
      id: item.key,
      name: item.label,
      type: "scatter",
      itemStyle: { color: context.palette[seriesIndex % context.palette.length], opacity: 0.78 },
      symbolSize: bubble
        ? (value: unknown) => {
            const tuple = Array.isArray(value) ? value : [];
            const size = Number(tuple[2] ?? 0);
            return maxSize === minSize ? 26 : 14 + ((size - minSize) / (maxSize - minSize)) * 32;
          }
        : 12,
      data: item.points.map((point: DashboardDataPoint) => {
        const x = probabilityOnX ? point.secondaryValue ?? 0 : point.value;
        const y = probabilityOnX ? point.value : point.secondaryValue ?? 0;
        return datum(context, item, point, seriesIndex, [x, y, Math.max(0, point.size ?? 0)]);
      }),
    })),
  });
}

export function buildFunnelOption(context: DashboardEChartsBuildContext): EChartsOption {
  const primary = context.series[0];
  const points = (primary?.points ?? []).filter((point: DashboardDataPoint) => point.value >= 0).slice(0, 12);
  return baseOption({
    tooltip: dashboardTooltip("item"),
    series: [{
      id: primary?.key ?? "funnel",
      name: primary?.label,
      type: "funnel",
      left: "8%",
      top: 8,
      bottom: 8,
      width: "84%",
      minSize: "18%",
      maxSize: "100%",
      sort: "descending",
      gap: 3,
      label: { show: true, position: "inside", color: "#fff", formatter: "{b}" },
      data: points.map((point: DashboardDataPoint, index: number) => ({
        ...datum(context, primary, point, 0),
        itemStyle: { color: point.color ?? context.palette[index % context.palette.length] },
      })),
    }],
  });
}

export function buildHeatmapOption(context: DashboardEChartsBuildContext): EChartsOption {
  const columns = categoryDomain(context.series);
  const values = context.series.flatMap((item) => item.points.map((point: DashboardDataPoint) => point.value));
  const max = Math.max(1, ...values);
  return baseOption({
    grid: { left: 12, right: 8, top: 8, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: columns.map(({ label }) => label),
      splitArea: { show: true },
      axisLabel: { color: textColor, hideOverlap: true },
    },
    yAxis: {
      type: "category",
      data: context.series.map((item) => item.label),
      splitArea: { show: true },
      axisLabel: { color: textColor, hideOverlap: true },
    },
    visualMap: {
      min: 0,
      max,
      show: false,
      inRange: { color: ["#f3f4f6", context.palette[0]] },
    },
    series: [{
      type: "heatmap",
      data: context.series.flatMap((item, rowIndex) => columns.flatMap(({ key }, columnIndex) => {
        const point = item.points.find((candidate: DashboardDataPoint) => candidate.key === key);
        if (!point) return [];
        const value = [columnIndex, rowIndex, point.value];
        return [datum(context, item, point, rowIndex, value)];
      })),
      label: { show: values.length <= 36, color: "var(--tenant-text)" },
      emphasis: { itemStyle: { borderColor: "var(--tenant-text)", borderWidth: 1 } },
    }],
  });
}

export function buildGaugeOption(
  value: number,
  min: number,
  max: number,
  formattedValue: string,
  target: number | undefined,
  color: string,
  gaugeType: string,
): EChartsOption {
  const semi = gaugeType === "SEMI_CIRCLE_GAUGE";
  const threeQuarter = gaugeType === "THREE_QUARTER_GAUGE" || gaugeType === "DETAILED_SPEEDOMETER";
  const startAngle = semi ? 180 : threeQuarter ? 225 : 90;
  const endAngle = semi ? 0 : threeQuarter ? -45 : -270;
  const progress = Math.max(0, Math.min(1, (value - min) / Math.max(Number.EPSILON, max - min)));
  const targetProgress = target === undefined
    ? undefined
    : Math.max(0, Math.min(1, (target - min) / Math.max(Number.EPSILON, max - min)));
  const axisColors: Array<[number, string]> = targetProgress === undefined
    ? [[1, "#e5e7eb"]]
    : [[targetProgress, "#e5e7eb"], [1, "#f97316"]];
  return baseOption({
    series: [{
      type: "gauge",
      min,
      max,
      startAngle,
      endAngle,
      radius: semi ? "96%" : "86%",
      center: semi ? ["50%", "72%"] : ["50%", "52%"],
      progress: { show: true, width: 13, roundCap: true, itemStyle: { color } },
      axisLine: { roundCap: true, lineStyle: { width: 13, color: axisColors } },
      pointer: { show: gaugeType === "DETAILED_SPEEDOMETER", width: 4, length: "58%" },
      anchor: { show: gaugeType === "DETAILED_SPEEDOMETER", size: 8 },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      title: { show: false },
      detail: {
        valueAnimation: true,
        offsetCenter: semi ? [0, "-6%"] : [0, "8%"],
        color: "var(--tenant-text)",
        fontSize: 22,
        fontWeight: 800,
        formatter: () => formattedValue,
      },
      data: [{ value: min + progress * (max - min) }],
    }],
  });
}

export function buildTreemapOption(
  nodes: readonly HierarchyNode[],
  unit: string,
  currency: string | undefined,
  palette: string[],
): EChartsOption {
  const byParent = new Map<string | undefined, HierarchyNode[]>();
  for (const node of nodes) {
    byParent.set(node.parentId, [...(byParent.get(node.parentId) ?? []), node]);
  }
  const build = (node: HierarchyNode, index: number): DashboardEChartsDatum => ({
    value: Math.max(0, node.value),
    name: node.label,
    pointKey: node.id,
    drilldownCapable: false,
    formattedValue: formatUnitValue(node.value, unit, currency),
    itemStyle: { color: palette[index % palette.length] },
    children: (byParent.get(node.id) ?? []).map((child, childIndex) => build(child, childIndex)),
  });
  return baseOption({
    tooltip: dashboardTooltip("item"),
    series: [{
      type: "treemap",
      roam: false,
      nodeClick: false,
      breadcrumb: { show: true, itemStyle: { color: "#f3f4f6", textStyle: { color: "#4b5563" } } },
      label: { show: true, overflow: "truncate", formatter: "{b}" },
      upperLabel: { show: true, color: "#fff", height: 24 },
      data: (byParent.get(undefined) ?? []).map((node, index) => build(node, index)),
    }],
  });
}

export function buildHistogramOption(
  bins: readonly DistributionBin[],
  currency: string | undefined,
  palette: string[],
): EChartsOption {
  return baseOption({
    grid: { left: 12, right: 8, top: 12, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: bins.map((bin) => bin.label),
      axisLabel: { color: textColor, hideOverlap: true, rotate: bins.length > 8 ? 28 : 0 },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: axisColor } },
    },
    yAxis: valueAxis("Count"),
    series: [{
      type: "bar",
      barCategoryGap: "2%",
      data: bins.map((bin, index) => ({
        value: bin.count,
        name: bin.label,
        pointKey: bin.key,
        drilldownCapable: false,
        formattedValue: `${formatDashboardValue(bin.count)} records${currency ? ` · ${currency}` : ""}`,
        itemStyle: { color: palette[index % Math.min(3, palette.length)], borderRadius: [4, 4, 0, 0] },
      })),
    }],
  });
}

export function buildWaterfallOption(
  steps: readonly WaterfallStep[],
  unit: string,
  currency: string | undefined,
  palette: string[],
): EChartsOption {
  const offsets: number[] = [];
  const values: number[] = [];
  let previous = 0;
  for (const step of steps) {
    const absolute = step.kind === "START" || step.kind === "SUBTOTAL" || step.kind === "TOTAL";
    const next = absolute ? step.cumulativeValue : previous + step.value;
    offsets.push(Math.min(previous, next));
    values.push(Math.abs(next - previous) || Math.abs(step.value));
    previous = next;
  }
  return baseOption({
    grid: { left: 12, right: 8, top: 12, bottom: 8, containLabel: true },
    xAxis: { type: "category", data: steps.map((step) => step.label), axisLabel: { color: textColor, hideOverlap: true } },
    yAxis: valueAxis("Value"),
    series: [
      { type: "bar", stack: "waterfall", silent: true, itemStyle: { color: transparent }, data: offsets },
      {
        type: "bar",
        stack: "waterfall",
        data: steps.map((step, index) => ({
          value: values[index],
          name: step.label,
          pointKey: step.key,
          drilldownCapable: false,
          formattedValue: formatUnitValue(step.value, unit, currency),
          itemStyle: { color: step.value < 0 ? "#ef4444" : palette[index % palette.length] },
        })),
      },
    ],
  });
}

export function dashboardTooltip(trigger: "axis" | "item" = "axis") {
  return {
    trigger,
    renderMode: "richText" as const,
    confine: true,
    formatter: (raw: unknown) => tooltipText(raw),
  };
}

function tooltipText(raw: unknown): string {
  const params = Array.isArray(raw) ? raw : [raw];
  return params.map((entry) => {
    if (!entry || typeof entry !== "object") return "";
    const value = entry as { seriesName?: unknown; name?: unknown; data?: unknown; value?: unknown };
    const datumValue = value.data && typeof value.data === "object"
      ? (value.data as { formattedValue?: unknown }).formattedValue
      : undefined;
    const label = String(value.name ?? value.seriesName ?? "Value");
    const formatted = typeof datumValue === "string" ? datumValue : formatUnknownValue(value.value);
    return `${label}: ${formatted}`;
  }).filter(Boolean).join("\n");
}

function formatUnknownValue(value: unknown): string {
  if (Array.isArray(value)) return value.map((entry) => String(entry)).join(", ");
  return typeof value === "number" ? formatDashboardValue(value) : String(value ?? "—");
}

function datum(
  context: DashboardEChartsBuildContext,
  series: DashboardWidgetSeriesData,
  point: DashboardDataPoint,
  seriesIndex: number,
  value: number | number[] = point.value,
  allowDrilldown = true,
): DashboardEChartsDatum {
  const selection = allowDrilldown ? context.selectionFor(series, point, seriesIndex) : undefined;
  return {
    value,
    name: point.label,
    pointKey: selection?.pointKey ?? point.key,
    ...(selection?.seriesKey ? { seriesKey: selection.seriesKey } : {}),
    drilldownCapable: Boolean(selection),
    formattedValue: formatSeriesValue(point.value, series, context.widget),
    ...(point.color ? { itemStyle: { color: point.color } } : {}),
  };
}

function baseOption(option: Record<string, unknown>): EChartsOption {
  return {
    animationDuration: 320,
    animationDurationUpdate: 180,
    textStyle: { color: "var(--tenant-text)", fontFamily: "inherit" },
    aria: { enabled: true, decal: { show: true } },
    tooltip: dashboardTooltip(),
    toolbox: {
      show: true,
      feature: {
        saveAsImage: { title: "Export Image", pixelRatio: 2, iconStyle: { borderColor: "var(--tenant-text)" } }
      },
      top: 0,
      right: 15
    },
    ...option,
  } as EChartsOption;
}

function valueAxis(name: string) {
  return {
    type: "value" as const,
    name,
    nameTextStyle: { color: textColor },
    splitLine: { lineStyle: { color: axisColor, type: "dashed" as const, opacity: 0.6 } },
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: textColor },
  };
}

function categoryDomain(series: DashboardWidgetSeriesData[]) {
  const domain = new Map<string, string>();
  for (const item of series) {
    for (const point of item.points) {
      if (!domain.has(point.key)) domain.set(point.key, point.label);
    }
  }
  return [...domain.entries()].map(([key, label]) => ({ key, label }));
}

function collapseCategoricalPoints(points: DashboardDataPoint[], limit: number): DashboardDataPoint[] {
  if (points.length <= limit) return points;
  const visible = points.slice(0, Math.max(1, limit - 1));
  const remainder = points.slice(visible.length);
  return [
    ...visible,
    {
      key: "__other__",
      label: `Other (${remainder.length})`,
      value: remainder.reduce((sum, point) => sum + Math.max(0, point.value), 0),
    },
  ];
}

function formatSeriesValue(value: number, series: DashboardWidgetSeriesData, widget: CrmDashboardWidget) {
  const numberFormat = widget.displaySpec.numberFormat;
  const percent = numberFormat === "percent";
  const suffix = displayOption<string>(widget, "suffix");
  return formatDashboardValue(value, {
    currency: percent ? undefined : series.currency,
    compact: numberFormat === "compact",
    precision: displayOption<number>(widget, "precision"),
    prefix: displayOption<string>(widget, "prefix"),
    suffix: percent ? suffix ?? "%" : suffix,
  });
}

function formatUnitValue(value: number, unit: string, currency?: string) {
  return formatDashboardValue(value, {
    currency: unit === "MONEY" ? currency : undefined,
    suffix: unit === "PERCENT" ? "%" : undefined,
    compact: Math.abs(value) >= 100_000,
  });
}

function displayOption<T>(widget: CrmDashboardWidget, key: string): T | undefined {
  return widget.displaySpec.options?.[key] as T | undefined;
}

function isComparisonSeries(series: DashboardWidgetSeriesData) {
  return /previous|comparison|prior/i.test(`${series.key} ${series.label}`);
}

export function buildEchartsOption(
  widget: CrmDashboardWidget,
  result: DashboardWidgetResult,
): EChartsOption | undefined {
  if (!result.series || result.series.length === 0) return undefined;

  const context: DashboardEChartsBuildContext = {
    widget,
    series: result.series,
    palette: [
      "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", 
      "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1"
    ],
    selectionFor: () => undefined,
  };

  switch (widget.visualizationType) {
    case "LINE":
    case "AREA":
    case "LINE_AREA":
    case "COLUMN":
    case "BAR":
    case "STACKED_BAR":
    case "STACKED_BAR_100":
    case "COMBO":
      return buildCartesianOption(context, widget.visualizationType);
    case "PIE":
      return buildPieOption(context, true);
    case "DONUT":
      return buildPieOption(context, false);
    case "SCATTER":
      return buildScatterOption(context, false);
    case "BUBBLE":
      return buildScatterOption(context, true);
    case "FUNNEL":
      return buildFunnelOption(context);
    case "HEATMAP":
      return buildHeatmapOption(context);
    case "SEMI_CIRCLE_GAUGE":
    case "THREE_QUARTER_GAUGE":
    case "CIRCULAR_PROGRESS_GAUGE":
    case "DETAILED_SPEEDOMETER": {
      const val = result.value ?? 0;
      const target = result.target;
      const min = 0;
      const max = target ? target * 1.5 : (val > 0 ? val * 1.5 : 100);
      const formatted = formatDashboardValue(val, { 
        compact: true, 
        currency: result.meta?.currency,
        suffix: result.meta?.unit === "PERCENT" ? "%" : undefined 
      });
      return buildGaugeOption(val, min, max, formatted, target, context.palette[0], widget.visualizationType);
    }
    default:
      return undefined;
  }
}


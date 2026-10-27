"use client";

import {
  Activity,
  AlertTriangle,
  Bell,
  Calendar,
  CheckSquare,
  FileText,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Scatter,
  ScatterChart as RechartsScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import {
  AreaChart,
  Badge,
  BarChart,
  Button,
  DateTime,
  DonutChart,
  LineChart,
  Money,
  Progress,
  swatchSurfacePalette,
  topNWithOther,
  type CartesianSeries,
  type SwatchHue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { CrmVisualization } from "../../widget-contract";
import type { WidgetResult, WidgetSeries } from "../../dashboard-run-contract";
import {
  COLORFUL_SWATCH_FILLS,
  COLORFUL_SWATCH_HUES,
  formatMetricValue,
  primarySeries,
  seriesRole,
  type WidgetRenderMode,
} from "../../widget-view";

interface WidgetChartProps {
  mode: Exclude<WidgetRenderMode, "SCALAR" | "MULTI_KPI" | "TABLE">;
  visualizationType?: CrmVisualization;
  result: WidgetResult;
  label: string;
  onDrilldown?: (pointKey: string, pointLabel: string, seriesKey?: string | null) => void;
}

const CHART_HEIGHT = 220;

export function WidgetChart({
  mode,
  visualizationType,
  result,
  label,
  onDrilldown,
}: WidgetChartProps) {
  const { t, lang } = useI18n();
  const series = primarySeries(result);

  const summary = formatTemplate(t.crmDashboards.chartSummary, {
    series: series.length,
    points: series[0]?.points.length ?? 0,
  });

  if (mode === "GAUGE") {
    return (
      <GaugeChartView
        visualizationType={visualizationType}
        result={result}
        label={label}
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
      />
    );
  }

  if (mode === "HEATMAP" && series[0]) {
    return (
      <HeatmapChartView
        allSeries={series}
        label={label}
        summary={summary}
        onDrilldown={onDrilldown}
      />
    );
  }

  if (mode === "HISTOGRAM") {
    return (
      <HistogramChartView
        result={result}
        label={label}
      />
    );
  }

  if (mode === "ALERT_LIST") {
    return <AlertListView result={result} label={label} />;
  }

  if (mode === "ACTIVITY_FEED") {
    return <ActivityFeedView result={result} label={label} />;
  }

  if (mode === "DONUT" && series[0]) {
    const baseSlices = topNWithOther(
      series[0].points.map((point) => ({
        key: point.key,
        label: point.label,
        value: point.value,
      })),
      t.crmDashboards.otherSlice,
    );
    const slices = baseSlices.map((slice, index) => ({
      ...slice,
      fill: slice.isOther
        ? "var(--swatch-slate)"
        : COLORFUL_SWATCH_FILLS[index % COLORFUL_SWATCH_FILLS.length],
    }));
    const total = series[0].points.reduce((sum, point) => sum + point.value, 0);
    const formattedTotal = formatMetricValue(
      total,
      series[0].unit,
      series[0].currency ?? result.currency,
      lang,
    );
    return (
      <DonutChart
        slices={slices}
        label={label}
        summary={summary}
        centerValue={formattedTotal}
        centerLabel={t.crmDashboards.totalLabel}
        height={CHART_HEIGHT}
        numberFormat={{ notation: "compact" }}
      />
    );
  }

  const order: string[] = [];
  const rows = new Map<string, Record<string, string | number>>();
  for (const entry of series) {
    for (const point of entry.points) {
      const existing = rows.get(point.key);
      if (existing) {
        existing[entry.key] = point.value;
        continue;
      }
      order.push(point.key);
      rows.set(point.key, { label: point.label, [entry.key]: point.value });
    }
  }

  const dataRows = order.map((key) => {
    const row = { ...(rows.get(key) as Record<string, string | number>) };
    if (visualizationType === "STACKED_BAR_100") {
      const rowTotal = series.reduce(
        (sum, entry) => sum + Number(row[entry.key] ?? 0),
        0,
      );
      if (rowTotal > 0) {
        for (const entry of series) {
          row[entry.key] = Number(((Number(row[entry.key] ?? 0) / rowTotal) * 100).toFixed(1));
        }
      }
    }
    return row;
  });

  const isStacked = mode === "STACKED_BAR";
  const chartSeries: CartesianSeries[] = series.map((entry, index) => {
    const role = seriesRole(entry.key);
    const fill =
      isStacked || (series.length > 1 && role === "brand")
        ? COLORFUL_SWATCH_FILLS[index % COLORFUL_SWATCH_FILLS.length]
        : role === "brand" && series.length === 1
          ? COLORFUL_SWATCH_FILLS[0]
          : undefined;
    return {
      key: entry.key,
      label: entry.label,
      role,
      fill,
    };
  });

  const props = {
    data: dataRows,
    xKey: "label",
    series: chartSeries,
    label,
    summary,
    height: CHART_HEIGHT,
    stacked: isStacked,
    showLegend: series.length > 1,
    numberFormat: { notation: "compact" as const },
  };

  if (mode === "LINE") return <LineChart {...props} />;
  if (mode === "AREA") return <AreaChart {...props} />;
  return <BarChart {...props} />;
}

function GaugeChartView({
  visualizationType,
  result,
  label,
}: {
  visualizationType?: CrmVisualization;
  result: WidgetResult;
  label: string;
}) {
  const { t, lang } = useI18n();
  const value = result.value ?? 0;
  const target = result.target !== null && result.target > 0 ? result.target : 100;
  const maxScale = Math.max(target, value, 100);
  const ratio = Math.max(0, Math.min(1, value / maxScale));
  const targetProgress = Math.max(0, Math.min(100, Math.round((value / target) * 100)));

  const formattedValue = formatMetricValue(value, result.unit, result.currency, lang);
  const formattedTarget = formatMetricValue(target, result.unit, result.currency, lang);

  const gaugeStroke =
    value >= target
      ? "var(--swatch-green)"
      : value >= target * 0.7
        ? "var(--swatch-teal)"
        : value >= target * 0.4
          ? "var(--swatch-blue)"
          : "var(--swatch-amber)";

  const badgeTone =
    value >= target ? "positive" : value >= target * 0.7 ? "brand" : "caution";

  const deltaFromTarget = Number((value - target).toFixed(1));
  const deltaBadgeText =
    result.unit === "PERCENT" && deltaFromTarget >= 0
      ? formatTemplate(t.crmDashboards.aboveTarget, {
          value: formatNumber(deltaFromTarget, lang, {
            style: "unit", unit: "percent", maximumFractionDigits: 1,
          }),
        })
      : formatNumber(targetProgress, lang, {
          style: "unit",
          unit: "percent",
          maximumFractionDigits: 0,
        });

  if (visualizationType === "PROGRESS_CARD" || visualizationType === "BULLET") {
    return (
      <figure role="img" aria-label={label} className="space-y-3 py-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-2xl font-semibold tabular-nums text-foreground">
            {formattedValue}
          </p>
          <Badge tone={badgeTone}>{deltaBadgeText}</Badge>
        </div>
        <Progress
          value={value}
          max={target}
          label={t.crmDashboards.targetProgress}
          valueText={formatTemplate(t.crmDashboards.targetOf, { target: formattedTarget })}
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
          <span>{t.crmDashboards.targetProgress}</span>
          <span>{formatTemplate(t.crmDashboards.targetOf, { target: formattedTarget })}</span>
        </div>
      </figure>
    );
  }

  if (
    visualizationType === "CIRCULAR_PROGRESS_GAUGE" ||
    visualizationType === "THREE_QUARTER_GAUGE"
  ) {
    const radius = 56;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference * (1 - ratio);

    return (
      <figure
        role="img"
        aria-label={label}
        className="flex flex-col items-center justify-center gap-2 py-1"
      >
        <div className="relative flex h-40 w-40 items-center justify-center">
          <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="var(--border)"
              strokeWidth="12"
            />
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="var(--swatch-indigo)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-xl font-semibold tabular-nums text-foreground">
              {formattedValue}
            </span>
            <span className="text-2xs text-muted-foreground tabular-nums">
              {formatTemplate(t.crmDashboards.targetOf, { target: formattedTarget })}
            </span>
          </div>
        </div>
        <Badge tone={badgeTone}>{deltaBadgeText}</Badge>
      </figure>
    );
  }

  const arcLength = Math.PI * 76;
  const arcOffset = arcLength * (1 - ratio);

  return (
    <figure
      role="img"
      aria-label={label}
      className="flex flex-col items-center justify-center gap-1 py-1"
    >
      <div className="relative flex h-36 w-52 items-end justify-center">
        <svg viewBox="0 0 200 115" className="h-full w-full" aria-hidden="true">
          <path
            d="M 24 100 A 76 76 0 0 1 176 100"
            fill="none"
            stroke="var(--border)"
            strokeWidth="14"
            strokeLinecap="round"
          />
          <path
            d="M 24 100 A 76 76 0 0 1 176 100"
            fill="none"
            stroke={gaugeStroke}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={arcLength}
            strokeDashoffset={arcOffset}
          />
        </svg>
        <div className="absolute inset-x-0 bottom-2 flex flex-col items-center text-center">
          <span className="text-xl font-semibold tabular-nums text-foreground">
            {formattedValue}
          </span>
          <span className="text-2xs text-muted-foreground tabular-nums">
            {formatTemplate(t.crmDashboards.targetOf, { target: formattedTarget })}
          </span>
        </div>
      </div>
      <Badge tone={badgeTone}>{deltaBadgeText}</Badge>
    </figure>
  );
}

function FunnelChartView({
  series,
  currency,
  label,
  summary,
  onDrilldown,
}: {
  series: ReturnType<typeof primarySeries>[number];
  currency: string | null;
  label: string;
  summary: string;
  onDrilldown?: (pointKey: string, pointLabel: string, seriesKey?: string | null) => void;
}) {
  const { lang } = useI18n();
  const points = series.points;
  const maxVal = Math.max(...points.map((point) => point.value), 1);
  const firstVal = points[0]?.value && points[0].value > 0 ? points[0].value : maxVal;

  return (
    <figure role="img" aria-label={label} className="space-y-2.5 py-1.5">
      <span className="sr-only">{summary}</span>
      {points.map((point, index) => {
        const widthPct = Math.max(32, Math.round((point.value / maxVal) * 100));
        const sharePct = Math.round((point.value / firstVal) * 100);
        const hue = COLORFUL_SWATCH_HUES[index % COLORFUL_SWATCH_HUES.length];
        const palette = swatchSurfacePalette(hue);
        const formatted = formatMetricValue(
          point.value,
          series.unit,
          series.currency ?? currency,
          lang,
        );

        return (
          <div key={point.key} className="flex items-center gap-2.5 text-xs">
            <div className="w-28 shrink-0 truncate">
              {onDrilldown ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => onDrilldown(point.key, point.label, series.key)}
                  className="h-auto max-w-full truncate px-1 py-0.5 font-medium text-foreground"
                >
                  {point.label}
                </Button>
              ) : (
                <span className="font-medium text-foreground">{point.label}</span>
              )}
            </div>

            <div className="flex flex-1 items-center justify-center rounded-sm bg-muted/45 py-0.5">
              <div
                className={`flex h-7 items-center justify-center rounded-xs px-2 text-xs font-semibold tabular-nums ${palette.iconBoxActive}`}
                style={{
                  width: `${widthPct}%`,
                  clipPath: "polygon(0 0, 100% 0, 94% 100%, 6% 100%)",
                }}
              >
                {formatted}
              </div>
            </div>

            <div className="w-12 shrink-0 text-end tabular-nums">
              <span
                className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-2xs font-semibold ${palette.badge}`}
              >
                {formatNumber(sharePct, lang, {
                  style: "unit",
                  unit: "percent",
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>
          </div>
        );
      })}
    </figure>
  );
}

function ScatterBubbleChartView({
  visualizationType,
  series,
  currency,
  label,
  summary,
}: {
  visualizationType?: CrmVisualization;
  series: ReturnType<typeof primarySeries>[number];
  currency: string | null;
  label: string;
  summary: string;
}) {
  const { t, lang } = useI18n();
  const isBubble = visualizationType === "BUBBLE";
  const points = series.points.map((point, index) => ({
    key: point.key,
    label: point.label,
    x: point.secondaryValue ?? 0,
    y: point.value,
    z: Math.max(1, Math.abs(point.value)),
    fill: COLORFUL_SWATCH_FILLS[index % COLORFUL_SWATCH_FILLS.length],
  }));

  const topDeal = [...points].sort((a, b) => b.y - a.y)[0];

  return (
    <div className="space-y-2">
      {topDeal ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-2xs">
          <span className="text-muted-foreground">
            {`${t.crmDashboards.dealValue} × ${t.crmDashboards.winProbability}`}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-medium tabular-nums ${swatchSurfacePalette("purple").badge}`}
          >
            <span>{topDeal.label}</span>
            <span>•</span>
            <span>
              {formatMetricValue(topDeal.y, series.unit, series.currency ?? currency, lang)}
            </span>
            <span>{`(${Math.round(topDeal.x)}%)`}</span>
          </span>
        </div>
      ) : null}
      <figure role="img" aria-label={label} className="w-full" style={{ height: CHART_HEIGHT }}>
        <span className="sr-only">{summary}</span>
        <ResponsiveContainer width="100%" height="100%">
          <RechartsScatterChart margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="x"
              name={t.crmDashboards.winProbability}
              domain={[0, 100]}
              tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--chart-grid)" }}
              tickFormatter={(val: number) =>
                formatNumber(val, lang, { style: "unit", unit: "percent", maximumFractionDigits: 0 })
              }
            />
            <YAxis
              type="number"
              dataKey="y"
              name={t.crmDashboards.dealValue}
              tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val: number) =>
                formatNumber(val, lang, { notation: "compact", maximumFractionDigits: 1 })
              }
            />
            <ZAxis type="number" dataKey="z" range={isBubble ? [80, 420] : [64, 64]} />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const item = payload[0]?.payload as (typeof points)[number] | undefined;
                if (!item) return null;
                return (
                  <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-(--elevation-pop)">
                    <p className="mb-1 font-medium text-foreground">{item.label}</p>
                    <div className="flex items-center justify-between gap-4 tabular-nums">
                      <span className="text-muted-foreground">{t.crmDashboards.dealValue}</span>
                      <span className="font-semibold">
                        {formatMetricValue(
                          item.y,
                          series.unit,
                          series.currency ?? currency,
                          lang,
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4 tabular-nums">
                      <span className="text-muted-foreground">{t.crmDashboards.winProbability}</span>
                      <span className="font-semibold">
                        {formatNumber(item.x, lang, {
                          style: "unit",
                          unit: "percent",
                          maximumFractionDigits: 1,
                        })}
                      </span>
                    </div>
                  </div>
                );
              }}
            />
            <Scatter data={points} isAnimationActive={false}>
              {points.map((entry) => (
                <Cell
                  key={entry.key}
                  fill={entry.fill}
                  fillOpacity={0.82}
                  stroke={entry.fill}
                  strokeWidth={1.5}
                />
              ))}
            </Scatter>
          </RechartsScatterChart>
        </ResponsiveContainer>
      </figure>
    </div>
  );
}

const HEATMAP_DAY_ORDER = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function HeatmapChartView({
  allSeries,
  label,
  summary,
  onDrilldown,
}: {
  allSeries: readonly WidgetSeries[];
  label: string;
  summary: string;
  onDrilldown?: (pointKey: string, pointLabel: string, seriesKey?: string | null) => void;
}) {
  const { t, lang } = useI18n();

  const allValues = allSeries.flatMap((s) => s.points.map((p) => p.value));
  const maxVal = Math.max(...allValues, 1);

  const cellClasses = (val: number): string => {
    if (val <= 0) {
      return `border ${swatchSurfacePalette("slate").badge}`;
    }
    const ratio = val / maxVal;
    if (ratio >= 0.8) {
      return swatchSurfacePalette("purple").iconBoxActive;
    }
    if (ratio >= 0.55) {
      return swatchSurfacePalette("indigo").iconBoxActive;
    }
    if (ratio >= 0.3) {
      return swatchSurfacePalette("teal").iconBoxActive;
    }
    return `border ${swatchSurfacePalette("blue").badge}`;
  };

  if (allSeries.length > 1) {
    const presentDays = new Set<string>();
    const valueMatrix = new Map<string, number>();

    for (const s of allSeries) {
      for (const pt of s.points) {
        presentDays.add(pt.label);
        valueMatrix.set(`${pt.label}::${s.key}`, pt.value);
      }
    }

    const orderedDays = HEATMAP_DAY_ORDER.filter((day) => {
      if (!presentDays.has(day)) return false;
      if (day === "Fri" || day === "Sat") {
        const hasWeekendActivity = allSeries.some(
          (s) => (valueMatrix.get(`${day}::${s.key}`) ?? 0) > 0,
        );
        return hasWeekendActivity;
      }
      return true;
    });
    const daysToRender =
      orderedDays.length > 0 ? orderedDays : Array.from(presentDays).slice(0, 7);

    return (
      <figure role="img" aria-label={label} className="space-y-2.5 py-1">
        <span className="sr-only">{summary}</span>
        <div className="overflow-x-auto">
          <div className="min-w-72 space-y-1.5">
            <div
              className="grid items-center gap-1.5 text-center text-2xs font-medium text-muted-foreground tabular-nums"
              style={{
                gridTemplateColumns: `2.75rem repeat(${allSeries.length}, minmax(0, 1fr))`,
              }}
            >
              <span />
              {allSeries.map((col) => (
                <span key={col.key} className="truncate">
                  {col.label}
                </span>
              ))}
            </div>

            {daysToRender.map((day) => (
              <div
                key={day}
                className="grid items-center gap-1.5"
                style={{
                  gridTemplateColumns: `2.75rem repeat(${allSeries.length}, minmax(0, 1fr))`,
                }}
              >
                <span className="text-xs font-medium text-muted-foreground">
                  {t.crmDashboards.weekdays[day] ?? day}
                </span>
                {allSeries.map((col) => {
                  const val = valueMatrix.get(`${day}::${col.key}`) ?? 0;
                  return (
                    <div
                      key={`${day}-${col.key}`}
                      className={`flex h-8 items-center justify-center rounded-sm text-xs font-semibold tabular-nums transition-colors ${cellClasses(val)}`}
                      title={`${t.crmDashboards.weekdays[day] ?? day} ${col.label}: ${formatNumber(val, lang, { maximumFractionDigits: 0 })}`}
                    >
                      {formatNumber(val, lang, { maximumFractionDigits: 0 })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1 text-2xs text-muted-foreground">
          <span>{t.crmDashboards.lowIntensity}</span>
          <div className="flex items-center gap-1.5">
            {(["slate", "blue", "teal", "indigo", "purple"] as const).map((hue) => (
              <span
                key={hue}
                className={`inline-block h-2.5 w-5 rounded-xs ${swatchSurfacePalette(hue).dot}`}
              />
            ))}
          </div>
          <span>{t.crmDashboards.highIntensity}</span>
        </div>
      </figure>
    );
  }

  const series = allSeries[0];
  const points = series.points;

  return (
    <figure role="img" aria-label={label} className="space-y-3 py-1">
      <span className="sr-only">{summary}</span>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4">
        {points.slice(0, 16).map((point) => (
          <div
            key={point.key}
            className={`flex items-center justify-between gap-1.5 rounded-md px-2.5 py-1.5 text-xs ${cellClasses(point.value)}`}
          >
            {onDrilldown ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => onDrilldown(point.key, point.label, series.key)}
                className="h-auto p-0 font-medium text-current"
              >
                {point.label}
              </Button>
            ) : (
              <span className="font-medium">{point.label}</span>
            )}
            <span className="font-semibold tabular-nums">
              {formatNumber(point.value, lang, { maximumFractionDigits: 0 })}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-1.5 text-2xs text-muted-foreground">
        <span>{t.crmDashboards.lowIntensity}</span>
        {(["slate", "blue", "teal", "indigo", "purple"] as const).map((hue) => (
          <span
            key={hue}
            className={`inline-block h-2.5 w-4 rounded-xs ${swatchSurfacePalette(hue).dot}`}
          />
        ))}
        <span>{t.crmDashboards.highIntensity}</span>
      </div>
    </figure>
  );
}

function formatCompactBinRange(
  rawLabel: string,
  minValue: unknown,
  maxValue: unknown,
  currencyCode: string | null,
  lang: "ar" | "en",
): string {
  if (typeof minValue === "number" && typeof maxValue === "number" && maxValue >= 1000) {
    const low = formatNumber(minValue, lang, {
      notation: "compact",
      maximumFractionDigits: 0,
    });
    const high = formatNumber(maxValue, lang, {
      notation: "compact",
      maximumFractionDigits: 0,
    });
    return currencyCode ? `${low}–${high} ${currencyCode}` : `${low}–${high}`;
  }
  return rawLabel;
}

function HistogramChartView({
  result,
  label,
}: {
  result: WidgetResult;
  label: string;
}) {
  const { t, lang } = useI18n();
  const rawBins = Array.isArray(result.typedResult?.bins)
    ? (result.typedResult.bins as Array<Record<string, unknown>>)
    : [];
  const currencyCode =
    typeof result.typedResult?.currencyCode === "string"
      ? result.typedResult.currencyCode
      : result.currency;

  const data = rawBins.map((bin, index) => {
    const rawLabel = typeof bin.label === "string" ? bin.label : formatTemplate(
      t.crmDashboards.histogramBin,
      { index: formatNumber(index + 1, lang, { maximumFractionDigits: 0 }) },
    );
    const count = typeof bin.count === "number" ? bin.count : 0;
    return {
      label: formatCompactBinRange(
        rawLabel,
        bin.minValue,
        bin.maxValue,
        currencyCode,
        lang,
      ),
      rawLabel,
      count,
      fill: COLORFUL_SWATCH_FILLS[index % COLORFUL_SWATCH_FILLS.length],
    };
  });

  const totalCount =
    typeof result.typedResult?.totalCount === "number"
      ? result.typedResult.totalCount
      : data.reduce((sum, bin) => sum + bin.count, 0);

  const summary = formatTemplate(t.crmDashboards.chartSummary, {
    series: 1,
    points: data.length,
  });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-2xs">
        <span className="text-muted-foreground">{t.crmDashboards.dealValue}</span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-semibold tabular-nums ${swatchSurfacePalette("indigo").badge}`}
        >
          {`${formatNumber(totalCount, lang, { maximumFractionDigits: 0 })} ${t.crmDashboards.totalLabel}`}
        </span>
      </div>
      <figure role="img" aria-label={label} className="w-full" style={{ height: CHART_HEIGHT }}>
        <span className="sr-only">{summary}</span>
        <ResponsiveContainer width="100%" height="100%">
          <RechartsBarChart data={data} margin={{ top: 18, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--chart-axis)", fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: "var(--chart-grid)" }}
              interval={0}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={28}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.35 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const item = payload[0]?.payload as (typeof data)[number] | undefined;
                if (!item) return null;
                return (
                  <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-(--elevation-pop)">
                    <p className="mb-1 font-medium text-foreground">{item.label}</p>
                    <div className="flex items-center justify-between gap-4 tabular-nums">
                      <span className="text-muted-foreground">{t.crmDashboards.pointValue}</span>
                      <span className="font-semibold">
                        {formatNumber(item.count, lang, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                );
              }}
            />
            <Bar dataKey="count" radius={[6, 6, 0, 0]} isAnimationActive={false}>
              {data.map((entry) => (
                <Cell key={entry.rawLabel} fill={entry.fill} />
              ))}
              <LabelList
                dataKey="count"
                position="top"
                style={{ fill: "var(--foreground)", fontSize: 11, fontWeight: 600 }}
              />
            </Bar>
          </RechartsBarChart>
        </ResponsiveContainer>
      </figure>
    </div>
  );
}

function AlertListView({
  result,
  label,
}: {
  result: WidgetResult;
  label: string;
}) {
  const { t } = useI18n();
  const rawRows = Array.isArray(result.typedResult?.rows)
    ? (result.typedResult.rows as Array<Record<string, unknown>>)
    : result.rows;

  const isCriticalSeverity = (severity: unknown): boolean =>
    typeof severity === "string" && severity.toLowerCase() === "critical";

  const criticalCount = rawRows.filter((row) => isCriticalSeverity(row.severity)).length;
  const warningCount = rawRows.length - criticalCount;

  return (
    <div role="region" aria-label={label} className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {criticalCount > 0 && (
          <Badge tone="negative">
            {formatTemplate(t.crmDashboards.criticalAlerts, { count: criticalCount })}
          </Badge>
        )}
        {warningCount > 0 && (
          <Badge tone="caution">
            {formatTemplate(t.crmDashboards.warningAlerts, { count: warningCount })}
          </Badge>
        )}
      </div>

      <div className="max-h-64 space-y-2 overflow-y-auto pe-1">
        {rawRows.slice(0, 8).map((row, index) => {
          const isCritical = isCriticalSeverity(row.severity);
          const palette = swatchSurfacePalette(isCritical ? "red" : "amber");
          const title = typeof row.title === "string" ? row.title : "—";
          const reason =
            typeof row.reasonCode === "string"
              ? row.reasonCode
              : typeof row.reason === "string"
                ? row.reason
                : null;
          const entityRef =
            row.entityRef && typeof row.entityRef === "object"
              ? (row.entityRef as Record<string, unknown>)
              : null;
          const entityType =
            typeof entityRef?.type === "string"
              ? entityRef.type
              : typeof row.entityType === "string"
                ? row.entityType
                : null;
          const occurredAt = typeof row.occurredAt === "string" ? row.occurredAt : null;
          const amount = typeof row.amount === "number" ? row.amount : null;
          const currencyCode = typeof row.currencyCode === "string" ? row.currencyCode : null;

          return (
            <div
              key={typeof row.id === "string" ? row.id : `alert-${index}`}
              className={`flex items-start justify-between gap-3 rounded-md border border-border border-s-4 bg-card p-2.5 ${palette.accentBorder}`}
            >
              <div className="flex min-w-0 items-start gap-2.5">
                <span
                  className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm ${palette.iconBoxIdle}`}
                >
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={isCritical ? "negative" : "caution"}>
                      {isCritical ? t.crmDashboards.severityCritical : t.crmDashboards.severityWarning}
                    </Badge>
                    <p className="text-xs font-semibold text-foreground">{title}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-2xs text-muted-foreground">
                    {entityType && (
                      <span className={`inline-flex items-center rounded-xs border px-1.5 py-0.2 text-2xs font-medium ${palette.badge}`}>
                        {t.crmDashboardReports.statusValues[entityType] ?? t.crmDashboards.unknownEntityType}
                      </span>
                    )}
                    {reason && (
                      <span>
                        {t.crmDashboardReports.statusValues[reason] ?? t.crmDashboards.unknownAlertReason}
                      </span>
                    )}
                    {occurredAt && <DateTime value={occurredAt} />}
                  </div>
                </div>
              </div>
              {amount !== null && currencyCode && (
                <div className="shrink-0 text-xs font-semibold tabular-nums text-foreground">
                  <Money value={String(amount)} currency={currencyCode} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActivityFeedView({
  result,
  label,
}: {
  result: WidgetResult;
  label: string;
}) {
  const { t } = useI18n();
  const events = Array.isArray(result.typedResult?.events)
    ? (result.typedResult.events as Array<Record<string, unknown>>)
    : [];

  const eventVisual = (eventType: string): { hue: SwatchHue; Icon: typeof Activity } => {
    const normalized = eventType.toUpperCase();
    if (normalized.includes("CALL")) return { hue: "green", Icon: Phone };
    if (normalized.includes("MEETING") || normalized.includes("CALENDAR")) {
      return { hue: "blue", Icon: Calendar };
    }
    if (normalized.includes("EMAIL")) return { hue: "purple", Icon: Mail };
    if (normalized.includes("VISIT")) return { hue: "teal", Icon: MapPin };
    if (normalized.includes("TASK") || normalized.includes("FOLLOW_UP")) {
      return { hue: "amber", Icon: CheckSquare };
    }
    if (normalized.includes("REMINDER")) return { hue: "orange", Icon: Bell };
    if (normalized.includes("NOTE")) return { hue: "indigo", Icon: FileText };
    return { hue: "indigo", Icon: Activity };
  };

  return (
    <div role="region" aria-label={label} className="space-y-2.5">
      <div className="flex items-center justify-between gap-2 text-2xs">
        <span className="text-muted-foreground">{label}</span>
      </div>
      <div className="max-h-64 space-y-2 overflow-y-auto pe-1">
        {events.slice(0, 8).map((event, index) => {
          const eventType =
            typeof event.kind === "string"
              ? event.kind
              : typeof event.eventType === "string"
                ? event.eventType
                : "ACTIVITY";
          const title = typeof event.title === "string" ? event.title : "—";
          const actorName = typeof event.actorName === "string" ? event.actorName : null;
          const occurredAt = typeof event.occurredAt === "string" ? event.occurredAt : null;
          const { hue, Icon } = eventVisual(eventType);
          const palette = swatchSurfacePalette(hue);

          return (
            <div
              key={typeof event.id === "string" ? event.id : `event-${index}`}
              className="flex items-start justify-between gap-3 rounded-md border border-border bg-card p-2.5"
            >
              <div className="flex min-w-0 items-start gap-2.5">
                <span
                  className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${palette.iconBoxIdle}`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0 space-y-0.5">
                  <p className="text-xs font-semibold text-foreground">{title}</p>
                  <div className="flex flex-wrap items-center gap-1.5 text-2xs text-muted-foreground">
                    <span
                      className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-2xs font-medium ${palette.badge}`}
                    >
                      {t.crmDashboardReports.statusValues[eventType] ?? t.crmDashboards.unknownActivityType}
                    </span>
                    {actorName && <span>{`• ${actorName}`}</span>}
                  </div>
                </div>
              </div>
              {occurredAt && (
                <div className="shrink-0 text-2xs text-muted-foreground tabular-nums">
                  <DateTime value={occurredAt} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


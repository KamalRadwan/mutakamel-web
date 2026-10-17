"use client";

import { useId, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Briefcase,
  Filter,
  Layers,
  PieChart,
  Table2,
  Target,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  DegradedBanner,
  IdentifierText,
  Progress,
  StatCard,
  swatchSurfacePalette,
  type SwatchHue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { formatNumber } from "@/lib/format/number";
import type { WidgetResult } from "../../dashboard-run-contract";
import { displayWarnings } from "../../dashboard-run-contract";
import type { CrmVisualization, WidgetDefinition } from "../../widget-contract";
import {
  formatMetricValue,
  isInverseMetricKey,
  primarySeries,
  scalarDelta,
  widgetAccentHue,
  widgetRenderMode,
  widgetTableModel,
} from "../../widget-view";
import { WidgetChart } from "./WidgetChart";
import { WidgetDataTable } from "./WidgetDataTable";

interface WidgetTileProps {
  widget: WidgetDefinition;
  result: WidgetResult | undefined;
  onDrilldown: (widget: WidgetDefinition, pointKey: string, label: string) => void;
  onRemove?: (placementId: string) => void;
  placementId: string;
  isRemoving: boolean;
}

function WidgetHeaderIcon({
  visualizationType,
  metricKey,
}: {
  visualizationType: CrmVisualization;
  metricKey: string | null;
}) {
  const key = metricKey ?? "";
  if (visualizationType === "ALERT_LIST" || key.includes(".overdue") || key.includes(".stale")) {
    return <AlertTriangle className="size-4" aria-hidden="true" />;
  }
  if (visualizationType === "ACTIVITY_FEED" || key.includes("activities") || key.includes("calendar")) {
    return <Activity className="size-4" aria-hidden="true" />;
  }
  if (
    visualizationType === "SEMI_CIRCLE_GAUGE" ||
    visualizationType === "THREE_QUARTER_GAUGE" ||
    visualizationType === "CIRCULAR_PROGRESS_GAUGE" ||
    visualizationType === "DETAILED_SPEEDOMETER" ||
    visualizationType === "PROGRESS_CARD" ||
    visualizationType === "BULLET"
  ) {
    return <Target className="size-4" aria-hidden="true" />;
  }
  if (visualizationType === "FUNNEL") return <Filter className="size-4" aria-hidden="true" />;
  if (visualizationType === "DONUT" || visualizationType === "PIE") {
    return <PieChart className="size-4" aria-hidden="true" />;
  }
  if (visualizationType === "LINE" || visualizationType === "AREA" || visualizationType === "LINE_AREA") {
    return <TrendingUp className="size-4" aria-hidden="true" />;
  }
  if (visualizationType === "STACKED_BAR" || visualizationType === "STACKED_BAR_100") {
    return <Layers className="size-4" aria-hidden="true" />;
  }
  if (key.includes("leads") || key.includes("customer_profiles")) {
    return <Users className="size-4" aria-hidden="true" />;
  }
  if (key.includes("opportunities")) {
    return <Briefcase className="size-4" aria-hidden="true" />;
  }
  return <BarChart3 className="size-4" aria-hidden="true" />;
}

function ScalarSparkline({
  accentHue,
  currentValue,
  previousValue,
  inverse,
}: {
  accentHue: SwatchHue;
  currentValue: number;
  previousValue: number | null;
  inverse: boolean;
}) {
  const gradientId = useId();
  const strokeColor = `var(--swatch-${accentHue})`;
  const prev = previousValue ?? currentValue * 0.75;
  const isRising = currentValue >= prev;

  const linePath = inverse
    ? "M 0 34 C 35 30, 55 12, 95 28 C 135 40, 165 10, 200 24 C 220 32, 230 34, 240 36"
    : isRising
      ? "M 0 36 C 40 34, 70 26, 110 28 C 150 30, 175 14, 205 16 C 222 17, 232 8, 240 6"
      : "M 0 14 C 40 16, 75 22, 115 20 C 155 18, 185 28, 215 30 C 228 31, 235 34, 240 35";

  const areaPath = `${linePath} L 240 44 L 0 44 Z`;

  return (
    <svg
      viewBox="0 0 240 44"
      className="mt-auto h-11 w-full overflow-visible pt-1"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity={0.28} />
          <stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function WidgetTile({
  widget,
  result,
  onDrilldown,
  onRemove,
  placementId,
  isRemoving,
}: WidgetTileProps) {
  const { t, lang } = useI18n();
  const [isTableOpen, setIsTableOpen] = useState(false);

  const mode = result ? widgetRenderMode(widget.visualizationType, result) : "TABLE";
  const model = result
    ? widgetTableModel(result, {
        label: t.crmDashboards.pointLabel,
        value: t.crmDashboards.pointValue,
      })
    : { columns: [], rows: [] };
  const warnings = result ? displayWarnings(result.warnings) : [];

  const primaryMetricKey = widget.querySpec.series[0]?.metricKey ?? null;
  const accentHue = widgetAccentHue(widget.visualizationType, primaryMetricKey);
  const palette = swatchSurfacePalette(accentHue);

  const inverseDelta =
    Boolean((widget.displaySpec.options as Record<string, unknown> | undefined)?.inverseDelta) ||
    isInverseMetricKey(primaryMetricKey);
  const delta = result ? scalarDelta(result, inverseDelta) : null;

  const canDrilldown =
    result !== undefined &&
    result.errorCode === null &&
    result.typedResult === null &&
    widget.querySpec.series.length === 1;

  const showTableToggle =
    result !== undefined &&
    result.errorCode === null &&
    mode !== "TABLE" &&
    mode !== "SCALAR" &&
    mode !== "MULTI_KPI" &&
    mode !== "GAUGE" &&
    mode !== "ALERT_LIST" &&
    mode !== "ACTIVITY_FEED" &&
    model.rows.length > 0;

  return (
    <Card className="flex h-full flex-col overflow-hidden p-0">
      <div className={`h-1 w-full ${palette.dot}`} aria-hidden="true" />
      <div className="flex flex-1 flex-col gap-2.5 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full ${palette.iconBoxIdle}`}
            >
              <WidgetHeaderIcon
                visualizationType={widget.visualizationType}
                metricKey={primaryMetricKey}
              />
            </span>
            <h3 className="truncate text-sm font-semibold text-foreground">{widget.name}</h3>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {showTableToggle ? (
              <Button
                variant="ghost"
                size="sm"
                aria-label={
                  isTableOpen ? t.crmDashboards.hideDataTable : t.crmDashboards.showDataTable
                }
                aria-pressed={isTableOpen}
                onClick={() => setIsTableOpen((prev) => !prev)}
              >
                <Table2 className="size-3.5 text-muted-foreground" aria-hidden="true" />
              </Button>
            ) : null}
            {onRemove ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={isRemoving}
                aria-label={`${t.crmDashboards.removeWidget}: ${widget.name}`}
                onClick={() => onRemove(placementId)}
              >
                <Trash2 className="size-4 text-destructive" aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        </div>

        {result === undefined ? (
          <p className="text-xs text-muted-foreground">{t.crmDashboards.widgetNotExecuted}</p>
        ) : result.errorCode !== null ? (
          <div
            role="note"
            className="flex flex-col gap-1 rounded-sm border border-border bg-muted p-2.5"
          >
            <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <AlertTriangle className="size-4 shrink-0 text-destructive" aria-hidden="true" />
              {t.crmDashboards.widgetFailed}
            </p>
            <p className="text-2xs text-muted-foreground">
              {t.crmDashboards.widgetErrors[result.errorCode] ?? t.crmDashboards.widgetFailedGeneric}
            </p>
            <IdentifierText className="text-2xs text-muted-foreground">
              {result.errorCode}
            </IdentifierText>
          </div>
        ) : mode === "SCALAR" && result.value !== null ? (
          <div className="flex flex-1 flex-col justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <p className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
                {formatMetricValue(result.value, result.unit, result.currency, lang)}
              </p>
              {delta ? (
                <Badge tone={delta.tone} className="tabular-nums">
                  {`${delta.sign === "up" ? "+" : ""}${formatNumber(delta.deltaPercent, lang, {
                    style: "unit",
                    unit: "percent",
                    maximumFractionDigits: 1,
                  })} (${formatMetricValue(result.previousValue ?? 0, result.unit, result.currency, lang)})`}
                </Badge>
              ) : result.previousValue !== null ? (
                <span className="text-2xs text-muted-foreground tabular-nums">
                  {formatTemplate(t.crmDashboards.previousValue, {
                    value: formatMetricValue(result.previousValue, result.unit, result.currency, lang),
                  })}
                </span>
              ) : null}
            </div>
            {result.target !== null ? (
              <Progress
                value={result.value}
                max={result.target}
                label={t.crmDashboards.targetProgress}
                valueText={formatTemplate(t.crmDashboards.targetOf, {
                  target: formatNumber(result.target, lang, { maximumFractionDigits: 2 }),
                })}
              />
            ) : (
              <ScalarSparkline
                accentHue={accentHue}
                currentValue={result.value}
                previousValue={result.previousValue}
                inverse={inverseDelta}
              />
            )}
          </div>
        ) : mode === "MULTI_KPI" ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {primarySeries(result).map((seriesEntry) => {
              const pointVal = seriesEntry.points[0]?.value ?? 0;
              return (
                <StatCard
                  key={seriesEntry.key}
                  label={seriesEntry.label}
                  value={formatMetricValue(
                    pointVal,
                    seriesEntry.unit,
                    seriesEntry.currency ?? result.currency,
                    lang,
                  )}
                />
              );
            })}
          </div>
        ) : mode === "TABLE" || mode === "SCALAR" ? (
          <WidgetDataTable
            model={model}
            caption={widget.name}
            onDrilldown={
              canDrilldown
                ? (pointKey, label) => onDrilldown(widget, pointKey, label)
                : undefined
            }
            drilldownLabel={t.crmDashboards.drilldown}
          />
        ) : (
          <WidgetChart
            mode={mode}
            visualizationType={widget.visualizationType}
            result={result}
            label={widget.name}
            onDrilldown={
              canDrilldown
                ? (pointKey, pointLabel) => onDrilldown(widget, pointKey, pointLabel)
                : undefined
            }
          />
        )}

        {warnings.length > 0 ? (
          <DegradedBanner
            message={warnings
              .map((warning) => t.crmDashboards.widgetWarnings[warning] ?? warning)
              .join(" · ")}
          />
        ) : null}

        {showTableToggle ? (
          <div className={isTableOpen ? "mt-2 border-t border-border pt-2" : "sr-only"}>
            <WidgetDataTable
              model={model}
              caption={widget.name}
              onDrilldown={
                canDrilldown
                  ? (pointKey, label) => onDrilldown(widget, pointKey, label)
                  : undefined
              }
              drilldownLabel={t.crmDashboards.drilldown}
            />
          </div>
        ) : null}
      </div>
    </Card>
  );
}

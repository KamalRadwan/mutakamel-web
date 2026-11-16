"use client";
import { Badge, ScatterPlotChart, swatchSurfacePalette } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import type { CrmVisualization, WidgetQuerySpec } from "../../widget-contract";
import { primarySeries } from "../../widget-view";
import { formatWidgetValue, widgetSeriesColor } from "../../widget-presentation";

export function ScatterBubbleChartView({
  visualizationType,
  series,
  currency,
  label,
  summary,
  displaySpec = {},
  querySpec,
}: {
  visualizationType?: CrmVisualization;
  series: ReturnType<typeof primarySeries>[number];
  currency: string | null;
  label: string;
  summary: string;
  displaySpec?: Record<string, unknown>;
  querySpec?: WidgetQuerySpec;
}) {
  const { t, lang } = useI18n();
  const isBubble = visualizationType === "BUBBLE";
  const points = series.points.flatMap((point) => point.value === null || point.secondaryValue === null || (isBubble && point.size == null) ? [] : [{
    key: point.key,
    label: point.label,
    x: point.value,
    y: point.secondaryValue,
    z: point.size ?? 0,
    fill: widgetSeriesColor(series.key, querySpec, displaySpec) ?? "var(--primary)",
  }]);

  const topDeal = [...points].sort((a, b) => b.y - a.y)[0];

  return (
    <div className="space-y-2">
      {topDeal ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-2xs">
          <span className="text-muted-foreground">
            {`${t.crmDashboards.dealValue} × ${t.crmDashboards.winProbability}`}
          </span>
          <Badge
            className={`border tabular-nums normal-case tracking-normal ${swatchSurfacePalette("purple").badge}`}
          >
            <span>{topDeal.label}</span>
            <span>•</span>
            <span>
              {formatWidgetValue(topDeal.y, series.unit, series.currency ?? currency, lang, displaySpec)}
            </span>
            <span>{`(${Math.round(topDeal.x)}%)`}</span>
          </Badge>
        </div>
      ) : null}
      <ScatterPlotChart points={points} bubble={isBubble} label={label} summary={summary} xDomain={[0, 100]} sizeDomain={[0, 365]}
        xLabel={t.crmDashboards.winProbability} yLabel={t.crmDashboards.dealValue} sizeLabel={t.crmDashboards.dealAgeDays}
        formatX={(value) => formatNumber(value, lang, { style: "unit", unit: "percent", maximumFractionDigits: 1 })}
        formatY={(value) => formatWidgetValue(value, series.unit, series.currency ?? currency, lang, displaySpec)}
        formatYAxis={(value) => formatWidgetValue(value, series.unit, series.currency ?? currency, lang, { ...displaySpec, numberFormat: "compact" })}
        formatSize={(value) => formatNumber(value, lang, { style: "unit", unit: "day", maximumFractionDigits: 0 })} />
      {isBubble && <p className="text-2xs text-muted-foreground">{t.crmDashboards.bubbleSizeCaption}</p>}
      <p className="text-2xs text-muted-foreground">{t.crmDashboards.xyPopulationCaption}</p>
    </div>
  );
}

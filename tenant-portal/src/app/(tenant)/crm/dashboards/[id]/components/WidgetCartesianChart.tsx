"use client";
import { AreaChart, BarChart, ComposedChart, LineChart } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { WidgetResult } from "../../dashboard-run-contract";
import type { CrmVisualization, WidgetQuerySpec } from "../../widget-contract";
import { buildWidgetCartesianModel } from "../../widget-cartesian-model";
import { formatWidgetValue, widgetOption } from "../../widget-presentation";
import { WidgetLegend } from "./WidgetLegend";
import { LEAD_SOURCE_GROWTH_METRIC } from "../../widget-source-growth";

interface Props {
  result: WidgetResult;
  visualizationType?: CrmVisualization;
  label: string;
  summary: string;
  displaySpec: Record<string, unknown>;
  querySpec?: WidgetQuerySpec;
  onDrilldown?: (pointKey: string, label: string, seriesKey?: string | null) => void;
}

export function WidgetCartesianChart(props: Props) {
  const { t, lang } = useI18n();
  const currencies = new Set(props.result.series.filter((entry) => entry.unit === "MONEY").map((entry) => entry.currency ?? props.result.currency));
  const groups = new Map<string, WidgetResult["series"]>();
  for (const entry of props.result.series) {
    const key = currencies.size > 1 ? entry.unit === "MONEY" ? entry.currency ?? "__unknown__" : "__other__" : "__all__";
    groups.set(key, [...groups.get(key) ?? [], entry]);
  }
  return <div className="space-y-3">
    {currencies.size > 1 && <p role="note" className="text-xs text-muted-foreground">{t.crmDashboards.currencyFacetNotice}</p>}
    {[...groups].map(([key, series]) => {
      const model = buildWidgetCartesianModel({ ...props.result, series }, props.visualizationType,
        { previous: t.crmDashboards.pointPreviousValue, value: t.crmDashboards.pointValue, units: t.crmDashboards.metricUnits },
        props.displaySpec, props.querySpec, (value, unit, currency) => formatWidgetValue(value, unit, currency, lang, props.displaySpec));
      const mixedGeometry = new Set(model.series.map((entry) => entry.kind)).size > 1;
      if (model.series.length > 12 || model.data.length * model.series.length > 1000) return <p key={key} role="note" className="text-xs text-muted-foreground">{t.crmDashboards.chartLimitNotice}</p>;
      const Chart = mixedGeometry || props.visualizationType === "COMBO" || props.visualizationType === "LINE_AREA" ? ComposedChart
        : props.visualizationType === "LINE" ? LineChart : props.visualizationType === "AREA" ? AreaChart : BarChart;
      return <section key={key} className="space-y-1">
        {currencies.size > 1 && <h4 className="text-xs font-medium">{key === "__unknown__" ? t.common.unknownCode : key === "__other__" ? t.crmDashboards.nonMoneySeries : key}</h4>}
        <WidgetLegend position={props.displaySpec.legendPosition ?? (model.series.length > 1 ? "bottom" : "none")} entries={model.series}>
          <Chart data={model.data} xKey="label" series={model.series} label={props.label} summary={props.summary}
            height={series[0]?.key === LEAD_SOURCE_GROWTH_METRIC ? Math.max(220, 48 + 28 * model.data.length) : 220}
            axisLabels={model.axisLabels} valueAxes={model.valueAxes} horizontal={props.visualizationType === "BAR"}
            stacked={props.visualizationType === "STACKED_BAR" || props.visualizationType === "STACKED_BAR_100"}
            showLegend={false} showPoints={widgetOption(props.displaySpec, "showPoints") || (props.querySpec?.comparison?.type === "DATASETS"
              && props.visualizationType === "LINE" && series.some((entry) => entry.points.filter(({ value }) => value !== null).length === 1))}
            showValues={widgetOption(props.displaySpec, "showValues")}
            valueFormatter={model.series[0]?.valueFormatter}
            onPointSelect={!model.hasComparisons && props.onDrilldown ? (index) => {
              const point = series[0]?.points.find((candidate) => candidate.key === model.pointKeys[index]);
              if (point) props.onDrilldown?.(point.key, point.label, series[0].key);
            } : undefined} />
        </WidgetLegend>
      </section>;
    })}
  </div>;
}

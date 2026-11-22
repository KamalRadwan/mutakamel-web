import type { EChartsOption, ScatterSeriesOption } from 'echarts';
import type { ChartContext, SeriesUnit, WidgetExecution } from '../chart.model';
import { formatValue } from '../chart-format';
import { baseOption, limitSeries, valueAxis } from '../chart-theme';
import {
  cartesianGrid,
  colorForSeries,
  emptyCartesianOption,
  formatTooltipHtml,
  legendOption,
  toPointDatum,
  type TooltipEntry,
} from './cartesian';

const SERIES_UNITS = new Set<SeriesUnit>(['COUNT', 'MONEY', 'PERCENT', 'RATIO', 'DURATION', 'SCORE']);

function readStringDetail(details: Record<string, unknown> | undefined, key: string): string | undefined {
  const val = details?.[key];
  return typeof val === 'string' && val.trim() ? val.trim() : undefined;
}

export function readUnitDetail(details: Record<string, unknown> | undefined, key: string, fallback: SeriesUnit): SeriesUnit {
  const val = details?.[key];
  return typeof val === 'string' && SERIES_UNITS.has(val as SeriesUnit)
    ? (val as SeriesUnit)
    : fallback;
}

export const scatterOption = (exec: WidgetExecution, ctx: ChartContext): EChartsOption => {
  const limited = limitSeries(exec.series, ctx);
  const xLabel = readStringDetail(exec.details, 'xLabel');
  const yLabel = readStringDetail(exec.details, 'yLabel');
  const xUnit = readUnitDetail(exec.details, 'xUnit', 'COUNT');
  const yUnit = limited[0]?.unit ?? 'COUNT';

  const seriesList: ScatterSeriesOption[] = [];
  let totalPoints = 0;

  limited.forEach((s, index) => {
    const color = colorForSeries(s, index, ctx);
    const points = s.points
      .filter(
        (p) =>
          p.value !== null &&
          Number.isFinite(p.value) &&
          p.secondaryValue !== undefined &&
          Number.isFinite(p.secondaryValue),
      )
      .map((p) => {
        totalPoints++;
        return toPointDatum({
          value: [p.value, p.secondaryValue as number],
          name: p.label || p.key,
          key: p.key,
          seriesKey: s.key,
        });
      });

    seriesList.push({
      type: 'scatter',
      name: s.label,
      symbolSize: 8,
      itemStyle: { color },
      data: points,
    });
  });

  if (seriesList.length === 0 || totalPoints === 0) {
    return emptyCartesianOption(ctx);
  }

  const showLegend = seriesList.length > 1;
  const baseTooltip = baseOption(ctx).tooltip;
  const baseTooltipObj = Array.isArray(baseTooltip) ? baseTooltip[0] : baseTooltip;

  return {
    ...baseOption(ctx),
    grid: cartesianGrid(showLegend, Boolean(xLabel || yLabel)),
    legend: legendOption(ctx, showLegend),
    tooltip: {
      ...baseTooltipObj,
      trigger: 'item',
      formatter: (params: unknown) => {
        if (!params || typeof params !== 'object') return '';
        const p = params as Record<string, unknown>;
        const seriesIdx = typeof p['seriesIndex'] === 'number' ? p['seriesIndex'] : 0;
        const srcSeries = limited[seriesIdx];
        const rawVal = p['value'];
        const coords = Array.isArray(rawVal) ? rawVal : [];
        const xVal = typeof coords[0] === 'number' ? coords[0] : null;
        const yVal = typeof coords[1] === 'number' ? coords[1] : null;
        const pointName = typeof p['name'] === 'string' && p['name'] ? p['name'] : srcSeries?.label ?? '';

        const entries: TooltipEntry[] = [
          {
            name: xLabel ?? ctx.t('table.x'),
            valueText: formatValue(xVal, xUnit, undefined, ctx.lang, ctx.t),
          },
          {
            name: yLabel ?? ctx.t('table.y'),
            valueText: formatValue(
              yVal,
              srcSeries?.unit ?? yUnit,
              srcSeries?.currency,
              ctx.lang,
              ctx.t,
            ),
          },
        ];

        return formatTooltipHtml(ctx, pointName, entries);
      },
    },
    xAxis: {
      ...valueAxis(ctx, xUnit, xLabel ? { name: xLabel } : undefined),
      position: 'bottom',
      inverse: ctx.dir === 'rtl',
    },
    yAxis: valueAxis(ctx, yUnit, yLabel ? { name: yLabel } : undefined),
    series: seriesList,
  };
};

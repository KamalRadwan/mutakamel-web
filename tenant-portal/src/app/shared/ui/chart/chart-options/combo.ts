import type {
  BarSeriesOption,
  EChartsOption,
  LineSeriesOption,
  SeriesOption,
} from 'echarts';
import type { ChartContext, SeriesUnit, WidgetExecution } from '../chart.model';
import { baseOption, limitSeries } from '../chart-theme';
import {
  attachMarkLineToFirstSeries,
  buildAxisTooltip,
  buildMarkLine,
  buildValueAxes,
  cartesianGrid,
  categoryLabels,
  categoryXAxis,
  colorForSeries,
  comparisonName,
  emptyCartesianOption,
  findAlignedPoint,
  hasComparison,
  legendOption,
  toPointDatum,
} from './cartesian';

function verticalBarRadius(val: number | null): number[] {
  return val !== null && val < 0 ? [0, 0, 4, 4] : [4, 4, 0, 0];
}

export const comboOption = (exec: WidgetExecution, ctx: ChartContext): EChartsOption => {
  const limited = limitSeries(exec.series, ctx);
  const basePoints = limited.find((s) => s.points.length > 0)?.points ?? [];
  if (limited.length === 0 || basePoints.length === 0) {
    return emptyCartesianOption(ctx);
  }

  const labels = categoryLabels(exec, limited, ctx);
  const hasExplicitRight = limited.some((s) => s.axis === 'RIGHT');
  const firstUnit = limited[0]?.unit;
  const hasMixedLeftUnits =
    !hasExplicitRight && limited.length > 1 && limited.slice(1).some((s) => s.unit !== firstUnit);

  const isLineSeries = (idx: number): boolean =>
    hasExplicitRight ? limited[idx]?.axis === 'RIGHT' : idx > 0;

  const barCount = limited.reduce(
    (count, s, idx) => count + (isLineSeries(idx) ? 0 : hasComparison(s) ? 2 : 1),
    0,
  );
  const barWidth = barCount === 1 ? '44%' : undefined;
  const compCount = limited.filter(hasComparison).length;

  const seriesList: (BarSeriesOption | LineSeriesOption)[] = [];
  const tooltipUnits: { unit: SeriesUnit; currency?: string }[] = [];

  limited.forEach((s, index) => {
    const color = colorForSeries(s, index, ctx);
    const asLine = isLineSeries(index);
    const yAxisIndex = hasExplicitRight
      ? s.axis === 'RIGHT'
        ? 1
        : 0
      : hasMixedLeftUnits && index > 0 && s.unit !== firstUnit
        ? 1
        : 0;

    if (asLine) {
      seriesList.push({
        type: 'line',
        name: s.label,
        yAxisIndex,
        symbol: 'circle',
        symbolSize: 5,
        connectNulls: false,
        itemStyle: { color },
        lineStyle: { color, width: 2 },
        data: basePoints.map((refPt, ptIdx) => {
          const pt = findAlignedPoint(s, ptIdx, refPt.key);
          return toPointDatum({
            value: pt?.value ?? null,
            key: pt?.key ?? refPt.key,
            seriesKey: s.key,
          });
        }),
      });
      tooltipUnits.push({ unit: s.unit, ...(s.currency ? { currency: s.currency } : {}) });

      if (hasComparison(s)) {
        seriesList.push({
          type: 'line',
          name: comparisonName(s, ctx, compCount > 1),
          yAxisIndex,
          symbol: 'circle',
          symbolSize: 5,
          connectNulls: false,
          itemStyle: { color },
          lineStyle: { color, width: 2, type: 'dashed' },
          data: basePoints.map((refPt, ptIdx) => {
            const pt = findAlignedPoint(s, ptIdx, refPt.key);
            return toPointDatum({
              value: pt?.previousValue ?? null,
              key: pt?.previousKey ?? pt?.key ?? refPt.key,
              seriesKey: s.key,
            });
          }),
        });
        tooltipUnits.push({ unit: s.unit, ...(s.currency ? { currency: s.currency } : {}) });
      }
    } else {
      seriesList.push({
        type: 'bar',
        name: s.label,
        yAxisIndex,
        ...(barWidth ? { barWidth } : { barMaxWidth: 28 }),
        itemStyle: { color },
        data: basePoints.map((refPt, ptIdx) => {
          const pt = findAlignedPoint(s, ptIdx, refPt.key);
          const val = pt?.value ?? null;
          return toPointDatum({
            value: val,
            key: pt?.key ?? refPt.key,
            seriesKey: s.key,
            itemStyle: { borderRadius: verticalBarRadius(val) },
          });
        }),
      });
      tooltipUnits.push({ unit: s.unit, ...(s.currency ? { currency: s.currency } : {}) });

      if (hasComparison(s)) {
        seriesList.push({
          type: 'bar',
          name: comparisonName(s, ctx, compCount > 1),
          yAxisIndex,
          ...(barWidth ? { barWidth } : { barMaxWidth: 28 }),
          itemStyle: {
            color: ctx.colors.brandSoft,
            borderColor: color,
            borderType: 'dashed',
            borderWidth: 1,
          },
          data: basePoints.map((refPt, ptIdx) => {
            const pt = findAlignedPoint(s, ptIdx, refPt.key);
            const val = pt?.previousValue ?? null;
            return toPointDatum({
              value: val,
              key: pt?.previousKey ?? pt?.key ?? refPt.key,
              seriesKey: s.key,
              itemStyle: { borderRadius: verticalBarRadius(val) },
            });
          }),
        });
        tooltipUnits.push({ unit: s.unit, ...(s.currency ? { currency: s.currency } : {}) });
      }
    }
  });

  attachMarkLineToFirstSeries(seriesList as SeriesOption[], buildMarkLine(exec, ctx));
  const showLegend = seriesList.length > 1;

  return {
    ...baseOption(ctx),
    grid: cartesianGrid(showLegend),
    legend: legendOption(ctx, showLegend),
    tooltip: buildAxisTooltip(ctx, (i) => tooltipUnits[i] ?? { unit: 'COUNT' }),
    xAxis: categoryXAxis(ctx, exec, labels, true),
    yAxis: buildValueAxes(limited, ctx, { forceDualAxis: hasMixedLeftUnits }),
    series: seriesList,
  };
};

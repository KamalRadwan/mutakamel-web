import type { EChartsOption, LineSeriesOption, SeriesOption } from 'echarts';
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

export const lineOption = (exec: WidgetExecution, ctx: ChartContext): EChartsOption => {
  const limited = limitSeries(exec.series, ctx);
  const basePoints = limited.find((s) => s.points.length > 0)?.points ?? [];
  if (limited.length === 0 || basePoints.length === 0) {
    return emptyCartesianOption(ctx);
  }

  const labels = categoryLabels(exec, limited, ctx);
  const compCount = limited.filter(hasComparison).length;
  const seriesList: LineSeriesOption[] = [];
  const tooltipUnits: { unit: SeriesUnit; currency?: string }[] = [];

  limited.forEach((s, index) => {
    const color = colorForSeries(s, index, ctx);
    const yAxisIndex = s.axis === 'RIGHT' ? 1 : 0;

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
  });

  attachMarkLineToFirstSeries(seriesList as SeriesOption[], buildMarkLine(exec, ctx));
  const showLegend = seriesList.length > 1;

  return {
    ...baseOption(ctx),
    grid: cartesianGrid(showLegend),
    legend: legendOption(ctx, showLegend),
    tooltip: buildAxisTooltip(ctx, (i) => tooltipUnits[i] ?? { unit: 'COUNT' }),
    xAxis: categoryXAxis(ctx, exec, labels, true),
    yAxis: buildValueAxes(limited, ctx),
    series: seriesList,
  };
};

import type { BarSeriesOption, EChartsOption, SeriesOption } from 'echarts';
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
  emptyCartesianOption,
  findAlignedPoint,
  legendOption,
  toPointDatum,
} from './cartesian';

export const stackedBarOption = (exec: WidgetExecution, ctx: ChartContext): EChartsOption => {
  const limited = limitSeries(exec.series, ctx);
  const basePoints = limited.find((s) => s.points.length > 0)?.points ?? [];
  if (limited.length === 0 || basePoints.length === 0) {
    return emptyCartesianOption(ctx);
  }

  const labels = categoryLabels(exec, limited, ctx);
  const seriesList: BarSeriesOption[] = [];
  const tooltipUnits: { unit: SeriesUnit; currency?: string }[] = [];

  limited.forEach((s, index) => {
    const color = colorForSeries(s, index, ctx);
    seriesList.push({
      type: 'bar',
      name: s.label,
      stack: 's',
      barWidth: '48%',
      itemStyle: { color },
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
  });

  attachMarkLineToFirstSeries(seriesList as SeriesOption[], buildMarkLine(exec, ctx));

  return {
    ...baseOption(ctx),
    grid: cartesianGrid(true),
    legend: legendOption(ctx, limited.length > 1),
    tooltip: buildAxisTooltip(ctx, (i) => tooltipUnits[i] ?? { unit: 'COUNT' }),
    xAxis: categoryXAxis(ctx, exec, labels, true),
    yAxis: buildValueAxes(limited, ctx),
    series: seriesList,
  };
};

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

export const columnOption = (exec: WidgetExecution, ctx: ChartContext): EChartsOption => {
  const limited = limitSeries(exec.series, ctx);
  const basePoints = limited.find((s) => s.points.length > 0)?.points ?? [];
  if (limited.length === 0 || basePoints.length === 0) {
    return emptyCartesianOption(ctx);
  }

  const labels = categoryLabels(exec, limited, ctx);
  const compCount = limited.filter(hasComparison).length;
  const totalSeriesCount = limited.length + compCount;
  const barWidth = totalSeriesCount === 1 ? '48%' : undefined;
  const seriesList: BarSeriesOption[] = [];
  const tooltipUnits: { unit: SeriesUnit; currency?: string }[] = [];

  limited.forEach((s, index) => {
    const color = colorForSeries(s, index, ctx);
    const yAxisIndex = s.axis === 'RIGHT' ? 1 : 0;

    seriesList.push({
      type: 'bar',
      name: s.label,
      yAxisIndex,
      ...(barWidth ? { barWidth } : { barMaxWidth: 32 }),
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
        ...(barWidth ? { barWidth } : { barMaxWidth: 32 }),
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

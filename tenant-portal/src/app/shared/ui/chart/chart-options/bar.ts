import type { BarSeriesOption, EChartsOption, SeriesOption } from 'echarts';
import type { ChartContext, SeriesUnit, WidgetExecution } from '../chart.model';
import { baseOption, categoryAxis, limitSeries, valueAxis } from '../chart-theme';
import {
  attachMarkLineToFirstSeries,
  buildAxisTooltip,
  buildMarkLine,
  cartesianGrid,
  categoryLabels,
  colorForSeries,
  comparisonName,
  emptyCartesianOption,
  findAlignedPoint,
  hasComparison,
  legendOption,
  toPointDatum,
} from './cartesian';

function horizontalBarRadius(val: number | null, isRtl: boolean): number[] {
  const growsLeft = isRtl ? val === null || val >= 0 : val !== null && val < 0;
  return growsLeft ? [4, 0, 0, 4] : [0, 4, 4, 0];
}

export const barOption = (exec: WidgetExecution, ctx: ChartContext): EChartsOption => {
  const limited = limitSeries(exec.series, ctx);
  const basePoints = limited.find((s) => s.points.length > 0)?.points ?? [];
  if (limited.length === 0 || basePoints.length === 0) {
    return emptyCartesianOption(ctx);
  }

  const isRtl = ctx.dir === 'rtl';
  const labels = categoryLabels(exec, limited, ctx);
  const compCount = limited.filter(hasComparison).length;
  const totalSeriesCount = limited.length + compCount;
  const barWidth = totalSeriesCount === 1 ? '48%' : undefined;
  const seriesList: BarSeriesOption[] = [];
  const tooltipUnits: { unit: SeriesUnit; currency?: string }[] = [];

  limited.forEach((s, index) => {
    const color = colorForSeries(s, index, ctx);

    seriesList.push({
      type: 'bar',
      name: s.label,
      ...(barWidth ? { barWidth } : { barMaxWidth: 28 }),
      itemStyle: { color },
      data: basePoints.map((refPt, ptIdx) => {
        const pt = findAlignedPoint(s, ptIdx, refPt.key);
        const val = pt?.value ?? null;
        return toPointDatum({
          value: val,
          key: pt?.key ?? refPt.key,
          seriesKey: s.key,
          itemStyle: { borderRadius: horizontalBarRadius(val, isRtl) },
        });
      }),
    });
    tooltipUnits.push({ unit: s.unit, ...(s.currency ? { currency: s.currency } : {}) });

    if (hasComparison(s)) {
      seriesList.push({
        type: 'bar',
        name: comparisonName(s, ctx, compCount > 1),
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
            itemStyle: { borderRadius: horizontalBarRadius(val, isRtl) },
          });
        }),
      });
      tooltipUnits.push({ unit: s.unit, ...(s.currency ? { currency: s.currency } : {}) });
    }
  });

  attachMarkLineToFirstSeries(
    seriesList as SeriesOption[],
    buildMarkLine(exec, ctx, { horizontal: true }),
  );
  const showLegend = seriesList.length > 1;
  const primaryUnit = limited[0]?.unit ?? 'COUNT';

  return {
    ...baseOption(ctx),
    grid: cartesianGrid(showLegend),
    legend: legendOption(ctx, showLegend),
    tooltip: buildAxisTooltip(ctx, (i) => tooltipUnits[i] ?? { unit: 'COUNT' }),
    xAxis: {
      ...valueAxis(ctx, primaryUnit),
      position: 'bottom',
      inverse: isRtl,
    },
    yAxis: {
      ...categoryAxis(ctx, labels, { horizontal: true }),
      inverse: true,
    },
    series: seriesList,
  };
};

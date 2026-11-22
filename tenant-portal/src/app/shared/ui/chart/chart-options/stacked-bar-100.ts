import type { BarSeriesOption, EChartsOption } from 'echarts';
import type { ChartContext, WidgetExecution } from '../chart.model';
import { DASH, formatPercent, formatValue } from '../chart-format';
import { baseOption, limitSeries, valueAxis } from '../chart-theme';
import {
  cartesianGrid,
  categoryLabels,
  categoryXAxis,
  colorForSeries,
  emptyCartesianOption,
  findAlignedPoint,
  formatTooltipHtml,
  legendOption,
  toPointDatum,
  type TooltipEntry,
} from './cartesian';

export const stackedBar100Option = (exec: WidgetExecution, ctx: ChartContext): EChartsOption => {
  const limited = limitSeries(exec.series, ctx);
  const basePoints = limited.find((s) => s.points.length > 0)?.points ?? [];
  if (limited.length === 0 || basePoints.length === 0) {
    return emptyCartesianOption(ctx);
  }

  const labels = categoryLabels(exec, limited, ctx);
  const categoryTotals = basePoints.map((refPt, ptIdx) => {
    let total = 0;
    for (const s of limited) {
      const pt = findAlignedPoint(s, ptIdx, refPt.key);
      if (pt && pt.value !== null && Number.isFinite(pt.value)) {
        total += Math.abs(pt.value);
      }
    }
    return total;
  });

  const rawValues: (number | null)[][] = [];
  const pctValues: (number | null)[][] = [];

  const seriesList: BarSeriesOption[] = limited.map((s, seriesIdx) => {
    const color = colorForSeries(s, seriesIdx, ctx);
    const sRaw: (number | null)[] = [];
    const sPct: (number | null)[] = [];

    const data = basePoints.map((refPt, ptIdx) => {
      const pt = findAlignedPoint(s, ptIdx, refPt.key);
      const raw = pt?.value != null && Number.isFinite(pt.value) ? pt.value : null;
      const total = categoryTotals[ptIdx] ?? 0;
      const pct = raw === null ? null : total === 0 ? 0 : (Math.abs(raw) / total) * 100;
      sRaw.push(raw);
      sPct.push(pct);

      return toPointDatum({
        value: pct,
        key: pt?.key ?? refPt.key,
        seriesKey: s.key,
      });
    });

    rawValues.push(sRaw);
    pctValues.push(sPct);

    return {
      type: 'bar',
      name: s.label,
      stack: 'p',
      barWidth: '48%',
      itemStyle: { color },
      data,
    };
  });

  const baseTooltip = baseOption(ctx).tooltip;
  const baseTooltipObj = Array.isArray(baseTooltip) ? baseTooltip[0] : baseTooltip;

  return {
    ...baseOption(ctx),
    grid: cartesianGrid(true),
    legend: legendOption(ctx, limited.length > 1),
    tooltip: {
      ...baseTooltipObj,
      trigger: 'axis',
      formatter: (params: unknown) => {
        const items = Array.isArray(params) ? params : [params];
        if (items.length === 0) return '';

        let header = '';
        const entries: TooltipEntry[] = [];

        for (const rawItem of items) {
          if (!rawItem || typeof rawItem !== 'object') continue;
          const p = rawItem as Record<string, unknown>;
          if (!header && typeof p['axisValueLabel'] === 'string') {
            header = p['axisValueLabel'];
          }
          const seriesIdx = typeof p['seriesIndex'] === 'number' ? p['seriesIndex'] : 0;
          const dataIdx = typeof p['dataIndex'] === 'number' ? p['dataIndex'] : 0;
          const name = typeof p['seriesName'] === 'string' ? p['seriesName'] : '';
          const marker = typeof p['marker'] === 'string' ? p['marker'] : '';

          const srcSeries = limited[seriesIdx];
          const pct = pctValues[seriesIdx]?.[dataIdx] ?? null;
          const raw = rawValues[seriesIdx]?.[dataIdx] ?? null;

          const valueText =
            pct === null || raw === null || !srcSeries
              ? DASH
              : `${formatPercent(pct, 1)} (${formatValue(raw, srcSeries.unit, srcSeries.currency, ctx.lang, ctx.t)})`;

          entries.push({ marker, name, valueText });
        }

        return formatTooltipHtml(ctx, header, entries);
      },
    },
    xAxis: categoryXAxis(ctx, exec, labels, true),
    yAxis: valueAxis(ctx, 'PERCENT', { percentMax: true }),
    series: seriesList,
  };
};

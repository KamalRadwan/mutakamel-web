import type { BoxplotSeriesOption, EChartsOption } from 'echarts';
import type { ChartContext, WidgetExecution } from '../chart.model';
import { DASH, formatDuration, formatNumber } from '../chart-format';
import { baseOption, categoryAxis, seriesColor, valueAxis } from '../chart-theme';
import {
  cartesianGrid,
  emptyCartesianOption,
  formatTooltipHtml,
  legendOption,
  type TooltipEntry,
} from './cartesian';

export const boxPlotOption = (exec: WidgetExecution, ctx: ChartContext): EChartsOption => {
  if (exec.result?.shape !== 'DURATION_DISTRIBUTION' || exec.result.groups.length === 0) {
    return emptyCartesianOption(ctx);
  }

  const groups = exec.result.groups;
  const borderColor = seriesColor(ctx, 0);
  const seriesKey = exec.series[0]?.key ?? 'boxplot';
  const baseTooltip = baseOption(ctx).tooltip;
  const baseTooltipObj = Array.isArray(baseTooltip) ? baseTooltip[0] : baseTooltip;

  const data: NonNullable<BoxplotSeriesOption['data']> = groups.map((g) => {
    const hasAll =
      g.min !== null && g.q1 !== null && g.median !== null && g.q3 !== null && g.max !== null;
    const item = {
      value: hasAll
        ? ([g.min, g.q1, g.median, g.q3, g.max] as number[])
        : (['-', '-', '-', '-', '-'] as ('-' | number)[]),
      name: g.label,
      key: g.key,
      seriesKey,
    };
    return item;
  });

  const series: BoxplotSeriesOption = {
    type: 'boxplot',
    name: exec.series[0]?.label || ctx.t('table.duration'),
    itemStyle: {
      color: ctx.colors.brandSoft,
      borderColor,
      borderWidth: 1.5,
    },
    data,
  };

  return {
    ...baseOption(ctx),
    grid: cartesianGrid(false),
    legend: legendOption(ctx, false),
    tooltip: {
      ...baseTooltipObj,
      trigger: 'axis',
      formatter: (params: unknown) => {
        const items = Array.isArray(params) ? params : [params];
        const first = items[0] as Record<string, unknown> | undefined;
        if (!first || typeof first['dataIndex'] !== 'number') return '';

        const g = groups[first['dataIndex']];
        if (!g) return '';

        const hasAll =
          g.min !== null && g.q1 !== null && g.median !== null && g.q3 !== null && g.max !== null;

        const entries: TooltipEntry[] = hasAll
          ? [
              { name: ctx.t('max'), valueText: formatDuration(g.max, ctx.lang, ctx.t) },
              ...(g.p90 !== null
                ? [{ name: ctx.t('p90'), valueText: formatDuration(g.p90, ctx.lang, ctx.t) }]
                : []),
              { name: ctx.t('q3'), valueText: formatDuration(g.q3, ctx.lang, ctx.t) },
              { name: ctx.t('median'), valueText: formatDuration(g.median, ctx.lang, ctx.t) },
              { name: ctx.t('q1'), valueText: formatDuration(g.q1, ctx.lang, ctx.t) },
              { name: ctx.t('min'), valueText: formatDuration(g.min, ctx.lang, ctx.t) },
              { name: ctx.t('samples'), valueText: formatNumber(g.sampleCount, ctx.lang) },
            ]
          : [
              { name: ctx.t('median'), valueText: DASH },
              { name: ctx.t('samples'), valueText: formatNumber(g.sampleCount, ctx.lang) },
            ];

        return formatTooltipHtml(ctx, g.label, entries);
      },
    },
    xAxis: categoryAxis(
      ctx,
      groups.map((g) => g.label),
    ),
    yAxis: valueAxis(ctx, 'DURATION'),
    series: [series],
  };
};

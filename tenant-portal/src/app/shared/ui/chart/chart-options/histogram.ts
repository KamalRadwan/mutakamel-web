import type { BarSeriesOption, EChartsOption } from 'echarts';
import type { ChartContext, WidgetExecution } from '../chart.model';
import { formatNumber, formatPercent } from '../chart-format';
import { baseOption, categoryAxis, seriesColor, valueAxis } from '../chart-theme';
import {
  buildMarkLine,
  cartesianGrid,
  emptyCartesianOption,
  formatTooltipHtml,
  legendOption,
  toPointDatum,
  type TooltipEntry,
} from './cartesian';

const BIN_ORDER_RANK = {
  UNDERFLOW: 0,
  STANDARD: 1,
  OVERFLOW: 2,
} as const;

export const histogramOption = (exec: WidgetExecution, ctx: ChartContext): EChartsOption => {
  if (exec.result?.shape !== 'BINNED_DISTRIBUTION' || exec.result.bins.length === 0) {
    return emptyCartesianOption(ctx);
  }

  const dist = exec.result;
  const bins = [...dist.bins].sort(
    (a, b) => BIN_ORDER_RANK[a.kind] - BIN_ORDER_RANK[b.kind] || a.order - b.order,
  );

  const color = seriesColor(ctx, 0);
  const seriesKey = exec.series[0]?.key ?? 'histogram';
  const markLine = buildMarkLine(exec, ctx);
  const baseTooltip = baseOption(ctx).tooltip;
  const baseTooltipObj = Array.isArray(baseTooltip) ? baseTooltip[0] : baseTooltip;

  const series: BarSeriesOption = {
    type: 'bar',
    name: exec.series[0]?.label || ctx.t('count'),
    barCategoryGap: '2%',
    itemStyle: {
      color,
      borderRadius: [4, 4, 0, 0],
    },
    data: bins.map((bin) =>
      toPointDatum({
        value: bin.count,
        name: bin.label,
        key: bin.key,
        seriesKey,
      }),
    ),
    ...(markLine ? { markLine } : {}),
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

        const bin = bins[first['dataIndex']];
        if (!bin) return '';

        const countText = formatNumber(bin.count, ctx.lang);
        const valueText =
          dist.totalCount > 0
            ? `${countText} (${formatPercent((bin.count / dist.totalCount) * 100, 1)})`
            : countText;

        const entries: TooltipEntry[] = [
          {
            marker: typeof first['marker'] === 'string' ? first['marker'] : '',
            name: ctx.t('count'),
            valueText,
          },
        ];

        return formatTooltipHtml(ctx, bin.label, entries);
      },
    },
    xAxis: categoryAxis(
      ctx,
      bins.map((b) => b.label),
    ),
    yAxis: valueAxis(ctx, 'COUNT'),
    series: [series],
  };
};

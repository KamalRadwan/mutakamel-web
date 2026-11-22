import type { BarSeriesOption, EChartsOption } from 'echarts';
import type { ChartContext, SeriesUnit, WidgetExecution } from '../chart.model';
import { formatAxisNumber, formatValue } from '../chart-format';
import { baseOption, categoryAxis, seriesColor, valueAxis } from '../chart-theme';
import {
  buildMarkLine,
  emptyCartesianOption,
  formatTooltipHtml,
  legendOption,
  toPointDatum,
  type TooltipEntry,
} from './cartesian';

function formatWaterfallBarLabel(
  value: number,
  signed: boolean,
  unit: SeriesUnit,
  currency: string | undefined,
  ctx: ChartContext,
): string {
  const absVal = Math.abs(value);
  const body =
    unit === 'MONEY'
      ? formatAxisNumber(absVal)
      : formatValue(absVal, unit, currency, ctx.lang, ctx.t);
  if (value < 0) return `−${body}`;
  if (signed && value > 0) return `+${body}`;
  return body;
}

export const waterfallOption = (exec: WidgetExecution, ctx: ChartContext): EChartsOption => {
  if (exec.result?.shape !== 'WATERFALL' || exec.result.steps.length === 0) {
    return emptyCartesianOption(ctx);
  }

  const wf = exec.result;
  const steps = [...wf.steps].sort((a, b) => a.order - b.order);
  const unit = wf.unit;
  const currency = wf.currencyCode ?? exec.meta.currency;
  const deltaColor = seriesColor(ctx, 0);
  const totalColor = seriesColor(ctx, 1);
  const seriesKey = exec.series[0]?.key ?? 'waterfall';

  const baseData: number[] = [];
  const barData = steps.map((step) => {
    const isAnchor = step.kind === 'START' || step.kind === 'SUBTOTAL' || step.kind === 'TOTAL';
    let base: number;
    let magnitude: number;
    let isNegative = false;

    if (isAnchor) {
      base = step.cumulativeValue < 0 ? step.cumulativeValue : 0;
      magnitude = Math.abs(step.cumulativeValue);
      isNegative = step.cumulativeValue < 0;
    } else {
      const before = step.cumulativeValue - step.value;
      const after = step.cumulativeValue;
      base = Math.min(before, after);
      magnitude = Math.abs(step.value);
      isNegative = step.value < 0;
    }

    baseData.push(base);

    const displayNumber = isAnchor ? step.cumulativeValue : step.value;
    const labelText = formatWaterfallBarLabel(displayNumber, !isAnchor, unit, currency, ctx);

    return toPointDatum({
      value: magnitude,
      name: step.label,
      key: step.key,
      seriesKey,
      itemStyle: {
        color: isAnchor ? totalColor : deltaColor,
        borderRadius: isNegative ? [0, 0, 4, 4] : [4, 4, 0, 0],
      },
      label: {
        show: true,
        position: 'top',
        color: ctx.colors.text,
        fontSize: 11,
        fontFamily: ctx.colors.fontUi,
        formatter: () => labelText,
      },
    });
  });

  const markLine = buildMarkLine(exec, ctx);
  const baseTooltip = baseOption(ctx).tooltip;
  const baseTooltipObj = Array.isArray(baseTooltip) ? baseTooltip[0] : baseTooltip;

  const baseSeries: BarSeriesOption = {
    type: 'bar',
    stack: 'w',
    stackStrategy: 'all',
    silent: true,
    tooltip: { show: false },
    emphasis: { disabled: true },
    itemStyle: { color: 'transparent', borderColor: 'transparent' },
    data: baseData,
  };

  const valueSeries: BarSeriesOption = {
    type: 'bar',
    stack: 'w',
    stackStrategy: 'all',
    barWidth: '48%',
    name: exec.series[0]?.label || ctx.t('value'),
    data: barData,
    ...(markLine ? { markLine } : {}),
  };

  return {
    ...baseOption(ctx),
    grid: { left: 8, right: 8, top: 28, bottom: 4, containLabel: true },
    legend: legendOption(ctx, false),
    tooltip: {
      ...baseTooltipObj,
      trigger: 'axis',
      formatter: (params: unknown) => {
        const items = Array.isArray(params) ? params : [params];
        const first = items.find(
          (item) =>
            item &&
            typeof item === 'object' &&
            (item as Record<string, unknown>)['seriesIndex'] === 1,
        ) as Record<string, unknown> | undefined;
        const targetItem = first ?? (items[0] as Record<string, unknown> | undefined);
        if (!targetItem || typeof targetItem['dataIndex'] !== 'number') return '';

        const step = steps[targetItem['dataIndex']];
        if (!step) return '';

        const isAnchor =
          step.kind === 'START' || step.kind === 'SUBTOTAL' || step.kind === 'TOTAL';
        const kindLabel =
          step.kind === 'START'
            ? ctx.t('start')
            : step.kind === 'SUBTOTAL'
              ? ctx.t('subtotal')
              : step.kind === 'TOTAL'
                ? ctx.t('total')
                : step.value < 0
                  ? ctx.t('decrease')
                  : ctx.t('increase');

        const stepFormatted = formatValue(Math.abs(step.value), unit, currency, ctx.lang, ctx.t);
        const stepSigned = isAnchor
          ? formatValue(step.cumulativeValue, unit, currency, ctx.lang, ctx.t)
          : step.value > 0
            ? `+${stepFormatted}`
            : step.value < 0
              ? `−${stepFormatted}`
              : stepFormatted;

        const entries: TooltipEntry[] = [{ name: kindLabel, valueText: stepSigned }];
        if (!isAnchor) {
          entries.push({
            name: ctx.t('table.cumulative'),
            valueText: formatValue(step.cumulativeValue, unit, currency, ctx.lang, ctx.t),
          });
        }

        return formatTooltipHtml(ctx, step.label, entries);
      },
    },
    xAxis: categoryAxis(
      ctx,
      steps.map((s) => s.label),
    ),
    yAxis: valueAxis(ctx, unit),
    series: [baseSeries, valueSeries],
  };
};

import type { BarSeriesOption, EChartsOption } from 'echarts';
import type { BarDataItemOption } from './echarts-items';
import { DASH, formatAxisNumber, formatPercent } from '../chart-format';
import type { ChartContext, WidgetExecution } from '../chart.model';
import { baseOption, categoryAxis, valueAxis } from '../chart-theme';
import {
  type ChartBuilder,
  computeRatioPercent,
  escapeHtml,
  extractScalarTarget,
  formatMetricValue,
} from './gauge';

interface BulletPointItem extends BarDataItemOption {
  key: string;
  seriesKey?: string;
}

export const bulletOption: ChartBuilder = (
  exec: WidgetExecution,
  ctx: ChartContext,
): EChartsOption => {
  const base = baseOption(ctx);
  const baseTooltip = Array.isArray(base.tooltip) ? base.tooltip[0] : base.tooltip;
  const scalar = extractScalarTarget(exec);

  if (
    scalar.value === null &&
    (scalar.target === undefined || !Number.isFinite(scalar.target))
  ) {
    return {
      ...base,
      legend: { show: false },
      series: [],
    };
  }

  const hasTarget =
    scalar.target !== undefined && Number.isFinite(scalar.target) && scalar.target > 0;
  const numericVal =
    scalar.value !== null && Number.isFinite(scalar.value) ? Math.max(scalar.value, 0) : 0;
  const maxRef = Math.max(hasTarget && scalar.target !== undefined ? scalar.target : 0, numericVal);
  const trackMax = maxRef > 0 ? Math.ceil(maxRef * 1.15) : 100;

  const isRtl = ctx.dir === 'rtl';
  const xAxisBase = valueAxis(ctx, scalar.unit);
  const xAxis: EChartsOption['xAxis'] = {
    type: 'value',
    position: 'bottom',
    inverse: isRtl,
    max: trackMax,
    axisLine: xAxisBase.axisLine,
    axisTick: xAxisBase.axisTick,
    splitLine: xAxisBase.splitLine,
    axisLabel: {
      color: ctx.colors.textMuted,
      fontSize: 11,
      fontFamily: ctx.colors.fontUi,
      hideOverlap: true,
      formatter: (v: number) =>
        scalar.unit === 'PERCENT' ? `${formatAxisNumber(v)}%` : formatAxisNumber(v),
    },
  };

  const yAxisBase = categoryAxis(ctx, [scalar.label], { horizontal: true });
  const yAxis: EChartsOption['yAxis'] = {
    type: 'category',
    data: yAxisBase.data,
    inverse: yAxisBase.inverse,
    position: isRtl ? 'right' : 'left',
    axisLine: yAxisBase.axisLine,
    axisTick: yAxisBase.axisTick,
    axisLabel: {
      color: ctx.colors.textMuted,
      fontSize: 11,
      fontFamily: ctx.colors.fontUi,
      hideOverlap: true,
    },
    splitLine: yAxisBase.splitLine,
  };

  const valuePoint: BulletPointItem = {
    value: scalar.value,
    key: scalar.pointKey,
    seriesKey: scalar.seriesKey,
  };

  const valueSeries: BarSeriesOption = {
    type: 'bar',
    name: scalar.label,
    barWidth: 12,
    z: 2,
    data: [valuePoint],
    itemStyle: {
      color: ctx.colors.accent,
      borderRadius: isRtl ? [4, 0, 0, 4] : [0, 4, 4, 0],
    },
  };

  if (hasTarget && scalar.target !== undefined) {
    valueSeries.markLine = {
      silent: true,
      symbol: 'none',
      label: {
        show: true,
        formatter: ctx.t('target'),
        fontSize: 11,
        fontFamily: ctx.colors.fontUi,
        color: ctx.colors.text,
      },
      lineStyle: {
        color: ctx.colors.text,
        width: 2,
        type: 'solid',
      },
      data: [{ xAxis: scalar.target }],
    };
  }

  const trackSeries: BarSeriesOption = {
    type: 'bar',
    data: [trackMax],
    barWidth: 28,
    barGap: '-100%',
    silent: true,
    z: 1,
    tooltip: { show: false },
    itemStyle: {
      color: ctx.colors.neutralSoft,
      borderRadius: 4,
    },
  };

  const realRatio = computeRatioPercent(scalar.value, scalar.target);
  const actualStr = formatMetricValue(scalar.value, scalar.unit, scalar.currency, ctx);
  const targetStr =
    scalar.target !== undefined && Number.isFinite(scalar.target)
      ? formatMetricValue(scalar.target, scalar.unit, scalar.currency, ctx)
      : DASH;

  return {
    ...base,
    legend: { show: false },
    grid: {
      left: isRtl ? 12 : 4,
      right: isRtl ? 4 : 12,
      top: 30,
      bottom: 30,
      containLabel: true,
    },
    xAxis,
    yAxis,
    tooltip: {
      ...baseTooltip,
      trigger: 'item',
      formatter: () => {
        const lines: string[] = [];
        if (scalar.label) {
          lines.push(`<div>${escapeHtml(scalar.label)}</div>`);
        }
        const ratioPart =
          realRatio !== null ? ` (<bdi dir="ltr">${escapeHtml(formatPercent(realRatio))}</bdi>)` : '';
        lines.push(`<div><bdi dir="ltr">${escapeHtml(actualStr)}</bdi>${ratioPart}</div>`);
        lines.push(
          `<div>${escapeHtml(ctx.t('target'))}: <bdi dir="ltr">${escapeHtml(targetStr)}</bdi></div>`,
        );
        return `<div dir="${ctx.dir}">${lines.join('')}</div>`;
      },
    },
    series: [trackSeries, valueSeries],
  };
};

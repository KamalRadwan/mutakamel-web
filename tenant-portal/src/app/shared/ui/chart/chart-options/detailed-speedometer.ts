import type { EChartsOption } from 'echarts';
import type { ChartContext, WidgetExecution } from '../chart.model';
import { buildGaugeOption, type ChartBuilder } from './gauge';

export const detailedSpeedometerOption: ChartBuilder = (
  exec: WidgetExecution,
  ctx: ChartContext,
): EChartsOption =>
  buildGaugeOption(exec, ctx, {
    startAngle: 210,
    endAngle: -30,
    radius: '88%',
    splitNumber: 5,
    progress: {
      show: true,
      width: 8,
      itemStyle: { color: ctx.colors.accent },
    },
    axisLine: {
      lineStyle: { width: 8, color: [[1, ctx.colors.neutralSoft]] },
    },
    axisTick: {
      show: true,
      splitNumber: 4,
      distance: 2,
      length: 4,
      lineStyle: { color: ctx.colors.borderField },
    },
    splitLine: {
      show: true,
      distance: 2,
      length: 8,
      lineStyle: { color: ctx.colors.borderField },
    },
    axisLabel: {
      show: true,
      distance: 14,
      fontSize: 11,
      fontFamily: ctx.colors.fontUi,
      color: ctx.colors.textMuted,
      formatter: (v: number) => `${v}%`,
    },
    pointer: {
      show: true,
      length: '58%',
      width: 4,
      itemStyle: { color: ctx.colors.text },
    },
    anchor: {
      show: true,
      size: 8,
      itemStyle: { color: ctx.colors.text },
    },
    detail: {
      fontSize: 16,
      fontWeight: 500,
      color: ctx.colors.text,
      offsetCenter: [0, '62%'],
    },
    title: { offsetCenter: [0, '88%'] },
  });

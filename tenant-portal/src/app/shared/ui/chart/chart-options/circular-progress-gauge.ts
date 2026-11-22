import type { EChartsOption } from 'echarts';
import type { ChartContext, WidgetExecution } from '../chart.model';
import { buildGaugeOption, type ChartBuilder } from './gauge';

export const circularProgressGaugeOption: ChartBuilder = (
  exec: WidgetExecution,
  ctx: ChartContext,
): EChartsOption =>
  buildGaugeOption(exec, ctx, {
    startAngle: 90,
    endAngle: -270,
    radius: '86%',
    detail: { offsetCenter: [0, '-6%'] },
    title: { offsetCenter: [0, '24%'] },
  });

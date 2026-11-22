import type { EChartsOption } from 'echarts';
import type { ChartContext, WidgetExecution } from '../chart.model';
import { buildGaugeOption, type ChartBuilder } from './gauge';

export const threeQuarterGaugeOption: ChartBuilder = (
  exec: WidgetExecution,
  ctx: ChartContext,
): EChartsOption =>
  buildGaugeOption(exec, ctx, {
    startAngle: 225,
    endAngle: -45,
    radius: '88%',
    detail: { offsetCenter: [0, '-6%'] },
    title: { offsetCenter: [0, '24%'] },
  });

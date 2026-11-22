import type { EChartsOption } from 'echarts';
import type { ChartContext, WidgetExecution } from '../chart.model';
import { buildGaugeOption, type ChartBuilder } from './gauge';

export const semiCircleGaugeOption: ChartBuilder = (
  exec: WidgetExecution,
  ctx: ChartContext,
): EChartsOption =>
  buildGaugeOption(exec, ctx, {
    startAngle: 180,
    endAngle: 0,
    radius: '110%',
    center: ['50%', '78%'],
    detail: { offsetCenter: [0, '-18%'] },
    title: { offsetCenter: [0, '8%'] },
  });

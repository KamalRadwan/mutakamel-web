import type { EChartsOption } from 'echarts';
import type { ChartContext, WidgetExecution } from '../chart.model';
import type { ChartBuilder } from './gauge';
import { buildPieOption } from './pie';

export const donutOption: ChartBuilder = (
  exec: WidgetExecution,
  ctx: ChartContext,
): EChartsOption => buildPieOption(exec, ctx, { radius: ['46%', '72%'], showCenterTotal: true });

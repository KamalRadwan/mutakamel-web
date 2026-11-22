import type { EChartsOption } from 'echarts';
import type { ChartContext, ChartKind, WidgetExecution } from '../chart.model';
import { areaOption } from './area';
import { barOption } from './bar';
import { boxPlotOption } from './box-plot';
import { bubbleOption } from './bubble';
import { bulletOption } from './bullet';
import { calendarHeatmapOption } from './calendar-heatmap';
import { circularProgressGaugeOption } from './circular-progress-gauge';
import { columnOption } from './column';
import { comboOption } from './combo';
import { detailedSpeedometerOption } from './detailed-speedometer';
import { donutOption } from './donut';
import { flowchartOption } from './flowchart';
import { funnelOption } from './funnel';
import { ganttOption } from './gantt';
import { heatmapOption } from './heatmap';
import { histogramOption } from './histogram';
import { lineOption } from './line';
import { lineAreaOption } from './line-area';
import { pieOption } from './pie';
import { scatterOption } from './scatter';
import { semiCircleGaugeOption } from './semi-circle-gauge';
import { stackedBarOption } from './stacked-bar';
import { stackedBar100Option } from './stacked-bar-100';
import { threeQuarterGaugeOption } from './three-quarter-gauge';
import { treemapOption } from './treemap';
import { waterfallOption } from './waterfall';

export type ChartBuilder = (exec: WidgetExecution, ctx: ChartContext) => EChartsOption;

export const CHART_BUILDERS: Record<ChartKind, ChartBuilder> = {
  LINE: lineOption,
  AREA: areaOption,
  LINE_AREA: lineAreaOption,
  COLUMN: columnOption,
  BAR: barOption,
  STACKED_BAR: stackedBarOption,
  STACKED_BAR_100: stackedBar100Option,
  COMBO: comboOption,
  WATERFALL: waterfallOption,
  HISTOGRAM: histogramOption,
  SCATTER: scatterOption,
  BUBBLE: bubbleOption,
  BOX_PLOT: boxPlotOption,
  PIE: pieOption,
  DONUT: donutOption,
  FUNNEL: funnelOption,
  HEATMAP: heatmapOption,
  CALENDAR_HEATMAP: calendarHeatmapOption,
  TREEMAP: treemapOption,
  FLOWCHART: flowchartOption,
  GANTT: ganttOption,
  SEMI_CIRCLE_GAUGE: semiCircleGaugeOption,
  THREE_QUARTER_GAUGE: threeQuarterGaugeOption,
  CIRCULAR_PROGRESS_GAUGE: circularProgressGaugeOption,
  DETAILED_SPEEDOMETER: detailedSpeedometerOption,
  BULLET: bulletOption,
};

export function buildChartOption(
  kind: ChartKind,
  exec: WidgetExecution,
  ctx: ChartContext,
): EChartsOption {
  const builder = CHART_BUILDERS[kind];
  return builder(exec, ctx);
}

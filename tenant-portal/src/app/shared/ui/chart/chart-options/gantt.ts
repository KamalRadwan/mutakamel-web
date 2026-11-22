import type { CustomSeriesOption, EChartsOption } from 'echarts';
import { formatDate, formatDuration, formatShortDate, localIsoDate } from '../chart-format';
import type { ChartContext, WidgetExecution } from '../chart.model';
import { baseOption, categoryAxis, seriesColor, timeValueAxis } from '../chart-theme';
import { type ChartBuilder, escapeHtml } from './gauge';

interface GanttPointItem {
  name: string;
  value: [number, number, number];
  key: string;
  seriesKey: string;
  startIso: string;
  endIso: string;
  durationMin: number;
}

export const ganttOption: ChartBuilder = (
  exec: WidgetExecution,
  ctx: ChartContext,
): EChartsOption => {
  const base = baseOption(ctx);
  const baseTooltip = Array.isArray(base.tooltip) ? base.tooltip[0] : base.tooltip;
  const series = exec.series[0];

  if (!series || series.points.length === 0) {
    return {
      ...base,
      legend: { show: false },
      tooltip: { ...baseTooltip, trigger: 'item' },
      series: [],
    };
  }

  const items: GanttPointItem[] = [];
  const taskLabels: string[] = [];

  for (const p of series.points) {
    if (!p.start || !p.end) {
      continue;
    }
    const startMs = Date.parse(p.start);
    const endMs = Date.parse(p.end);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
      continue;
    }
    const durationMs =
      typeof p.value === 'number' && Number.isFinite(p.value) && p.value >= 0
        ? p.value
        : endMs - startMs;
    const durationMin = Math.round(durationMs / 60000);
    const rowIdx = taskLabels.length;
    taskLabels.push(p.label);
    items.push({
      name: p.label,
      value: [rowIdx, startMs, endMs],
      key: p.key,
      seriesKey: series.key,
      startIso: p.start,
      endIso: p.end,
      durationMin,
    });
  }

  if (items.length === 0) {
    return {
      ...base,
      legend: { show: false },
      tooltip: { ...baseTooltip, trigger: 'item' },
      series: [],
    };
  }

  const isRtl = ctx.dir === 'rtl';
  const xAxisObj = timeValueAxis(ctx);
  const xAxis: EChartsOption['xAxis'] = {
    type: 'time',
    inverse: false,
    position: 'bottom',
    axisLine: xAxisObj.axisLine,
    axisTick: xAxisObj.axisTick,
    splitLine: xAxisObj.splitLine,
    axisLabel: {
      fontSize: 11,
      fontFamily: ctx.colors.fontUi,
      color: ctx.colors.textMuted,
      hideOverlap: true,
      formatter: (val: number) =>
        formatShortDate(localIsoDate(val), ctx.lang, 'DAY', ctx.t),
    },
  };

  const yAxisBase = categoryAxis(ctx, taskLabels, { horizontal: true });
  const yAxis: EChartsOption['yAxis'] = {
    type: 'category',
    data: yAxisBase.data,
    inverse: true,
    position: isRtl ? 'right' : 'left',
    axisLine: yAxisBase.axisLine,
    axisTick: yAxisBase.axisTick,
    axisLabel: {
      fontSize: 11,
      fontFamily: ctx.colors.fontUi,
      color: ctx.colors.textMuted,
      hideOverlap: true,
    },
    splitLine: yAxisBase.splitLine,
  };

  const customSeries: CustomSeriesOption = {
    type: 'custom',
    encode: { x: [1, 2], y: 0 },
    data: items,
    renderItem: (params, api) => {
      const yIdx = api.value(0);
      const start = api.coord([api.value(1), yIdx]);
      const end = api.coord([api.value(2), yIdx]);
      const bandSize = api.size?.([0, 1]);
      const bandHeight = Array.isArray(bandSize) ? (bandSize[1] ?? 24) : (bandSize ?? 24);
      const height = bandHeight * 0.5;
      const x = Math.min(start[0], end[0]);
      const width = Math.max(Math.abs(end[0] - start[0]), 2);
      return {
        type: 'rect',
        shape: {
          x,
          y: start[1] - height / 2,
          width,
          height,
          r: 4,
        },
        style: {
          fill: seriesColor(ctx, params.dataIndex),
        },
      };
    },
  };

  return {
    ...base,
    legend: { show: false },
    grid: { left: isRtl ? 12 : 8, right: isRtl ? 8 : 12, top: 8, bottom: 4, containLabel: true },
    xAxis,
    yAxis,
    tooltip: {
      ...baseTooltip,
      trigger: 'item',
      formatter: (params) => {
        const p = Array.isArray(params) ? params[0] : params;
        if (!p) return '';
        const item = p.data as GanttPointItem | undefined;
        if (!item) {
          return `<div>${escapeHtml(p.name ?? '')}</div>`;
        }
        const rangeText = `${formatDate(item.startIso, ctx.lang, ctx.t)} – ${formatDate(item.endIso, ctx.lang, ctx.t)}`;
        const durText = formatDuration(item.durationMin, ctx.lang, ctx.t);
        return `<div dir="${ctx.dir}"><div>${escapeHtml(item.name)}</div><div>${escapeHtml(rangeText)}</div><div>${escapeHtml(durText)}</div></div>`;
      },
    },
    series: [customSeries],
  };
};

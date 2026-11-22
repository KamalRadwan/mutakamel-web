import type { EChartsOption } from 'echarts';
import type { HeatmapDataItemOption } from './echarts-items';
import { formatDate } from '../chart-format';
import type { ChartContext, WidgetExecution, WidgetPoint } from '../chart.model';
import { baseOption, seriesColor } from '../chart-theme';
import { type ChartBuilder, escapeHtml, formatMetricValue } from './gauge';

interface CalendarCellItem extends HeatmapDataItemOption {
  key: string;
  seriesKey: string;
  dateKey: string;
}

function extractDateKey(point: WidgetPoint): string | null {
  const raw = /^\d{4}-\d{2}-\d{2}/.test(point.key)
    ? point.key
    : point.start && /^\d{4}-\d{2}-\d{2}/.test(point.start)
      ? point.start
      : null;
  return raw ? raw.slice(0, 10) : null;
}

export const calendarHeatmapOption: ChartBuilder = (
  exec: WidgetExecution,
  ctx: ChartContext,
): EChartsOption => {
  const base = baseOption(ctx);
  const isRtl = ctx.dir === 'rtl';
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

  const allDateKeys: string[] = [];
  const cells: CalendarCellItem[] = [];
  let maxVal = 0;

  for (const p of series.points) {
    const dateKey = extractDateKey(p);
    if (!dateKey) {
      continue;
    }
    allDateKeys.push(dateKey);
    if (p.value === null || !Number.isFinite(p.value)) {
      continue;
    }
    if (p.value > maxVal) {
      maxVal = p.value;
    }
    cells.push({
      value: [dateKey, p.value],
      key: p.key,
      seriesKey: series.key,
      dateKey,
    });
  }

  if (allDateKeys.length === 0 || cells.length === 0) {
    return {
      ...base,
      legend: { show: false },
      tooltip: { ...baseTooltip, trigger: 'item' },
      series: [],
    };
  }

  allDateKeys.sort();
  const rangeStart = allDateKeys[0];
  const rangeEnd = allDateKeys[allDateKeys.length - 1];

  const dayNames = [0, 1, 2, 3, 4, 5, 6].map((d) => ctx.t(`daysShort.${d}`));
  const monthNames = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((m) => ctx.t(`monthsShort.${m}`));

  return {
    ...base,
    legend: { show: false },
    visualMap: {
      type: 'continuous',
      show: false,
      min: 0,
      max: maxVal > 0 ? maxVal : 1,
      inRange: {
        color: [ctx.colors.neutralSoft, seriesColor(ctx, 0)],
      },
    },
    calendar: {
      range: [rangeStart, rangeEnd],
      cellSize: ['auto', 16],
      top: 26,
      left: isRtl ? 8 : 30,
      right: isRtl ? 30 : 8,
      itemStyle: {
        borderColor: ctx.colors.surface,
        borderWidth: 2,
        color: ctx.colors.surfaceMuted,
      },
      splitLine: { show: false },
      dayLabel: {
        firstDay: 0,
        position: isRtl ? 'end' : 'start',
        fontSize: 11,
        fontFamily: ctx.colors.fontUi,
        color: ctx.colors.textMuted,
        nameMap: dayNames,
      },
      monthLabel: {
        fontSize: 11,
        fontFamily: ctx.colors.fontUi,
        color: ctx.colors.textMuted,
        nameMap: monthNames,
      },
      yearLabel: { show: false },
    },
    tooltip: {
      ...baseTooltip,
      trigger: 'item',
      formatter: (params) => {
        const p = Array.isArray(params) ? params[0] : params;
        if (!p) return '';
        const item = p.data as CalendarCellItem | undefined;
        const rawDate = item?.dateKey ?? (Array.isArray(p.value) ? String(p.value[0] ?? '') : '');
        const rawVal = Array.isArray(p.value) ? p.value[1] : undefined;
        const numVal = typeof rawVal === 'number' && Number.isFinite(rawVal) ? rawVal : null;
        const dateLabel = rawDate ? formatDate(rawDate, ctx.lang, ctx.t) : '';
        const valText = formatMetricValue(numVal, series.unit, series.currency, ctx);
        return `<div dir="${ctx.dir}"><div>${escapeHtml(dateLabel)}</div><div><bdi dir="ltr">${escapeHtml(valText)}</bdi></div></div>`;
      },
    },
    series: [
      {
        type: 'heatmap',
        coordinateSystem: 'calendar',
        data: cells,
      },
    ],
  };
};

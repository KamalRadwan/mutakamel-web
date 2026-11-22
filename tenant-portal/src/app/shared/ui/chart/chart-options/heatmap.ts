import type { EChartsOption } from 'echarts';
import type { HeatmapDataItemOption } from './echarts-items';
import { DASH, formatAxisNumber, formatShortDate } from '../chart-format';
import type { ChartContext, SeriesUnit, WidgetExecution } from '../chart.model';
import { baseOption, categoryAxis, seriesColor } from '../chart-theme';
import { type ChartBuilder, escapeHtml, formatMetricValue } from './gauge';

interface HeatmapPointItem extends HeatmapDataItemOption {
  key: string;
  seriesKey: string;
  xLabel: string;
  yLabel: string;
  unit: SeriesUnit;
  currency?: string;
}

export const heatmapOption: ChartBuilder = (
  exec: WidgetExecution,
  ctx: ChartContext,
): EChartsOption => {
  const base = baseOption(ctx);
  const baseTooltip = Array.isArray(base.tooltip) ? base.tooltip[0] : base.tooltip;
  const isTime = exec.shape === 'TIME_SERIES';
  const isRtl = ctx.dir === 'rtl';

  if (exec.series.length === 0) {
    return {
      ...base,
      legend: { show: false },
      tooltip: { ...baseTooltip, trigger: 'item' },
      series: [],
    };
  }

  const xKeyToIndex = new Map<string, number>();
  const xLabels: string[] = [];

  for (const s of exec.series) {
    for (const p of s.points) {
      if (!xKeyToIndex.has(p.key)) {
        xKeyToIndex.set(p.key, xLabels.length);
        let label = p.label;
        if (isTime) {
          const grain = /^\d{4}-\d{2}$/.test(p.key) ? 'MONTH' : 'DAY';
          const sourceIso = p.start ?? p.key;
          const formatted = formatShortDate(sourceIso, ctx.lang, grain, ctx.t);
          if (formatted && formatted !== DASH) {
            label = formatted;
          }
        }
        xLabels.push(label);
      }
    }
  }

  const yLabels = exec.series.map((s) => s.label);
  const cells: HeatmapPointItem[] = [];
  let maxVal = 0;

  for (let yIdx = 0; yIdx < exec.series.length; yIdx++) {
    const s = exec.series[yIdx];
    for (const p of s.points) {
      if (p.value === null || !Number.isFinite(p.value)) {
        continue;
      }
      const xIdx = xKeyToIndex.get(p.key);
      if (xIdx === undefined) {
        continue;
      }
      if (p.value > maxVal) {
        maxVal = p.value;
      }
      cells.push({
        value: [xIdx, yIdx, p.value],
        key: p.key,
        seriesKey: s.key,
        xLabel: xLabels[xIdx] ?? p.label,
        yLabel: s.label,
        unit: s.unit,
        currency: s.currency,
      });
    }
  }

  if (cells.length === 0 || xLabels.length === 0) {
    return {
      ...base,
      legend: { show: false },
      tooltip: { ...baseTooltip, trigger: 'item' },
      series: [],
    };
  }

  const xAxisBase = categoryAxis(ctx, xLabels, { time: isTime });
  const xAxis: EChartsOption['xAxis'] = {
    type: 'category',
    data: xAxisBase.data,
    inverse: xAxisBase.inverse,
    position: 'bottom',
    axisLine: xAxisBase.axisLine,
    axisTick: xAxisBase.axisTick,
    axisLabel: {
      fontSize: 11,
      fontFamily: ctx.colors.fontUi,
      color: ctx.colors.textMuted,
      hideOverlap: true,
    },
    splitLine: { show: false },
  };

  const yAxisBase = categoryAxis(ctx, yLabels, { horizontal: true });
  const yAxis: EChartsOption['yAxis'] = {
    type: 'category',
    data: yAxisBase.data,
    inverse: yAxisBase.inverse,
    position: isRtl ? 'right' : 'left',
    axisLine: yAxisBase.axisLine,
    axisTick: yAxisBase.axisTick,
    axisLabel: {
      fontSize: 11,
      fontFamily: ctx.colors.fontUi,
      color: ctx.colors.textMuted,
      hideOverlap: true,
    },
    splitLine: { show: false },
  };

  return {
    ...base,
    legend: { show: false },
    grid: { left: 4, right: 4, top: 4, bottom: 30, containLabel: true },
    xAxis,
    yAxis,
    visualMap: {
      type: 'continuous',
      min: 0,
      max: maxVal > 0 ? maxVal : 1,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      itemHeight: 80,
      itemWidth: 8,
      textStyle: {
        fontSize: 11,
        fontFamily: ctx.colors.fontUi,
        color: ctx.colors.textMuted,
      },
      inRange: {
        color: [ctx.colors.neutralSoft, seriesColor(ctx, 0)],
      },
      formatter: (val) => (typeof val === 'number' ? formatAxisNumber(val) : String(val ?? '')),
    },
    tooltip: {
      ...baseTooltip,
      trigger: 'item',
      formatter: (params) => {
        const p = Array.isArray(params) ? params[0] : params;
        if (!p) return '';
        const item = p.data as HeatmapPointItem | undefined;
        const val = Array.isArray(p.value) ? p.value[2] : undefined;
        const numVal = typeof val === 'number' && Number.isFinite(val) ? val : null;
        const unit = item?.unit ?? exec.series[0]?.unit ?? 'COUNT';
        const currency = item?.currency ?? exec.series[0]?.currency;
        const valText = formatMetricValue(numVal, unit, currency, ctx);
        const header =
          item !== undefined
            ? `${escapeHtml(item.yLabel)} · ${escapeHtml(item.xLabel)}`
            : escapeHtml(p.name ?? '');
        return `<div dir="${ctx.dir}"><div>${header}</div><div><bdi dir="ltr">${escapeHtml(valText)}</bdi></div></div>`;
      },
    },
    series: [
      {
        type: 'heatmap',
        data: cells,
        itemStyle: {
          borderColor: ctx.colors.surface,
          borderWidth: 1,
        },
      },
    ],
  };
};

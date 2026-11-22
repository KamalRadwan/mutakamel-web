import type { EChartsOption, PieSeriesOption } from 'echarts';
import type { PieDataItemOption } from './echarts-items';
import { DASH, formatPercent, formatValue } from '../chart-format';
import type { ChartContext, WidgetExecution } from '../chart.model';
import { OTHER_SERIES_KEY, baseOption, seriesColor } from '../chart-theme';
import { type ChartBuilder, escapeHtml, formatMetricValue } from './gauge';

interface PiePointItem extends PieDataItemOption {
  key: string;
  seriesKey: string;
}

export interface PieBuildOptions {
  radius: string | [string, string];
  showCenterTotal?: boolean;
}

export function buildPieOption(
  exec: WidgetExecution,
  ctx: ChartContext,
  opts: PieBuildOptions,
): EChartsOption {
  const base = baseOption(ctx);
  const baseTooltip = Array.isArray(base.tooltip) ? base.tooltip[0] : base.tooltip;
  const series = exec.series[0];

  if (!series) {
    return {
      ...base,
      legend: { show: false },
      tooltip: { ...baseTooltip, trigger: 'item' },
      series: [],
    };
  }

  const filteredPoints = series.points.filter(
    (p): p is typeof p & { value: number } =>
      p.value !== null && Number.isFinite(p.value) && p.value >= 0,
  );
  // "Other" groups the smallest slices, so order by value before cutting at 9.
  const validPoints =
    filteredPoints.length > 10
      ? [...filteredPoints].sort((a, b) => b.value - a.value)
      : filteredPoints;

  if (validPoints.length === 0) {
    return {
      ...base,
      legend: { show: false },
      tooltip: { ...baseTooltip, trigger: 'item' },
      series: [],
    };
  }

  const items: PiePointItem[] = [];
  if (validPoints.length > 10) {
    for (let i = 0; i < 9; i++) {
      const p = validPoints[i];
      items.push({
        name: p.label,
        value: p.value,
        key: p.key,
        seriesKey: series.key,
        itemStyle: { color: seriesColor(ctx, i) },
      });
    }
    let otherSum = 0;
    for (let i = 9; i < validPoints.length; i++) {
      otherSum += validPoints[i].value;
    }
    items.push({
      name: ctx.t('other'),
      value: otherSum,
      key: OTHER_SERIES_KEY,
      seriesKey: series.key,
      itemStyle: { color: ctx.colors.other },
    });
  } else {
    for (let i = 0; i < validPoints.length; i++) {
      const p = validPoints[i];
      items.push({
        name: p.label,
        value: p.value,
        key: p.key,
        seriesKey: series.key,
        itemStyle: { color: seriesColor(ctx, i) },
      });
    }
  }

  const total = validPoints.reduce((acc, p) => acc + p.value, 0);

  const mainSeries: PieSeriesOption = {
    type: 'pie',
    radius: opts.radius,
    center: ['50%', '50%'],
    label: {
      show: true,
      fontFamily: ctx.colors.fontUi,
      fontSize: 11,
      color: ctx.colors.text,
      formatter: (p) => {
        const pct = typeof p.percent === 'number' && Number.isFinite(p.percent) ? p.percent : null;
        return formatPercent(pct);
      },
    },
    data: items,
  };

  const seriesList: PieSeriesOption[] = [mainSeries];

  if (opts.showCenterTotal && series.unit === 'COUNT') {
    seriesList.push({
      type: 'pie',
      radius: ['0%', '0%'],
      center: ['50%', '50%'],
      silent: true,
      tooltip: { show: false },
      emphasis: { disabled: true },
      labelLine: { show: false },
      label: {
        show: true,
        position: 'center',
        formatter: () => formatValue(total, 'COUNT', undefined, ctx.lang, ctx.t),
        fontFamily: ctx.colors.fontUi,
        fontSize: 16,
        fontWeight: 500,
        color: ctx.colors.text,
      },
      data: [
        {
          value: 1,
          name: ctx.t('total'),
          itemStyle: { color: 'transparent' },
        },
      ],
    });
  }

  return {
    ...base,
    legend: { show: false },
    tooltip: {
      ...baseTooltip,
      trigger: 'item',
      formatter: (params) => {
        const p = Array.isArray(params) ? params[0] : params;
        if (!p) return '';
        const name = escapeHtml(p.name ?? '');
        const rawVal = typeof p.value === 'number' && Number.isFinite(p.value) ? p.value : null;
        const valText = formatMetricValue(rawVal, series.unit, series.currency, ctx);
        const pct = typeof p.percent === 'number' && Number.isFinite(p.percent) ? p.percent : null;
        const pctText = pct !== null ? formatPercent(pct) : DASH;
        return `<div dir="${ctx.dir}"><div>${name}</div><div><bdi dir="ltr">${escapeHtml(valText)}</bdi> · <bdi dir="ltr">${escapeHtml(pctText)}</bdi></div></div>`;
      },
    },
    series: seriesList,
  };
}

export const pieOption: ChartBuilder = (exec: WidgetExecution, ctx: ChartContext): EChartsOption =>
  buildPieOption(exec, ctx, { radius: '72%' });

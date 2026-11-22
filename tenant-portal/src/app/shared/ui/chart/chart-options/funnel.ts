import type { EChartsOption } from 'echarts';
import type { FunnelDataItemOption } from './echarts-items';
import { DASH, formatPercent, formatRateN } from '../chart-format';
import type { ChartContext, WidgetExecution } from '../chart.model';
import { baseOption, seriesColor } from '../chart-theme';
import { type ChartBuilder, escapeHtml, formatMetricValue } from './gauge';

interface FunnelPointItem extends FunnelDataItemOption {
  key: string;
  seriesKey: string;
  rawValue: number;
}

export const funnelOption: ChartBuilder = (
  exec: WidgetExecution,
  ctx: ChartContext,
): EChartsOption => {
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

  const validPoints = series.points.filter(
    (p): p is typeof p & { value: number } =>
      p.value !== null && Number.isFinite(p.value) && p.value >= 0,
  );

  if (validPoints.length === 0) {
    return {
      ...base,
      legend: { show: false },
      tooltip: { ...baseTooltip, trigger: 'item' },
      series: [],
    };
  }

  const firstValue = validPoints[0].value;
  const isRtl = ctx.dir === 'rtl';

  const items: FunnelPointItem[] = validPoints.map((p, i) => ({
    name: p.label,
    value: p.value,
    rawValue: p.value,
    key: p.key,
    seriesKey: series.key,
    itemStyle: {
      color: seriesColor(ctx, i),
      borderColor: ctx.colors.surface,
      borderWidth: 1,
    },
  }));

  return {
    ...base,
    legend: { show: false },
    tooltip: {
      ...baseTooltip,
      trigger: 'item',
      formatter: (params) => {
        const p = Array.isArray(params) ? params[0] : params;
        if (!p) return '';
        const item = p.data as FunnelPointItem | undefined;
        const val =
          item?.rawValue ??
          (typeof p.value === 'number' && Number.isFinite(p.value) ? p.value : null);
        const valStr = formatMetricValue(val, series.unit, series.currency, ctx);
        const pctStr =
          val !== null && firstValue > 0 ? formatPercent((val / firstValue) * 100) : DASH;
        const lines: string[] = [
          `<div>${escapeHtml(p.name ?? '')}</div>`,
          `<div><bdi dir="ltr">${escapeHtml(valStr)}</bdi> · <bdi dir="ltr">${escapeHtml(pctStr)}</bdi></div>`,
        ];
        if (val !== null && firstValue > 0) {
          lines.push(`<div>${escapeHtml(formatRateN(val, firstValue, ctx.lang, ctx.t))}</div>`);
        }
        return `<div dir="${ctx.dir}">${lines.join('')}</div>`;
      },
    },
    series: [
      {
        type: 'funnel',
        sort: 'none',
        gap: 3,
        minSize: '36%',
        maxSize: '100%',
        top: 4,
        bottom: 4,
        left: isRtl ? 144 : 8,
        right: isRtl ? 8 : 144,
        labelLine: {
          show: true,
          length: 8,
          lineStyle: { color: ctx.colors.border },
        },
        label: {
          show: true,
          position: isRtl ? 'left' : 'right',
          color: ctx.colors.text,
          fontFamily: ctx.colors.fontUi,
          fontSize: 11,
          width: 136,
          overflow: 'truncate',
          formatter: (p) => {
            const item = p.data as FunnelPointItem | undefined;
            const val =
              item?.rawValue ??
              (typeof p.value === 'number' && Number.isFinite(p.value) ? p.value : null);
            const valStr = formatMetricValue(val, series.unit, series.currency, ctx);
            const pctStr =
              val !== null && firstValue > 0 ? formatPercent((val / firstValue) * 100) : DASH;
            return `${p.name}
${valStr} · ${pctStr}`;
          },
        },
        data: items,
      },
    ],
  };
};

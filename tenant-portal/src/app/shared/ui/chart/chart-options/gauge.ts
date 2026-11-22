import type { EChartsOption, GaugeSeriesOption } from 'echarts';
import type { GaugeDataItemOption } from './echarts-items';
import { DASH, formatMoney, formatPercent, formatValue } from '../chart-format';
import type { ChartContext, Reference, SeriesUnit, WidgetExecution } from '../chart.model';
import { baseOption } from '../chart-theme';

export type ChartBuilder = (exec: WidgetExecution, ctx: ChartContext) => EChartsOption;

interface GaugePointItem extends GaugeDataItemOption {
  key: string;
  seriesKey?: string;
}

export interface ScalarTargetData {
  value: number | null;
  target: number | undefined;
  unit: SeriesUnit;
  currency: string | undefined;
  label: string;
  pointKey: string;
  seriesKey: string | undefined;
}

export interface GaugeMeta {
  unit: SeriesUnit;
  currency?: string;
  pointKey?: string;
  seriesKey?: string;
}

const VALID_UNITS: readonly SeriesUnit[] = [
  'COUNT',
  'MONEY',
  'PERCENT',
  'RATIO',
  'DURATION',
  'SCORE',
];

function isSeriesUnit(value: string | undefined): value is SeriesUnit {
  return value !== undefined && (VALID_UNITS as readonly string[]).includes(value);
}

export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function extractTargetReference(exec: WidgetExecution): Reference | undefined {
  const result = exec.result;
  if (!result || !('references' in result) || !Array.isArray(result.references)) {
    return undefined;
  }
  return result.references.find((ref) => ref.kind === 'TARGET' && Number.isFinite(ref.value));
}

export function extractScalarTarget(exec: WidgetExecution): ScalarTargetData {
  const firstSeries = exec.series[0];
  const firstPoint = firstSeries?.points[0];

  let value: number | null = null;
  if (typeof exec.value === 'number' && Number.isFinite(exec.value)) {
    value = exec.value;
  } else if (exec.value === null) {
    value = null;
  } else if (typeof firstPoint?.value === 'number' && Number.isFinite(firstPoint.value)) {
    value = firstPoint.value;
  }

  const targetRef = extractTargetReference(exec);
  let target: number | undefined;
  if (typeof exec.target === 'number' && Number.isFinite(exec.target)) {
    target = exec.target;
  } else if (targetRef !== undefined) {
    target = targetRef.value;
  }

  let unit: SeriesUnit = 'COUNT';
  if (firstSeries?.unit) {
    unit = firstSeries.unit;
  } else if (isSeriesUnit(exec.meta.unit)) {
    unit = exec.meta.unit;
  } else if (targetRef?.unit) {
    unit = targetRef.unit;
  }

  const currency = firstSeries?.currency ?? exec.meta.currency ?? targetRef?.currencyCode;
  const label = firstSeries?.label ?? '';
  const pointKey = firstPoint?.key ?? firstSeries?.key ?? exec.widgetId;
  const seriesKey = firstSeries?.key;

  return { value, target, unit, currency, label, pointKey, seriesKey };
}

export function formatMetricValue(
  v: number | null | undefined,
  unit: SeriesUnit,
  currency: string | undefined,
  ctx: ChartContext,
): string {
  if (v === null || v === undefined || !Number.isFinite(v)) {
    return DASH;
  }
  if (unit === 'MONEY' && currency) {
    return formatMoney(v, currency);
  }
  return formatValue(v, unit, currency, ctx.lang, ctx.t);
}

export function computeRatioPercent(
  value: number | null,
  target: number | undefined,
): number | null {
  if (
    value === null ||
    !Number.isFinite(value) ||
    target === undefined ||
    !Number.isFinite(target) ||
    target <= 0
  ) {
    return null;
  }
  return (value / target) * 100;
}

export function gaugeBase(
  ctx: ChartContext,
  value: number | null,
  target: number | undefined,
  extra: Partial<GaugeSeriesOption> = {},
  meta?: GaugeMeta,
): GaugeSeriesOption {
  const unit = meta?.unit ?? 'COUNT';
  const currency = meta?.currency;
  const realRatio = computeRatioPercent(value, target);
  const plotted = realRatio !== null ? Math.min(Math.max(realRatio, 0), 100) : 0;

  const formattedActual = formatMetricValue(value, unit, currency, ctx);
  const formattedTarget =
    target !== undefined && Number.isFinite(target)
      ? formatMetricValue(target, unit, currency, ctx)
      : DASH;
  const subtitle = `${formattedActual} · ${ctx.t('target')} ${formattedTarget}`;

  const dataItem: GaugePointItem = {
    value: plotted,
    name: subtitle,
    key: meta?.pointKey ?? 'gauge',
    seriesKey: meta?.seriesKey,
  };

  const {
    progress: extraProgress,
    axisLine: extraAxisLine,
    axisTick: extraAxisTick,
    splitLine: extraSplitLine,
    axisLabel: extraAxisLabel,
    pointer: extraPointer,
    detail: extraDetail,
    title: extraTitle,
    data: _ignoredData,
    ...restExtra
  } = extra;

  return {
    type: 'gauge',
    min: 0,
    max: 100,
    ...restExtra,
    progress: {
      show: true,
      width: 12,
      itemStyle: { color: ctx.colors.accent },
      ...extraProgress,
    },
    axisLine: {
      lineStyle: { width: 12, color: [[1, ctx.colors.neutralSoft]] },
      ...extraAxisLine,
    },
    axisTick: extraAxisTick ?? { show: false },
    splitLine: extraSplitLine ?? { show: false },
    axisLabel: extraAxisLabel ?? { show: false },
    pointer: extraPointer ?? { show: false },
    detail: {
      fontFamily: ctx.colors.fontUi,
      fontSize: 20,
      fontWeight: 500,
      color: ctx.colors.text,
      offsetCenter: [0, '-6%'],
      valueAnimation: false,
      formatter: () => (realRatio !== null ? formatPercent(realRatio) : DASH),
      ...extraDetail,
    },
    title: {
      show: true,
      fontFamily: ctx.colors.fontUi,
      fontSize: 11,
      fontWeight: 400,
      color: ctx.colors.textMuted,
      offsetCenter: [0, '24%'],
      overflow: 'truncate',
      width: 180,
      ...extraTitle,
    },
    data: [dataItem],
  };
}

export function buildGaugeOption(
  exec: WidgetExecution,
  ctx: ChartContext,
  extra: Partial<GaugeSeriesOption> = {},
): EChartsOption {
  const base = baseOption(ctx);
  const baseTooltip = Array.isArray(base.tooltip) ? base.tooltip[0] : base.tooltip;
  const scalar = extractScalarTarget(exec);
  const realRatio = computeRatioPercent(scalar.value, scalar.target);

  const actualStr = formatMetricValue(scalar.value, scalar.unit, scalar.currency, ctx);
  const targetStr =
    scalar.target !== undefined && Number.isFinite(scalar.target)
      ? formatMetricValue(scalar.target, scalar.unit, scalar.currency, ctx)
      : DASH;
  const pctStr = realRatio !== null ? formatPercent(realRatio) : DASH;

  const series = gaugeBase(ctx, scalar.value, scalar.target, extra, {
    unit: scalar.unit,
    currency: scalar.currency,
    pointKey: scalar.pointKey,
    seriesKey: scalar.seriesKey,
  });

  return {
    ...base,
    legend: { show: false },
    tooltip: {
      ...baseTooltip,
      trigger: 'item',
      formatter: () => {
        const lines: string[] = [];
        if (scalar.label) {
          lines.push(`<div>${escapeHtml(scalar.label)}</div>`);
        }
        lines.push(
          `<div><bdi dir="ltr">${escapeHtml(actualStr)}</bdi> (<bdi dir="ltr">${escapeHtml(pctStr)}</bdi>)</div>`,
        );
        lines.push(
          `<div>${escapeHtml(ctx.t('target'))}: <bdi dir="ltr">${escapeHtml(targetStr)}</bdi></div>`,
        );
        return `<div dir="${ctx.dir}">${lines.join('')}</div>`;
      },
    },
    series: [series],
  };
}

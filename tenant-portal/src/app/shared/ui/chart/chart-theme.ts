import type { EChartsOption } from 'echarts';
import type { ChartColors, ChartContext, SeriesUnit, WidgetPoint, WidgetSeries } from './chart.model';
import { DASH, formatAxisNumber, formatDuration, formatNumber, formatShortDate, localIsoDate } from './chart-format';

export const OTHER_SERIES_KEY = '__other__';

const MAX_SERIES_BEFORE_OTHER = 10;
const KEPT_SERIES_COUNT = 9;

export interface ChartAxisOptionBase {
  type?: 'category' | 'value' | 'time';
  position?: 'top' | 'bottom' | 'left' | 'right';
  inverse?: boolean;
  boundaryGap?: boolean;
  name?: string;
  nameLocation?: 'start' | 'middle' | 'center' | 'end';
  nameGap?: number;
  nameTextStyle?: {
    color?: string;
    fontSize?: number;
    fontFamily?: string;
  };
  min?: number;
  max?: number;
  data?: string[];
  axisLine?: {
    show?: boolean;
    lineStyle?: { color?: string };
  };
  axisTick?: { show?: boolean };
  axisLabel?: {
    color?: string;
    fontSize?: number;
    fontFamily?: string;
    hideOverlap?: boolean;
  };
  splitLine?: {
    show?: boolean;
    lineStyle?: { color?: string };
  };
}

export interface ChartCategoryAxis extends ChartAxisOptionBase {
  type: 'category';
  data: string[];
  axisLabel?: ChartAxisOptionBase['axisLabel'] & {
    formatter?: ((value: string, index: number) => string) | string;
  };
}

export interface ChartValueAxis extends Omit<ChartAxisOptionBase, 'boundaryGap'> {
  type: 'value';
  axisLabel?: ChartAxisOptionBase['axisLabel'] & {
    formatter?: ((value: number, index: number) => string) | string;
  };
}

export interface ChartTimeAxis extends ChartAxisOptionBase {
  type: 'time';
  axisLabel?: ChartAxisOptionBase['axisLabel'] & {
    formatter?: (value: number, index: number) => string;
  };
}

export interface LimitSliceItem {
  key: string;
  label: string;
  value: number | null;
  color?: string;
}

function cssToken(styles: CSSStyleDeclaration | null, name: string, fallback = ''): string {
  if (!styles) return fallback;
  const val = styles.getPropertyValue(name).trim();
  return val || fallback;
}

function cssNumber(styles: CSSStyleDeclaration | null, name: string, fallback: number): number {
  const raw = cssToken(styles, name);
  const parsed = raw ? Number.parseFloat(raw) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function readChartColors(root?: Element): ChartColors {
  const target = root ?? (typeof document !== 'undefined' ? document.documentElement : undefined);
  const styles =
    target && typeof getComputedStyle === 'function' ? getComputedStyle(target) : null;

  const series: string[] = [];
  for (let i = 1; i <= 10; i++) {
    series.push(cssToken(styles, `--chart-${i}`, 'currentColor'));
  }

  return {
    series,
    other: cssToken(styles, '--status-none', 'currentColor'),
    text: cssToken(styles, '--text', 'currentColor'),
    textMuted: cssToken(styles, '--text-muted', 'currentColor'),
    border: cssToken(styles, '--border', 'currentColor'),
    borderField: cssToken(styles, '--border-field', 'currentColor'),
    surface: cssToken(styles, '--surface', ''),
    surfaceMuted: cssToken(styles, '--surface-muted', ''),
    neutralSoft: cssToken(styles, '--neutral-soft', ''),
    brandSoft: cssToken(styles, '--brand-soft', ''),
    accent: cssToken(styles, '--accent', 'currentColor'),
    fontUi: cssToken(styles, '--font-ui', 'system-ui, sans-serif'),
    fillOpacity: cssNumber(styles, '--chart-fill-opacity', 0.25),
    linkOpacity: cssNumber(styles, '--chart-link-opacity', 0.35),
  };
}

export function baseOption(ctx: ChartContext): EChartsOption {
  const { colors, dir } = ctx;
  const isRtl = dir === 'rtl';

  return {
    color: colors.series,
    textStyle: {
      fontFamily: colors.fontUi,
      fontSize: 11,
      color: colors.textMuted,
    },
    animation: false,
    grid: {
      left: 8,
      right: 8,
      top: 24,
      bottom: 4,
      containLabel: true,
    },
    legend: {
      top: 0,
      left: isRtl ? 'auto' : 0,
      right: isRtl ? 0 : 'auto',
      icon: 'roundRect',
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 24,
      textStyle: {
        color: colors.text,
        fontSize: 11,
        fontFamily: colors.fontUi,
      },
    },
    tooltip: {
      trigger: 'axis',
      confine: true,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      textStyle: {
        color: colors.text,
        fontSize: 12,
        fontFamily: colors.fontUi,
      },
    },
  };
}

export function categoryAxis(
  ctx: ChartContext,
  labels: string[],
  opts?: { time?: boolean; horizontal?: boolean; boundaryGap?: boolean; name?: string },
): ChartCategoryAxis {
  const { colors, dir } = ctx;
  const horizontal = opts?.horizontal === true;
  const time = opts?.time === true;

  return {
    type: 'category',
    data: labels,
    inverse: !horizontal && !time && dir === 'rtl',
    ...(horizontal ? { position: dir === 'rtl' ? 'right' : 'left' } : {}),
    ...(opts?.boundaryGap !== undefined ? { boundaryGap: opts.boundaryGap } : {}),
    ...(opts?.name
      ? {
          name: opts.name,
          nameTextStyle: {
            color: colors.textMuted,
            fontSize: 11,
            fontFamily: colors.fontUi,
          },
        }
      : {}),
    axisLine: { show: true, lineStyle: { color: colors.border } },
    axisTick: { show: false },
    axisLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontFamily: colors.fontUi,
      hideOverlap: true,
    },
    splitLine: { show: false },
  };
}

export function valueAxis(
  ctx: ChartContext,
  unit: SeriesUnit,
  opts?: { percentMax?: boolean; position?: 'start' | 'end'; name?: string },
): ChartValueAxis {
  const { colors, dir, lang, t } = ctx;
  const isEnd = opts?.position === 'end';
  const position = isEnd ? (dir === 'rtl' ? 'left' : 'right') : dir === 'rtl' ? 'right' : 'left';

  return {
    type: 'value',
    position,
    ...(opts?.percentMax ? { max: 100 } : {}),
    ...(opts?.name
      ? {
          name: opts.name,
          nameTextStyle: {
            color: colors.textMuted,
            fontSize: 11,
            fontFamily: colors.fontUi,
          },
        }
      : {}),
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: {
      show: !isEnd,
      lineStyle: { color: colors.border },
    },
    axisLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontFamily: colors.fontUi,
      hideOverlap: true,
      formatter: (raw: number) => {
        if (!Number.isFinite(raw)) return DASH;
        switch (unit) {
          case 'PERCENT':
            return `${formatAxisNumber(raw)}%`;
          case 'DURATION':
            return formatDuration(raw, lang, t);
          case 'RATIO':
          case 'SCORE':
            return Number.isInteger(raw) ? formatAxisNumber(raw) : formatNumber(raw, lang, 1);
          case 'COUNT':
          case 'MONEY':
          default:
            return formatAxisNumber(raw);
        }
      },
    },
  };
}

export function timeValueAxis(ctx: ChartContext): ChartTimeAxis {
  const { colors, lang, t } = ctx;

  return {
    type: 'time',
    inverse: false,
    axisLine: { show: true, lineStyle: { color: colors.border } },
    axisTick: { show: false },
    splitLine: {
      show: true,
      lineStyle: { color: colors.border },
    },
    axisLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontFamily: colors.fontUi,
      hideOverlap: true,
      formatter: (raw: number) => formatShortDate(localIsoDate(raw), lang, 'DAY', t),
    },
  };
}

export function seriesColor(ctx: ChartContext, index: number): string {
  const palette = ctx.colors.series;
  if (palette.length === 0) return ctx.colors.other;
  const safeIndex = ((index % palette.length) + palette.length) % palette.length;
  return palette[safeIndex] ?? ctx.colors.other;
}

function isWidgetSeries(item: WidgetSeries | LimitSliceItem): item is WidgetSeries {
  return 'points' in item;
}

export function limitSeries(series: WidgetSeries[], ctx: ChartContext): WidgetSeries[];
export function limitSeries<T extends LimitSliceItem>(series: T[], ctx: ChartContext): T[];
export function limitSeries<T extends WidgetSeries | LimitSliceItem>(
  series: T[],
  ctx: ChartContext,
): T[] {
  if (series.length <= MAX_SERIES_BEFORE_OTHER) {
    return [...series];
  }

  const head = series.slice(0, KEPT_SERIES_COUNT);
  const tail = series.slice(KEPT_SERIES_COUNT);
  const first = head[0];
  if (!first) return [...series];

  if (isWidgetSeries(first)) {
    const widgetHead = head as WidgetSeries[];
    const widgetTail = tail as WidgetSeries[];
    // Ordered union of point keys across head and tail: tail-only keys must not be dropped.
    const referenceByKey = new Map<string, WidgetPoint>();
    for (const s of [...widgetHead, ...widgetTail]) {
      for (const pt of s.points) {
        if (!referenceByKey.has(pt.key)) referenceByKey.set(pt.key, pt);
      }
    }
    const referencePoints = [...referenceByKey.values()];
    const tailIndexes = widgetTail.map((s) => new Map(s.points.map((pt) => [pt.key, pt] as const)));

    // XY data (scatter/bubble) is never summed: the tail's points are kept unchanged under "Other".
    const isXy = widgetTail.some((s) => s.points.some((pt) => pt.secondaryValue !== undefined));
    if (isXy) {
      const xyOther: WidgetSeries = {
        key: OTHER_SERIES_KEY,
        label: ctx.t('other'),
        unit: widgetTail[0]?.unit ?? 'COUNT',
        axis: widgetTail[0]?.axis ?? 'LEFT',
        ...(widgetTail[0]?.currency ? { currency: widgetTail[0].currency } : {}),
        points: widgetTail.flatMap((s) => s.points),
      };
      return [...widgetHead, xyOther] as T[];
    }

    // Never add different units or currencies: a mixed tail merges to a gap.
    const tailUnit = widgetTail[0]?.unit ?? 'COUNT';
    const tailCurrency = widgetTail[0]?.currency;
    const tailCompatible = widgetTail.every((s) => s.unit === tailUnit && s.currency === tailCurrency);

    const mergedPoints: WidgetPoint[] = referencePoints.map((refPt) => {
      let hasValue = false;
      let sum = 0;
      let hasPrev = false;
      let prevSum = 0;

      for (const index of tailIndexes) {
        const pt = index.get(refPt.key);
        if (pt && pt.value !== null && Number.isFinite(pt.value)) {
          hasValue = true;
          sum += pt.value;
        }
        if (pt && pt.previousValue !== undefined && Number.isFinite(pt.previousValue)) {
          hasPrev = true;
          prevSum += pt.previousValue;
        }
      }

      return {
        key: refPt.key,
        label: refPt.label,
        value: tailCompatible && hasValue ? sum : null,
        ...(hasPrev ? { previousValue: prevSum } : {}),
        ...(refPt.start !== undefined ? { start: refPt.start } : {}),
        ...(refPt.end !== undefined ? { end: refPt.end } : {}),
        ...(refPt.previousKey !== undefined ? { previousKey: refPt.previousKey } : {}),
      };
    });

    const otherSeries: WidgetSeries = {
      key: OTHER_SERIES_KEY,
      label: ctx.t('other'),
      unit: tailCompatible ? tailUnit : (widgetHead[0]?.unit ?? 'COUNT'),
      axis: widgetHead[0]?.axis ?? 'LEFT',
      ...((tailCompatible ? tailCurrency : widgetHead[0]?.currency)
        ? { currency: tailCompatible ? tailCurrency : widgetHead[0]?.currency }
        : {}),
      points: mergedPoints,
    };

    return [...widgetHead, otherSeries] as T[];
  }

  const sliceHead = head as LimitSliceItem[];
  const sliceTail = tail as LimitSliceItem[];
  let hasValue = false;
  let sum = 0;
  for (const item of sliceTail) {
    if (item.value !== null && Number.isFinite(item.value)) {
      hasValue = true;
      sum += item.value;
    }
  }

  const otherSlice: LimitSliceItem = {
    key: OTHER_SERIES_KEY,
    label: ctx.t('other'),
    value: hasValue ? sum : null,
    color: ctx.colors.other,
  };

  return [...sliceHead, otherSlice] as T[];
}

export function nullLabel(ctx: ChartContext): (params: unknown) => string {
  const empty = ctx.t('noValue') || DASH;
  return (params: unknown) => {
    if (params == null) return empty;
    if (typeof params === 'number') return Number.isFinite(params) ? String(params) : empty;
    if (typeof params === 'object' && 'value' in params) {
      const val = (params as { value?: unknown }).value;
      if (val == null) return empty;
      if (typeof val === 'number') return Number.isFinite(val) ? String(val) : empty;
      return String(val);
    }
    return String(params);
  };
}

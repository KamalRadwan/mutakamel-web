import type { EChartsOption, MarkLineComponentOption, SeriesOption } from 'echarts';
import type {
  ChartContext,
  Reference,
  SeriesUnit,
  WidgetExecution,
  WidgetPoint,
  WidgetSeries,
} from '../chart.model';
import { DASH, formatShortDate, formatValue } from '../chart-format';
import {
  OTHER_SERIES_KEY,
  baseOption,
  categoryAxis,
  seriesColor,
  valueAxis,
  type ChartValueAxis,
} from '../chart-theme';

export interface TooltipEntry {
  marker?: string;
  name: string;
  valueText: string;
}

export interface PointItemStyle {
  color?: string;
  borderColor?: string;
  borderType?: 'solid' | 'dashed' | 'dotted';
  borderWidth?: number;
  borderRadius?: number | number[];
  opacity?: number;
}

export interface PointLabelOption {
  show?: boolean;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'inside';
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  formatter?: string | (() => string);
}

export interface PointDataObject {
  value: number | (number | null)[] | null;
  name?: string;
  key: string;
  seriesKey: string;
  symbolSize?: number;
  itemStyle?: PointItemStyle;
  label?: PointLabelOption;
}

export function emptyCartesianOption(ctx: ChartContext): EChartsOption {
  return {
    ...baseOption(ctx),
    legend: { show: false },
    series: [],
  };
}

export function detectTimeGrain(points: readonly WidgetPoint[]): 'DAY' | 'MONTH' | 'MONTH_YEAR' {
  if (points.length === 0) return 'DAY';
  const monthKeys = points
    .map((p) => p.key)
    .filter((k) => /^\d{4}-\d{2}$/.test(k));
  if (monthKeys.length === points.length) {
    const years = new Set(monthKeys.map((k) => k.slice(0, 4)));
    return years.size > 1 ? 'MONTH_YEAR' : 'MONTH';
  }
  return 'DAY';
}

export function pointLabel(
  point: WidgetPoint,
  shape: WidgetExecution['shape'],
  grain: 'DAY' | 'MONTH' | 'MONTH_YEAR',
  ctx: ChartContext,
): string {
  if (shape === 'TIME_SERIES') {
    const raw = point.start ?? point.key;
    if (/^\d{4}-\d{2}/.test(raw)) {
      return formatShortDate(raw, ctx.lang, grain, ctx.t);
    }
    return point.label || raw;
  }
  if (point.label) return point.label;
  return point.key === 'UNSPECIFIED' ? ctx.t('table.unspecified') : point.key;
}

export function categoryLabels(
  exec: WidgetExecution,
  series: readonly WidgetSeries[],
  ctx: ChartContext,
): string[] {
  const basePoints = series.find((s) => s.points.length > 0)?.points ?? [];
  const grain = detectTimeGrain(basePoints);
  return basePoints.map((p) => pointLabel(p, exec.shape, grain, ctx));
}

export function colorForSeries(series: WidgetSeries, index: number, ctx: ChartContext): string {
  return series.key === OTHER_SERIES_KEY ? ctx.colors.other : seriesColor(ctx, index);
}

export function hasComparison(series: WidgetSeries): boolean {
  return series.points.some((p) => p.previousValue !== undefined);
}

export function comparisonName(
  series: WidgetSeries,
  ctx: ChartContext,
  multipleWithComparison: boolean,
): string {
  const prev = ctx.t('previous');
  return multipleWithComparison ? `${series.label} (${prev})` : prev;
}

export function buildValueAxes(
  series: readonly WidgetSeries[],
  ctx: ChartContext,
  opts?: { percentMaxLeft?: boolean; percentMaxRight?: boolean; forceDualAxis?: boolean },
): ChartValueAxis | ChartValueAxis[] {
  const leftSeries = series.find((s) => s.axis !== 'RIGHT') ?? series[0];
  const rightSeries = series.find((s) => s.axis === 'RIGHT') ?? (opts?.forceDualAxis ? series[1] : undefined);

  const leftAxis = valueAxis(ctx, leftSeries?.unit ?? 'COUNT', {
    position: 'start',
    ...(opts?.percentMaxLeft ? { percentMax: true } : {}),
  });

  if (!rightSeries) {
    return leftAxis;
  }

  const rightAxis = valueAxis(ctx, rightSeries.unit, {
    position: 'end',
    ...(opts?.percentMaxRight ? { percentMax: true } : {}),
  });

  return [leftAxis, rightAxis];
}

export function collectReferences(exec: WidgetExecution): Reference[] {
  const refs: Reference[] = [];
  if (exec.result && 'references' in exec.result && exec.result.references) {
    refs.push(...exec.result.references);
  }
  if (exec.references?.length) {
    refs.push(...exec.references.filter((r) => !refs.some((x) => x.key === r.key)));
  }
  if (exec.target !== undefined && !refs.some((r) => r.kind === 'TARGET')) {
    refs.push({
      key: 'target',
      label: '',
      kind: 'TARGET',
      value: exec.target,
      unit: 'COUNT',
    });
  }
  return refs;
}

export function buildMarkLine(
  exec: WidgetExecution,
  ctx: ChartContext,
  opts?: { horizontal?: boolean },
): MarkLineComponentOption | undefined {
  const refs = collectReferences(exec);
  if (refs.length === 0) return undefined;

  const isHorizontal = opts?.horizontal === true;
  const data = refs.map((ref) => ({
    name: ref.label || ctx.t('target'),
    ...(isHorizontal ? { xAxis: ref.value } : { yAxis: ref.value }),
  }));

  return {
    symbol: 'none',
    silent: true,
    lineStyle: {
      color: ctx.colors.text,
      width: 2,
      type: 'solid',
    },
    label: {
      show: true,
      formatter: '{b}',
      color: ctx.colors.text,
      fontSize: 11,
      fontFamily: ctx.colors.fontUi,
    },
    data,
  };
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function wrapLtr(text: string): string {
  return `<bdi dir="ltr">${escapeHtml(text)}</bdi>`;
}

export function formatTooltipHtml(
  ctx: ChartContext,
  header: string,
  entries: readonly TooltipEntry[],
): string {
  const rows = entries
    .map(
      (entry) =>
        `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:2px;">` +
        `<span style="display:inline-flex;align-items:center;gap:6px;">${entry.marker ?? ''}${escapeHtml(entry.name)}</span>` +
        `<span style="font-weight:500;">${wrapLtr(entry.valueText)}</span>` +
        `</div>`,
    )
    .join('');

  return `<div dir="${ctx.dir}" style="font-family:${escapeHtml(ctx.colors.fontUi)};font-size:var(--fs-12);color:${escapeHtml(ctx.colors.text)};">` +
    (header ? `<div style="font-weight:var(--font-weight-medium);margin-bottom:var(--space-4);">${escapeHtml(header)}</div>` : '') +
    rows +
    `</div>`;
}

export function buildAxisTooltip(
  ctx: ChartContext,
  getUnitInfo: (seriesIndex: number) => { unit: SeriesUnit; currency?: string },
): NonNullable<EChartsOption['tooltip']> {
  const baseTooltip = baseOption(ctx).tooltip;
  const baseObj = Array.isArray(baseTooltip) ? baseTooltip[0] : baseTooltip;

  return {
    ...baseObj,
    trigger: 'axis',
    formatter: (params: unknown) => {
      const items = Array.isArray(params) ? params : [params];
      if (items.length === 0) return '';

      let header = '';
      const entries: TooltipEntry[] = [];

      for (const rawItem of items) {
        if (!rawItem || typeof rawItem !== 'object') continue;
        const p = rawItem as Record<string, unknown>;
        if (!header && typeof p['axisValueLabel'] === 'string') {
          header = p['axisValueLabel'];
        }
        const seriesIdx = typeof p['seriesIndex'] === 'number' ? p['seriesIndex'] : 0;
        const name = typeof p['seriesName'] === 'string' ? p['seriesName'] : '';
        const marker = typeof p['marker'] === 'string' ? p['marker'] : '';
        const rawData = p['data'];
        const numericVal = extractNumericValue(rawData, p['value']);
        const { unit, currency } = getUnitInfo(seriesIdx);
        const valueText =
          numericVal === null ? DASH : formatValue(numericVal, unit, currency, ctx.lang, ctx.t);
        entries.push({ marker, name, valueText });
      }

      return formatTooltipHtml(ctx, header, entries);
    },
  };
}

export function extractNumericValue(data: unknown, fallbackValue: unknown): number | null {
  const candidate =
    data && typeof data === 'object' && !Array.isArray(data) && 'value' in data
      ? (data as Record<string, unknown>)['value']
      : fallbackValue;
  return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : null;
}

export function toPointDatum(item: PointDataObject): PointDataObject {
  return item;
}

export function legendOption(ctx: ChartContext, show: boolean): EChartsOption['legend'] {
  const baseLegend = baseOption(ctx).legend;
  const legendObj = Array.isArray(baseLegend) ? baseLegend[0] : baseLegend;
  return {
    ...legendObj,
    show,
  };
}

export function cartesianGrid(
  hasLegend: boolean,
  hasAxisName = false,
): NonNullable<EChartsOption['grid']> {
  if (hasAxisName) {
    return {
      left: 8,
      right: 8,
      top: 28,
      bottom: 4,
      outerBoundsMode: 'same',
      outerBoundsContain: 'all',
    };
  }
  return {
    left: 8,
    right: 8,
    top: hasLegend ? 28 : 16,
    bottom: 4,
    containLabel: true,
  };
}

export function categoryXAxis(
  ctx: ChartContext,
  exec: WidgetExecution,
  labels: string[],
  boundaryGap = true,
) {
  return categoryAxis(ctx, labels, {
    time: exec.shape === 'TIME_SERIES',
    boundaryGap,
  });
}

export function findAlignedPoint(
  series: WidgetSeries,
  index: number,
  referenceKey?: string,
): WidgetPoint | undefined {
  const atIndex = series.points[index];
  if (referenceKey === undefined) return atIndex;
  if (atIndex && atIndex.key === referenceKey) return atIndex;
  return series.points.find((p) => p.key === referenceKey) ?? atIndex;
}

export function attachMarkLineToFirstSeries(
  seriesList: SeriesOption[],
  markLine: MarkLineComponentOption | undefined,
): void {
  if (!markLine || seriesList.length === 0) return;
  const first = seriesList[0];
  if (!first) return;
  (first as SeriesOption & { markLine?: MarkLineComponentOption }).markLine = markLine;
}

import type {
  ExactTable,
  ExecutionState,
  ResultShape,
  SeriesUnit,
  Visualization,
  WidgetExecution,
  WidgetPoint,
  WidgetSeries,
} from '../../../shared/ui/chart/chart.model';
import type { GridItem } from '../../../shared/widgets/dashboard/dashboard-grid/dashboard-grid';
import type {
  MetricUnit,
  Partition,
  PeriodComparison,
  Placement,
  Point,
  RunResult,
  Series,
  VisualizationDescriptor,
  WidgetResult,
} from './trade-dashboard.model';

export const TRADE_X = 4; // 1 Trade column = 4 CRM columns (12 -> 48)
export const TRADE_H = 5; // 1 Trade height unit = 5 CRM rows of 8px (40px)

const TRADE_MAX_COLS = 12;
const TRADE_MAX_H = 24;
const DAY_MS = 86_400_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MONEY_COLUMNS = new Set(['grandTotal']);
const NUMERIC_COLUMNS = new Set([
  'orderedQuantity',
  'receivedQuantity',
  'onHand',
  'reserved',
  'available',
]);

export interface GridRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AdapterContext {
  currentCompanyId: string;
  companyName: (id: string) => string;
  /** Base currency of a company, or null when unknown; decides which currency comes first in SCALAR. */
  companyCurrency: (id: string) => string | null;
  label: (labelKey: string) => string;
  column: (name: string) => string;
  /** Formats one cell; gets the whole row (with `currencyCode` filled from the partition) so money shows its own currency. */
  rowValue: (column: string, value: unknown, row: Record<string, unknown>) => string;
  widgetTitle: string;
  comparisonMode: PeriodComparison;
  normalized: RunResult['normalizedFilters'];
  generatedAt: string;
}

export interface AdaptedWidget {
  kind: Visualization;
  execution: WidgetExecution;
  table: ExactTable | null;
  tag: string | null;
  others: { companyId: string; currencyCode: string | null; value: string }[];
  asOf: string | null;
  errorCode: string | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export type GridSizeLimits = Pick<
  VisualizationDescriptor,
  'minimumWidth' | 'minimumHeight' | 'maximumWidth' | 'maximumHeight'
>;

export function toGridItem(
  p: { id: string; x: number; y: number; width: number; height: number },
  viz: GridSizeLimits,
): GridItem {
  return {
    id: p.id,
    x: p.x * TRADE_X,
    y: p.y * TRADE_H,
    w: p.width * TRADE_X,
    h: p.height * TRADE_H,
    minW: viz.minimumWidth * TRADE_X,
    minH: viz.minimumHeight * TRADE_H,
    maxW: viz.maximumWidth * TRADE_X,
    maxH: Math.min(viz.maximumHeight, TRADE_MAX_H) * TRADE_H,
  };
}

export function fromGridItem(g: GridItem): GridRect {
  const minWidth = Number.isFinite(g.minW)
    ? clamp(Math.round(g.minW / TRADE_X), 1, TRADE_MAX_COLS)
    : 1;
  const maxWidth =
    g.maxW !== undefined && Number.isFinite(g.maxW)
      ? clamp(Math.round(g.maxW / TRADE_X), minWidth, TRADE_MAX_COLS)
      : TRADE_MAX_COLS;

  const minHeight = Number.isFinite(g.minH)
    ? Math.max(1, Math.round(g.minH / TRADE_H))
    : 1;
  const maxHeight =
    g.maxH !== undefined && Number.isFinite(g.maxH)
      ? Math.max(minHeight, Math.min(TRADE_MAX_H, Math.round(g.maxH / TRADE_H)))
      : TRADE_MAX_H;

  const width = clamp(Math.round(g.w / TRADE_X), minWidth, maxWidth);
  const height = clamp(Math.round(g.h / TRADE_H), minHeight, maxHeight);
  const x = clamp(Math.round(g.x / TRADE_X), 0, TRADE_MAX_COLS - width);
  const y = Math.max(0, Math.round(g.y / TRADE_H));

  return { x, y, width, height };
}

export function snapItems(items: GridItem[]): GridItem[] {
  return items.map((item) => {
    const cell = fromGridItem(item);
    return {
      ...item,
      x: cell.x * TRADE_X,
      y: cell.y * TRADE_H,
      w: cell.width * TRADE_X,
      h: cell.height * TRADE_H,
    };
  });
}

export function overlaps(a: GridRect, b: GridRect): boolean {
  if (a.width <= 0 || a.height <= 0 || b.width <= 0 || b.height <= 0) {
    return false;
  }
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function mapState(result: WidgetResult | undefined): ExecutionState {
  if (!result) return 'FAILED';
  switch (result.status) {
    case 'READY':
    case 'LIMITED':
    case 'STALE':
      return 'READY';
    case 'EMPTY':
      return 'EMPTY';
    case 'UNAVAILABLE':
      return 'UNAVAILABLE';
    case 'FAILED': {
      const code = result.errorCode ?? '';
      return code === 'EXECUTION_BUDGET_EXCEEDED' || code.endsWith('.EXECUTION_BUDGET_EXCEEDED')
        ? 'DEADLINE_EXCEEDED'
        : 'FAILED';
    }
  }
}

function mapUnit(unit: MetricUnit | undefined): SeriesUnit {
  switch (unit) {
    case 'MONEY':
      return 'MONEY';
    case 'PERCENT':
      return 'PERCENT';
    case 'DURATION':
      return 'DURATION';
    case 'SCORE':
      return 'SCORE';
    case 'COUNT':
    case 'QUANTITY':
    default:
      return 'COUNT';
  }
}

function toNumber(raw: number | string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function partitionCurrency(p: Partition): string | null {
  const direct = p.currencyCode?.trim();
  if (direct) return direct;
  if (!p.series || p.series.length === 0) return null;

  const seriesCurrencies = p.series
    .map((s) => s.currencyCode?.trim())
    .filter((c): c is string => Boolean(c));
  if (seriesCurrencies.length !== p.series.length) return null;

  const unique = new Set(seriesCurrencies);
  return unique.size === 1 ? seriesCurrencies[0] : null;
}

function sharedCurrencyTag(partitions: readonly Partition[]): string | null {
  if (partitions.length === 0) return null;
  const currencies: string[] = [];
  for (const p of partitions) {
    const code = partitionCurrency(p);
    if (!code) return null;
    currencies.push(code);
  }
  return new Set(currencies).size === 1 ? currencies[0] : null;
}

function parseUtcYmd(ymd: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return { year, month, day };
}

function formatUtcYmd(ms: number): string {
  const d = new Date(ms);
  const y = String(d.getUTCFullYear()).padStart(4, '0');
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function shiftYearUtc(ymd: string): string {
  const parts = parseUtcYmd(ymd);
  if (!parts) return ymd;
  const targetYear = parts.year - 1;
  // Clamp Feb 29 to Feb 28 when shifting from a leap year into a non-leap year.
  const lastDayOfMonth = new Date(Date.UTC(targetYear, parts.month, 0)).getUTCDate();
  const clampedDay = Math.min(parts.day, lastDayOfMonth);
  return formatUtcYmd(Date.UTC(targetYear, parts.month - 1, clampedDay));
}

function computePreviousWindow(
  dateFrom: string,
  dateTo: string,
  mode: 'PREVIOUS_PERIOD' | 'PREVIOUS_YEAR',
): { from: string; to: string; fromInstant: string; toInstant: string } {
  let prevFrom = dateFrom;
  let prevTo = dateTo;

  if (mode === 'PREVIOUS_YEAR') {
    prevFrom = shiftYearUtc(dateFrom);
    prevTo = shiftYearUtc(dateTo);
  } else {
    const fromParts = parseUtcYmd(dateFrom);
    const toParts = parseUtcYmd(dateTo);
    if (fromParts && toParts) {
      const fromMs = Date.UTC(fromParts.year, fromParts.month - 1, fromParts.day);
      const toMs = Date.UTC(toParts.year, toParts.month - 1, toParts.day);
      const spanDays = Math.max(1, Math.round((toMs - fromMs) / DAY_MS) + 1);
      prevFrom = formatUtcYmd(fromMs - spanDays * DAY_MS);
      prevTo = formatUtcYmd(toMs - spanDays * DAY_MS);
    }
  }

  return {
    from: prevFrom,
    to: prevTo,
    fromInstant: `${prevFrom}T00:00:00.000Z`,
    toInstant: `${prevTo}T23:59:59.999Z`,
  };
}

function inferScalarUnit(
  placement: Placement,
  primary: Partition | undefined,
  currency: string | undefined,
): SeriesUnit {
  const seriesUnit = primary?.series?.[0]?.unit;
  if (seriesUnit) {
    return mapUnit(seriesUnit);
  }
  if (currency) {
    return 'MONEY';
  }
  const metricKey = placement.widget.querySpec.series[0]?.metricKey ?? '';
  if (metricKey.endsWith('_rate') || metricKey.endsWith('.rate')) {
    return 'PERCENT';
  }
  if (metricKey.includes('duration') || metricKey.includes('schedule')) {
    return 'DURATION';
  }
  if (metricKey.includes('score')) {
    return 'SCORE';
  }
  return 'COUNT';
}

function adaptScalar(
  placement: Placement,
  result: WidgetResult,
  ctx: AdapterContext,
  effectivePeriod: { from: string; to: string; timeZone: string },
  tag: string | null,
): AdaptedWidget {
  const kind: Visualization = placement.widget.visualizationType;
  const partitions = result.partitions;
  const primaryCompanyId = partitions.some((p) => p.companyId === ctx.currentCompanyId)
    ? ctx.currentCompanyId
    : partitions[0]?.companyId;

  const primaryPartitions = primaryCompanyId
    ? partitions.filter((p) => p.companyId === primaryCompanyId)
    : [];
  const otherCompanyPartitions = primaryCompanyId
    ? partitions.filter((p) => p.companyId !== primaryCompanyId)
    : [];

  const preferredCurrency = primaryCompanyId ? (ctx.companyCurrency(primaryCompanyId) ?? undefined) : undefined;
  const orderedPrimary = preferredCurrency
    ? [
        ...primaryPartitions.filter((p) => partitionCurrency(p) === preferredCurrency),
        ...primaryPartitions.filter((p) => partitionCurrency(p) !== preferredCurrency),
      ]
    : primaryPartitions;

  const primary = orderedPrimary[0];
  const rawPrimary = primary?.scalar ?? primary?.series?.[0]?.points[0]?.value;
  const value = toNumber(rawPrimary);
  const currency = primary ? (partitionCurrency(primary) ?? undefined) : undefined;
  const unit = inferScalarUnit(placement, primary, currency);

  const otherCurrencies: { currencyCode: string; value: number }[] = [];
  for (const extra of orderedPrimary.slice(1)) {
    const code = partitionCurrency(extra);
    const num = toNumber(extra.scalar ?? extra.series?.[0]?.points[0]?.value);
    if (code && num !== null) {
      otherCurrencies.push({ currencyCode: code, value: num });
    }
  }

  const others: { companyId: string; currencyCode: string | null; value: string }[] = [];
  for (const other of otherCompanyPartitions) {
    const raw = other.scalar ?? other.series?.[0]?.points[0]?.value;
    if (raw === undefined || raw === null) continue;
    const text = String(raw).trim();
    if (!text) continue;
    others.push({
      companyId: other.companyId,
      currencyCode: partitionCurrency(other),
      value: text,
    });
  }

  const compSeries =
    primary?.series?.find((s) => s.key === 'comparison') ?? primary?.series?.[0];
  const secondaryNum = toNumber(compSeries?.points[0]?.secondaryValue);
  const widgetCompMode = placement.widget.querySpec.comparison?.mode;

  let target: number | undefined;
  let previousValue: number | undefined;
  let comparison: WidgetExecution['comparison'];

  if (widgetCompMode === 'TARGET') {
    const resolvedTarget = secondaryNum ?? toNumber(placement.widget.querySpec.comparison?.target);
    if (resolvedTarget !== null) {
      target = resolvedTarget;
    }
  } else {
    const activeComparison: 'PREVIOUS_PERIOD' | 'PREVIOUS_YEAR' | null =
      ctx.comparisonMode !== 'NONE'
        ? ctx.comparisonMode
        : ctx.normalized.comparisonMode !== 'NONE'
          ? ctx.normalized.comparisonMode
          : widgetCompMode === 'PREVIOUS_PERIOD' || widgetCompMode === 'PREVIOUS_YEAR'
            ? widgetCompMode
            : null;

    if (activeComparison && secondaryNum !== null) {
      previousValue = secondaryNum;
      const absoluteChange = value !== null ? value - secondaryNum : undefined;
      const percentChange =
        value !== null && secondaryNum !== 0
          ? ((value - secondaryNum) / Math.abs(secondaryNum)) * 100
          : undefined;
      comparison = {
        type: activeComparison,
        previousValue,
        ...(absoluteChange !== undefined ? { absoluteChange } : {}),
        ...(percentChange !== undefined ? { percentChange } : {}),
        previousWindow: computePreviousWindow(
          ctx.normalized.dateFrom,
          ctx.normalized.dateTo,
          activeComparison,
        ),
      };
    }
  }

  const execution: WidgetExecution = {
    widgetId: placement.widgetId,
    widgetRevision: placement.widget.revision,
    state: 'READY',
    shape: 'SCALAR',
    value,
    ...(previousValue !== undefined ? { previousValue } : {}),
    ...(comparison ? { comparison } : {}),
    ...(target !== undefined ? { target } : {}),
    series: [],
    meta: {
      unit,
      ...(currency ? { currency } : {}),
      ...(otherCurrencies.length > 0 ? { otherCurrencies } : {}),
      effectivePeriod,
      generatedAt: ctx.generatedAt,
      warnings: [],
    },
  };

  return {
    kind,
    execution,
    table: null,
    tag,
    others,
    asOf: result.asOf ?? null,
    errorCode: result.errorCode ?? null,
  };
}

interface PartitionSeriesEntry {
  partition: Partition;
  series: Series;
  seriesCountInPartition: number;
}

function collectSeriesEntries(partitions: readonly Partition[]): PartitionSeriesEntry[] {
  const entries: PartitionSeriesEntry[] = [];
  for (const partition of partitions) {
    const list = partition.series ?? [];
    for (const series of list) {
      entries.push({
        partition,
        series,
        seriesCountInPartition: list.length,
      });
    }
  }
  return entries;
}

function buildSeriesLabel(
  entry: PartitionSeriesEntry,
  totalPartitions: number,
  placement: Placement,
  ctx: AdapterContext,
): string {
  const { partition, series, seriesCountInPartition } = entry;
  if (totalPartitions === 1 && seriesCountInPartition === 1) {
    return ctx.widgetTitle;
  }

  const querySeriesLabel =
    placement.widget.querySpec.series.find((q) => q.metricKey === series.key)?.label ??
    (ctx.label(series.key) || series.key);

  if (totalPartitions === 1) {
    return querySeriesLabel;
  }

  const currency = (series.currencyCode ?? partition.currencyCode)?.trim();
  const companyText = ctx.companyName(partition.companyId);
  const partitionText = currency ? `${companyText} · ${currency}` : companyText;
  return seriesCountInPartition > 1 ? `${partitionText} · ${querySeriesLabel}` : partitionText;
}

function buildSeriesKey(partition: Partition, series: Series): string {
  const currency = (series.currencyCode ?? partition.currencyCode ?? '').trim();
  return `${partition.companyId}:${currency}:${series.key}`;
}

function adaptAlignedSeries(
  shape: 'TIME_SERIES' | 'CATEGORY',
  placement: Placement,
  result: WidgetResult,
  ctx: AdapterContext,
  effectivePeriod: { from: string; to: string; timeZone: string },
  tag: string | null,
): AdaptedWidget {
  const entries = collectSeriesEntries(result.partitions);
  const keyToLabel = new Map<string, string>();
  const orderedKeys: string[] = [];

  for (const { series } of entries) {
    for (const pt of series.points) {
      if (!keyToLabel.has(pt.key)) {
        orderedKeys.push(pt.key);
        const ptLabel = shape === 'CATEGORY' && pt.labelKey ? ctx.label(pt.labelKey) : pt.key;
        keyToLabel.set(pt.key, ptLabel || pt.key);
      }
    }
  }

  if (
    shape === 'TIME_SERIES' &&
    orderedKeys.length > 1 &&
    orderedKeys.every((k) => /^\d{4}-\d{2}-\d{2}/.test(k))
  ) {
    orderedKeys.sort();
  }

  const totalPartitions = result.partitions.length;
  const widgetSeries: WidgetSeries[] = entries.map((entry) => {
    const byKey = new Map<string, Point>();
    for (const pt of entry.series.points) {
      byKey.set(pt.key, pt);
    }

    const currency = (entry.series.currencyCode ?? entry.partition.currencyCode)?.trim() || undefined;
    const points: WidgetPoint[] = orderedKeys.map((key) => {
      const pt = byKey.get(key);
      const label = keyToLabel.get(key) ?? key;
      if (!pt) {
        return { key, label, value: null };
      }
      const prev = toNumber(pt.secondaryValue);
      return {
        key,
        label,
        value: toNumber(pt.value),
        ...(prev !== null ? { previousValue: prev } : {}),
        ...(pt.occurredAt !== undefined ? { start: pt.occurredAt } : {}),
        ...(pt.meta ? { meta: pt.meta } : {}),
      };
    });

    return {
      key: buildSeriesKey(entry.partition, entry.series),
      label: buildSeriesLabel(entry, totalPartitions, placement, ctx),
      unit: mapUnit(entry.series.unit),
      axis: 'LEFT',
      ...(currency ? { currency } : {}),
      points,
    };
  });

  const execution: WidgetExecution = {
    widgetId: placement.widgetId,
    widgetRevision: placement.widget.revision,
    state: 'READY',
    shape,
    series: widgetSeries,
    meta: {
      ...(tag ? { currency: tag } : {}),
      effectivePeriod,
      generatedAt: ctx.generatedAt,
      warnings: [],
    },
  };

  return {
    kind: placement.widget.visualizationType,
    execution,
    table: null,
    tag,
    others: [],
    asOf: result.asOf ?? null,
    errorCode: result.errorCode ?? null,
  };
}

function adaptXy(
  placement: Placement,
  result: WidgetResult,
  ctx: AdapterContext,
  effectivePeriod: { from: string; to: string; timeZone: string },
  tag: string | null,
): AdaptedWidget {
  const entries = collectSeriesEntries(result.partitions);
  const totalPartitions = result.partitions.length;

  const widgetSeries: WidgetSeries[] = entries.map((entry) => {
    const currency = (entry.series.currencyCode ?? entry.partition.currencyCode)?.trim() || undefined;
    const points: WidgetPoint[] = entry.series.points.map((pt) => {
      const y = toNumber(pt.secondaryValue);
      const size = typeof pt.size === 'number' && Number.isFinite(pt.size) ? pt.size : undefined;
      return {
        key: pt.key,
        label: pt.key,
        value: toNumber(pt.value),
        ...(y !== null ? { secondaryValue: y } : {}),
        ...(size !== undefined ? { size } : {}),
        ...(pt.meta ? { meta: pt.meta } : {}),
      };
    });

    return {
      key: buildSeriesKey(entry.partition, entry.series),
      label: buildSeriesLabel(entry, totalPartitions, placement, ctx),
      unit: mapUnit(entry.series.unit),
      axis: 'LEFT',
      ...(currency ? { currency } : {}),
      points,
    };
  });

  return {
    kind: placement.widget.visualizationType,
    execution: {
      widgetId: placement.widgetId,
      widgetRevision: placement.widget.revision,
      state: 'READY',
      shape: 'XY',
      series: widgetSeries,
      meta: {
        ...(tag ? { currency: tag } : {}),
        effectivePeriod,
        generatedAt: ctx.generatedAt,
        warnings: [],
      },
    },
    table: null,
    tag,
    others: [],
    asOf: result.asOf ?? null,
    errorCode: result.errorCode ?? null,
  };
}

function adaptInterval(
  placement: Placement,
  result: WidgetResult,
  ctx: AdapterContext,
  effectivePeriod: { from: string; to: string; timeZone: string },
  tag: string | null,
): AdaptedWidget {
  const entries = collectSeriesEntries(result.partitions);
  const totalPartitions = result.partitions.length;

  const widgetSeries: WidgetSeries[] = entries.map((entry) => {
    const currency = (entry.series.currencyCode ?? entry.partition.currencyCode)?.trim() || undefined;
    const points: WidgetPoint[] = entry.series.points.map((pt) => {
      const startMs = pt.start ? Date.parse(pt.start) : Number.NaN;
      const endMs = pt.end ? Date.parse(pt.end) : Number.NaN;
      const durationMs =
        Number.isFinite(startMs) && Number.isFinite(endMs)
          ? Math.max(0, endMs - startMs)
          : toNumber(pt.value);
      const metaLabel = pt.meta?.['label'];
      const label = pt.labelKey
        ? ctx.label(pt.labelKey) || pt.key
        : typeof metaLabel === 'string' && metaLabel
          ? metaLabel
          : pt.key;

      return {
        key: pt.key,
        label,
        value: durationMs,
        ...(pt.start !== undefined ? { start: pt.start } : {}),
        ...(pt.end !== undefined ? { end: pt.end } : {}),
        ...(pt.meta ? { meta: pt.meta } : {}),
      };
    });

    return {
      key: buildSeriesKey(entry.partition, entry.series),
      label: buildSeriesLabel(entry, totalPartitions, placement, ctx),
      unit: mapUnit(entry.series.unit),
      axis: 'LEFT',
      ...(currency ? { currency } : {}),
      points,
    };
  });

  return {
    kind: placement.widget.visualizationType,
    execution: {
      widgetId: placement.widgetId,
      widgetRevision: placement.widget.revision,
      state: 'READY',
      shape: 'INTERVAL',
      series: widgetSeries,
      meta: {
        ...(tag ? { currency: tag } : {}),
        effectivePeriod,
        generatedAt: ctx.generatedAt,
        warnings: [],
      },
    },
    table: null,
    tag,
    others: [],
    asOf: result.asOf ?? null,
    errorCode: result.errorCode ?? null,
  };
}

function translateGraphStatus(raw: string, labelFn: (key: string) => string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const key = trimmed.includes('.') ? trimmed : `trade.document.status.${trimmed.toLowerCase()}`;
  return labelFn(key) || trimmed;
}

function adaptGraph(
  placement: Placement,
  result: WidgetResult,
  ctx: AdapterContext,
  effectivePeriod: { from: string; to: string; timeZone: string },
  tag: string | null,
): AdaptedWidget {
  const entries = collectSeriesEntries(result.partitions);
  const totalPartitions = result.partitions.length;

  const widgetSeries: WidgetSeries[] = entries.map((entry) => {
    const currency = (entry.series.currencyCode ?? entry.partition.currencyCode)?.trim() || undefined;
    const points: WidgetPoint[] = entry.series.points.map((pt) => {
      const [keySource, keyTarget] = pt.key.split(':');
      const rawSource = pt.source ?? keySource ?? '';
      const rawTarget = pt.target ?? keyTarget ?? '';
      const source = translateGraphStatus(rawSource, ctx.label);
      const target = translateGraphStatus(rawTarget, ctx.label);
      const edgeKey = pt.key || `${rawSource}:${rawTarget}`;

      return {
        key: edgeKey,
        label: `${source} -> ${target}`,
        value: toNumber(pt.value),
        meta: {
          ...(pt.meta ?? {}),
          source,
          target,
        },
      };
    });

    return {
      key: buildSeriesKey(entry.partition, entry.series),
      label: buildSeriesLabel(entry, totalPartitions, placement, ctx),
      unit: mapUnit(entry.series.unit),
      axis: 'LEFT',
      ...(currency ? { currency } : {}),
      points,
    };
  });

  return {
    kind: placement.widget.visualizationType,
    execution: {
      widgetId: placement.widgetId,
      widgetRevision: placement.widget.revision,
      state: 'READY',
      shape: 'GRAPH',
      series: widgetSeries,
      meta: {
        ...(tag ? { currency: tag } : {}),
        effectivePeriod,
        generatedAt: ctx.generatedAt,
        warnings: [],
      },
    },
    table: null,
    tag,
    others: [],
    asOf: result.asOf ?? null,
    errorCode: result.errorCode ?? null,
  };
}

function shortenUuidIfRaw(text: string): string {
  const trimmed = text.trim();
  if (!UUID_RE.test(trimmed)) return text;
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

function inferRowColumnUnit(
  colKey: string,
  partitions: readonly Partition[],
): SeriesUnit | 'TEXT' {
  if (MONEY_COLUMNS.has(colKey)) {
    return 'MONEY';
  }
  if (NUMERIC_COLUMNS.has(colKey)) {
    return 'COUNT';
  }
  for (const p of partitions) {
    for (const row of p.rows ?? []) {
      const sample = row[colKey];
      if (sample !== null && sample !== undefined) {
        return typeof sample === 'number' ? 'COUNT' : 'TEXT';
      }
    }
  }
  return 'TEXT';
}

function adaptRows(
  placement: Placement,
  result: WidgetResult,
  ctx: AdapterContext,
  effectivePeriod: { from: string; to: string; timeZone: string },
  tag: string | null,
): AdaptedWidget {
  const partitions = result.partitions;
  const multiPartition = partitions.length > 1;
  const metricKeys: string[] = [];
  const seenKeys = new Set<string>();

  for (const p of partitions) {
    for (const row of p.rows ?? []) {
      for (const key of Object.keys(row)) {
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          metricKeys.push(key);
        }
      }
    }
  }

  const includeCompanyColumn = multiPartition && !seenKeys.has('company');
  const columns: ExactTable['columns'] = [];

  if (includeCompanyColumn) {
    columns.push({
      key: 'company',
      label: ctx.column('company'),
      unit: 'TEXT',
    });
  }

  for (const key of metricKeys) {
    const unit = inferRowColumnUnit(key, partitions);
    columns.push({
      key,
      label: ctx.column(key),
      unit,
      ...(unit === 'MONEY' && tag ? { currency: tag } : {}),
    });
  }

  const tableRows: (string | number | null)[][] = [];
  const execRows: Record<string, unknown>[] = [];

  for (const p of partitions) {
    const companyText = ctx.companyName(p.companyId);
    const partitionCode = partitionCurrency(p);
    for (const rawRow of p.rows ?? []) {
      const rowWithCurrency: Record<string, unknown> =
        rawRow['currencyCode'] === undefined && partitionCode
          ? { ...rawRow, currencyCode: partitionCode }
          : rawRow;
      const tableRow: (string | number | null)[] = [];
      const execRow: Record<string, unknown> = {};

      if (includeCompanyColumn) {
        tableRow.push(companyText);
        execRow['company'] = companyText;
      }

      for (const key of metricKeys) {
        const rawVal = rawRow[key];
        const formatted = shortenUuidIfRaw(ctx.rowValue(key, rawVal, rowWithCurrency));
        const cellValue =
          formatted === '' && (rawVal === null || rawVal === undefined) ? null : formatted;
        tableRow.push(cellValue);
        execRow[key] = cellValue;
      }

      tableRows.push(tableRow);
      execRows.push(execRow);
    }
  }

  const table: ExactTable | null =
    columns.length > 0 ? { columns, rows: tableRows, totals: null } : null;

  return {
    kind: placement.widget.visualizationType,
    execution: {
      widgetId: placement.widgetId,
      widgetRevision: placement.widget.revision,
      state: 'READY',
      shape: 'ROWS',
      series: [],
      rows: execRows,
      meta: {
        ...(tag ? { currency: tag } : {}),
        effectivePeriod,
        generatedAt: ctx.generatedAt,
        warnings: [],
      },
    },
    table,
    tag,
    others: [],
    asOf: result.asOf ?? null,
    errorCode: result.errorCode ?? null,
  };
}

export function adaptWidget(
  placement: Placement,
  result: WidgetResult | undefined,
  ctx: AdapterContext,
): AdaptedWidget {
  const kind: Visualization = placement.widget.visualizationType;
  const effectivePeriod = {
    from: ctx.normalized.dateFrom,
    to: ctx.normalized.dateTo,
    timeZone: ctx.normalized.timeZone,
  };
  const errorCode = result?.errorCode ?? null;
  const asOf = result?.asOf ?? null;
  const state = mapState(result);

  if (!result || state !== 'READY') {
    const shape: ResultShape = result?.shape ?? 'SCALAR';
    return {
      kind,
      execution: {
        widgetId: placement.widgetId,
        widgetRevision: placement.widget.revision,
        state,
        shape,
        series: [],
        ...(errorCode ? { error: { code: errorCode } } : {}),
        meta: {
          effectivePeriod,
          generatedAt: ctx.generatedAt,
          warnings: [],
        },
      },
      table: null,
      tag: null,
      others: [],
      asOf,
      errorCode,
    };
  }

  const tag = sharedCurrencyTag(result.partitions);

  switch (result.shape) {
    case 'SCALAR':
      return adaptScalar(placement, result, ctx, effectivePeriod, tag);
    case 'TIME_SERIES':
    case 'CATEGORY':
      return adaptAlignedSeries(result.shape, placement, result, ctx, effectivePeriod, tag);
    case 'XY':
      return adaptXy(placement, result, ctx, effectivePeriod, tag);
    case 'INTERVAL':
      return adaptInterval(placement, result, ctx, effectivePeriod, tag);
    case 'GRAPH':
      return adaptGraph(placement, result, ctx, effectivePeriod, tag);
    case 'ROWS':
      return adaptRows(placement, result, ctx, effectivePeriod, tag);
  }
}

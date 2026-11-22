import { describe, expect, it } from 'vitest';
import type { ChartContext, Measure, P2Result, WidgetExecution, WidgetPoint, WidgetSeries } from './chart.model';
import { toExactTable } from './chart-table';

const ctx: ChartContext = {
  lang: 'en',
  dir: 'ltr',
  colors: {
    series: [], other: '', text: '', textMuted: '', border: '', borderField: '', surface: '',
    surfaceMuted: '', neutralSoft: '', brandSoft: '', accent: '', fontUi: '', fillOpacity: 0, linkOpacity: 0,
  },
  t: (key) => key,
};

const META = { generatedAt: '2026-11-21T09:00:00Z', warnings: [] };
const pt = (key: string, value: number | null, extra: Partial<WidgetPoint> = {}): WidgetPoint => ({ key, label: key, value, ...extra });
const ser = (key: string, points: WidgetPoint[], extra: Partial<WidgetSeries> = {}): WidgetSeries => ({
  key, label: key, unit: 'COUNT', axis: 'LEFT', points, ...extra,
});
const exec = (shape: WidgetExecution['shape'], series: WidgetSeries[], extra: Partial<WidgetExecution> = {}): WidgetExecution => ({
  widgetId: 'w', state: 'READY', shape, series, meta: META, ...extra,
});

describe('toExactTable series tables', () => {
  it('aligns a point by key when the series order differs', () => {
    const a = ser('a', [pt('x', 1), pt('y', 2)]);
    const b = ser('b', [pt('y', 20), pt('x', 10)]);
    const table = toExactTable('COLUMN', exec('CATEGORY', [a, b]), ctx);
    expect(table.rows).toEqual([['x', 1, 10], ['y', 2, 20]]);
  });

  it('yields null for a series missing a key', () => {
    const a = ser('a', [pt('x', 1), pt('y', 2)]);
    const b = ser('b', [pt('y', 20)]);
    const table = toExactTable('COLUMN', exec('CATEGORY', [a, b]), ctx);
    expect(table.rows[0]).toEqual(['x', 1, null]);
  });

  it('keeps rows that exist only in a later series (union of keys)', () => {
    const a = ser('a', [pt('x', 1)]);
    const b = ser('b', [pt('x', 5), pt('z', 9)]);
    const table = toExactTable('COLUMN', exec('CATEGORY', [a, b]), ctx);
    expect(table.rows.map((r) => r[0])).toEqual(['x', 'z']);
  });

  it('aligns large series by key without index assumptions', () => {
    const n = 2000;
    const keys = Array.from({ length: n }, (_, i) => `k${i}`);
    const a = ser('a', keys.map((k, i) => pt(k, i)));
    const b = ser('b', [...keys].reverse().map((k) => pt(k, Number(k.slice(1)) * 2)));
    const table = toExactTable('COLUMN', exec('CATEGORY', [a, b]), ctx);
    expect(table.rows).toHaveLength(n);
    expect(table.rows[0]).toEqual(['k0', 0, 0]);
    expect(table.rows[n - 1]).toEqual([`k${n - 1}`, n - 1, (n - 1) * 2]);
  });

  it('uses the first series that has points as the base when the first is empty', () => {
    const table = toExactTable('COLUMN', exec('CATEGORY', [ser('a', []), ser('b', [pt('x', 3)])]), ctx);
    expect(table.rows).toEqual([['x', null, 3]]);
  });

  it('returns an empty table when no series has points', () => {
    expect(toExactTable('COLUMN', exec('CATEGORY', [ser('a', [])]), ctx)).toEqual({ columns: [], rows: [], totals: null });
  });

  it('adds a previous column only for series that have previous values', () => {
    const a = ser('a', [pt('x', 1, { previousValue: 0 })]);
    const b = ser('b', [pt('x', 2)]);
    const table = toExactTable('COLUMN', exec('CATEGORY', [a, b]), ctx);
    expect(table.columns.map((c) => c.key)).toEqual(['category', 'a', 'a_prev', 'b']);
  });

  it('puts the currency in the money column header and column definition', () => {
    const a = ser('a', [pt('x', 1)], { unit: 'MONEY', currency: 'EGP', label: 'Revenue' });
    const col = toExactTable('COLUMN', exec('CATEGORY', [a]), ctx).columns[1];
    expect(col.label).toBe('Revenue (EGP)');
    expect(col.currency).toBe('EGP');
  });

  it('sums count columns into a totals row and skips money without currency', () => {
    const a = ser('a', [pt('x', 1), pt('y', 2)]);
    const b = ser('b', [pt('x', 4), pt('y', 5)], { unit: 'MONEY' });
    expect(toExactTable('COLUMN', exec('CATEGORY', [a, b]), ctx).totals).toEqual(['total', 3, null]);
  });

  it('has no totals row when no column is summable', () => {
    const a = ser('a', [pt('x', 1)], { unit: 'PERCENT' });
    expect(toExactTable('COLUMN', exec('CATEGORY', [a]), ctx).totals).toBeNull();
  });

  it('labels an UNSPECIFIED category with the translated key', () => {
    const a = ser('a', [{ key: 'UNSPECIFIED', label: '', value: 1 }]);
    expect(toExactTable('COLUMN', exec('CATEGORY', [a]), ctx).rows[0][0]).toBe('table.unspecified');
  });
});

describe('toExactTable time grain inference', () => {
  const timeTable = (keys: string[]) =>
    toExactTable('LINE', exec('TIME_SERIES', [ser('a', keys.map((k) => pt(k, 1)))]), ctx);

  it('shows month names only when all keys are months of one year', () => {
    expect(timeTable(['2026-01', '2026-02']).rows.map((r) => r[0])).toEqual(['Jan', 'Feb']);
  });

  it('adds the year when month keys span several years', () => {
    expect(timeTable(['2025-12', '2026-01']).rows.map((r) => r[0])).toEqual(['Dec 2025', 'Jan 2026']);
  });

  it('uses day grain for day keys', () => {
    expect(timeTable(['2026-01-05', '2026-01-06']).rows.map((r) => r[0])).toEqual(['Jan 5', 'Jan 6']);
  });

  it('uses day grain when month keys are mixed with day keys', () => {
    expect(timeTable(['2026-01', '2026-02-03']).rows.map((r) => r[0])).toEqual(['Jan 1', 'Feb 3']);
  });

  it('prefers the point start over the key for the label', () => {
    const a = ser('a', [pt('w1', 1, { start: '2026-03-09' })]);
    expect(toExactTable('LINE', exec('TIME_SERIES', [a]), ctx).rows[0][0]).toBe('Mar 9');
  });

  it('uses the period header for time series', () => {
    expect(timeTable(['2026-01']).columns[0].label).toBe('table.period');
  });
});

describe('toExactTable RANKED rows', () => {
  const measure = (key: string, value: number, unit: Measure['unit'] = 'COUNT', currencyCode?: string): Measure => ({
    key, label: key.toUpperCase(), value, unit, ...(currencyCode ? { currencyCode } : {}),
  });
  const ranked = (rows: { label: string; primary: Measure; secondary?: Measure[] }[]): WidgetExecution => {
    const result: P2Result = {
      shape: 'ROWS',
      rowKind: 'RANKED',
      rows: rows.map((r, i) => ({ id: `r${i}`, rank: i + 1, label: r.label, primaryMeasure: r.primary, secondaryMeasures: r.secondary ?? [] })),
    };
    return exec('ROWS', [], { result });
  };

  it('keeps raw numbers and the unit when every row agrees', () => {
    const table = toExactTable('LEADERBOARD', ranked([
      { label: 'A', primary: measure('m', 10, 'MONEY', 'EGP') },
      { label: 'B', primary: measure('m', 5, 'MONEY', 'EGP') },
    ]), ctx);
    expect(table.columns[2]).toEqual({ key: 'm', label: 'M', unit: 'MONEY', currency: 'EGP' });
    expect(table.rows).toEqual([[1, 'A', 10], [2, 'B', 5]]);
  });

  it('turns the column into TEXT and formats each cell when currency differs', () => {
    const table = toExactTable('LEADERBOARD', ranked([
      { label: 'A', primary: measure('m', 10, 'MONEY', 'EGP') },
      { label: 'B', primary: measure('m', 5, 'MONEY', 'USD') },
    ]), ctx);
    expect(table.columns[2].unit).toBe('TEXT');
    expect(table.rows.map((r) => r[2])).toEqual(['EGP 10', 'USD 5']);
  });

  it('turns the column into TEXT when the unit differs', () => {
    const table = toExactTable('LEADERBOARD', ranked([
      { label: 'A', primary: measure('m', 10, 'COUNT') },
      { label: 'B', primary: measure('m', 50, 'PERCENT') },
    ]), ctx);
    expect(table.rows.map((r) => r[2])).toEqual(['10', '50.0%']);
  });

  it('shows a dash for a row missing a mixed measure', () => {
    const table = toExactTable('LEADERBOARD', ranked([
      { label: 'A', primary: measure('m', 1, 'COUNT'), secondary: [measure('n', 1, 'COUNT')] },
      { label: 'B', primary: measure('m', 5, 'COUNT') },
      { label: 'C', primary: measure('m', 6, 'COUNT'), secondary: [measure('n', 2, 'PERCENT')] },
    ]), ctx);
    const nIdx = table.columns.findIndex((c) => c.key === 'n');
    expect(table.rows[1][nIdx]).toBe('—');
  });

  it('leaves a missing non-mixed measure as null', () => {
    const table = toExactTable('LEADERBOARD', ranked([
      { label: 'A', primary: measure('m', 1), secondary: [measure('n', 1)] },
      { label: 'B', primary: measure('m', 5) },
    ]), ctx);
    expect(table.rows[1]).toEqual([2, 'B', 5, null]);
  });

  it('matches measures by key, not position, across rows', () => {
    const table = toExactTable('LEADERBOARD', ranked([
      { label: 'A', primary: measure('m', 1), secondary: [measure('n', 2)] },
      { label: 'B', primary: measure('n', 3), secondary: [measure('m', 4)] },
    ]), ctx);
    expect(table.columns.map((c) => c.key)).toEqual(['rank', 'label', 'm', 'n']);
    expect(table.rows).toEqual([[1, 'A', 1, 2], [2, 'B', 4, 3]]);
  });

  it('returns an empty table when there are no ranked rows', () => {
    expect(toExactTable('LEADERBOARD', ranked([]), ctx)).toEqual({ columns: [], rows: [], totals: null });
  });
});

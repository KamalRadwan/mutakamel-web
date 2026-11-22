import { describe, expect, it } from 'vitest';
import type { ChartContext, SeriesUnit, WidgetSeries } from './chart.model';
import { OTHER_SERIES_KEY, limitSeries, seriesColor } from './chart-theme';

const ctx: ChartContext = {
  lang: 'en',
  dir: 'ltr',
  colors: {
    series: ['c1', 'c2', 'c3'],
    other: 'grey',
    text: '', textMuted: '', border: '', borderField: '', surface: '', surfaceMuted: '',
    neutralSoft: '', brandSoft: '', accent: '', fontUi: '', fillOpacity: 0.25, linkOpacity: 0.35,
  },
  t: (key) => (key === 'other' ? 'Other' : key),
};

interface Opts { unit?: SeriesUnit; currency?: string; values?: (number | null)[]; xy?: boolean }

function series(i: number, opts: Opts = {}): WidgetSeries {
  const values = opts.values ?? [i, i];
  return {
    key: `s${i}`,
    label: `S${i}`,
    unit: opts.unit ?? 'COUNT',
    axis: 'LEFT',
    ...(opts.currency ? { currency: opts.currency } : {}),
    points: values.map((v, idx) => ({
      key: `k${idx}`,
      label: `K${idx}`,
      value: v,
      ...(opts.xy ? { secondaryValue: 1 } : {}),
    })),
  };
}

const many = (n: number, opts?: Opts) => Array.from({ length: n }, (_, i) => series(i, opts));
const egp: Opts = { unit: 'MONEY', currency: 'EGP' };

describe('limitSeries', () => {
  it('returns a copy unchanged when there are ten series or fewer', () => {
    const input = many(10);
    const out = limitSeries(input, ctx);
    expect(out).toEqual(input);
    expect(out).not.toBe(input);
  });

  it('keeps nine series and appends one Other series for eleven', () => {
    const out = limitSeries(many(11), ctx);
    expect(out).toHaveLength(10);
    expect(out[9].key).toBe(OTHER_SERIES_KEY);
    expect(out[9].label).toBe('Other');
  });

  it('sums the tail values point by point into Other', () => {
    const out = limitSeries(many(11), ctx);
    expect(out[9].points.map((p) => p.value)).toEqual([19, 19]);
  });

  it('keeps the shared unit and currency when the tail is compatible', () => {
    const input = [...many(9, egp), series(9, egp), series(10, egp)];
    const other = limitSeries(input, ctx)[9];
    expect(other.unit).toBe('MONEY');
    expect(other.currency).toBe('EGP');
  });

  it('keeps tail-only point keys in Other (ordered union of keys)', () => {
    const tailOnly = series(10, { values: [5, 7] });
    tailOnly.points = [
      { key: 'k0', label: 'K0', value: 5 },
      { key: 'k9', label: 'K9', value: 7 },
    ];
    const input = [...many(10), tailOnly];
    const other = limitSeries(input, ctx)[9];
    expect(other.points.map((p) => p.key)).toEqual(['k0', 'k1', 'k9']);
    expect(other.points.map((p) => p.value)).toEqual([14, 9, 7]);
  });

  it('merges to gaps when the tail mixes units', () => {
    const input = [...many(9), series(9, { unit: 'COUNT' }), series(10, { unit: 'PERCENT' })];
    expect(limitSeries(input, ctx)[9].points.map((p) => p.value)).toEqual([null, null]);
  });

  it('merges to gaps when the tail mixes currencies', () => {
    const input = [...many(9, egp), series(9, egp), series(10, { unit: 'MONEY', currency: 'USD' })];
    expect(limitSeries(input, ctx)[9].points.map((p) => p.value)).toEqual([null, null]);
  });

  it('falls back to the head unit and currency for a mixed tail', () => {
    const input = [...many(9, egp), series(9, { unit: 'COUNT' }), series(10, { unit: 'PERCENT' })];
    const other = limitSeries(input, ctx)[9];
    expect(other.unit).toBe('MONEY');
    expect(other.currency).toBe('EGP');
  });

  it('does not merge a gap-only tail into zero', () => {
    const input = [...many(9), series(9, { values: [null, null] }), series(10, { values: [null, null] })];
    expect(limitSeries(input, ctx)[9].points.map((p) => p.value)).toEqual([null, null]);
  });

  it('keeps scatter tail points unchanged instead of summing them', () => {
    const input = [...many(9, { xy: true }), series(9, { xy: true, values: [5, 6] }), series(10, { xy: true, values: [7, 8] })];
    const other = limitSeries(input, ctx)[9];
    expect(other.points.map((p) => p.value)).toEqual([5, 6, 7, 8]);
    expect(other.points.every((p) => p.secondaryValue === 1)).toBe(true);
  });

  it('merges plain slice items into Other with the other color', () => {
    const slices = Array.from({ length: 12 }, (_, i) => ({ key: `p${i}`, label: `P${i}`, value: 1 }));
    const out = limitSeries(slices, ctx);
    expect(out).toHaveLength(10);
    expect(out[9]).toEqual({ key: OTHER_SERIES_KEY, label: 'Other', value: 3, color: 'grey' });
  });

  it('gives a null Other slice when every tail slice is null', () => {
    const slices = [
      ...Array.from({ length: 9 }, (_, i) => ({ key: `p${i}`, label: `P${i}`, value: 1 as number | null })),
      { key: 'a', label: 'A', value: null },
      { key: 'b', label: 'B', value: null },
    ];
    expect(limitSeries(slices, ctx)[9].value).toBeNull();
  });
});

describe('seriesColor', () => {
  it('wraps around the palette', () => {
    expect(seriesColor(ctx, 3)).toBe('c1');
  });

  it('wraps negative indexes', () => {
    expect(seriesColor(ctx, -1)).toBe('c3');
  });

  it('returns the other color for an empty palette', () => {
    expect(seriesColor({ ...ctx, colors: { ...ctx.colors, series: [] } }, 0)).toBe('grey');
  });
});

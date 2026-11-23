import { describe, expect, it } from 'vitest';
import type { GridItem } from '../../../shared/widgets/dashboard/dashboard-grid/dashboard-grid';
import {
  shareTargetName,
  type Partition,
  type Placement,
  type RunResult,
  type WidgetResult,
} from './trade-dashboard.model';
import {
  TRADE_H,
  TRADE_X,
  adaptWidget,
  fromGridItem,
  overlaps,
  snapItems,
  toGridItem,
  type AdapterContext,
} from './trade-widget-adapter';

const VIZ = { minimumWidth: 2, minimumHeight: 2, maximumWidth: 12, maximumHeight: 24 };

function gridItem(x: number, y: number, w: number, h: number): GridItem {
  return { ...toGridItem({ id: 'p1', x: 0, y: 0, width: 3, height: 4 }, VIZ), x, y, w, h };
}

function placement(visualizationType: string, metricKey = 'trade.sales_orders.count'): Placement {
  return {
    id: 'p1',
    widgetId: 'w1',
    x: 0,
    y: 0,
    width: 3,
    height: 4,
    widget: {
      id: 'w1',
      name: 'Widget',
      revision: 1,
      visualizationType,
      displaySpec: {},
      querySpec: { series: [{ metricKey }] },
    },
  } as unknown as Placement;
}

const NORMALIZED = {
  datePreset: 'CURRENT_MONTH',
  dateFrom: '2026-11-01',
  dateTo: '2026-11-30',
  timeZone: 'Africa/Cairo',
  today: '2026-11-21',
  comparisonMode: 'NONE',
  currencyCodes: [],
  itemIds: [],
  clauses: [],
  matchNone: false,
} as RunResult['normalizedFilters'];

function ctx(over: Partial<AdapterContext> = {}): AdapterContext {
  return {
    currentCompanyId: 'c1',
    companyName: (id) => `name-${id}`,
    companyCurrency: (id) => ({ c1: 'EGP', c2: 'SAR' })[id] ?? null,
    label: (k) => k,
    column: (n) => n,
    rowValue: (_col, value) => String(value ?? ''),
    widgetTitle: 'Widget',
    comparisonMode: 'NONE',
    normalized: NORMALIZED,
    generatedAt: '2026-11-21T10:00:00.000Z',
    ...over,
  };
}

function result(over: Partial<WidgetResult>): WidgetResult {
  return {
    widgetId: 'w1',
    status: 'READY',
    shape: 'SCALAR',
    metricVersions: {},
    sourceOwners: [],
    sourceEpochs: [],
    completeness: 'COMPLETE',
    partitions: [],
    warnings: [],
    ...over,
  };
}

function scalarPartition(companyId: string, scalar: string, currencyCode?: string): Partition {
  return { companyId, branchIds: [], scalar, ...(currencyCode ? { currencyCode } : {}) };
}

function seriesPartition(companyId: string, values: Record<string, number>, currencyCode?: string): Partition {
  return {
    companyId,
    branchIds: [],
    ...(currencyCode ? { currencyCode } : {}),
    series: [
      {
        key: 'm',
        unit: currencyCode ? 'MONEY' : 'COUNT',
        points: Object.entries(values).map(([key, value]) => ({ key, value })),
      },
    ],
  };
}

describe('grid mapping', () => {
  it('toGridItem(fromGridItem(g)) is stable and snaps to 4/5', () => {
    const original = toGridItem({ id: 'p1', x: 2, y: 3, width: 3, height: 4 }, VIZ);
    expect(original).toMatchObject({ x: 2 * TRADE_X, y: 3 * TRADE_H, w: 3 * TRADE_X, h: 4 * TRADE_H });

    const cell = fromGridItem(original);
    expect(cell).toEqual({ x: 2, y: 3, width: 3, height: 4 });

    const again = toGridItem({ id: 'p1', x: cell.x, y: cell.y, width: cell.width, height: cell.height }, VIZ);
    expect(again).toEqual(original);
    expect(snapItems([original])[0]).toEqual(original);
  });

  it('snaps an off-grid item to the nearest Trade cell', () => {
    const [snapped] = snapItems([gridItem(9, 11, 13, 21)]);
    expect(snapped).toMatchObject({ x: 2 * TRADE_X, y: 2 * TRADE_H, w: 3 * TRADE_X, h: 4 * TRADE_H });
  });

  it('keyboard step of 1 snaps back (why the grid needs a 4/5 step); a whole cell moves', () => {
    const base = gridItem(8, 10, 12, 20);

    const [oneColumn] = snapItems([{ ...base, x: base.x + 1 }]);
    expect(oneColumn.x).toBe(base.x);
    const [oneRow] = snapItems([{ ...base, y: base.y + 1 }]);
    expect(oneRow.y).toBe(base.y);
    const [oneWider] = snapItems([{ ...base, w: base.w + 1 }]);
    expect(oneWider.w).toBe(base.w);

    const [cellRight] = snapItems([{ ...base, x: base.x + TRADE_X }]);
    expect(cellRight.x).toBe(base.x + TRADE_X);
    const [cellDown] = snapItems([{ ...base, y: base.y + TRADE_H }]);
    expect(cellDown.y).toBe(base.y + TRADE_H);
    const [cellWider] = snapItems([{ ...base, w: base.w + TRADE_X }]);
    expect(cellWider.w).toBe(base.w + TRADE_X);
  });

  it('keeps the item inside the 12 Trade columns', () => {
    const cell = fromGridItem(gridItem(44, 0, 12, 20));
    expect(cell.x + cell.width).toBeLessThanOrEqual(12);
  });

  it('detects overlap and treats touching edges as free', () => {
    const a = { x: 0, y: 0, width: 3, height: 3 };
    expect(overlaps(a, { x: 2, y: 2, width: 3, height: 3 })).toBe(true);
    expect(overlaps(a, { x: 3, y: 0, width: 3, height: 3 })).toBe(false);
    expect(overlaps(a, { x: 0, y: 3, width: 3, height: 3 })).toBe(false);
  });
});

describe('adaptWidget statuses', () => {
  const states: [WidgetResult['status'], string | undefined, string][] = [
    ['READY', undefined, 'READY'],
    ['EMPTY', undefined, 'EMPTY'],
    ['UNAVAILABLE', undefined, 'UNAVAILABLE'],
    ['FAILED', undefined, 'FAILED'],
    ['FAILED', 'EXECUTION_BUDGET_EXCEEDED', 'DEADLINE_EXCEEDED'],
    ['LIMITED', undefined, 'READY'],
    ['STALE', undefined, 'READY'],
  ];

  it.each(states)('%s (%s) maps to %s', (status, errorCode, expected) => {
    const res = result({
      status,
      ...(errorCode ? { errorCode } : {}),
      partitions: [scalarPartition('c1', '5')],
    });
    expect(adaptWidget(placement('METRIC_CARD'), res, ctx()).execution.state).toBe(expected);
  });

  it('a missing result is FAILED', () => {
    expect(adaptWidget(placement('METRIC_CARD'), undefined, ctx()).execution.state).toBe('FAILED');
  });
});

describe('adaptWidget shapes and no summing', () => {
  it('SCALAR shows the current company only and lists the other companies', () => {
    const res = result({
      partitions: [scalarPartition('c1', '10', 'EGP'), scalarPartition('c2', '7', 'SAR')],
    });
    const adapted = adaptWidget(placement('METRIC_CARD'), res, ctx());
    expect(adapted.execution.value).toBe(10);
    expect(adapted.others).toEqual([{ companyId: 'c2', currencyCode: 'SAR', value: '7' }]);
  });

  it('SCALAR puts the company currency first from the context, not a hard-coded map', () => {
    const res = result({
      partitions: [scalarPartition('c9', '3', 'USD'), scalarPartition('c9', '40', 'GBP')],
    });
    const gbpFirst = adaptWidget(
      placement('METRIC_CARD'),
      res,
      ctx({ currentCompanyId: 'c9', companyCurrency: () => 'GBP' }),
    );
    expect(gbpFirst.execution.value).toBe(40);

    const unknown = adaptWidget(
      placement('METRIC_CARD'),
      res,
      ctx({ currentCompanyId: 'c9', companyCurrency: () => null }),
    );
    expect(unknown.execution.value).toBe(3);
    expect(unknown.execution.meta.otherCurrencies).toEqual([{ currencyCode: 'GBP', value: 40 }]);
  });

  it('TIME_SERIES keeps one series per company and never adds them up', () => {
    const res = result({
      shape: 'TIME_SERIES',
      partitions: [
        seriesPartition('c1', { '2026-11-01': 2, '2026-11-02': 3 }, 'EGP'),
        seriesPartition('c2', { '2026-11-01': 5, '2026-11-02': 7 }, 'SAR'),
      ],
    });
    const adapted = adaptWidget(placement('LINE'), res, ctx());
    expect(adapted.execution.series).toHaveLength(2);
    const values = adapted.execution.series.map((s) => s.points.map((p) => p.value));
    expect(values).toEqual([
      [2, 3],
      [5, 7],
    ]);
  });

  it('CATEGORY keeps one series per company and currency', () => {
    const res = result({
      shape: 'CATEGORY',
      partitions: [seriesPartition('c1', { open: 4, closed: 6 }), seriesPartition('c2', { open: 1, closed: 2 })],
    });
    const adapted = adaptWidget(placement('BAR'), res, ctx());
    expect(adapted.execution.series).toHaveLength(2);
    expect(adapted.execution.series.flatMap((s) => s.points.map((p) => p.value))).toEqual([4, 6, 1, 2]);
  });

  it('XY, INTERVAL and GRAPH results adapt to a READY execution', () => {
    const xy = result({
      shape: 'XY',
      partitions: [
        {
          companyId: 'c1',
          branchIds: [],
          series: [{ key: 'm', unit: 'COUNT', points: [{ key: 'a', value: 1, secondaryValue: 2 }] }],
        },
      ],
    });
    expect(adaptWidget(placement('SCATTER'), xy, ctx()).execution.state).toBe('READY');

    const interval = result({
      shape: 'INTERVAL',
      partitions: [
        {
          companyId: 'c1',
          branchIds: [],
          series: [
            {
              key: 'm',
              unit: 'COUNT',
              points: [{ key: 'a', value: 1, start: '2026-11-01T00:00:00Z', end: '2026-11-03T00:00:00Z' }],
            },
          ],
        },
      ],
    });
    expect(adaptWidget(placement('GANTT'), interval, ctx()).execution.state).toBe('READY');

    const graph = result({
      shape: 'GRAPH',
      partitions: [
        {
          companyId: 'c1',
          branchIds: [],
          series: [{ key: 'm', unit: 'COUNT', points: [{ key: 'a', value: 1, source: 'x', target: 'y' }] }],
        },
      ],
    });
    expect(adaptWidget(placement('FLOWCHART'), graph, ctx()).execution.state).toBe('READY');
  });

  it('ROWS gives rowValue the whole row, with the partition currency filled in', () => {
    const seen: { column: string; row: Record<string, unknown> }[] = [];
    const res = result({
      shape: 'ROWS',
      partitions: [
        {
          companyId: 'c1',
          branchIds: [],
          currencyCode: 'EGP',
          rows: [{ id: 'a', grandTotal: '12500' }],
        },
        {
          companyId: 'c2',
          branchIds: [],
          currencyCode: 'SAR',
          rows: [{ id: 'b', grandTotal: '300', currencyCode: 'SAR' }],
        },
      ],
    });
    const adapted = adaptWidget(
      placement('TABLE'),
      res,
      ctx({
        rowValue: (column, value, row) => {
          seen.push({ column, row });
          return column === 'grandTotal' ? `${String(row['currencyCode'])} ${String(value)}` : String(value);
        },
      }),
    );

    const money = seen.filter((s) => s.column === 'grandTotal').map((s) => s.row['currencyCode']);
    expect(money).toEqual(['EGP', 'SAR']);
    expect(adapted.table?.rows.map((r) => r[adapted.table!.columns.findIndex((c) => c.key === 'grandTotal')])).toEqual([
      'EGP 12500',
      'SAR 300',
    ]);
    expect(adapted.execution.rows).toHaveLength(2);
  });
});

describe('field-diff H-1 and H-2', () => {
  it('H-1: shareTargetName always shows name regardless of language or optional nameI18n', () => {
    expect(shareTargetName({ name: 'Rana Mansour' }, 'ar')).toBe('Rana Mansour');
    expect(
      shareTargetName({ name: 'Sales team', nameI18n: { en: 'Sales EN', ar: 'فريق المبيعات' } }, 'ar'),
    ).toBe('Sales team');
  });

  it('H-2: handles numeric and decimal-string Point.value and preserves alignment gap null', () => {
    const res = result({
      shape: 'TIME_SERIES',
      partitions: [
        {
          companyId: 'c1',
          branchIds: [],
          currencyCode: 'EGP',
          series: [
            {
              key: 'm',
              unit: 'MONEY',
              points: [
                { key: '2026-11-01', value: '12500.50' },
                { key: '2026-11-02', value: 300 },
              ],
            },
          ],
        },
        {
          companyId: 'c2',
          branchIds: [],
          currencyCode: 'SAR',
          series: [
            {
              key: 'm',
              unit: 'MONEY',
              points: [{ key: '2026-11-01', value: 100 }],
            },
          ],
        },
      ],
    });
    const adapted = adaptWidget(placement('LINE'), res, ctx());
    expect(adapted.execution.series[0].points.map((p) => p.value)).toEqual([12500.5, 300]);
    expect(adapted.execution.series[1].points.map((p) => p.value)).toEqual([100, null]);
  });
});

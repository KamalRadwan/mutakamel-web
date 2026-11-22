import type {
  ChartContext,
  ExactTable,
  P2Result,
  SeriesUnit,
  Visualization,
  WidgetExecution,
  WidgetPoint,
  WidgetSeries,
} from './chart.model';
import { readUnitDetail } from './chart-options/scatter';
import { DASH, formatShortDate, formatValue } from './chart-format';

type TableColumn = ExactTable['columns'][number];

function pointDisplayLabel(
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

function inferTimeGrain(points: readonly WidgetPoint[]): 'DAY' | 'MONTH' | 'MONTH_YEAR' {
  const keys = points.map((p) => p.key).filter((k) => /^\d{4}-\d{2}$/.test(k));
  if (keys.length === points.length && keys.length > 0) {
    const years = new Set(keys.map((k) => k.slice(0, 4)));
    return years.size > 1 ? 'MONTH_YEAR' : 'MONTH';
  }
  return 'DAY';
}

function isSummableUnit(unit: SeriesUnit | 'TEXT' | 'DATE' | undefined): boolean {
  return unit === 'COUNT' || unit === 'MONEY';
}

function sumColumn(rows: readonly (string | number | null)[][], colIndex: number): number | null {
  let hasNumber = false;
  let total = 0;
  for (const row of rows) {
    const cell = row[colIndex];
    if (typeof cell === 'number' && Number.isFinite(cell)) {
      hasNumber = true;
      total += cell;
    }
  }
  return hasNumber ? total : null;
}

function buildTotalsRow(
  columns: readonly TableColumn[],
  rows: readonly (string | number | null)[][],
  label: string,
): (string | number | null)[] | null {
  if (rows.length === 0 || columns.length < 2) return null;

  let anySummable = false;
  const totals: (string | number | null)[] = columns.map((col, idx) => {
    if (idx === 0) return label;
    if (!isSummableUnit(col.unit)) return null;
    if (col.unit === 'MONEY' && !col.currency) return null;
    const summed = sumColumn(rows, idx);
    if (summed !== null) anySummable = true;
    return summed;
  });

  return anySummable ? totals : null;
}

function codeLabel(ctx: ChartContext, group: 'eventKind' | 'severityValue' | 'statusValue', code: string): string {
  const key = `table.${group}.${code}`;
  const label = ctx.t(key);
  return label === key ? code : label;
}

function indexPoints(series: WidgetSeries): Map<string, WidgetPoint> {
  const byKey = new Map<string, WidgetPoint>();
  for (const p of series.points) {
    if (!byKey.has(p.key)) byKey.set(p.key, p);
  }
  return byKey;
}

function fromP2Result(result: P2Result, ctx: ChartContext): ExactTable {
  const { t, lang } = ctx;

  switch (result.shape) {
    case 'WATERFALL': {
      const unit = result.unit;
      const currency = result.currencyCode;
      const columns: TableColumn[] = [
        { key: 'label', label: t('table.item'), unit: 'TEXT' },
        { key: 'kind', label: t('table.kind'), unit: 'TEXT' },
        { key: 'value', label: t('value'), unit, ...(currency ? { currency } : {}) },
        { key: 'cumulative', label: t('table.cumulative'), unit, ...(currency ? { currency } : {}) },
      ];
      const sorted = [...result.steps].sort((a, b) => a.order - b.order);
      const rows = sorted.map((step) => {
        const kindLabel =
          step.kind === 'START'
            ? t('start')
            : step.kind === 'SUBTOTAL'
              ? t('subtotal')
              : step.kind === 'TOTAL'
                ? t('total')
                : step.value < 0
                  ? t('decrease')
                  : t('increase');
        return [step.label, kindLabel, step.value, step.cumulativeValue];
      });
      return { columns, rows, totals: null };
    }

    case 'BINNED_DISTRIBUTION': {
      const rank = { UNDERFLOW: 0, STANDARD: 1, OVERFLOW: 2 } as const;
      const sorted = [...result.bins].sort(
        (a, b) => rank[a.kind] - rank[b.kind] || a.order - b.order,
      );
      const columns: TableColumn[] = [
        { key: 'bin', label: t('table.bin'), unit: 'TEXT' },
        { key: 'count', label: t('count'), unit: 'COUNT' },
      ];
      const rows = sorted.map((b) => [b.label, b.count]);
      return { columns, rows, totals: buildTotalsRow(columns, rows, t('total')) };
    }

    case 'DURATION_DISTRIBUTION': {
      const columns: TableColumn[] = [
        { key: 'group', label: t('table.group'), unit: 'TEXT' },
        { key: 'samples', label: t('samples'), unit: 'COUNT' },
        { key: 'min', label: t('min'), unit: 'DURATION' },
        { key: 'q1', label: t('q1'), unit: 'DURATION' },
        { key: 'median', label: t('median'), unit: 'DURATION' },
        { key: 'q3', label: t('q3'), unit: 'DURATION' },
        { key: 'p90', label: t('p90'), unit: 'DURATION' },
        { key: 'max', label: t('max'), unit: 'DURATION' },
      ];
      const rows = result.groups.map((g) => [
        g.label,
        g.sampleCount,
        g.min,
        g.q1,
        g.median,
        g.q3,
        g.p90,
        g.max,
      ]);
      return { columns, rows, totals: null };
    }

    case 'HIERARCHY': {
      const byId = new Map(result.nodes.map((n) => [n.id, n]));
      const columns: TableColumn[] = [
        { key: 'label', label: t('table.item'), unit: 'TEXT' },
        { key: 'parent', label: t('table.parent'), unit: 'TEXT' },
        {
          key: 'value',
          label: t('value'),
          unit: result.unit,
          ...(result.currencyCode ? { currency: result.currencyCode } : {}),
        },
      ];
      const rows = result.nodes.map((node) => [
        node.label,
        node.parentId ? (byId.get(node.parentId)?.label ?? DASH) : DASH,
        node.value,
      ]);

      let totals: (string | number | null)[] | null = null;
      if (result.unit === 'COUNT' || (result.unit === 'MONEY' && result.currencyCode)) {
        const roots = result.nodes.filter((n) => !n.parentId || n.depth === 0);
        if (roots.length > 0) {
          const sum = roots.reduce((acc, n) => acc + n.value, 0);
          totals = [t('total'), null, sum];
        }
      }

      return { columns, rows, totals };
    }

    case 'EVENT_STREAM': {
      const columns: TableColumn[] = [
        { key: 'occurredAt', label: t('table.occurredAt'), unit: 'DATE' },
        { key: 'kind', label: t('table.kind'), unit: 'TEXT' },
        { key: 'title', label: t('table.title'), unit: 'TEXT' },
        { key: 'severity', label: t('table.severity'), unit: 'TEXT' },
      ];
      const rows = result.events.map((ev) => [
        ev.occurredAt,
        codeLabel(ctx, 'eventKind', ev.kind),
        lang === 'ar' && ev.titleAr ? ev.titleAr : ev.title,
        codeLabel(ctx, 'severityValue', ev.severity),
      ]);
      return { columns, rows, totals: null };
    }

    case 'ROWS': {
      if (result.rowKind === 'ALERT') {
        const columns: TableColumn[] = [
          { key: 'title', label: t('table.title'), unit: 'TEXT' },
          { key: 'severity', label: t('table.severity'), unit: 'TEXT' },
          { key: 'reason', label: t('table.reason'), unit: 'TEXT' },
          { key: 'occurredAt', label: t('table.occurredAt'), unit: 'DATE' },
          { key: 'dueAt', label: t('table.dueAt'), unit: 'DATE' },
        ];
        const rows = result.rows.map((r) => [
          r.title,
          codeLabel(ctx, 'severityValue', r.severity),
          ctx.reasonLabel ? ctx.reasonLabel(r.reasonCode) : r.reasonCode,
          r.occurredAt,
          r.dueAt ?? null,
        ]);
        return { columns, rows, totals: null };
      }

      if (result.rowKind === 'RANKED') {
        const first = result.rows[0];
        if (!first) return { columns: [], rows: [], totals: null };
        // Measures are matched by key. A column whose unit or currency differs between rows
        // becomes TEXT and each cell is formatted with its own unit and currency.
        const measureKeys = [first.primaryMeasure.key];
        const labels = new Map<string, string>([[first.primaryMeasure.key, first.primaryMeasure.label]]);
        for (const r of result.rows) {
          for (const m of [r.primaryMeasure, ...r.secondaryMeasures]) {
            if (!labels.has(m.key)) {
              labels.set(m.key, m.label);
              measureKeys.push(m.key);
            }
          }
        }
        const findMeasure = (r: (typeof result.rows)[number], key: string) =>
          r.primaryMeasure.key === key
            ? r.primaryMeasure
            : r.secondaryMeasures.find((m) => m.key === key);
        const measureColumns = measureKeys.map((key): { column: TableColumn; mixed: boolean } => {
          const found = result.rows.flatMap((r) => findMeasure(r, key) ?? []);
          const ref = found[0];
          const label = labels.get(key) ?? key;
          const mixed = found.some(
            (m) => m.unit !== ref.unit || m.currencyCode !== ref.currencyCode,
          );
          return {
            mixed,
            column: mixed
              ? { key, label, unit: 'TEXT' }
              : {
                  key,
                  label,
                  unit: ref.unit,
                  ...(ref.currencyCode ? { currency: ref.currencyCode } : {}),
                },
          };
        });
        const columns: TableColumn[] = [
          { key: 'rank', label: t('table.rank'), unit: 'COUNT' },
          { key: 'label', label: t('table.item'), unit: 'TEXT' },
          ...measureColumns.map((c) => c.column),
        ];
        const rows = result.rows.map((r) => [
          r.rank,
          r.label,
          ...measureColumns.map(({ column, mixed }) => {
            const m = findMeasure(r, column.key);
            if (!m) return mixed ? DASH : null;
            return mixed ? formatValue(m.value, m.unit, m.currencyCode, lang, t) : m.value;
          }),
        ]);
        return { columns, rows, totals: null };
      }

      // SCORECARD: each row can have a different unit/currency, so format measure cells individually.
      const first = result.rows[0];
      if (!first) return { columns: [], rows: [], totals: null };
      const hasTarget = result.rows.some((r) =>
        r.measures.some((m) => m.references?.some((ref) => ref.kind === 'TARGET')),
      );
      const columns: TableColumn[] = [
        { key: 'label', label: t('table.item'), unit: 'TEXT' },
        { key: 'value', label: t('value'), unit: 'TEXT' },
        ...(hasTarget ? [{ key: 'target', label: t('target'), unit: 'TEXT' as const }] : []),
        { key: 'status', label: t('table.status'), unit: 'TEXT' },
      ];
      const rows = result.rows.map((r) => {
        const primary = r.measures[0];
        const targetRef = primary?.references?.find((ref) => ref.kind === 'TARGET');
        const actualText = primary
          ? formatValue(primary.value, primary.unit, primary.currencyCode, lang, t)
          : DASH;
        const targetText =
          targetRef && primary
            ? formatValue(targetRef.value, targetRef.unit, targetRef.currencyCode, lang, t)
            : DASH;
        return [r.label, actualText, ...(hasTarget ? [targetText] : []), codeLabel(ctx, 'statusValue', r.status)];
      });
      return { columns, rows, totals: null };
    }
  }
}

function buildSeriesTable(exec: WidgetExecution, ctx: ChartContext): ExactTable {
  const { t } = ctx;
  const series = exec.series;
  if (series.length === 0) return { columns: [], rows: [], totals: null };

  const baseSeries = series.find((s) => s.points.length > 0) ?? series[0];
  if (!baseSeries || baseSeries.points.length === 0) {
    return { columns: [], rows: [], totals: null };
  }

  // Ordered union of keys across all series (first-seen order), so sparse series never drop rows.
  const refPoints = new Map<string, WidgetPoint>();
  for (const s of series) {
    for (const p of s.points) if (!refPoints.has(p.key)) refPoints.set(p.key, p);
  }
  const unionPoints = [...refPoints.values()];
  const grain = inferTimeGrain(unionPoints);
  const seriesHasPrev = series.map((s) => s.points.some((p) => p.previousValue !== undefined));

  const columns: TableColumn[] = [
    {
      key: 'category',
      label: exec.shape === 'TIME_SERIES' ? t('table.period') : t('table.category'),
      unit: 'TEXT',
    },
  ];

  series.forEach((s, idx) => {
    const header = s.unit === 'MONEY' && s.currency ? `${s.label} (${s.currency})` : s.label;
    columns.push({
      key: s.key || `series_${idx}`,
      label: header,
      unit: s.unit,
      ...(s.currency ? { currency: s.currency } : {}),
    });

    if (seriesHasPrev[idx]) {
      const prevHeader = series.length > 1 ? `${s.label} (${t('previous')})` : t('previous');
      columns.push({
        key: `${s.key || `series_${idx}`}_prev`,
        label: prevHeader,
        unit: s.unit,
        ...(s.currency ? { currency: s.currency } : {}),
      });
    }
  });

  const pointIndexes = series.map(indexPoints);
  const rows: (string | number | null)[][] = unionPoints.map((refPoint) => {
    const row: (string | number | null)[] = [
      pointDisplayLabel(refPoint, exec.shape, grain, ctx),
    ];

    series.forEach((s, seriesIdx) => {
      const pt = pointIndexes[seriesIdx]?.get(refPoint.key);
      row.push(pt?.value ?? null);
      if (seriesHasPrev[seriesIdx]) {
        row.push(pt?.previousValue ?? null);
      }
    });

    return row;
  });

  return { columns, rows, totals: buildTotalsRow(columns, rows, t('total')) };
}

export function toExactTable(
  kind: Visualization,
  exec: WidgetExecution,
  ctx: ChartContext,
): ExactTable {
  const { t, lang } = ctx;

  if (exec.result) {
    return fromP2Result(exec.result, ctx);
  }

  if (exec.shape === 'ROWS' && exec.rows && exec.rows.length > 0) {
    const keys = Object.keys(exec.rows[0] ?? {});
    const columns: TableColumn[] = keys.map((key) => {
      const sample = exec.rows?.find((r) => r[key] != null)?.[key];
      const unit: SeriesUnit | 'TEXT' = typeof sample === 'number' ? 'COUNT' : 'TEXT';
      return { key, label: key, unit };
    });
    const rows = exec.rows.map((r) =>
      keys.map((key) => {
        const val = r[key];
        if (typeof val === 'number' || typeof val === 'string') return val;
        return val == null ? null : String(val);
      }),
    );
    return { columns, rows, totals: null };
  }

  if (exec.shape === 'XY') {
    const multiSeries = exec.series.length > 1;
    const hasSize =
      kind === 'BUBBLE' || exec.series.some((s) => s.points.some((p) => p.size !== undefined));
    const xLabel =
      typeof exec.details?.['xLabel'] === 'string' && exec.details['xLabel']
        ? exec.details['xLabel']
        : t('table.x');
    const yLabel =
      typeof exec.details?.['yLabel'] === 'string' && exec.details['yLabel']
        ? exec.details['yLabel']
        : t('table.y');
    const first = exec.series[0];
    const columns: TableColumn[] = [
      ...(multiSeries ? [{ key: 'series', label: t('table.series'), unit: 'TEXT' as const }] : []),
      { key: 'label', label: t('table.item'), unit: 'TEXT' },
      { key: 'x', label: xLabel, unit: readUnitDetail(exec.details, 'xUnit', 'COUNT') },
      {
        key: 'y',
        label: yLabel,
        unit: first?.unit ?? 'COUNT',
        ...(first?.currency ? { currency: first.currency } : {}),
      },
      ...(hasSize ? [{ key: 'size', label: t('table.size'), unit: 'COUNT' as const }] : []),
    ];
    const rows: (string | number | null)[][] = [];
    for (const s of exec.series) {
      for (const p of s.points) {
        rows.push([
          ...(multiSeries ? [s.label] : []),
          p.label || p.key,
          p.value,
          p.secondaryValue ?? null,
          ...(hasSize ? [p.size ?? null] : []),
        ]);
      }
    }
    return { columns, rows, totals: null };
  }

  if (exec.shape === 'GRAPH') {
    const first = exec.series[0];
    const columns: TableColumn[] = [
      { key: 'source', label: t('table.source'), unit: 'TEXT' },
      { key: 'target', label: t('table.targetNode'), unit: 'TEXT' },
      {
        key: 'value',
        label: t('value'),
        unit: first?.unit ?? 'COUNT',
        ...(first?.currency ? { currency: first.currency } : {}),
      },
    ];
    const rows = (first?.points ?? []).map((p) => {
      const metaSource = typeof p.meta?.['source'] === 'string' ? p.meta['source'] : undefined;
      const metaTarget = typeof p.meta?.['target'] === 'string' ? p.meta['target'] : undefined;
      const [keySource, keyTarget] = p.key.split(':');
      return [metaSource ?? keySource ?? DASH, metaTarget ?? keyTarget ?? DASH, p.value];
    });
    return { columns, rows, totals: buildTotalsRow(columns, rows, t('total')) };
  }

  if (exec.shape === 'INTERVAL') {
    const multiSeries = exec.series.length > 1;
    const columns: TableColumn[] = [
      ...(multiSeries ? [{ key: 'series', label: t('table.series'), unit: 'TEXT' as const }] : []),
      { key: 'label', label: t('table.item'), unit: 'TEXT' },
      { key: 'start', label: t('table.start'), unit: 'DATE' },
      { key: 'end', label: t('table.end'), unit: 'DATE' },
      { key: 'duration', label: t('table.duration'), unit: 'DURATION' },
    ];
    const rows: (string | number | null)[][] = [];
    for (const s of exec.series) {
      for (const p of s.points) {
        const minutes =
          p.value !== null && Number.isFinite(p.value) ? Math.round(p.value / 60000) : null;
        rows.push([
          ...(multiSeries ? [s.label] : []),
          p.label || p.key,
          p.start ?? null,
          p.end ?? null,
          minutes,
        ]);
      }
    }
    return { columns, rows, totals: null };
  }

  if (exec.shape === 'SCALAR') {
    const breakdown = exec.meta.breakdown;
    if (breakdown && breakdown.length > 1) {
      const columns: TableColumn[] = [
        { key: 'currency', label: t('table.item'), unit: 'TEXT' },
        { key: 'value', label: t('value'), unit: 'TEXT' },
      ];
      const rows = breakdown.map((b) => [
        b.currencyCode,
        formatValue(b.value, 'MONEY', b.currencyCode, lang, t),
      ]);
      return { columns, rows, totals: null };
    }

    if (kind === 'MULTI_KPI' || exec.series.length > 1) {
      const first = exec.series[0];
      const uniform =
        first != null &&
        exec.series.every((s) => s.unit === first.unit && s.currency === first.currency);
      const columns: TableColumn[] = [
        { key: 'label', label: t('table.item'), unit: 'TEXT' },
        uniform && first
          ? {
              key: 'value',
              label: t('value'),
              unit: first.unit,
              ...(first.currency ? { currency: first.currency } : {}),
            }
          : { key: 'value', label: t('value'), unit: 'TEXT' },
      ];
      const rows = exec.series.map((s) => {
        const raw = s.points[0]?.value ?? null;
        return [
          s.label,
          uniform ? raw : formatValue(raw, s.unit, s.currency, lang, t),
        ];
      });
      return { columns, rows, totals: null };
    }

    const first = exec.series[0];
    const unit = first?.unit ?? (exec.meta.unit as SeriesUnit | undefined) ?? 'COUNT';
    const currency = first?.currency ?? exec.meta.currency;
    const scalarValue =
      exec.value !== undefined ? exec.value : (first?.points[0]?.value ?? null);
    const prevValue = exec.comparison?.previousValue ?? exec.previousValue;
    const targetValue = exec.target;

    const columns: TableColumn[] = [
      { key: 'label', label: t('table.item'), unit: 'TEXT' },
      { key: 'value', label: t('current'), unit, ...(currency ? { currency } : {}) },
      ...(prevValue !== undefined
        ? [{ key: 'previous', label: t('previous'), unit, ...(currency ? { currency } : {}) }]
        : []),
      ...(targetValue !== undefined
        ? [{ key: 'target', label: t('target'), unit, ...(currency ? { currency } : {}) }]
        : []),
    ];

    const row: (string | number | null)[] = [
      first?.label || t('value'),
      scalarValue,
      ...(prevValue !== undefined ? [prevValue] : []),
      ...(targetValue !== undefined ? [targetValue] : []),
    ];

    return { columns, rows: [row], totals: null };
  }

  return buildSeriesTable(exec, ctx);
}

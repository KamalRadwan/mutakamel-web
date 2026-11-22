import { Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import type { EntityRef, SeriesUnit, WidgetExecution } from '../../../../ui/chart/chart.model';
import { DASH, formatDate, formatNumber, formatValue } from '../../../../ui/chart/chart-format';
import { toExactTable } from '../../../../ui/chart/chart-table';
import { readChartColors } from '../../../../ui/chart/chart-theme';
import { DataColumn, DataTable } from '../../../../ui/data-table/data-table';

type TableRowRecord = Record<string, string | EntityRef | undefined> & {
  __key: string;
  __entityRef?: EntityRef;
};

interface TableViewModel {
  columns: DataColumn[];
  rows: TableRowRecord[];
  totals: Record<string, string> | null;
  hasClickable: boolean;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;

@Component({
  selector: 'app-kind-table',
  imports: [DataTable],
  providers: [
    provideTranslocoScope(
      { scope: 'dashboard-kinds', alias: 'dashboardKinds' },
      { scope: 'chart', alias: 'chart' },
    ),
  ],
  templateUrl: './table.html',
  host: { class: 'block size-full overflow-auto' },
})
export class TableKind {
  private readonly language = inject(LanguageState).current;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly kindsScope = toSignal(this.transloco.selectTranslation('dashboard-kinds'));
  private readonly chartScope = toSignal(this.transloco.selectTranslation('chart'));

  readonly execution = input.required<WidgetExecution>();
  readonly title = input('');
  readonly pointClick = output<{ pointKey: string; seriesKey?: string }>();
  readonly openRecord = output<EntityRef>();

  protected readonly rowKey = (row: TableRowRecord) => row.__key;

  protected readonly vm = computed<TableViewModel>(() => {
    this.i18n();
    this.kindsScope();
    this.chartScope();
    const exec = this.execution();
    const lang = this.language();

    const chartT = (key: string, params?: Record<string, unknown>) =>
      this.transloco.translate(`chart.${key}`, params);

    const exact = toExactTable('TABLE', exec, {
      lang,
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      colors: readChartColors(),
      t: chartT,
    });

    if (exact.columns.length === 0 || exact.rows.length === 0) {
      return { columns: [], rows: [], totals: null, hasClickable: false };
    }

    const columns: DataColumn[] = exact.columns.map((col, idx) => {
      const numeric = isNumericUnit(col.unit);
      return {
        key: col.key,
        label: col.label,
        width: idx === 0 && !numeric ? 1.5 : 1,
        align: numeric ? 'end' : 'start',
        numeric,
        sortable: false,
      };
    });

    let hasClickable = false;
    const rows: TableRowRecord[] = exact.rows.map((cells, rowIdx) => {
      const entityRef = extractEntityRef(exec, rowIdx);
      if (entityRef) hasClickable = true;

      const record: TableRowRecord = {
        __key: entityRef ? `${entityRef.type}:${entityRef.id}:${rowIdx}` : `row-${rowIdx}`,
        __entityRef: entityRef,
      };

      exact.columns.forEach((col, colIdx) => {
        record[col.key] = formatTableCell(
          cells[colIdx] ?? null,
          col.unit,
          col.currency,
          lang,
          chartT,
        );
      });

      return record;
    });

    const totals = buildTotalsRow(
      exact.columns,
      exact.totals ?? null,
      this.transloco.translate('dashboardKinds.total'),
      lang,
      chartT,
    );

    return { columns, rows, totals, hasClickable };
  });

  protected onRowClick(row: TableRowRecord) {
    if (row.__entityRef) {
      this.openRecord.emit(row.__entityRef);
    }
  }
}

function isNumericUnit(unit: SeriesUnit | 'TEXT' | 'DATE' | undefined): boolean {
  return unit !== undefined && unit !== 'TEXT' && unit !== 'DATE';
}

function formatTableCell(
  value: string | number | null,
  unit: SeriesUnit | 'TEXT' | 'DATE' | undefined,
  currency: string | undefined,
  lang: 'ar' | 'en',
  t: (key: string, params?: Record<string, unknown>) => string,
): string {
  if (value === null || value === undefined) {
    return DASH;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return DASH;
    if (unit && unit !== 'TEXT' && unit !== 'DATE') {
      return formatValue(value, unit, currency, lang, t);
    }
    return formatNumber(value, lang);
  }
  if (unit === 'DATE' && ISO_DATE_RE.test(value)) {
    return formatDate(value, lang, t);
  }
  return value;
}

function buildTotalsRow(
  columns: { key: string; unit?: SeriesUnit | 'TEXT' | 'DATE'; currency?: string }[],
  providedTotals: (string | number | null)[] | null,
  totalLabel: string,
  lang: 'ar' | 'en',
  t: (key: string, params?: Record<string, unknown>) => string,
): Record<string, string> | null {
  if (!providedTotals || providedTotals.length === 0) return null;

  const hasSummableColumn = columns.some(
    (col, idx) => idx > 0 && (col.unit === 'COUNT' || (col.unit === 'MONEY' && Boolean(col.currency))),
  );
  if (!hasSummableColumn) return null;

  const totals: Record<string, string> = {};
  columns.forEach((col, idx) => {
    if (idx === 0) {
      const first = providedTotals[0];
      totals[col.key] = typeof first === 'string' && first ? first : totalLabel;
      return;
    }

    const canTotal = col.unit === 'COUNT' || (col.unit === 'MONEY' && Boolean(col.currency));
    if (!canTotal) {
      totals[col.key] = isNumericUnit(col.unit) ? DASH : '';
      return;
    }

    const val = providedTotals[idx] ?? null;
    totals[col.key] =
      typeof val === 'number' && Number.isFinite(val)
        ? formatValue(val, col.unit as SeriesUnit, col.currency, lang, t)
        : DASH;
  });

  return totals;
}

function extractEntityRef(exec: WidgetExecution, rowIdx: number): EntityRef | undefined {
  const rawRow = exec.rows?.[rowIdx];
  if (rawRow) {
    const candidate = rawRow['entityRef'];
    if (isEntityRef(candidate)) return candidate;
  }

  const res = exec.result;
  if (!res) return undefined;
  if (res.shape === 'ROWS') {
    const item = res.rows[rowIdx];
    return item && 'entityRef' in item && isEntityRef(item.entityRef) ? item.entityRef : undefined;
  }
  if (res.shape === 'EVENT_STREAM') {
    const item = res.events[rowIdx];
    return item && isEntityRef(item.entityRef) ? item.entityRef : undefined;
  }
  if (res.shape === 'HIERARCHY') {
    const item = res.nodes[rowIdx];
    return item && isEntityRef(item.entityRef) ? item.entityRef : undefined;
  }
  return undefined;
}

function isEntityRef(value: unknown): value is EntityRef {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate['type'] === 'string' && typeof candidate['id'] === 'string';
}

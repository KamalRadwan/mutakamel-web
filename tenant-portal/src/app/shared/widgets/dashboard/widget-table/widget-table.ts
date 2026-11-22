import { Component, computed, inject, input } from '@angular/core';
import { LanguageState } from '../../../../core/i18n/language';
import { DASH, formatDate, formatValue } from '../../../ui/chart/chart-format';
import type { ExactTable, SeriesUnit } from '../../../ui/chart/chart.model';
import { DataTable, type DataColumn } from '../../../ui/data-table/data-table';

function isSeriesUnit(unit: SeriesUnit | 'TEXT' | 'DATE' | undefined): unit is SeriesUnit {
  return unit !== undefined && unit !== 'TEXT' && unit !== 'DATE';
}

function formatCell(
  raw: string | number | null | undefined,
  col: ExactTable['columns'][number],
  lang: 'ar' | 'en',
): string {
  if (raw === null || raw === undefined || raw === '') return DASH;
  if (col.unit === 'DATE') {
    return typeof raw === 'string' ? formatDate(raw, lang) : String(raw);
  }
  if (isSeriesUnit(col.unit)) {
    return typeof raw === 'number' ? formatValue(raw, col.unit, col.currency, lang) : String(raw);
  }
  return String(raw);
}

@Component({
  selector: 'app-widget-table',
  imports: [DataTable],
  templateUrl: './widget-table.html',
  host: { class: 'block size-full min-h-0 overflow-auto' },
})
export class WidgetTable {
  private readonly language = inject(LanguageState).current;

  readonly table = input.required<ExactTable>();
  readonly label = input('');

  protected readonly columns = computed<DataColumn[]>(() =>
    this.table().columns.map((col, index) => {
      const numeric = col.unit !== undefined && col.unit !== 'TEXT';
      return {
        key: col.key,
        label: col.label,
        width: index === 0 && !numeric ? 1.5 : 1,
        align: numeric ? 'end' : 'start',
        numeric,
      };
    }),
  );

  protected readonly rows = computed<Record<string, string>[]>(() => {
    const lang = this.language();
    const { columns: cols, rows: rawRows } = this.table();
    return rawRows.map((row, rowIndex) => {
      const record: Record<string, string> = {};
      for (let colIndex = 0; colIndex < cols.length; colIndex++) {
        const col = cols[colIndex];
        record[col.key] = formatCell(row[colIndex], col, lang);
      }
      record['__id'] = String(rowIndex);
      return record;
    });
  });

  protected readonly totals = computed<Record<string, string> | null>(() => {
    const lang = this.language();
    const { columns: cols, totals: rawTotals } = this.table();
    if (!rawTotals || rawTotals.length === 0) return null;
    const record: Record<string, string> = {};
    for (let colIndex = 0; colIndex < cols.length; colIndex++) {
      const col = cols[colIndex];
      record[col.key] = formatCell(rawTotals[colIndex], col, lang);
    }
    return record;
  });

  protected readonly rowKey = (row: Record<string, string>): string => row['__id'] ?? '';
}

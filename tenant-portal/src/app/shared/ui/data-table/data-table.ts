import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  Directive,
  TemplateRef,
  computed,
  contentChildren,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerArrowsSort, tablerSortAscending, tablerSortDescending } from '@ng-icons/tabler-icons';
import {
  Cell,
  ColumnDef,
  Header,
  RowData,
  SortingState,
  Updater,
  injectTable,
  rowSortingFeature,
  tableFeatures,
} from '@tanstack/angular-table';

export interface DataColumn {
  key: string;
  label: string;
  width?: number;
  align?: 'start' | 'end';
  numeric?: boolean;
  sortable?: boolean;
}

export interface DataSort {
  key: string;
  dir: 'asc' | 'desc';
}

export interface DataCellContext<T = unknown> {
  $implicit: T;
  column: DataColumn;
}

const TABLE_FEATURES = tableFeatures({
  rowSortingFeature,
  columnMeta: {} as DataColumn,
});

function readField(row: RowData, key: string): unknown {
  if (row !== null && typeof row === 'object') {
    return (row as Record<string, unknown>)[key];
  }
  return undefined;
}

@Directive({
  selector: 'ng-template[uiCell]',
})
export class DataCell {
  readonly key = input.required<string>({ alias: 'uiCell' });
  readonly template = inject<TemplateRef<DataCellContext<unknown>>>(TemplateRef);
}

@Component({
  selector: 'ui-data-table',
  imports: [NgIcon, NgTemplateOutlet],
  providers: [provideIcons({ tablerArrowsSort, tablerSortAscending, tablerSortDescending })],
  templateUrl: './data-table.html',
  host: { class: 'block min-w-0' },
})
export class DataTable<T = Record<string, unknown>> {
  readonly columns = input.required<readonly DataColumn[]>();
  readonly rows = input.required<readonly T[]>();
  readonly rowKey = input<((row: T) => string) | null>(null);
  readonly totals = input<Record<string, string> | null>(null);
  readonly loading = input(false);
  readonly emptyText = input('');
  readonly rowClickable = input(false);
  readonly label = input('');
  readonly sort = model<DataSort | null>(null);
  readonly rowClick = output<T>();

  private readonly cellTemplates = contentChildren(DataCell);

  protected readonly skeletonRows = [0, 1, 2, 3, 4] as const;

  protected readonly cellTemplateMap = computed(() => {
    const map = new Map<string, TemplateRef<DataCellContext<T>>>();
    for (const cell of this.cellTemplates()) {
      map.set(cell.key(), cell.template as TemplateRef<DataCellContext<T>>);
    }
    return map;
  });

  protected readonly gridColumns = computed(() =>
    this.columns()
      .map((col) => `minmax(0,${col.width ?? 1}fr)`)
      .join(' '),
  );

  private readonly columnDefs = computed<ColumnDef<typeof TABLE_FEATURES, RowData, unknown>[]>(() =>
    this.columns().map((col) => ({
      id: col.key,
      header: col.label,
      accessorFn: (row) => readField(row, col.key),
      enableSorting: Boolean(col.sortable),
      sortDescFirst: false,
      meta: col,
    })),
  );

  private readonly sortingState = computed<SortingState>(() => {
    const current = this.sort();
    return current ? [{ id: current.key, desc: current.dir === 'desc' }] : [];
  });

  protected readonly table = injectTable<typeof TABLE_FEATURES, RowData>(() => ({
    features: TABLE_FEATURES,
    data: this.rows() as unknown as readonly RowData[],
    columns: this.columnDefs(),
    state: { sorting: this.sortingState() },
    manualSorting: true,
    enableMultiSort: false,
    onSortingChange: (updater) => this.handleSortingChange(updater),
    getRowId: (originalRow, index) => this.resolveRowKey(originalRow as unknown as T, index),
  }));

  protected readonly headers = computed(() => this.table.getHeaderGroups()[0]?.headers ?? []);
  protected readonly tableRows = computed(() => this.table.getRowModel().rows);
  protected readonly ariaRowCount = computed(
    () => 1 + (this.loading() ? this.skeletonRows.length : this.tableRows().length + (this.totals() ? 1 : 0)),
  );

  private handleSortingChange(updater: Updater<SortingState>): void {
    const next = typeof updater === 'function' ? updater(this.sortingState()) : updater;
    const first = next[0];
    this.sort.set(first ? { key: first.id, dir: first.desc ? 'desc' : 'asc' } : null);
  }

  private resolveRowKey(row: T, index: number): string {
    const fn = this.rowKey();
    return fn ? fn(row) : String(index);
  }

  protected headerColumn(header: Header<typeof TABLE_FEATURES, RowData, unknown>, index: number): DataColumn {
    return header.column.columnDef.meta ?? this.columns()[index];
  }

  protected cellColumn(cell: Cell<typeof TABLE_FEATURES, RowData, unknown>, index: number): DataColumn {
    return cell.column.columnDef.meta ?? this.columns()[index];
  }

  protected isEndAligned(column: DataColumn): boolean {
    return column.align === 'end' || Boolean(column.numeric);
  }

  protected ariaSort(
    header: Header<typeof TABLE_FEATURES, RowData, unknown>,
    column: DataColumn,
  ): 'ascending' | 'descending' | 'none' | null {
    if (!column.sortable) return null;
    const dir = header.column.getIsSorted();
    if (dir === 'asc') return 'ascending';
    if (dir === 'desc') return 'descending';
    return 'none';
  }

  protected sortIcon(header: Header<typeof TABLE_FEATURES, RowData, unknown>): string {
    const dir = header.column.getIsSorted();
    if (dir === 'asc') return 'tablerSortAscending';
    if (dir === 'desc') return 'tablerSortDescending';
    return 'tablerArrowsSort';
  }

  protected toggleSort(header: Header<typeof TABLE_FEATURES, RowData, unknown>, column: DataColumn): void {
    if (!column.sortable) return;
    header.column.toggleSorting();
  }

  protected cellContext(row: RowData, column: DataColumn): DataCellContext<T> {
    return { $implicit: row as unknown as T, column };
  }

  protected formatCellValue(value: unknown): string {
    return value === null || value === undefined ? '—' : String(value);
  }

  protected totalValue(totals: Record<string, string>, key: string): string {
    return totals[key] ?? '';
  }

  protected onRowClick(row: RowData, event: MouseEvent): void {
    if (!this.rowClickable()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a, input, select, textarea, [role="button"], [role="menuitem"]')) {
      return;
    }
    this.rowClick.emit(row as unknown as T);
  }

  protected onRowKeydown(event: KeyboardEvent, row: RowData): void {
    if (!this.rowClickable() || event.target !== event.currentTarget) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      this.rowClick.emit(row as unknown as T);
    }
  }
}

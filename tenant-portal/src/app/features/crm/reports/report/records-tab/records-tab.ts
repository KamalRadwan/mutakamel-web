import {
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowsSort,
  tablerChevronLeft,
  tablerChevronRight,
  tablerChevronsLeft,
  tablerSortAscending,
  tablerSortDescending,
  tablerTable,
} from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import {
  Cell,
  ColumnDef,
  Header,
  PaginationState,
  RowData,
  SortingState,
  Updater,
  injectTable,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
} from '@tanstack/angular-table';
import { injectVirtualizer, observeElementRect } from '@tanstack/angular-virtual';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { ScopeState } from '../../../../../core/scope/scope';
import type { ChartContext, SeriesUnit } from '../../../../../shared/ui/chart/chart.model';
import {
  DASH,
  formatDate,
  formatDuration,
  formatMoney,
  formatNumber,
  formatPercent,
} from '../../../../../shared/ui/chart/chart-format';
import { DataColumn, DataSort, DataTable } from '../../../../../shared/ui/data-table/data-table';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { rectInPage } from '../../../../../shared/ui/overlay/zoom';
import { errorCodeOf, isAbortError, queueRun } from '../../../../../shared/widgets/dashboard/analytics-api';
import type { Panel, PanelManifest, PanelTable } from '../../../../../shared/widgets/dashboard/analytics.model';
import { getPanelRows } from '../report.api';
import type { PanelRowsPage, ReportRunRequest } from '../report.model';
import { ReportState } from '../report-state';
import { selectScopeTranslation } from '../../../../../shared/widgets/dashboard/scope-translation';
import { reportErrorMessage, reportLoadKind } from '../report-errors';
import type { FullStateKind } from '../../../../../shared/ui/full-state/full-state';
import { can } from '../../../../../shared/widgets/dashboard/analytics-permissions';

const PAGE_SIZES = [25, 50, 100] as const;
const DEFAULT_PAGE = 1;
const DEFAULT_SIZE = 25;
const VIRTUAL_ROW_ESTIMATE = 46;

type ColumnUnit = SeriesUnit | 'TEXT' | 'DATE';

interface CommittedSnapshot {
  panelKey: string;
  page: number;
  size: number;
  sort: DataSort | null;
  runSignature: string;
  lang: 'ar' | 'en';
}

const RECORDS_TABLE_FEATURES = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  columnMeta: {} as DataColumn,
});

function parsePage(raw: string | null | undefined): number {
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_PAGE;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : DEFAULT_PAGE;
}

function parsePageSize(raw: string | null | undefined): number {
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_SIZE;
  const parsed = Number(raw);
  return (PAGE_SIZES as readonly number[]).includes(parsed) ? parsed : DEFAULT_SIZE;
}

function isNumericUnit(unit: ColumnUnit | undefined): unit is SeriesUnit {
  return unit !== undefined && unit !== 'TEXT' && unit !== 'DATE';
}

function toFiniteNumber(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatCellValue(
  raw: unknown,
  unit: ColumnUnit | undefined,
  currency: string,
  lang: 'ar' | 'en',
  chartT: ChartContext['t'],
): string {
  if (raw === null || raw === undefined || raw === '') return DASH;

  switch (unit) {
    case 'MONEY': {
      const n = toFiniteNumber(raw);
      return n !== null ? formatMoney(n, currency) : String(raw);
    }
    case 'COUNT':
    case 'SCORE': {
      const n = toFiniteNumber(raw);
      return n !== null ? formatNumber(n, lang, Number.isInteger(n) ? 0 : 1) : String(raw);
    }
    case 'PERCENT': {
      const n = toFiniteNumber(raw);
      return n !== null ? formatPercent(n, 1) : String(raw);
    }
    case 'RATIO': {
      const n = toFiniteNumber(raw);
      return n !== null ? formatNumber(n, lang, 2) : String(raw);
    }
    case 'DURATION': {
      const n = toFiniteNumber(raw);
      return n !== null ? formatDuration(n, lang, chartT) : String(raw);
    }
    case 'DATE':
      return typeof raw === 'string' || typeof raw === 'number' || raw instanceof Date
        ? formatDate(raw, lang, chartT)
        : String(raw);
    case 'TEXT':
    default:
      return String(raw);
  }
}

function readRowField(row: RowData, key: string): unknown {
  if (row !== null && typeof row === 'object') {
    return (row as Record<string, unknown>)[key];
  }
  return undefined;
}

/** Report currency from the applied filters, then the company base currency; empty when unknown (no currency shown). */
function resolveCurrency(manifest: PanelManifest | null, request: ReportRunRequest, companyCurrency: string): string {
  // Confirm currency resolution per report in Phase 5 (facts §3.2).
  if (manifest) {
    const currencyDesc = manifest.filters.schema.find((desc) => desc.kind === 'CURRENCY');
    if (currencyDesc) {
      const applied = manifest.filters.applied.find((item) => item.key === currencyDesc.key);
      if (typeof applied?.value === 'string' && applied.value.trim()) {
        return applied.value.trim().toUpperCase();
      }
    }
    const appliedCurrency = manifest.filters.applied.find(
      (item) => item.key === 'currencyCode' || item.key === 'currency',
    );
    if (typeof appliedCurrency?.value === 'string' && appliedCurrency.value.trim()) {
      return appliedCurrency.value.trim().toUpperCase();
    }
  }
  const reqFilters = request.filters;
  if (reqFilters) {
    const candidate = reqFilters['currencyCode'] ?? reqFilters['currency'];
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim().toUpperCase();
    }
  }
  return companyCurrency.trim().toUpperCase();
}

function buildRowsScope(manifest: PanelManifest, request: ReportRunRequest): ReportRunRequest['scope'] | undefined {
  if (request.scope) return request.scope;
  const scope = manifest.scope;
  return {
    ...(scope.branchIds !== 'ALL' ? { branchIds: scope.branchIds } : {}),
    ownerMode: scope.ownerMode,
    basis: scope.basis,
    ...(scope.basis === 'AS_OF' && scope.asOf ? { asOf: scope.asOf } : {}),
  };
}

function buildRowsFilters(manifest: PanelManifest, request: ReportRunRequest): Record<string, unknown> | undefined {
  if (request.filters && Object.keys(request.filters).length > 0) {
    return request.filters;
  }
  if (!manifest.filters.applied.length) return undefined;
  const out: Record<string, unknown> = {};
  for (const item of manifest.filters.applied) {
    out[item.key] = item.value;
  }
  return out;
}

function findScrollParent(element: HTMLElement): HTMLElement {
  let current = element.parentElement;
  while (current) {
    if (current.tagName === 'MAIN') return current;
    const style = getComputedStyle(current);
    if (
      (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
      current.scrollHeight > current.clientHeight
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return element.closest('main') ?? element.ownerDocument.documentElement;
}

let nextRecordsId = 0;

@Component({
  selector: 'app-report-records-tab',
  imports: [NgIcon, TranslocoPipe, DataTable, Dropdown, Field, FullState],
  providers: [
    provideTranslocoScope(
      { scope: 'crm-rep-tabs', alias: 'repTabs' },
      { scope: 'analytics', alias: 'analytics' },
      { scope: 'chart', alias: 'chart' },
    ),
    provideIcons({
      tablerArrowsSort,
      tablerChevronLeft,
      tablerChevronRight,
      tablerChevronsLeft,
      tablerSortAscending,
      tablerSortDescending,
      tablerTable,
    }),
  ],
  templateUrl: './records-tab.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-8' },
})
export class RecordsTab {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly state = inject(ReportState);
  private readonly scope = inject(ScopeState);
  protected readonly language = inject(LanguageState).current;

  private readonly i18n = translationEvents(this.transloco);
  private readonly tabsScope = toSignal(selectScopeTranslation(this.transloco, 'crm-rep-tabs', 'repTabs'));
  private readonly analyticsScope = toSignal(this.transloco.selectTranslation('analytics'));
  private readonly chartScope = toSignal(this.transloco.selectTranslation('chart'));
  private readonly queryParams = toSignal(this.route.queryParamMap);
  private readonly virtualBodyRef = viewChild<ElementRef<HTMLElement>>('virtualBody');

  protected readonly uid = `report-records-${++nextRecordsId}`;
  protected readonly tableFieldId = `${this.uid}-table`;
  protected readonly pageSizes: number[] = [...PAGE_SIZES];
  protected readonly skeletonRows = [0, 1, 2, 3, 4] as const;

  protected readonly pageData = signal<PanelRowsPage | null>(null);
  protected readonly committedPage = signal(DEFAULT_PAGE);
  protected readonly committedSize = signal(DEFAULT_SIZE);
  protected readonly knownTotal = signal(0);
  protected readonly sort = signal<DataSort | null>(null);
  protected readonly loading = signal(false);
  /** A rows call was refused (429) and waits to retry: shown as a status line above the table. */
  /** Aborted when a newer fetch starts or the tab is destroyed: queued and retrying calls stop at once. */
  private fetchAbort = new AbortController();
  protected readonly initialFailed = signal(false);
  protected readonly loadKind = signal<FullStateKind>('load-failure');
  protected readonly loadMessage = signal('');
  protected readonly canViewReadiness = computed(() => can('crm.analytics.readiness.view'));
  private readonly retryTick = signal(0);

  private readonly scrollElement = signal<HTMLElement | undefined>(undefined);
  protected readonly virtualScrollMargin = signal(0);

  private cursors: (string | null)[] = [null];
  private exactTotal: number | null = null;
  private lastContextKey = '';
  private lastRunSignature = '';
  private fetchSeq = 0;
  private destroyed = false;
  private skipFetchKey: string | null = null;
  private committedSnapshot: CommittedSnapshot | null = null;

  protected readonly pageablePanels = computed<Panel[]>(() => {
    const panels = this.state.manifest()?.panels ?? [];
    const explicit = panels.filter((panel) => panel.pageable === true);
    if (explicit.length > 0) return explicit;
    return panels.filter((panel) => panel.pageable !== false && Boolean(panel.table));
  });

  protected readonly urlPanel = computed(() => this.queryParams()?.get('panel')?.trim() || null);
  protected readonly urlPage = computed(() => parsePage(this.queryParams()?.get('page')));
  protected readonly urlSize = computed(() => parsePageSize(this.queryParams()?.get('size')));

  protected readonly requestedPanelKey = computed(
    () => this.urlPanel() ?? this.pageablePanels()[0]?.panelKey ?? null,
  );

  protected readonly activePanel = computed<Panel | null>(() => {
    const key = this.requestedPanelKey();
    if (!key) return null;
    return this.state.manifest()?.panels.find((panel) => panel.panelKey === key) ?? null;
  });

  protected readonly showTablePicker = computed(() => this.pageablePanels().length > 1);
  protected readonly reconcilesFalse = computed(() => this.activePanel()?.table?.reconciles === false);
  protected readonly showReadonlyTableField = computed(
    () => this.pageablePanels().length === 1 && this.reconcilesFalse(),
  );
  protected readonly showTableField = computed(
    () => this.showTablePicker() || this.showReadonlyTableField(),
  );

  protected readonly activePanelTitle = computed(() => {
    const lang = this.language();
    const panel = this.activePanel() ?? this.pageablePanels()[0] ?? null;
    return panel ? panel.title[lang] : '';
  });

  protected readonly panelOptions = computed<DropdownOption<string>[]>(() => {
    const lang = this.language();
    return this.pageablePanels().map((panel) => ({
      value: panel.panelKey,
      label: panel.title[lang],
    }));
  });

  protected readonly currency = computed(() =>
    resolveCurrency(this.state.manifest(), this.state.request(), this.scope.company()?.currencyCode ?? ''),
  );

  private readonly chartTranslator = computed<ChartContext['t']>(() => {
    this.i18n();
    this.chartScope();
    return (key, params) => this.transloco.translate(`chart.${key}`, params);
  });

  protected readonly tableFieldHint = computed(() => {
    this.i18n();
    this.tabsScope();
    this.chartScope();
    const lang = this.language();
    const chartT = this.chartTranslator();
    const panel = this.activePanel();
    const table = panel?.table;
    const baseHint = this.showTablePicker()
      ? this.transloco.translate('repTabs.tableHint')
      : this.transloco.translate('repTabs.tableReadonlyHint');

    if (table?.reconciles !== false) {
      return baseHint;
    }

    const deltaMap = table.reconcileDelta ?? {};
    const cols = this.pageData()?.columns ?? table.columns ?? [];
    const currency = this.currency();
    const entries = Object.entries(deltaMap).filter(([, v]) => Number.isFinite(v));

    let reconcileMsg = this.transloco.translate('repTabs.reconcileHintGeneric');
    if (entries.length > 0) {
      const formattedParts = entries.map(([colKey, delta]) => {
        const col = cols.find((c) => c.key === colKey);
        const formatted = formatCellValue(delta, col?.unit, currency, lang, chartT);
        if (entries.length === 1) return formatted;
        const colLabel = col ? col.label[lang] : colKey;
        return `${colLabel}: ${formatted}`;
      });
      reconcileMsg = this.transloco.translate('repTabs.reconcileHint', {
        delta: formattedParts.join(', '),
      });
    }

    return this.showTablePicker() ? `${baseHint} — ${reconcileMsg}` : reconcileMsg;
  });

  private readonly rawColumns = computed<PanelTable['columns']>(() => {
    const fetched = this.pageData()?.columns;
    if (fetched && fetched.length > 0) return fetched;
    const manifestCols = this.activePanel()?.table?.columns;
    if (manifestCols && manifestCols.length > 0) return manifestCols;
    return [
      { key: 'col1', label: { en: '', ar: '' }, unit: 'TEXT' },
      { key: 'col2', label: { en: '', ar: '' }, unit: 'TEXT' },
      { key: 'col3', label: { en: '', ar: '' }, unit: 'TEXT' },
      { key: 'col4', label: { en: '', ar: '' }, unit: 'TEXT' },
    ];
  });

  protected readonly columns = computed<DataColumn[]>(() => {
    const lang = this.language();
    const raw = this.rawColumns();
    const hasRealColumns = Boolean(
      (this.pageData()?.columns?.length ?? 0) > 0 ||
        (this.activePanel()?.table?.columns?.length ?? 0) > 0,
    );

    return raw.map((col, index) => {
      const endAligned = isNumericUnit(col.unit);
      const numeric = endAligned && (col.unit !== 'DURATION' || lang === 'en');
      return {
        key: col.key,
        label: col.label[lang],
        width: index === 0 && !endAligned ? 1.6 : col.unit === 'MONEY' ? 1.3 : 1,
        align: endAligned ? 'end' : 'start',
        numeric,
        sortable: hasRealColumns,
      };
    });
  });

  protected readonly formattedRows = computed<Record<string, string>[]>(() => {
    const data = this.pageData();
    if (!data) return [];
    const lang = this.language();
    const currency = this.currency();
    const chartT = this.chartTranslator();
    const cols = data.columns;

    return data.rows.map((row, rowIndex) => {
      const record: Record<string, string> = {};
      for (let colIndex = 0; colIndex < cols.length; colIndex++) {
        const col = cols[colIndex];
        record[col.key] = formatCellValue(row[colIndex], col.unit, currency, lang, chartT);
      }
      record['__id'] = String(rowIndex);
      return record;
    });
  });

  protected readonly totals = computed<Record<string, string> | null>(() => {
    this.i18n();
    this.chartScope();
    const panelTable = this.activePanel()?.table;
    const rawTotals = panelTable?.totals;
    if (!rawTotals || rawTotals.length === 0) return null;
    const manifestCols = panelTable.columns ?? [];
    const activeCols = this.rawColumns();
    const lang = this.language();
    const currency = this.currency();
    const chartT = this.chartTranslator();

    const byKey = new Map<string, string>();
    for (let i = 0; i < manifestCols.length; i++) {
      const col = manifestCols[i];
      const rawVal = rawTotals[i];
      if (i === 0 && (col.unit === undefined || col.unit === 'TEXT') && (rawVal === null || rawVal === undefined || rawVal === '')) {
        byKey.set(col.key, this.transloco.translate('chart.total'));
      } else {
        byKey.set(col.key, formatCellValue(rawVal, col.unit, currency, lang, chartT));
      }
    }

    const record: Record<string, string> = {};
    for (let i = 0; i < activeCols.length; i++) {
      const col = activeCols[i];
      if (byKey.has(col.key)) {
        record[col.key] = byKey.get(col.key) ?? '';
      } else if (i < rawTotals.length) {
        const rawVal = rawTotals[i];
        record[col.key] =
          i === 0 && (col.unit === undefined || col.unit === 'TEXT') && (rawVal === null || rawVal === undefined || rawVal === '')
            ? this.transloco.translate('chart.total')
            : formatCellValue(rawVal, col.unit, currency, lang, chartT);
      } else {
        record[col.key] = '';
      }
    }
    return record;
  });

  private readonly columnDefs = computed<ColumnDef<typeof RECORDS_TABLE_FEATURES, RowData, unknown>[]>(() =>
    this.columns().map((col) => ({
      id: col.key,
      header: col.label,
      accessorFn: (row) => readRowField(row, col.key),
      enableSorting: Boolean(col.sortable),
      sortDescFirst: false,
      meta: col,
    })),
  );

  private readonly sortingState = computed<SortingState>(() => {
    const current = this.sort();
    return current ? [{ id: current.key, desc: current.dir === 'desc' }] : [];
  });

  private readonly paginationState = computed<PaginationState>(() => ({
    pageIndex: Math.max(0, this.committedPage() - 1),
    pageSize: this.committedSize(),
  }));

  protected readonly table = injectTable<typeof RECORDS_TABLE_FEATURES, RowData>(() => ({
    features: RECORDS_TABLE_FEATURES,
    data: this.formattedRows() as unknown as readonly RowData[],
    columns: this.columnDefs(),
    state: {
      sorting: this.sortingState(),
      pagination: this.paginationState(),
    },
    manualSorting: true,
    manualPagination: true,
    enableMultiSort: false,
    rowCount: this.knownTotal(),
    onSortingChange: (updater) => this.handleSortingChange(updater),
    onPaginationChange: (updater) => this.handlePaginationChange(updater),
    getRowId: (originalRow, index) => String((originalRow as Record<string, string>)['__id'] ?? index),
  }));

  protected readonly headers = computed(() => this.table.getHeaderGroups()[0]?.headers ?? []);
  protected readonly tableRows = computed(() => this.table.getRowModel().rows);
  protected readonly useVirtual = computed(() => this.committedSize() === 100);
  protected readonly isLoading = computed(() => this.loading() || (this.state.loading() && !this.state.manifest()));
  protected readonly hasNoPageableTables = computed(
    () =>
      Boolean(this.state.manifest()) &&
      !this.state.loading() &&
      this.pageablePanels().length === 0 &&
      !this.urlPanel(),
  );

  protected readonly gridColumns = computed(() =>
    this.columns()
      .map((col) => `minmax(0,${col.width ?? 1}fr)`)
      .join(' '),
  );

  protected readonly ariaRowCount = computed(
    () => 1 + (this.isLoading() ? this.skeletonRows.length : this.tableRows().length + (this.totals() ? 1 : 0)),
  );

  /** The rows endpoint returns no total (lead decision): the pager only knows whether another page exists. */
  protected readonly hasMoreRows = computed(() => this.pageData()?.pageInfo.hasMore === true);

  protected readonly pageSizeOptions = computed<DropdownOption<number>[]>(() => {
    this.i18n();
    this.tabsScope();
    return this.pageSizes.map((count) => ({
      value: count,
      label: this.transloco.translate('repTabs.perPage', { count }),
    }));
  });

  protected readonly showPagination = computed(
    () =>
      !this.initialFailed() &&
      !this.hasNoPageableTables() &&
      (this.isLoading() ? this.knownTotal() > 0 : this.formattedRows().length > 0),
  );

  protected readonly rowVirtualizer = injectVirtualizer<HTMLElement, HTMLElement>(() => ({
    scrollElement: this.scrollElement(),
    count: this.useVirtual() && !this.isLoading() ? this.tableRows().length : 0,
    estimateSize: () => VIRTUAL_ROW_ESTIMATE,
    scrollMargin: this.virtualScrollMargin(),
    overscan: 8,
    initialRect: { width: 1024, height: 768 },
    observeElementRect: (instance, cb) =>
      observeElementRect(instance, (rect) => {
        cb(rect.height > 0 ? rect : { width: rect.width || 1024, height: 768 });
      }),
    enabled: this.useVirtual(),
  }));

  protected readonly rowKey = (row: Record<string, string>): string => row['__id'] ?? '';

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.fetchAbort.abort();
    });

    afterRenderEffect(() => {
      this.useVirtual();
      this.showTableField();
      this.isLoading();
      this.tableRows();

      const hostEl = this.host.nativeElement;
      const scroller = findScrollParent(hostEl);
      if (scroller !== this.scrollElement()) {
        this.scrollElement.set(scroller);
      }

      const bodyEl = this.virtualBodyRef()?.nativeElement;
      if (bodyEl && scroller) {
        const margin = Math.max(
          0,
          Math.round(rectInPage(bodyEl).top - rectInPage(scroller).top + scroller.scrollTop),
        );
        if (margin !== this.virtualScrollMargin()) {
          this.virtualScrollMargin.set(margin);
        }
      }
    });

    effect(() => {
      const reportKey = this.state.reportKey();
      const manifest = this.state.manifest();
      const request = this.state.request();
      const panelKey = this.requestedPanelKey();
      const page = this.urlPage();
      const size = this.urlSize();
      const sort = this.sort();
      const lang = this.language();
      this.retryTick();

      if (!reportKey || !manifest) return;

      if (!panelKey) {
        untracked(() => {
          this.pageData.set(null);
          this.knownTotal.set(0);
          this.loading.set(false);
        });
        return;
      }

      const runSignature = `${manifest.receipts.runId}|${JSON.stringify(request)}`;
      const runChanged = Boolean(this.lastRunSignature && this.lastRunSignature !== runSignature);
      this.lastRunSignature = runSignature;

      if (runChanged && page !== DEFAULT_PAGE) {
        untracked(() => {
          this.cursors = [null];
          this.exactTotal = null;
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { page: null },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          });
        });
        return;
      }

      const contextKey = JSON.stringify({
        reportKey,
        panelKey,
        size,
        sort,
        runSignature,
        lang,
      });

      const fetchKey = JSON.stringify({ contextKey, page });
      if (this.skipFetchKey === fetchKey) {
        this.skipFetchKey = null;
        return;
      }

      if (contextKey !== this.lastContextKey) {
        this.cursors = [null];
        this.exactTotal = null;
        this.lastContextKey = contextKey;
      }

      untracked(() => {
        void this.loadTargetPage({
          reportKey,
          panelKey,
          targetPage: page,
          size,
          sort,
          manifest,
          request,
          runSignature,
          lang,
        });
      });
    });
  }

  protected selectPanel(panelKey: string): void {
    if (!panelKey || panelKey === this.requestedPanelKey()) return;
    this.sort.set(null);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        panel: panelKey,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected onSortChange(next: DataSort | null): void {
    this.sort.set(next);
    if (this.urlPage() !== DEFAULT_PAGE) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { page: null },
        queryParamsHandling: 'merge',
      });
    }
  }

  protected onPageChange(nextPage: number): void {
    const clamped = Math.max(DEFAULT_PAGE, nextPage);
    if (clamped === this.committedPage()) return;
    this.table.setPageIndex(clamped - 1);
  }

  protected onPageSizeChange(nextSize: number): void {
    if (!(PAGE_SIZES as readonly number[]).includes(nextSize) || nextSize === this.committedSize()) return;
    this.table.setPageSize(nextSize);
  }

  protected retry(): void {
    this.skipFetchKey = null;
    this.retryTick.update((n) => n + 1);
  }

  protected openReadiness(): void {
    void this.router.navigate(['/crm/settings/data-readiness']);
  }

  protected virtualHeaderColumn(header: Header<typeof RECORDS_TABLE_FEATURES, RowData, unknown>, index: number): DataColumn {
    return header.column.columnDef.meta ?? this.columns()[index];
  }

  protected virtualCellColumn(cell: Cell<typeof RECORDS_TABLE_FEATURES, RowData, unknown>, index: number): DataColumn {
    return cell.column.columnDef.meta ?? this.columns()[index];
  }

  protected ariaSort(
    header: Header<typeof RECORDS_TABLE_FEATURES, RowData, unknown>,
    column: DataColumn,
  ): 'ascending' | 'descending' | 'none' | null {
    if (!column.sortable) return null;
    const dir = header.column.getIsSorted();
    if (dir === 'asc') return 'ascending';
    if (dir === 'desc') return 'descending';
    return 'none';
  }

  protected sortIcon(header: Header<typeof RECORDS_TABLE_FEATURES, RowData, unknown>): string {
    const dir = header.column.getIsSorted();
    if (dir === 'asc') return 'tablerSortAscending';
    if (dir === 'desc') return 'tablerSortDescending';
    return 'tablerArrowsSort';
  }

  protected toggleVirtualSort(header: Header<typeof RECORDS_TABLE_FEATURES, RowData, unknown>, column: DataColumn): void {
    if (!column.sortable) return;
    header.column.toggleSorting();
  }

  protected formatVirtualCell(value: unknown): string {
    return value === null || value === undefined ? DASH : String(value);
  }

  protected totalValue(totals: Record<string, string>, key: string): string {
    return totals[key] ?? '';
  }

  private handleSortingChange(updater: Updater<SortingState>): void {
    const next = typeof updater === 'function' ? updater(this.sortingState()) : updater;
    const first = next[0];
    const nextSort: DataSort | null = first ? { key: first.id, dir: first.desc ? 'desc' : 'asc' } : null;
    this.onSortChange(nextSort);
  }

  private handlePaginationChange(updater: Updater<PaginationState>): void {
    const prev = this.paginationState();
    const next = typeof updater === 'function' ? updater(prev) : updater;
    const sizeChanged = next.pageSize !== prev.pageSize;
    const nextSize = (PAGE_SIZES as readonly number[]).includes(next.pageSize) ? next.pageSize : DEFAULT_SIZE;
    const nextPage = sizeChanged ? DEFAULT_PAGE : Math.max(DEFAULT_PAGE, next.pageIndex + 1);

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        page: nextPage === DEFAULT_PAGE ? null : nextPage,
        size: nextSize === DEFAULT_SIZE ? null : nextSize,
      },
      queryParamsHandling: 'merge',
    });
  }

  private async loadTargetPage(params: {
    reportKey: string;
    panelKey: string;
    targetPage: number;
    size: number;
    sort: DataSort | null;
    manifest: PanelManifest;
    request: ReportRunRequest;
    runSignature: string;
    lang: 'ar' | 'en';
  }): Promise<void> {
    const seq = ++this.fetchSeq;
    this.fetchAbort.abort();
    this.fetchAbort = new AbortController();
    const signal = this.fetchAbort.signal;
    const prevCursors = [...this.cursors];
    const prevExactTotal = this.exactTotal;
    const prevKnownTotal = this.knownTotal();
    const prevCommittedPage = this.committedPage();

    this.loading.set(true);
    this.initialFailed.set(false);

    const period = params.request.period ?? {
      preset: params.manifest.period.kind,
      from: params.manifest.period.from,
      to: params.manifest.period.to,
    };
    const filters = buildRowsFilters(params.manifest, params.request);
    const scope = buildRowsScope(params.manifest, params.request);
    const sortPayload = params.sort
      ? {
          key: params.sort.key,
          direction: (params.sort.dir === 'asc' ? 'ASC' : 'DESC') as 'ASC' | 'DESC',
        }
      : undefined;

    const readPage = (cursor: string | null) => queueRun(() => getPanelRows(
      params.reportKey,
      params.panelKey,
      {
        period,
        ...(filters ? { filters } : {}),
        ...(scope ? { scope } : {}),
        cursor,
        limit: params.size,
        ...(sortPayload ? { sort: sortPayload } : {}),
      },
      signal,
    ), signal);

    try {
      let actualPage = params.targetPage;
      let result: PanelRowsPage | null = null;

      if (params.targetPage - 1 >= this.cursors.length) {
        let step = this.cursors.length - 1;
        while (step < params.targetPage) {
          const cursor = this.cursors[step] ?? null;
          const res = await readPage(cursor);
          if (seq !== this.fetchSeq || this.destroyed) return;

          result = res;
          actualPage = step + 1;
          if (res.pageInfo.hasMore && res.pageInfo.nextCursor) {
            this.cursors[step + 1] = res.pageInfo.nextCursor;
            step++;
          } else {
            this.exactTotal = step * params.size + res.rows.length;
            break;
          }
        }
      } else {
        const cursor = this.cursors[params.targetPage - 1] ?? null;
        result = await readPage(cursor);
        if (seq !== this.fetchSeq || this.destroyed) return;
      }

      if (!result) {
        this.loading.set(false);
        return;
      }

      if (result.pageInfo.hasMore && result.pageInfo.nextCursor) {
        this.cursors[actualPage] = result.pageInfo.nextCursor;
        this.exactTotal = null;
        // The rows endpoint has no total: count the pages seen so far plus one more row, so "next" stays enabled.
        this.knownTotal.set(Math.max(this.knownTotal(), actualPage * params.size + 1));
      } else {
        const total = (actualPage - 1) * params.size + result.rows.length;
        this.exactTotal = total;
        this.knownTotal.set(total);
      }

      this.pageData.set(result);
      this.committedPage.set(actualPage);
      this.committedSize.set(params.size);
      this.committedSnapshot = {
        panelKey: params.panelKey,
        page: actualPage,
        size: params.size,
        sort: params.sort,
        runSignature: params.runSignature,
        lang: params.lang,
      };
      this.initialFailed.set(false);
      this.loading.set(false);

      if (actualPage !== params.targetPage) {
        const clampedKey = JSON.stringify({
          reportKey: params.reportKey,
          panelKey: params.panelKey,
          size: params.size,
          sort: params.sort,
          runSignature: params.runSignature,
          lang: params.lang,
        });
        this.skipFetchKey = JSON.stringify({ contextKey: clampedKey, page: actualPage });
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { page: actualPage === DEFAULT_PAGE ? null : actualPage },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      }

      if (actualPage !== prevCommittedPage) {
        this.host.nativeElement.closest('main')?.scrollTo({ top: 0 });
      }
    } catch (error) {
      if (isAbortError(error) || seq !== this.fetchSeq || this.destroyed) return;

      this.cursors = prevCursors;
      this.exactTotal = prevExactTotal;
      this.knownTotal.set(prevKnownTotal);
      this.loading.set(false);

      const code = errorCodeOf(error);
      this.loadKind.set(reportLoadKind(error));
      this.loadMessage.set(reportErrorMessage(this.transloco, error, 'repTabs'));
      this.notify.error(this.loadMessage());
      if (this.loadKind() === 'forbidden' || this.loadKind() === 'provisioning') {
        this.pageData.set(null);
        this.initialFailed.set(true);
        return;
      }

      if (code === 'CRM_REPORT_PANEL_NOT_PAGEABLE') {
        const fallback = this.pageablePanels()[0];
        if (fallback && fallback.panelKey !== params.panelKey) {
          this.sort.set(null);
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { panel: fallback.panelKey, page: null },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          });
          return;
        }
      }

      const prev = this.committedSnapshot;
      if (this.pageData() && prev) {
        const prevContextKey = JSON.stringify({
          reportKey: params.reportKey,
          panelKey: prev.panelKey,
          size: prev.size,
          sort: prev.sort,
          runSignature: prev.runSignature,
          lang: prev.lang,
        });
        this.lastContextKey = prevContextKey;

        const needsUrlRevert =
          prev.panelKey !== params.panelKey ||
          prev.page !== params.targetPage ||
          prev.size !== params.size;
        const needsSortRevert = JSON.stringify(prev.sort) !== JSON.stringify(params.sort);

        if (needsUrlRevert || needsSortRevert) {
          this.skipFetchKey = JSON.stringify({ contextKey: prevContextKey, page: prev.page });
          if (needsSortRevert) {
            this.sort.set(prev.sort);
          }
          if (needsUrlRevert) {
            void this.router.navigate([], {
              relativeTo: this.route,
              queryParams: {
                panel: prev.panelKey,
                page: prev.page === DEFAULT_PAGE ? null : prev.page,
                size: prev.size === DEFAULT_SIZE ? null : prev.size,
              },
              queryParamsHandling: 'merge',
              replaceUrl: true,
            });
          }
        }
      } else {
        this.initialFailed.set(true);
      }
    }
  }
}

export { RecordsTab as ReportRecordsTab };

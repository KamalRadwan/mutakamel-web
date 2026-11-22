import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerClipboardCheck,
  tablerFileDescription,
  tablerFileSearch,
  tablerLayoutGrid,
  tablerPlus,
  tablerRefresh,
  tablerSearch,
  tablerShoppingCart,
  tablerTable,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { ScopeState } from '../../../../core/scope/scope';
import { BulkJobsTracker } from '../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { Button } from '../../../../shared/ui/button/button';
import { Pagination } from '../../../../shared/ui/pagination/pagination';
import { StepFilter, StepOption } from '../../../../shared/ui/step-filter/step-filter';
import { ViewOption, ViewSwitcher } from '../../../../shared/ui/view-switcher/view-switcher';
import { DocumentBulkBar } from '../document-bulk/bulk-bar/bulk-bar';
import { KIND_CONFIG, KindConfig } from '../shared/document-kinds';
import { DocumentSelection } from '../shared/document-selection';
import type { AnyDocument, DocumentKind, ListQuery, SortOrder } from '../shared/document.model';
import {
  DocumentStatusCountFilters,
  DocumentStatusCounts,
  injectDocumentList,
  injectStatusCounts,
  invalidateDocumentQueries,
} from '../shared/documents.api';
import { DocumentCards } from './document-cards/document-cards';
import {
  DEFAULT_DOCUMENT_ROW_PERMS,
  DocumentRowActionId,
  DocumentRowMenuPerms,
} from './document-row-menu';
import { DocumentSortField, DocumentTable } from './document-table/document-table';
import { translationEvents } from '../../../../core/i18n/translation-events';

const CAN_CREATE = true; // later from the session permissions
const ROW_PERMS: DocumentRowMenuPerms = DEFAULT_DOCUMENT_ROW_PERMS;

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const ALLOWED_PAGE_SIZES: readonly number[] = [25, 50, 100];
const SEARCH_DEBOUNCE_MS = 300;
const ALLOWED_SORT_FIELDS: ReadonlySet<string> = new Set<DocumentSortField>([
  'documentNumber',
  'businessDate',
  'grandTotal',
  'updatedAt',
]);

function parsePositiveInt(raw: string | null | undefined, fallback: number): number {
  if (!raw || !/^\d+$/.test(raw)) return fallback;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : fallback;
}

function parsePageSize(raw: string | null | undefined): number {
  const parsed = parsePositiveInt(raw, DEFAULT_PAGE_SIZE);
  return ALLOWED_PAGE_SIZES.includes(parsed) ? parsed : DEFAULT_PAGE_SIZE;
}

function parseSort(raw: string | null | undefined): DocumentSortField | null {
  if (!raw || !ALLOWED_SORT_FIELDS.has(raw)) return null;
  return raw as DocumentSortField;
}

function parseKind(raw: unknown): DocumentKind {
  if (raw === 'quotation' || raw === 'sales-order' || raw === 'purchase-order' || raw === 'purchase-quotation') {
    return raw;
  }
  return 'quotation';
}

@Component({
  selector: 'app-document-list',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    Pagination,
    StepFilter,
    ViewSwitcher,
    DocumentBulkBar,
    DocumentTable,
    DocumentCards,
  ],
  providers: [
    DocumentSelection,
    provideTranslocoScope(
      { scope: 'trade-shared', alias: 'tradeShared' },
      { scope: 'trade-documents', alias: 'td' },
      { scope: 'trade-documents-list', alias: 'tdl' },
    ),
    provideIcons({
      tablerPlus,
      tablerSearch,
      tablerX,
      tablerTable,
      tablerLayoutGrid,
      tablerRefresh,
      tablerFileDescription,
      tablerClipboardCheck,
      tablerShoppingCart,
      tablerFileSearch,
    }),
  ],
  templateUrl: './document-list.html',
  host: { class: 'flex flex-1 shrink-0 flex-col gap-8 p-12' },
})
export class DocumentList {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly scope = inject(ScopeState);
  private readonly tracker = inject(BulkJobsTracker);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;

  protected readonly selection = inject(DocumentSelection);

  private readonly routeData = toSignal(this.route.data);
  private readonly queryParams = toSignal(this.route.queryParamMap);

  protected readonly canCreate = CAN_CREATE;
  protected readonly rowPerms = ROW_PERMS;
  protected readonly pageSizes: number[] = [...ALLOWED_PAGE_SIZES];

  protected readonly kind = computed<DocumentKind>(() => parseKind(this.routeData()?.['kind']));
  protected readonly kindConfig = computed<KindConfig>(() => KIND_CONFIG[this.kind()]);

  protected readonly view = computed<'table' | 'cards'>(() =>
    this.queryParams()?.get('view') === 'cards' ? 'cards' : 'table',
  );

  protected readonly status = computed<string>(() => {
    const raw = this.queryParams()?.get('status');
    if (!raw || raw === 'ALL') return 'ALL';
    return this.kindConfig().statuses.some((step) => step.value === raw) ? raw : 'ALL';
  });

  protected readonly urlSearch = computed<string>(() => this.queryParams()?.get('q')?.trim() ?? '');
  protected readonly searchInput = signal('');

  protected readonly page = computed<number>(() => parsePositiveInt(this.queryParams()?.get('page'), DEFAULT_PAGE));
  protected readonly pageSize = computed<number>(() => parsePageSize(this.queryParams()?.get('size')));
  protected readonly sort = computed<DocumentSortField | null>(() => parseSort(this.queryParams()?.get('sort')));
  protected readonly order = computed<SortOrder>(() =>
    this.queryParams()?.get('order') === 'asc' ? 'asc' : 'desc',
  );

  protected readonly query = computed<ListQuery>(() => {
    const status = this.status();
    const search = this.urlSearch();
    const sort = this.sort();
    return {
      page: this.page(),
      limit: this.pageSize(),
      ...(status !== 'ALL' ? { status } : {}),
      ...(search ? { search } : {}),
      ...(sort ? { sort, order: this.order() } : {}),
    };
  });

  protected readonly countFilters = computed<DocumentStatusCountFilters>(() => {
    const search = this.urlSearch();
    return search ? { search } : {};
  });

  protected readonly listQuery = injectDocumentList(this.kind, this.query);
  protected readonly countsQuery = injectStatusCounts(this.kind, this.countFilters);

  protected readonly items = computed<readonly AnyDocument[]>(() => this.listQuery.data()?.items ?? []);

  protected readonly total = linkedSignal<
    { kind: DocumentKind; dataTotal: number | undefined; failed: boolean },
    number
  >({
    source: () => ({
      kind: this.kind(),
      dataTotal: this.listQuery.data()?.total,
      failed: this.listQuery.isError(),
    }),
    computation: ({ kind, dataTotal, failed }, previous) => {
      if (failed) return 0;
      if (previous && previous.source.kind !== kind) return dataTotal ?? 0;
      if (dataTotal !== undefined) return dataTotal;
      return previous?.value ?? 0;
    },
  });

  private readonly counts = linkedSignal<
    { kind: DocumentKind; data: DocumentStatusCounts | undefined },
    DocumentStatusCounts | null
  >({
    source: () => ({
      kind: this.kind(),
      data: this.countsQuery.data(),
    }),
    computation: ({ kind, data }, previous) => {
      if (data !== undefined) return data;
      if (previous && previous.source.kind !== kind) return null;
      return previous?.value ?? null;
    },
  });

  protected readonly hasSelection = computed(() => this.selection.count(this.total()) > 0);
  protected readonly hasActiveFilters = computed(() => this.status() !== 'ALL' || this.urlSearch().length > 0);

  protected readonly viewOptions = computed<ViewOption[]>(() => {
    this.i18n();
    return [
      { id: 'table', icon: 'tablerTable', label: this.transloco.translate('tdl.view.table') },
      { id: 'cards', icon: 'tablerLayoutGrid', label: this.transloco.translate('tdl.view.cards') },
    ];
  });

  protected readonly stepOptions = computed<StepOption[]>(() => {
    this.i18n();
    const counts = this.counts();
    return [
      {
        id: 'ALL',
        label: this.transloco.translate('td.status.ALL'),
        count: counts ? counts.total : null,
      },
      ...this.kindConfig().statuses.map(
        (step): StepOption => ({
          id: step.value,
          label: this.transloco.translate(step.labelKey),
          count: counts ? (counts.byStatus[step.value] ?? 0) : null,
          ...(step.tone === 'danger' ? { tone: 'danger' as const } : {}),
          ...(step.tone === 'success' ? { tone: 'success' as const } : {}),
        }),
      ),
    ];
  });

  protected readonly emptyTitle = computed(() => {
    this.i18n();
    const rawKind = this.transloco.translate(`td.kinds.${this.kind()}.many`);
    const kindLabel = this.language() === 'en' ? rawKind.toLowerCase() : rawKind;
    return this.transloco.translate('tdl.empty.title', { kind: kindLabel });
  });

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSyncedUrlSearch: string | null = null;
  private lastKind: DocumentKind | null = null;
  private lastStatus: string | null = null;
  private lastSearch: string | null = null;
  private lastScopeKey: string | null = null;
  private lastScrolledPage = this.page();
  private readonly refreshedJobKeys = new Set<string>();

  constructor() {
    this.destroyRef.onDestroy(() => this.clearSearchTimer());

    effect(() => {
      const nextUrlSearch = this.urlSearch();
      untracked(() => {
        if (this.lastSyncedUrlSearch !== nextUrlSearch) {
          this.lastSyncedUrlSearch = nextUrlSearch;
          this.clearSearchTimer();
          this.searchInput.set(nextUrlSearch);
        }
      });
    });

    effect(() => {
      const kind = this.kind();
      const status = this.status();
      const search = this.urlSearch();
      untracked(() => {
        if (this.lastKind !== null && this.lastKind !== kind) {
          this.selection.clear();
          this.lastKind = kind;
          this.lastStatus = status;
          this.lastSearch = search;
          return;
        }
        if (this.lastKind === null) {
          this.lastKind = kind;
          this.lastStatus = status;
          this.lastSearch = search;
          return;
        }
        if (this.lastStatus !== null && this.lastStatus !== status) {
          this.selection.clearIfAll();
        }
        if (this.lastSearch !== null && this.lastSearch !== search) {
          this.selection.clearIfAll();
        }
        this.lastStatus = status;
        this.lastSearch = search;
      });
    });

    effect(() => {
      const scopeKey = `${this.scope.company().id}:${this.scope.branch().id}`;
      untracked(() => {
        if (this.lastScopeKey !== null && this.lastScopeKey !== scopeKey) {
          this.selection.clear();
        }
        this.lastScopeKey = scopeKey;
      });
    });

    effect(() => {
      const nextPage = this.page();
      if (nextPage === this.lastScrolledPage) return;
      this.lastScrolledPage = nextPage;
      this.host.nativeElement.closest('main')?.scrollTo({ top: 0 });
    });

    effect(() => {
      const loading = this.listQuery.isLoading();
      const failed = this.listQuery.isError();
      const data = this.listQuery.data();
      const currentPage = this.page();
      const limit = this.pageSize();
      if (loading || failed || !data) return;
      if (data.items.length === 0 && currentPage > DEFAULT_PAGE && data.total > 0) {
        const lastPage = Math.max(DEFAULT_PAGE, Math.ceil(data.total / limit));
        if (lastPage !== currentPage) {
          untracked(() => {
            void this.router.navigate([], {
              relativeTo: this.route,
              queryParams: { page: lastPage === DEFAULT_PAGE ? null : lastPage },
              queryParamsHandling: 'merge',
              replaceUrl: true,
            });
          });
        }
      }
    });

    const initialFinished = this.tracker.finished();
    if (initialFinished) {
      this.refreshedJobKeys.add(`${initialFinished.id}:${initialFinished.revision}`);
    }

    effect(() => {
      const finished = this.tracker.finished();
      const expectedModule = `trading.${this.kindConfig().segment}`;
      if (!finished || finished.app !== 'trading' || finished.module !== expectedModule) return;
      const key = `${finished.id}:${finished.revision}`;
      if (this.refreshedJobKeys.has(key)) return;
      this.refreshedJobKeys.add(key);
      untracked(() => this.reload());
    });
  }

  protected setView(nextView: string): void {
    const resolved = nextView === 'cards' ? 'cards' : 'table';
    if (resolved === this.view()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: resolved === 'table' ? null : resolved },
      queryParamsHandling: 'merge',
    });
  }

  protected setStatus(nextStatus: string): void {
    const valid = nextStatus === 'ALL' || this.kindConfig().statuses.some((step) => step.value === nextStatus);
    const resolved = valid ? nextStatus : 'ALL';
    if (resolved === this.status()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        status: resolved === 'ALL' ? null : resolved,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected setPage(nextPage: number): void {
    const safePage = Math.max(DEFAULT_PAGE, nextPage);
    if (safePage === this.page()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: safePage === DEFAULT_PAGE ? null : safePage },
      queryParamsHandling: 'merge',
    });
  }

  protected setPageSize(nextSize: number): void {
    if (!ALLOWED_PAGE_SIZES.includes(nextSize) || nextSize === this.pageSize()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        size: nextSize === DEFAULT_PAGE_SIZE ? null : nextSize,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected toggleSort(field: DocumentSortField): void {
    let nextSort: DocumentSortField | null = field;
    let nextOrder: SortOrder | null = 'asc';
    if (this.sort() === field) {
      if (this.order() === 'asc') {
        nextOrder = 'desc';
      } else {
        nextSort = null;
        nextOrder = null;
      }
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        sort: nextSort,
        order: nextOrder,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchInput.set(value);
    this.clearSearchTimer();
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      this.commitSearch(value);
    }, SEARCH_DEBOUNCE_MS);
  }

  protected clearSearch(): void {
    this.clearSearchTimer();
    this.searchInput.set('');
    this.commitSearch('');
  }

  protected clearFilters(): void {
    this.clearSearchTimer();
    this.searchInput.set('');
    this.lastSyncedUrlSearch = '';
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: null,
        status: null,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected reload(): void {
    invalidateDocumentQueries(this.kind());
  }

  protected openNew(): void {
    if (!this.canCreate) return;
    void this.router.navigate(['new'], { relativeTo: this.route });
  }

  protected openDocument(row: AnyDocument): void {
    void this.router.navigate([row.id], { relativeTo: this.route });
  }

  protected onRowAction(row: AnyDocument, action: DocumentRowActionId): void {
    switch (action) {
      case 'open':
      case 'edit':
        this.openDocument(row);
        break;
      case 'print':
        void this.router.navigate([row.id], {
          relativeTo: this.route,
          queryParams: { print: 1 },
        });
        break;
      case 'convert':
        void this.router.navigate(['/trade/documents/sales-orders/new'], {
          queryParams: { fromQuotation: row.id },
        });
        break;
      case 'createPo':
        void this.router.navigate(['/trade/documents/purchase-orders/new'], {
          queryParams: { fromPurchaseQuotation: row.id },
        });
        break;
    }
  }

  private commitSearch(raw: string): void {
    const trimmed = raw.trim();
    if (trimmed === this.urlSearch()) return;
    this.lastSyncedUrlSearch = trimmed;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: trimmed || null,
        page: null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private clearSearchTimer(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
  }
}

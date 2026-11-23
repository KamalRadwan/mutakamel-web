import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  computed,
  effect,
  inject,
  input,
  resource,
  runInInjectionContext,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerArrowsSort,
  tablerBan,
  tablerInbox,
  tablerLayoutGrid,
  tablerLayoutKanban,
  tablerPlus,
  tablerRefresh,
  tablerTable,
} from '@ng-icons/tabler-icons';
import { ApiError as CoreApiError } from '../../../../../core/api/api-errors';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { ScopeState } from '../../../../../core/scope/scope';
import { Button } from '../../../../../shared/ui/button/button';
import { Dropdown, type DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { FacetSearch } from '../../../../../shared/ui/facet-search/facet-search';
import type { SearchFacet, SearchField } from '../../../../../shared/ui/facet-search/facet-search.model';
import { Field } from '../../../../../shared/ui/field/field';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Pagination } from '../../../../../shared/ui/pagination/pagination';
import { Segmented, type SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import { StepFilter, type StepOption } from '../../../../../shared/ui/step-filter/step-filter';
import { UnsavedDialog } from '../../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { ViewSwitcher, type ViewOption } from '../../../../../shared/ui/view-switcher/view-switcher';
import { TradeReasonPicker, type ReasonPickerValue } from '../../../shared/pickers/reason-picker/reason-picker';
import { anyGrant, tenantWide } from '../../../shared/trade-access';
import { ApiError, errorCodeOf, tradeContext, type TradeContext } from '../../../shared/trade-api';
import { itemName, listCategoryOptions, listUoms } from '../../../shared/trade-foundation.api';
import type { ItemRow, ItemStatus, Uom } from '../../../shared/trade-foundation.model';
import { ITEM_STATUS_KEY } from '../../../shared/trade-labels';
import { ItemBoard } from '../item-board/item-board';
import { ItemBulkMenu } from '../item-bulk/bulk-menu/item-bulk-menu';
import { ItemSelection } from '../item-bulk/item-selection';
import { type ItemBulkFilter, toItemBulkFilter } from '../item-bulk/item-bulk.model';
import { ItemSelectionBar } from '../item-bulk/selection-bar/item-selection-bar';
import { ItemCard, type ItemActionId } from '../item-card/item-card';
import { ItemModal } from '../item-modal/item-modal';
import { itemSearchFields } from '../item-search/item-search.fields';
import { facetsToFilter, filterToFacets, filterToUrlParams, hasActiveFilter, urlParamsToFilter } from '../item-search/item-search.url';
import { ItemTable } from '../item-table/item-table';
import { countItemsByStatus, getItemDetail, itemErrorKey, listItems, moveItemStatus } from '../items.api';
import { actionKey } from '../../action-keys';
import {
  ITEM_DEFAULT_PAGE_SIZE,
  ITEM_PAGE_SIZES,
  ITEM_SORTS,
  ITEM_SORT_SPEC,
  ITEM_STATUSES,
  ITEM_VIEWS,
  type ItemListFilter,
  type ItemListScope,
  type ItemSortKey,
  type ItemStatusReason,
  type ItemView,
} from '../items.model';

const SHOW_ITEM_THUMBS = true; // exception X1 (Q-F6), pending owner approval

function isForbiddenError(error: unknown): boolean {
  return (error instanceof ApiError || error instanceof CoreApiError) && error.status === 403;
}

const DEFAULT_PAGE = 1;
const VIEW_ICONS: Record<ItemView, string> = {
  board: 'tablerLayoutKanban',
  cards: 'tablerLayoutGrid',
  table: 'tablerTable',
};

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw || !/^\d+$/.test(raw)) return fallback;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : fallback;
}

@Component({
  selector: 'app-items-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    Dropdown,
    FacetSearch,
    Field,
    FullState,
    Modal,
    Pagination,
    Segmented,
    StepFilter,
    TradeReasonPicker,
    UnsavedDialog,
    ViewSwitcher,
    ItemBoard,
    ItemBulkMenu,
    ItemCard,
    ItemSelectionBar,
    ItemTable,
    ItemModal,
  ],
  providers: [
    ItemSelection,
    provideTranslocoScope('settings', { scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-items', alias: 'tradeItems' }),
    provideIcons({
      tablerPlus,
      tablerArrowsSort,
      tablerBan,
      tablerLayoutKanban,
      tablerLayoutGrid,
      tablerTable,
      tablerAlertTriangle,
      tablerInbox,
      tablerRefresh,
    }),
  ],
  templateUrl: './items-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col gap-8 p-12' },
})
export class ItemsPage {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly scopeState = inject(ScopeState);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;
  protected readonly selection = inject(ItemSelection);

  private readonly itemBoard = viewChild(ItemBoard);
  private readonly itemModal = viewChild(ItemModal);
  private readonly discontinueModal = viewChild.required<Modal>('discontinueModal');
  protected readonly discontinueReasonPicker = viewChild<TradeReasonPicker>('discontinueReasonPicker');
  private readonly conflictDialog = viewChild.required<UnsavedDialog>('conflictDialog');

  readonly viewParam = input<string | undefined>(undefined, { alias: 'view' });
  readonly scopeParam = input<string | undefined>(undefined, { alias: 'scope' });
  readonly statusParam = input<string | undefined>(undefined, { alias: 'status' });
  readonly sortParam = input<string | undefined>(undefined, { alias: 'sort' });
  readonly pageParam = input<string | undefined>(undefined, { alias: 'page' });
  readonly sizeParam = input<string | undefined>(undefined, { alias: 'size' });
  readonly qParam = input<string | undefined>(undefined, { alias: 'q' });
  readonly kindParam = input<string | undefined>(undefined, { alias: 'kind' });
  readonly purposeParam = input<string | undefined>(undefined, { alias: 'purpose' });
  readonly imgParam = input<string | undefined>(undefined, { alias: 'img' });
  readonly catParam = input<string | undefined>(undefined, { alias: 'cat' });
  /** POS channel the list is filtered for; only used with the POS purpose (bulk QUERY `channelId`). */
  readonly channelParam = input<string | undefined>(undefined, { alias: 'channel' });
  readonly itemParam = input<string | undefined>(undefined, { alias: 'item' });

  protected readonly forbidden = signal(false);
  protected readonly canRead = computed(() =>
    runInInjectionContext(this.injector, () => anyGrant('trade.items.read')),
  );
  protected readonly isForbidden = computed(
    () =>
      !this.canRead() ||
      this.forbidden() ||
      isForbiddenError(this.pageResource.error()) ||
      isForbiddenError(this.countsResource.error()),
  );
  protected readonly canManage = computed(
    () => !this.isForbidden() && runInInjectionContext(this.injector, () => tenantWide('trade.catalog_master.manage')),
  );
  protected readonly showThumbs = SHOW_ITEM_THUMBS;
  protected readonly pageSizes = ITEM_PAGE_SIZES;
  protected readonly skeletonCards = [1, 2, 3, 4, 5, 6];

  protected readonly refreshTick = signal(0);
  protected readonly discontinueTargetName = signal('');
  protected readonly discontinueOpen = signal(false);
  protected readonly discontinueSubmitted = signal(false);
  protected readonly discontinueReason = signal<ReasonPickerValue>({ reasonCodeId: null, note: '' });
  private discontinueResolver: ((reason: ItemStatusReason | null) => void) | null = null;
  private readonly statusBusyIds = new Set<string>();

  protected readonly currentView = computed<ItemView>(() => {
    const raw = this.viewParam();
    return (ITEM_VIEWS as readonly string[]).includes(raw ?? '') ? (raw as ItemView) : 'board';
  });

  protected readonly currentScope = computed<ItemListScope>(() =>
    this.scopeParam() === 'company' ? 'company' : 'catalogue',
  );

  protected readonly currentStatus = computed<ItemStatus | 'all'>(() => {
    if (this.currentView() === 'board') return 'all';
    const raw = this.statusParam();
    return (ITEM_STATUSES as readonly string[]).includes(raw ?? '') ? (raw as ItemStatus) : 'all';
  });

  protected readonly currentSort = computed<ItemSortKey>(() => {
    const raw = this.sortParam();
    return (ITEM_SORTS as readonly string[]).includes(raw ?? '') ? (raw as ItemSortKey) : 'created';
  });

  protected readonly page = computed(() => parsePositiveInt(this.pageParam(), DEFAULT_PAGE));

  protected readonly pageSize = computed(() => {
    const parsed = parsePositiveInt(this.sizeParam(), ITEM_DEFAULT_PAGE_SIZE);
    return ITEM_PAGE_SIZES.includes(parsed) ? parsed : ITEM_DEFAULT_PAGE_SIZE;
  });

  protected readonly context = computed<TradeContext>(() => tradeContext(this.scopeState, 'COMPANY'));

  protected readonly companyName = computed(() => {
    const company = this.scopeState.company();
    return this.language() === 'ar' ? company.nameAr : company.nameEn;
  });

  protected readonly filter = computed<ItemListFilter>(() => {
    const base = urlParamsToFilter(
      {
        q: this.qParam(),
        kind: this.kindParam(),
        purpose: this.purposeParam(),
        img: this.imgParam(),
        cat: this.catParam(),
      },
      this.currentScope(),
    );
    const sortSpec = ITEM_SORT_SPEC[this.currentSort()];
    return {
      ...base,
      scope: this.currentScope() === 'company' ? 'COMPANY' : 'CATALOGUE',
      sort: sortSpec.sort,
      direction: sortSpec.direction,
    };
  });

  private readonly countFilter = computed<ItemListFilter>(() => {
    const { sort: _sort, direction: _direction, ...rest } = this.filter();
    return rest;
  });

  protected readonly bulkFilter = computed<ItemBulkFilter>(() => {
    const base = this.countFilter();
    const status = this.currentStatus();
    return toItemBulkFilter(status === 'all' ? base : { ...base, status }, this.channelParam());
  });

  protected readonly hasFilters = computed(() => hasActiveFilter(this.filter()));

  protected readonly modalOpen = computed(() => {
    const raw = this.itemParam();
    return raw !== undefined && raw !== null && raw.trim() !== '';
  });

  protected readonly modalItemId = computed<string | null>(() => {
    const raw = this.itemParam()?.trim();
    return !raw || raw === 'new' ? null : raw;
  });

  private readonly uomsResource = resource({
    params: () => (!this.canRead() || this.forbidden() ? undefined : true),
    loader: () => listUoms().catch(() => []),
  });

  protected readonly uomsMap = computed<ReadonlyMap<string, Uom>>(() => {
    const list = this.uomsResource.hasValue() ? this.uomsResource.value() : [];
    return new Map(list.map((uom) => [uom.id, uom]));
  });

  private readonly categoriesResource = resource({
    params: () =>
      !this.canRead() || this.forbidden()
        ? undefined
        : {
            ctx: this.currentScope() === 'company' ? this.context() : {},
            lang: this.language(),
          },
    loader: ({ params }) => listCategoryOptions(params.ctx).catch(() => []),
  });

  private readonly countsResource = resource({
    params: () =>
      !this.canRead() || this.forbidden()
        ? undefined
        : { ctx: this.context(), filter: this.countFilter(), tick: this.refreshTick() },
    loader: ({ params }) => countItemsByStatus(params.ctx, params.filter),
  });

  private readonly pageResource = resource({
    params: () => {
      if (!this.canRead() || this.forbidden() || this.currentView() === 'board') return undefined;
      const status = this.currentStatus();
      return {
        ctx: this.context(),
        filter: this.filter(),
        status: status === 'all' ? undefined : status,
        page: this.page(),
        limit: this.pageSize(),
        tick: this.refreshTick(),
        lang: this.language(),
      };
    },
    loader: async ({ params }) => {
      const res = await listItems(params.ctx, {
        ...params.filter,
        ...(params.status ? { status: params.status } : {}),
        page: params.page,
        limit: params.limit,
      });
      if (res.items.length === 0 && params.page > 1) {
        const lastPage = res.total > 0 ? Math.max(1, Math.ceil(res.total / params.limit)) : 1;
        if (lastPage !== params.page) {
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { page: lastPage === DEFAULT_PAGE ? null : lastPage },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          });
          if (res.total > 0) {
            return listItems(params.ctx, {
              ...params.filter,
              ...(params.status ? { status: params.status } : {}),
              page: lastPage,
              limit: params.limit,
            });
          }
        }
      }
      return res;
    },
  });

  protected readonly searchFields = computed<SearchField[]>(() => {
    this.i18n();
    const categories = this.categoriesResource.hasValue() ? this.categoriesResource.value() : [];
    return itemSearchFields({
      scope: this.currentScope(),
      categories,
      translate: (key) => this.transloco.translate(key),
    });
  });

  protected readonly facets = computed<SearchFacet[]>(() => {
    this.i18n();
    return filterToFacets(this.filter(), this.searchFields());
  });

  protected readonly scopeOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return [
      { value: 'catalogue', label: this.transloco.translate('tradeItems.toolbar.scope.catalogue') },
      { value: 'company', label: this.transloco.translate('tradeItems.toolbar.scope.company') },
    ];
  });

  protected readonly viewOptions = computed<ViewOption[]>(() => {
    this.i18n();
    return ITEM_VIEWS.map((id) => ({
      id,
      icon: VIEW_ICONS[id],
      label: this.transloco.translate(`tradeItems.views.${id}`),
    }));
  });

  protected readonly sortOptions = computed<DropdownOption<ItemSortKey>[]>(() => {
    this.i18n();
    return ITEM_SORTS.map((value) => ({
      value,
      label: this.transloco.translate(`tradeItems.sort.${value}`),
    }));
  });

  protected readonly stepOptions = computed<StepOption[]>(() => {
    this.i18n();
    const counts = this.countsResource.hasValue() ? this.countsResource.value() : null;
    return [
      {
        id: 'all',
        label: this.transloco.translate('tradeItems.steps.all'),
        count: counts ? counts.ALL : null,
      },
      ...ITEM_STATUSES.map((status) => ({
        id: status,
        label: this.transloco.translate(ITEM_STATUS_KEY[status]),
        count: counts ? counts[status] : null,
        ...(status === 'DISCONTINUED' ? { tone: 'danger' as const } : {}),
      })),
    ];
  });

  protected readonly listLoading = computed(() => this.pageResource.isLoading());
  protected readonly listFailed = computed(() => !!this.pageResource.error());
  protected readonly visibleItems = computed<ItemRow[]>(() =>
    this.pageResource.hasValue() ? this.pageResource.value().items : [],
  );
  protected readonly totalItems = computed(() =>
    this.pageResource.hasValue() ? this.pageResource.value().total : 0,
  );
  protected readonly totalCompanyAll = computed(() =>
    this.countsResource.hasValue() ? this.countsResource.value().ALL : null,
  );

  protected readonly visibleListIds = computed<string[]>(() => {
    if (this.currentView() === 'board') {
      return this.itemBoard()?.listIdsFor(this.modalItemId()) ?? [];
    }
    return this.visibleItems().map((item) => item.id);
  });

  constructor() {
    let lastPage = this.page();
    effect(() => {
      const nextPage = this.page();
      if (nextPage === lastPage) return;
      lastPage = nextPage;
      this.host.nativeElement.closest('main')?.scrollTo({ top: 0 });
    });

    const initialBulkFilter = this.bulkFilter();
    let lastBulkFilterJson = JSON.stringify(initialBulkFilter);
    this.selection.onFilterChange(initialBulkFilter);
    effect(() => {
      const next = this.bulkFilter();
      const nextJson = JSON.stringify(next);
      if (nextJson === lastBulkFilterJson) return;
      lastBulkFilterJson = nextJson;
      untracked(() => this.selection.onFilterChange(next));
    });

    let lastCompanyId = this.context().companyId;
    effect(() => {
      const nextCompanyId = this.context().companyId;
      if (nextCompanyId === lastCompanyId) return;
      lastCompanyId = nextCompanyId;
      untracked(() => {
        if (this.currentScope() === 'company') {
          this.selection.clear();
        }
      });
    });

    inject(DestroyRef).onDestroy(() => this.settleDiscontinue(null));
  }

  canLeave(): Promise<boolean> {
    const modal = this.itemModal();
    return modal ? modal.confirmLeave() : Promise.resolve(true);
  }

  protected setView(nextView: string): void {
    const target: ItemView = (ITEM_VIEWS as readonly string[]).includes(nextView)
      ? (nextView as ItemView)
      : 'board';
    if (target === this.currentView()) return;

    const toBoard = target === 'board';
    if (toBoard) {
      this.selection.clear();
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        view: toBoard ? null : target,
        status: toBoard || this.currentStatus() === 'all' ? null : this.currentStatus(),
        page: toBoard || this.page() === DEFAULT_PAGE ? null : this.page(),
        size: toBoard || this.pageSize() === ITEM_DEFAULT_PAGE_SIZE ? null : this.pageSize(),
      },
      queryParamsHandling: 'merge',
    });
  }

  protected setSort(nextSort: ItemSortKey): void {
    const resolved: ItemSortKey = (ITEM_SORTS as readonly string[]).includes(nextSort) ? nextSort : 'created';
    if (resolved === this.currentSort()) return;

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        sort: resolved === 'created' ? null : resolved,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected setScope(nextScope: string | null): void {
    const target: ItemListScope = nextScope === 'company' ? 'company' : 'catalogue';
    if (target === this.currentScope()) return;

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        scope: target === 'catalogue' ? null : target,
        purpose: target === 'catalogue' ? null : (this.filter().purpose ?? null),
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected setStatus(nextStatus: string): void {
    const resolved: ItemStatus | 'all' = (ITEM_STATUSES as readonly string[]).includes(nextStatus)
      ? (nextStatus as ItemStatus)
      : 'all';
    if (resolved === this.currentStatus()) return;

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        status: resolved === 'all' ? null : resolved,
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
    if (!ITEM_PAGE_SIZES.includes(nextSize) || nextSize === this.pageSize()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        size: nextSize === ITEM_DEFAULT_PAGE_SIZE ? null : nextSize,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected setFacets(nextFacets: SearchFacet[]): void {
    const nextFilter = facetsToFilter(nextFacets, this.currentScope());
    const params = filterToUrlParams(nextFilter, this.currentScope());
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ...params, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected clearSearch(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: null,
        kind: null,
        purpose: null,
        img: null,
        cat: null,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected openCreate(): void {
    if (!this.canManage()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { item: 'new' },
      queryParamsHandling: 'merge',
    });
  }

  protected openItem(item: ItemRow): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { item: item.id },
      queryParamsHandling: 'merge',
    });
  }

  protected closeModal(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { item: null },
      queryParamsHandling: 'merge',
    });
  }

  protected onItemSaved(_saved: ItemRow): void {
    this.refreshAll();
  }

  protected openFullPage(id: string): void {
    void this.router.navigate(['/trade/foundation/items', id], {
      state: { listIds: this.visibleListIds() },
    });
  }

  protected goHome(): void {
    void this.router.navigateByUrl('/workspace/home');
  }

  protected onForbidden(): void {
    this.forbidden.set(true);
  }

  protected reload(): void {
    this.refreshAll();
  }

  protected reloadCounts(): void {
    this.countsResource.reload();
  }

  protected retryList(): void {
    this.refreshAll();
  }

  protected onRowAction(item: ItemRow, action: ItemActionId): void {
    switch (action) {
      case 'open':
      case 'edit':
        this.openItem(item);
        break;
      case 'activate':
        void this.moveRowStatus(item, 'ACTIVE');
        break;
      case 'deactivate':
        void this.moveRowStatus(item, 'INACTIVE');
        break;
      case 'discontinue':
        void this.moveRowStatus(item, 'DISCONTINUED');
        break;
      case 'copyCode':
        void this.copyCode(item.canonicalCode);
        break;
    }
  }

  private refreshAll(): void {
    this.refreshTick.update((n) => n + 1);
    this.itemBoard()?.refresh();
  }

  protected confirmDiscontinue(): void {
    this.discontinueSubmitted.set(true);
    if (!this.discontinueReasonPicker()?.valid()) return;
    const val = this.discontinueReason();
    if (!val.reasonCodeId) return;
    const note = val.note.trim();
    this.settleDiscontinue({
      reasonCodeId: val.reasonCodeId,
      ...(note ? { reasonNote: note } : {}),
    });
    this.discontinueModal().close();
  }

  protected cancelDiscontinue(): void {
    this.settleDiscontinue(null);
    this.discontinueModal().close();
  }

  protected onDiscontinueClosed(): void {
    this.discontinueOpen.set(false);
    this.settleDiscontinue(null);
  }

  private promptDiscontinueReason(item: ItemRow): Promise<ItemStatusReason | null> {
    this.settleDiscontinue(null);
    this.discontinueTargetName.set(itemName(item, this.language()));
    this.discontinueReason.set({ reasonCodeId: null, note: '' });
    this.discontinueSubmitted.set(false);
    this.discontinueOpen.set(true);
    this.discontinueModal().open();
    return new Promise<ItemStatusReason | null>((resolve) => {
      this.discontinueResolver = resolve;
    });
  }

  private settleDiscontinue(result: ItemStatusReason | null): void {
    const resolve = this.discontinueResolver;
    this.discontinueResolver = null;
    resolve?.(result);
  }

  private async moveRowStatus(item: ItemRow, toStatus: ItemStatus): Promise<void> {
    if (this.statusBusyIds.has(item.id)) return;
    let reason: ItemStatusReason | undefined;
    if (toStatus === 'DISCONTINUED') {
      const picked = await this.promptDiscontinueReason(item);
      if (!picked) return;
      reason = picked;
    }

    this.statusBusyIds.add(item.id);
    try {
      const itemMove = actionKey('status', item.id, item.version, toStatus, reason);
      await moveItemStatus(item.id, item.version, toStatus, itemMove.key, reason);
      itemMove.done();
      this.refreshAll();
    } catch (error) {
      if (errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION') {
        const choice = await this.conflictDialog().open();
        if (choice === 'save') {
          this.refreshAll();
        } else if (choice === 'discard') {
          try {
            const fresh = await getItemDetail(this.context(), item.id);
            const freshMove = actionKey('status', fresh.id, fresh.version, toStatus, reason);
            await moveItemStatus(fresh.id, fresh.version, toStatus, freshMove.key, reason);
            freshMove.done();
            this.refreshAll();
          } catch (retryError) {
            if (isForbiddenError(retryError)) {
              this.forbidden.set(true);
              return;
            }
            this.notify.error(this.transloco.translate(itemErrorKey(retryError)));
            this.refreshAll();
          }
        }
      } else if (isForbiddenError(error)) {
        this.forbidden.set(true);
      } else {
        this.notify.error(this.transloco.translate(itemErrorKey(error)));
      }
    } finally {
      this.statusBusyIds.delete(item.id);
    }
  }

  private async copyCode(code: string): Promise<void> {
    try {
      await navigator.clipboard?.writeText(code);
      this.notify.success(this.transloco.translate('tradeItems.actions.copied'));
    } catch {
      this.notify.success(this.transloco.translate('tradeItems.actions.copied'));
    }
  }
}

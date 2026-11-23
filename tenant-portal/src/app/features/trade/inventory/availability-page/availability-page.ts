import {
  Component,
  DestroyRef,
  Injector,
  computed,
  effect,
  inject,
  runInInjectionContext,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle, tablerPlus, tablerStack2 } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { ScopeState } from '../../../../core/scope/scope';
import { Button } from '../../../../shared/ui/button/button';
import { Dropdown, type DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../shared/ui/field/field';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { Pagination } from '../../../../shared/ui/pagination/pagination';
import { SettingsFrame } from '../../../../shared/ui/settings-frame/settings-frame';
import { SettingsNotice } from '../../../../shared/ui/settings-notice/settings-notice';
import { Switch } from '../../../../shared/ui/switch/switch';
import { branchGrants } from '../../shared/trade-access';
import { tradeContext } from '../../shared/trade-api';
import { listBalances, listNodes } from '../inventory.api';
import {
  INVENTORY_LIMITS,
  type FulfillmentNode,
  type StockBalanceRow,
} from '../inventory.model';
import { errorKey, hasBranchGrant, isForbiddenError, itemName, signOf } from '../inventory.service';
import { InventoryQuantity } from '../inventory-shared/inventory-quantity/inventory-quantity';
import { OpeningBalanceModal } from '../opening-balance-modal/opening-balance-modal';
import { StockCheckModal } from '../stock-check-modal/stock-check-modal';

const DEFAULT_PAGE = 1;
const PAGE_SIZES: number[] = [20, 50, 100];
const DEFAULT_PAGE_SIZE = INVENTORY_LIMITS.pageSize;
const SEARCH_DEBOUNCE_MS = 300;
const SKELETON_ROWS = [0, 1, 2, 3, 4] as const;

interface StockCheckNavMeta {
  uomId?: string;
  itemCode?: string;
  nodeName?: string;
}

interface AvailabilityNavState {
  listQuery?: Record<string, string>;
  stockCheck?: StockCheckNavMeta;
}

interface ListQueryState {
  nodeId: string;
  onlyInStock: boolean;
  search: string;
  page: number;
  pageSize: number;
}

function parsePage(raw: string | null | undefined): number {
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_PAGE;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : DEFAULT_PAGE;
}

function parsePageSize(raw: string | null | undefined): number {
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_PAGE_SIZE;
  const parsed = Number(raw);
  return PAGE_SIZES.includes(parsed) ? parsed : DEFAULT_PAGE_SIZE;
}

function parseBooleanParam(raw: string | null | undefined): boolean {
  return raw === 'true' || raw === '1';
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function readNavState(): AvailabilityNavState {
  if (typeof history === 'undefined' || !history.state || typeof history.state !== 'object') {
    return {};
  }
  const raw = history.state as Record<string, unknown>;
  const result: AvailabilityNavState = {};

  if (raw['listQuery'] && typeof raw['listQuery'] === 'object' && !Array.isArray(raw['listQuery'])) {
    const cleanQuery: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw['listQuery'] as Record<string, unknown>)) {
      if (typeof v === 'string' && v.length > 0) {
        cleanQuery[k] = v;
      }
    }
    result.listQuery = cleanQuery;
  }

  if (raw['stockCheck'] && typeof raw['stockCheck'] === 'object' && !Array.isArray(raw['stockCheck'])) {
    const sc = raw['stockCheck'] as Record<string, unknown>;
    result.stockCheck = {
      uomId: typeof sc['uomId'] === 'string' ? sc['uomId'] : undefined,
      itemCode: typeof sc['itemCode'] === 'string' ? sc['itemCode'] : undefined,
      nodeName: typeof sc['nodeName'] === 'string' ? sc['nodeName'] : undefined,
    };
  }

  return result;
}

@Component({
  selector: 'app-availability-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    Dropdown,
    Field,
    FullState,
    Pagination,
    SettingsFrame,
    SettingsNotice,
    Switch,
    InventoryQuantity,
    StockCheckModal,
    OpeningBalanceModal,
  ],
  providers: [
    provideTranslocoScope('settings', { scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-inventory', alias: 'tradeInventory' }, { scope: 'trade-inventory-stock', alias: 'invStock' }),
    provideIcons({ tablerAlertTriangle, tablerPlus, tablerStack2 }),
  ],
  templateUrl: './availability-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col' },
})
export class AvailabilityPage {
  private static nextId = 0;
  protected readonly uid = `availability-page-${++AvailabilityPage.nextId}`;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly scope = inject(ScopeState);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly paramMap = toSignal(this.route.paramMap);
  private readonly queryParams = toSignal(this.route.queryParamMap);
  private readonly stockCheckModal = viewChild(StockCheckModal);
  private readonly openingBalanceModal = viewChild(OpeningBalanceModal);

  protected readonly forbidden = signal(false);
  protected readonly canRead = computed(() => {
    const grants = runInInjectionContext(this.injector, () => branchGrants('trade.inventory.read'));
    return hasBranchGrant(grants, this.scope.branch()?.id ?? null);
  });
  protected readonly showForbidden = computed(() => !this.canRead() || this.forbidden());
  protected readonly canOpening = computed(() => {
    if (this.forbidden()) return false;
    const grants = runInInjectionContext(this.injector, () => branchGrants('trade.inventory.opening_balance'));
    return hasBranchGrant(grants, this.scope.branch()?.id ?? null);
  });
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly gridColumns =
    'grid-cols-trade-inv-availability-row';

  private readonly navState = readNavState();
  private readonly returnListQuery = this.navState.listQuery ?? {};

  protected readonly nodes = signal<FulfillmentNode[]>([]);
  protected readonly nodesLoaded = signal(false);
  protected readonly rows = signal<StockBalanceRow[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly loadErrorKey = signal('invStock.loadFailed');

  private readonly initialSearch = this.route.snapshot.paramMap.get('id')
    ? (this.returnListQuery['search'] ?? '')
    : (this.route.snapshot.queryParamMap.get('search') ?? '');

  protected readonly searchInput = signal(this.initialSearch);
  private lastSyncedSearch = this.initialSearch;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private nodesSeq = 0;
  private listSeq = 0;
  private lastOpenedRouteKey = '';
  private destroyed = false;

  protected readonly routeItemId = computed(() => this.paramMap()?.get('id') ?? null);

  protected readonly listQuery = computed<ListQueryState>(() => {
    if (this.routeItemId()) {
      return {
        nodeId: this.returnListQuery['node'] ?? '',
        onlyInStock: parseBooleanParam(this.returnListQuery['inStock']),
        search: this.returnListQuery['search'] ?? '',
        page: parsePage(this.returnListQuery['page']),
        pageSize: parsePageSize(this.returnListQuery['size']),
      };
    }
    const qp = this.queryParams();
    return {
      nodeId: qp?.get('node') ?? '',
      onlyInStock: parseBooleanParam(qp?.get('inStock')),
      search: qp?.get('search') ?? '',
      page: parsePage(qp?.get('page')),
      pageSize: parsePageSize(qp?.get('size')),
    };
  });

  protected readonly nodeFilter = computed(() => this.listQuery().nodeId);
  protected readonly onlyInStock = computed(() => this.listQuery().onlyInStock);
  protected readonly urlSearch = computed(() => this.listQuery().search);
  protected readonly page = computed(() => this.listQuery().page);
  protected readonly pageSize = computed(() => this.listQuery().pageSize);

  protected readonly hasActiveFilters = computed(() =>
    Boolean(this.nodeFilter() || this.onlyInStock() || this.urlSearch().trim()),
  );

  protected readonly activeNodes = computed(() =>
    this.nodes().filter((node) => node.status === 'ACTIVE'),
  );

  protected readonly nodeOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const options: DropdownOption<string>[] = [
      { value: '', label: this.transloco.translate('invStock.filters.allNodes') },
    ];
    for (const node of this.activeNodes()) {
      options.push({
        value: node.id,
        label: `\u2066${node.code}\u2069 — ${node.name}`,
      });
    }
    return options;
  });

  constructor() {
    effect(() => {
      const term = this.searchInput();
      if (this.searchTimer !== null) {
        clearTimeout(this.searchTimer);
        this.searchTimer = null;
      }
      const trimmed = term.trim();
      if (trimmed === this.lastSyncedSearch) return;
      if (!trimmed) {
        untracked(() => this.applySearchParam(''));
        return;
      }
      this.searchTimer = setTimeout(() => {
        this.searchTimer = null;
        this.applySearchParam(trimmed);
      }, SEARCH_DEBOUNCE_MS);
    });

    effect(() => {
      const nextUrlSearch = this.urlSearch();
      untracked(() => {
        if (nextUrlSearch !== this.lastSyncedSearch) {
          this.lastSyncedSearch = nextUrlSearch;
          this.clearSearchTimer();
          this.searchInput.set(nextUrlSearch);
        }
      });
    });

    effect(() => {
      this.scope.company();
      this.scope.branch();
      const allowed = this.canRead();
      untracked(() => {
        this.forbidden.set(false);
        if (!allowed) {
          this.nodes.set([]);
          this.nodesLoaded.set(true);
          return;
        }
        void this.loadNodesForBranch();
      });
    });

    effect(() => {
      this.scope.company();
      this.scope.branch();
      const allowed = this.canRead();
      const q = this.listQuery();
      untracked(() => {
        if (!allowed) {
          this.rows.set([]);
          this.total.set(0);
          this.loading.set(false);
          this.loadFailed.set(false);
          return;
        }
        void this.loadBalances(q);
      });
    });

    effect(() => {
      if (this.showForbidden()) return;
      const itemId = this.routeItemId();
      const qp = this.queryParams();
      const modal = this.stockCheckModal();
      const loadedNodes = this.nodesLoaded();
      const activeList = this.activeNodes();

      if (!itemId || !modal) {
        this.lastOpenedRouteKey = '';
        return;
      }

      const qpNode = qp?.get('node') ?? '';
      if (!qpNode && !loadedNodes) return;

      const resolvedNodeId = qpNode || activeList[0]?.id || '';
      const lotKey = qp?.get('lot') || null;
      const routeKey = `${itemId}::${resolvedNodeId}::${lotKey ?? ''}`;
      if (routeKey === this.lastOpenedRouteKey) return;
      this.lastOpenedRouteKey = routeKey;

      const meta = this.navState.stockCheck;
      untracked(() => {
        modal.open({
          nodeId: resolvedNodeId,
          itemId,
          lotKey,
          uomId: meta?.uomId,
          itemCode: meta?.itemCode,
          nodeName: meta?.nodeName,
        });
      });
    });

    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.clearSearchTimer();
    });
  }

  protected reload(): void {
    if (!this.canRead()) return;
    this.forbidden.set(false);
    void this.loadNodesForBranch();
    void this.loadBalances(this.listQuery());
  }

  protected goHome(): void {
    void this.router.navigate(['/']);
  }

  protected onForbidden(): void {
    this.forbidden.set(true);
  }

  protected openOpeningBalance(): void {
    if (!this.canOpening()) return;
    this.openingBalanceModal()?.open({
      nodeId: this.nodeFilter() || null,
    });
  }

  protected onOpeningBalanceSaved(): void {
    void this.loadBalances(this.listQuery());
  }

  protected onNodeFilterChange(nodeId: string): void {
    if (this.routeItemId() || nodeId === this.nodeFilter()) return;
    this.updateQueryParams({ node: nodeId || null, page: null });
  }

  protected onOnlyInStockChange(checked: boolean): void {
    if (this.routeItemId() || checked === this.onlyInStock()) return;
    this.updateQueryParams({ inStock: checked ? 'true' : null, page: null });
  }

  protected onPageChange(nextPage: number): void {
    if (this.routeItemId()) return;
    const clamped = Math.max(DEFAULT_PAGE, nextPage);
    if (clamped === this.page()) return;
    this.updateQueryParams({ page: clamped === DEFAULT_PAGE ? null : clamped });
  }

  protected onPageSizeChange(nextSize: number): void {
    if (this.routeItemId() || nextSize === this.pageSize()) return;
    this.updateQueryParams({
      size: nextSize === DEFAULT_PAGE_SIZE ? null : nextSize,
      page: null,
    });
  }

  protected clearFilters(): void {
    this.clearSearchTimer();
    this.lastSyncedSearch = '';
    this.searchInput.set('');
    this.updateQueryParams({ node: null, inStock: null, search: null, page: null });
  }

  protected openStockCheck(row: StockBalanceRow): void {
    const current = this.listQuery();
    const listQuery: Record<string, string> = {};
    if (current.nodeId) listQuery['node'] = current.nodeId;
    if (current.onlyInStock) listQuery['inStock'] = 'true';
    if (current.search) listQuery['search'] = current.search;
    if (current.page !== DEFAULT_PAGE) listQuery['page'] = String(current.page);
    if (current.pageSize !== DEFAULT_PAGE_SIZE) listQuery['size'] = String(current.pageSize);

    void this.router.navigate(['/trade/inventory/availability', row.itemId], {
      queryParams: {
        node: row.nodeId,
        lot: row.lotKey || null,
      },
      state: {
        listQuery,
        stockCheck: {
          uomId: row.uomId,
          itemCode: row.itemCode,
          nodeName: row.nodeName,
        },
      },
    });
  }

  protected onStockCheckClosed(): void {
    if (!this.routeItemId()) return;
    void this.router.navigate(['/trade/inventory/availability'], {
      queryParams: this.returnListQuery,
    });
  }

  protected localizedItemName(row: StockBalanceRow): string {
    return itemName(row.itemNames, this.language());
  }

  protected serialCountLabel(count: number): string {
    this.i18n();
    const lang = this.language();
    const rule = new Intl.PluralRules(lang).select(count);
    return this.transloco.translate(`invStock.serialCount.${rule}`, { count });
  }

  protected isZero(value: string): boolean {
    return signOf(value) === 0;
  }

  protected isAvailableLow(row: StockBalanceRow): boolean {
    return signOf(row.availableQuantity) <= 0;
  }

  protected formatDateTime(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }

  private applySearchParam(term: string): void {
    if (this.routeItemId() || term === this.lastSyncedSearch) return;
    this.lastSyncedSearch = term;
    this.updateQueryParams({ search: term || null, page: null }, true);
  }

  private updateQueryParams(
    patch: Record<string, string | number | null>,
    replaceUrl = false,
  ): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: patch,
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  }

  private clearSearchTimer(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
  }

  private async loadNodesForBranch(): Promise<void> {
    if (!this.canRead()) return;
    const seq = ++this.nodesSeq;
    try {
      const list = await listNodes({}, tradeContext(this.scope, 'BRANCH'));
      if (seq !== this.nodesSeq || this.destroyed) return;
      this.nodes.set(list);
      this.nodesLoaded.set(true);

      const selectedNode = this.nodeFilter();
      if (
        !this.routeItemId() &&
        selectedNode &&
        !list.some((node) => node.status === 'ACTIVE' && node.id === selectedNode)
      ) {
        this.updateQueryParams({ node: null, page: null }, true);
      }
    } catch (error) {
      if (seq !== this.nodesSeq || this.destroyed) return;
      this.nodes.set([]);
      this.nodesLoaded.set(true);
      if (isForbiddenError(error)) {
        this.loadFailed.set(false);
        this.forbidden.set(true);
      }
    }
  }

  private async loadBalances(q: ListQueryState): Promise<void> {
    if (!this.canRead()) {
      this.loading.set(false);
      return;
    }
    const seq = ++this.listSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    try {
      const res = await listBalances(
        {
          ...(q.nodeId ? { nodeId: q.nodeId } : {}),
          ...(q.onlyInStock ? { onlyInStock: true } : {}),
          ...(q.search.trim() ? { search: q.search.trim() } : {}),
          page: q.page,
          limit: q.pageSize,
        },
        tradeContext(this.scope, 'BRANCH'),
      );
      if (seq !== this.listSeq || this.destroyed) return;
      this.rows.set(res.items);
      this.total.set(res.total);
    } catch (error) {
      if (seq !== this.listSeq || this.destroyed) return;
      this.rows.set([]);
      this.total.set(0);
      if (isForbiddenError(error)) {
        this.loadFailed.set(false);
        this.forbidden.set(true);
        return;
      }
      this.loadErrorKey.set(errorKey(error));
      this.loadFailed.set(true);
    } finally {
      if (seq === this.listSeq && !this.destroyed) {
        this.loading.set(false);
      }
    }
  }
}

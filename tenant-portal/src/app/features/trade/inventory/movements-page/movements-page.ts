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
import {
  tablerAlertTriangle,
  tablerPlus,
  tablerTruck,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { ScopeState } from '../../../../core/scope/scope';
import {
  ActionsMenu,
  type ActionItem,
  type ActionSelection,
} from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { DateField } from '../../../../shared/ui/date-time/date-field';
import { Dropdown, type DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../shared/ui/field/field';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { Pagination } from '../../../../shared/ui/pagination/pagination';
import { SettingsFrame } from '../../../../shared/ui/settings-frame/settings-frame';
import { SettingsNotice } from '../../../../shared/ui/settings-notice/settings-notice';
import { StepFilter, type StepOption } from '../../../../shared/ui/step-filter/step-filter';
import { branchGrants } from '../../shared/trade-access';
import { tradeContext } from '../../shared/trade-api';
import { listMovements, listNodes } from '../inventory.api';
import {
  INVENTORY_LIMITS,
  type FulfillmentNode,
  type LedgerEntry,
  type LedgerEntryDetail,
  type MovementQuery,
} from '../inventory.model';
import {
  canReverseEntry,
  errorKey,
  formatDateTime,
  hasBranchGrant,
  isForbiddenError,
  itemName,
  shortId,
  signOf,
} from '../inventory.service';
import { InventoryBadge } from '../inventory-shared/inventory-badge/inventory-badge';
import { InventoryQuantity } from '../inventory-shared/inventory-quantity/inventory-quantity';
import { MovementModal } from '../movement-modal/movement-modal';
import { OpeningBalanceModal } from '../opening-balance-modal/opening-balance-modal';
import { ReverseModal } from '../reverse-modal/reverse-modal';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = INVENTORY_LIMITS.pageSize;
const PAGE_SIZES: number[] = [20, 50, 100];
const SEARCH_DEBOUNCE_MS = 300;
const SKELETON_ROWS = [0, 1, 2, 3, 4] as const;
const ISO_DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

type MovementGroupFilter = '' | 'OPENING' | 'RECEIPT' | 'DELIVERY' | 'REVERSAL';

interface MovementCounts {
  all: number | null;
  OPENING: number | null;
  RECEIPT: number | null;
  DELIVERY: number | null;
  REVERSAL: number | null;
}

const EMPTY_COUNTS: MovementCounts = {
  all: null,
  OPENING: null,
  RECEIPT: null,
  DELIVERY: null,
  REVERSAL: null,
};

interface MovementsQueryState {
  nodeId: string;
  itemId: string;
  group: MovementGroupFilter;
  from: string;
  to: string;
  sourceId: string;
  search: string;
  page: number;
  pageSize: number;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const ym = `${String(year).padStart(4, '0')}-${pad2(month + 1)}`;
  return {
    from: `${ym}-01`,
    to: `${ym}-${pad2(lastDay)}`,
  };
}

function parseGroupFilter(raw: string | null | undefined): MovementGroupFilter {
  const norm = raw?.trim().toUpperCase();
  if (norm === 'OPENING' || norm === 'RECEIPT' || norm === 'DELIVERY' || norm === 'REVERSAL') {
    return norm;
  }
  return '';
}

function parseIsoDayParam(raw: string | null | undefined): string {
  const trimmed = raw?.trim() ?? '';
  if (!ISO_DAY_RE.test(trimmed)) return '';
  return trimmed;
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

@Component({
  selector: 'app-movements-page',
  imports: [
    TranslocoPipe,
    NgIcon,
    ActionsMenu,
    Button,
    DateField,
    Dropdown,
    Field,
    FullState,
    Pagination,
    SettingsFrame,
    SettingsNotice,
    StepFilter,
    InventoryBadge,
    InventoryQuantity,
    OpeningBalanceModal,
    MovementModal,
    ReverseModal,
  ],
  providers: [
    provideTranslocoScope('settings', { scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-inventory', alias: 'tradeInventory' }, { scope: 'trade-inventory-movements', alias: 'invMoves' }),
    provideIcons({ tablerAlertTriangle, tablerPlus, tablerTruck, tablerX }),
  ],
  templateUrl: './movements-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col' },
})
export class MovementsPage {
  private static nextId = 0;
  protected readonly uid = `movements-page-${++MovementsPage.nextId}`;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly scope = inject(ScopeState);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly paramMap = toSignal(this.route.paramMap);
  private readonly queryParamMap = toSignal(this.route.queryParamMap);

  private readonly openingBalanceModal = viewChild(OpeningBalanceModal);
  private readonly movementModal = viewChild(MovementModal);
  private readonly reverseModal = viewChild.required(ReverseModal);

  protected readonly forbidden = signal(false);
  protected readonly canRead = computed(() => this.hasGrant('trade.inventory.read'));
  protected readonly showForbidden = computed(() => !this.canRead() || this.forbidden());
  protected readonly canOpening = computed(
    () => !this.forbidden() && this.hasGrant('trade.inventory.opening_balance'),
  );
  protected readonly canAdjust = computed(
    () => !this.forbidden() && this.hasGrant('trade.inventory.adjust'),
  );
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly gridColumns =
    'grid-cols-trade-inv-movement-row-actions';

  private readonly defaultMonth = currentMonthRange();

  protected readonly nodes = signal<FulfillmentNode[]>([]);
  protected readonly rows = signal<LedgerEntry[]>([]);
  protected readonly total = signal(0);
  protected readonly counts = signal<MovementCounts>(EMPTY_COUNTS);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly loadErrorKey = signal('invMoves.loadFailed');
  private readonly reloadTick = signal(0);
  private readonly resolvedSourceNumber = signal<{ sourceId: string; sourceNumber: string } | null>(
    null,
  );

  private readonly initialSearch = this.route.snapshot.queryParamMap.get('search') ?? '';
  protected readonly searchInput = signal(this.initialSearch);
  private lastSyncedSearch = this.initialSearch;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private nodesSeq = 0;
  private listSeq = 0;
  private countsSeq = 0;
  private lastCountsKey = '';
  private lastCountsReloadTick = -1;
  private openedModalId: string | null = null;
  private lastScopeKey = '';
  private destroyed = false;

  protected readonly routeId = computed(() => this.paramMap()?.get('id')?.trim() || null);

  protected readonly listQuery = computed<MovementsQueryState>(() => {
    const qp = this.queryParamMap();
    const sourceId = qp?.get('source')?.trim() ?? '';
    const hasFrom = qp?.has('from') ?? false;
    const hasTo = qp?.has('to') ?? false;

    const from = hasFrom
      ? parseIsoDayParam(qp?.get('from'))
      : sourceId
        ? ''
        : this.defaultMonth.from;
    const to = hasTo
      ? parseIsoDayParam(qp?.get('to'))
      : sourceId
        ? ''
        : this.defaultMonth.to;

    return {
      nodeId: qp?.get('node')?.trim() ?? '',
      itemId: qp?.get('item')?.trim() ?? '',
      group: parseGroupFilter(qp?.get('group')),
      from,
      to,
      sourceId,
      search: qp?.get('search') ?? '',
      page: parsePage(qp?.get('page')),
      pageSize: parsePageSize(qp?.get('size')),
    };
  });

  protected readonly nodeFilter = computed(() => this.listQuery().nodeId);
  protected readonly groupFilter = computed(() => this.listQuery().group);
  protected readonly fromFilter = computed(() => this.listQuery().from);
  protected readonly toFilter = computed(() => this.listQuery().to);
  protected readonly sourceFilter = computed(() => this.listQuery().sourceId);
  protected readonly urlSearch = computed(() => this.listQuery().search);
  protected readonly page = computed(() => this.listQuery().page);
  protected readonly pageSize = computed(() => this.listQuery().pageSize);

  protected readonly dateRangeInvalid = computed(() => {
    const from = this.fromFilter();
    const to = this.toFilter();
    return Boolean(from && to && to < from);
  });

  protected readonly hasActiveFilters = computed(() => {
    const q = this.listQuery();
    if (q.nodeId || q.itemId || q.group || q.sourceId || q.search.trim()) {
      return true;
    }
    if (q.from !== this.defaultMonth.from || q.to !== this.defaultMonth.to) {
      return true;
    }
    return false;
  });

  protected readonly nodeOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const options: DropdownOption<string>[] = [
      { value: '', label: this.transloco.translate('invMoves.filters.allNodes') },
    ];
    for (const node of this.nodes()) {
      options.push({
        value: node.id,
        label: `\u2066${node.code}\u2069 — ${node.name}`,
      });
    }
    return options;
  });

  protected readonly steps = computed<StepOption[]>(() => {
    this.i18n();
    const c = this.counts();
    return [
      { id: '', label: this.transloco.translate('invMoves.steps.all'), count: c.all },
      { id: 'OPENING', label: this.transloco.translate('invMoves.steps.opening'), count: c.OPENING },
      {
        id: 'RECEIPT',
        label: this.transloco.translate('invMoves.steps.receipts'),
        count: c.RECEIPT,
        tone: 'success',
      },
      { id: 'DELIVERY', label: this.transloco.translate('invMoves.steps.deliveries'), count: c.DELIVERY },
      {
        id: 'REVERSAL',
        label: this.transloco.translate('invMoves.steps.reversals'),
        count: c.REVERSAL,
        tone: 'danger',
      },
    ];
  });

  constructor() {
    // Keep default current-month date range in the URL when no source or date params are set.
    effect(() => {
      const qp = this.queryParamMap();
      if (!qp) return;
      if (!qp.has('source') && !qp.has('from') && !qp.has('to')) {
        untracked(() => {
          this.updateQueryParams(
            { from: this.defaultMonth.from, to: this.defaultMonth.to },
            true,
          );
        });
      }
    });

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
      const compId = this.scope.company()?.id ?? '';
      const brId = this.scope.branch()?.id ?? '';
      const scopeKey = `${compId}|${brId}`;
      this.reloadTick();
      const allowed = this.canRead();
      untracked(() => {
        if (scopeKey !== this.lastScopeKey) {
          this.lastScopeKey = scopeKey;
          this.forbidden.set(false);
        }
        if (!allowed) {
          this.nodes.set([]);
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
      const tick = this.reloadTick();

      if (!allowed) {
        untracked(() => {
          this.loading.set(false);
          this.loadFailed.set(false);
          this.rows.set([]);
          this.total.set(0);
          this.counts.set(EMPTY_COUNTS);
        });
        return;
      }

      if (q.from && q.to && q.to < q.from) {
        untracked(() => {
          this.loading.set(false);
          this.loadFailed.set(false);
          this.rows.set([]);
          this.total.set(0);
          this.counts.set(EMPTY_COUNTS);
        });
        return;
      }

      untracked(() => {
        void this.loadMovements(q);
        const countsKey = [
          q.nodeId,
          q.itemId,
          q.from,
          q.to,
          q.sourceId,
          q.search.trim(),
        ].join('|');
        if (countsKey !== this.lastCountsKey || tick !== this.lastCountsReloadTick) {
          this.lastCountsKey = countsKey;
          this.lastCountsReloadTick = tick;
          void this.loadCounts(q);
        }
      });
    });

    effect(() => {
      if (this.showForbidden()) return;
      const id = this.routeId();
      const modal = this.movementModal();
      if (!modal) return;
      if (id) {
        if (this.openedModalId !== id) {
          this.openedModalId = id;
          untracked(() => modal.open(id));
        }
      } else if (this.openedModalId !== null) {
        this.openedModalId = null;
        untracked(() => modal.closeSilently());
      }
    });

    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.clearSearchTimer();
      this.nodesSeq += 1;
      this.listSeq += 1;
      this.countsSeq += 1;
    });
  }

  protected reload(): void {
    if (!this.canRead()) return;
    this.forbidden.set(false);
    this.reloadTick.update((n) => n + 1);
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
    this.reload();
  }

  protected onNodeFilterChange(nodeId: string): void {
    if (nodeId === this.nodeFilter()) return;
    this.updateQueryParams({ node: nodeId || null, page: null });
  }

  protected onFromFilterChange(nextFrom: string | null): void {
    const clean = nextFrom?.trim() ?? '';
    if (clean === this.fromFilter()) return;
    const currentTo = this.toFilter();
    const patch: Record<string, string | number | null> = {
      from: clean,
      page: null,
    };
    if (clean && currentTo && currentTo < clean) {
      patch['to'] = clean;
    }
    this.updateQueryParams(patch);
  }

  protected onToFilterChange(nextTo: string | null): void {
    const clean = nextTo?.trim() ?? '';
    if (clean === this.toFilter()) return;
    this.updateQueryParams({ to: clean, page: null });
  }

  protected clearSourceFilter(): void {
    if (!this.sourceFilter()) return;
    this.resolvedSourceNumber.set(null);
    this.updateQueryParams({ source: null, page: null });
  }

  protected onGroupChange(nextGroup: string): void {
    const parsed = parseGroupFilter(nextGroup);
    if (parsed === this.groupFilter()) return;
    this.updateQueryParams({ group: parsed || null, page: null });
  }

  protected onPageChange(nextPage: number): void {
    const clamped = Math.max(DEFAULT_PAGE, nextPage);
    if (clamped === this.page()) return;
    this.updateQueryParams({ page: clamped === DEFAULT_PAGE ? null : clamped });
  }

  protected onPageSizeChange(nextSize: number): void {
    if (!PAGE_SIZES.includes(nextSize) || nextSize === this.pageSize()) return;
    this.updateQueryParams({
      size: nextSize === DEFAULT_PAGE_SIZE ? null : nextSize,
      page: null,
    });
  }

  protected clearFilters(): void {
    this.clearSearchTimer();
    this.lastSyncedSearch = '';
    this.searchInput.set('');
    this.resolvedSourceNumber.set(null);
    this.updateQueryParams({
      node: null,
      item: null,
      group: null,
      source: null,
      search: null,
      from: this.defaultMonth.from,
      to: this.defaultMonth.to,
      page: null,
    });
  }

  protected openMovement(row: LedgerEntry): void {
    void this.router.navigate(['/trade/inventory/movements', row.id], {
      queryParamsHandling: 'preserve',
    });
  }

  protected onOpenMovementById(id: string): void {
    void this.router.navigate(['/trade/inventory/movements', id], {
      queryParamsHandling: 'preserve',
    });
  }

  protected onOpenDecision(decisionId: string): void {
    void this.router.navigate(['/trade/inventory/decisions', decisionId]);
  }

  protected onRowKeydown(event: KeyboardEvent, row: LedgerEntry): void {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.openMovement(row);
    }
  }

  protected onMovementModalClosed(): void {
    this.openedModalId = null;
    if (this.routeId()) {
      void this.router.navigate(['/trade/inventory/movements'], {
        queryParamsHandling: 'preserve',
      });
    }
  }

  protected onReverseFromDetail(detail: LedgerEntryDetail): void {
    if (!this.canAdjust()) return;
    this.reverseModal().open(detail);
  }

  protected onReversed(): void {
    this.reload();
    if (this.routeId()) {
      this.movementModal()?.reload();
    }
  }

  protected sourceDisplayLabel(sourceId: string): string {
    const rowMatch = this.rows().find((r) => r.sourceId === sourceId && r.sourceNumber);
    if (rowMatch?.sourceNumber) return rowMatch.sourceNumber;
    const cached = this.resolvedSourceNumber();
    if (cached && cached.sourceId === sourceId && cached.sourceNumber) {
      return cached.sourceNumber;
    }
    return shortId(sourceId);
  }

  protected localizedItemName(row: LedgerEntry): string {
    return itemName(row.itemNames, this.language());
  }

  protected hasOriginalColumnValue(row: LedgerEntry): boolean {
    return row.uomId !== row.normalizedUomId;
  }

  protected serialCountLabel(count: number): string {
    this.i18n();
    const lang = this.language();
    const rule = new Intl.PluralRules(lang).select(count);
    return this.transloco.translate(`invMoves.serialCount.${rule}`, { count });
  }

  protected formatDateTime(iso: string): string {
    return formatDateTime(iso);
  }

  protected canReverseRow(row: LedgerEntry): boolean {
    return canReverseEntry(row, this.canAdjust());
  }

  protected rowActions(row: LedgerEntry): ActionItem[] {
    this.i18n();
    const items: ActionItem[] = [
      {
        id: 'open',
        title: this.transloco.translate('invMoves.actions.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
    ];

    if (row.policyDecisionReceiptId) {
      items.push({
        id: 'openDecision',
        title: this.transloco.translate('invMoves.actions.openDecision'),
        icon: 'tablerLink',
        tile: 'bg-icon-blue',
      });
    }

    if (this.canReverseRow(row)) {
      items.push({
        id: 'reverse',
        title: this.transloco.translate('invMoves.actions.reverse'),
        icon: 'tablerArrowBackUp',
        tile: 'bg-icon-red',
        danger: true,
      });
    }

    return items;
  }

  protected onRowAction(row: LedgerEntry, selection: ActionSelection): void {
    switch (selection.id) {
      case 'open':
        this.openMovement(row);
        break;
      case 'openDecision':
        if (row.policyDecisionReceiptId) {
          this.onOpenDecision(row.policyDecisionReceiptId);
        }
        break;
      case 'reverse':
        if (this.canReverseRow(row)) {
          this.reverseModal().open(row);
        }
        break;
    }
  }

  private applySearchParam(term: string): void {
    if (term === this.lastSyncedSearch) return;
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

  private buildBaseQuery(q: MovementsQueryState): Omit<MovementQuery, 'group' | 'page' | 'limit'> {
    return {
      ...(q.nodeId ? { nodeId: q.nodeId } : {}),
      ...(q.itemId ? { itemId: q.itemId } : {}),
      ...(q.from ? { from: q.from } : {}),
      ...(q.to ? { to: q.to } : {}),
      ...(q.sourceId ? { sourceId: q.sourceId } : {}),
      ...(q.search.trim() ? { search: q.search.trim() } : {}),
    };
  }

  private async loadNodesForBranch(): Promise<void> {
    if (!this.canRead()) return;
    const seq = ++this.nodesSeq;
    try {
      const list = await listNodes({}, tradeContext(this.scope, 'BRANCH'));
      if (seq !== this.nodesSeq || this.destroyed) return;
      this.nodes.set(list);

      const selectedNode = this.nodeFilter();
      if (selectedNode && !list.some((node) => node.id === selectedNode)) {
        this.updateQueryParams({ node: null, page: null }, true);
      }
    } catch (error) {
      if (seq !== this.nodesSeq || this.destroyed) return;
      this.nodes.set([]);
      if (isForbiddenError(error)) {
        this.loadFailed.set(false);
        this.forbidden.set(true);
      }
    }
  }

  private async loadMovements(q: MovementsQueryState): Promise<void> {
    if (!this.canRead()) {
      this.loading.set(false);
      return;
    }
    const seq = ++this.listSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    const base = this.buildBaseQuery(q);

    try {
      const res = await listMovements(
        {
          ...base,
          ...(q.group ? { group: q.group } : {}),
          page: q.page,
          limit: q.pageSize,
        },
        tradeContext(this.scope, 'BRANCH'),
      );
      if (seq !== this.listSeq || this.destroyed) return;
      this.rows.set(res.items);
      this.total.set(res.total);
      if (q.sourceId) {
        const match = res.items.find((r) => r.sourceId === q.sourceId && r.sourceNumber);
        if (match?.sourceNumber) {
          this.resolvedSourceNumber.set({
            sourceId: q.sourceId,
            sourceNumber: match.sourceNumber,
          });
        }
      }
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

  private async loadCounts(q: MovementsQueryState): Promise<void> {
    if (!this.canRead()) return;
    const seq = ++this.countsSeq;
    const ctx = tradeContext(this.scope, 'BRANCH');
    const base = {
      ...this.buildBaseQuery(q),
      page: 1,
      limit: 1,
    };

    try {
      const [all, opening, receipt, delivery, reversal] = await Promise.all([
        listMovements(base, ctx),
        listMovements({ ...base, group: 'OPENING' }, ctx),
        listMovements({ ...base, group: 'RECEIPT' }, ctx),
        listMovements({ ...base, group: 'DELIVERY' }, ctx),
        listMovements({ ...base, group: 'REVERSAL' }, ctx),
      ]);
      if (seq !== this.countsSeq || this.destroyed) return;
      this.counts.set({
        all: all.total,
        OPENING: opening.total,
        RECEIPT: receipt.total,
        DELIVERY: delivery.total,
        REVERSAL: reversal.total,
      });
      if (q.sourceId && all.items[0]?.sourceNumber) {
        this.resolvedSourceNumber.set({
          sourceId: q.sourceId,
          sourceNumber: all.items[0].sourceNumber,
        });
      }
    } catch (error) {
      if (seq !== this.countsSeq || this.destroyed) return;
      this.counts.set(EMPTY_COUNTS);
      if (isForbiddenError(error)) {
        this.loadFailed.set(false);
        this.forbidden.set(true);
      }
    }
  }

  private hasGrant(key: string): boolean {
    const grants = runInInjectionContext(this.injector, () => branchGrants(key));
    return hasBranchGrant(grants, this.scope.branch()?.id ?? null);
  }
}

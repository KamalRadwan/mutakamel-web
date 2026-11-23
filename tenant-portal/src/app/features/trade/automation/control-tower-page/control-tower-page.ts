import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  resource,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerCircleCheck,
  tablerInbox,
  tablerMinus,
  tablerRefresh,
  tablerSearch,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { ScopeState } from '../../../../core/scope/scope';
import { BulkJobsTracker } from '../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { Button } from '../../../../shared/ui/button/button';
import { Checkbox } from '../../../../shared/ui/checkbox/checkbox';
import { Dropdown, type DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../shared/ui/field/field';
import { Pagination } from '../../../../shared/ui/pagination/pagination';
import { StepFilter, type StepOption } from '../../../../shared/ui/step-filter/step-filter';
import { ApiError, type TradeContext, tradeContext } from '../../shared/trade-api';
import type { ScopeTarget } from '../automation-fake-actors';
import { AutomationBadge } from '../automation-shared/automation-badge/automation-badge';
import { ScopeChip } from '../automation-shared/scope-chip/scope-chip';
import {
  formatTowerDateTime,
  isTowerRowSelectable,
  resolveTowerSourceLink,
  towerSourceLabel,
  translateTowerError,
  translateTowerProblem,
} from '../tower.util';
import { ExceptionModal } from '../exception-modal/exception-modal';
import { TowerBulkBar } from '../tower-bulk-bar/tower-bulk-bar';
import { getCounts, listExceptions } from '../tower.api';
import {
  TOWER_CATEGORIES,
  type TowerCardCounts,
  type TowerCategory,
  type TowerException,
  type TowerResolutionCode,
  type TowerScopeFilter,
  type TowerSelectionQuery,
  type TowerSeverity,
  type TowerSort,
  type TowerSourceRoute,
  type TowerStatus,
  allowedCodesFor,
  isResolvableStatus,
  resolutionCodesFor,
  toTowerCardCounts,
} from '../tower.model';

const CAN = { resolve: true }; // later from the session

type TowerStepStatus = 'OPEN' | 'ACTION_PENDING' | 'RESOLVED' | 'QUARANTINED';
type SeverityFilter = '' | 'HIGH' | 'CRITICAL';
type CategoryFilter = '' | TowerCategory;

/** Each step sends a comma list of backend statuses. */
const STEP_STATUSES: Readonly<Record<TowerStepStatus, TowerStatus[]>> = {
  OPEN: ['OPEN', 'ACKNOWLEDGED'],
  ACTION_PENDING: ['ACTION_PENDING', 'RECONCILIATION_PENDING'],
  RESOLVED: ['RESOLVED'],
  QUARANTINED: ['QUARANTINED'],
};

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 24;
const PAGE_SIZES: readonly number[] = [12, 24, 48, 96];

const VALID_STEPS: ReadonlySet<string> = new Set(Object.keys(STEP_STATUSES));
const VALID_CATEGORIES: readonly TowerCategory[] = TOWER_CATEGORIES;

interface StatCardItem {
  id: string;
  label: string;
  value: number;
  sub: string;
  barClass: string;
  percent: number;
}

function parseStepStatus(raw: string | undefined): TowerStepStatus {
  const upper = raw?.trim().toUpperCase() ?? 'OPEN';
  return VALID_STEPS.has(upper) ? (upper as TowerStepStatus) : 'OPEN';
}

function parseSeverity(raw: string | undefined): SeverityFilter {
  const upper = raw?.trim().toUpperCase();
  if (upper === 'HIGH' || upper === 'CRITICAL') return upper;
  return '';
}

function parseCategory(raw: string | undefined): CategoryFilter {
  const upper = raw?.trim().toUpperCase();
  if (upper && (VALID_CATEGORIES as readonly string[]).includes(upper)) {
    return upper as TowerCategory;
  }
  return '';
}

function parseSort(raw: string | undefined): TowerSort {
  return raw?.trim() === 'severity' ? 'severity' : 'createdAt';
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw || !/^\d+$/.test(raw)) return fallback;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : fallback;
}

function parsePageSize(raw: string | undefined): number {
  const parsed = parsePositiveInt(raw, DEFAULT_PAGE_SIZE);
  return PAGE_SIZES.includes(parsed) ? parsed : DEFAULT_PAGE_SIZE;
}

function parseScope(raw: string | undefined, hasCompany: boolean): ScopeTarget {
  const upper = raw?.trim().toUpperCase();
  if (upper === 'TENANT' || upper === 'BRANCH' || upper === 'COMPANY') {
    return upper;
  }
  return hasCompany ? 'COMPANY' : 'TENANT';
}

function ratioPercent(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || value <= 0 || total <= 0) {
    return 0;
  }
  return Math.max(4, Math.min(100, Math.round((value / total) * 100)));
}

function intersectResolutionCodes(
  rows: Iterable<TowerException>,
): readonly TowerResolutionCode[] {
  let common: TowerResolutionCode[] | null = null;
  for (const row of rows) {
    const allowed = allowedCodesFor(row);
    if (common === null) {
      common = [...allowed];
    } else {
      const allowedSet = new Set<TowerResolutionCode>(allowed);
      common = common.filter((code) => allowedSet.has(code));
    }
    if (common.length === 0) return [];
  }
  return common ?? [];
}

@Component({
  selector: 'app-control-tower-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    Checkbox,
    Dropdown,
    Field,
    Pagination,
    StepFilter,
    AutomationBadge,
    ScopeChip,
    TowerBulkBar,
    ExceptionModal,
  ],
  providers: [
    provideTranslocoScope(
      { scope: 'trade-auto-tower', alias: 'tower' },
      { scope: 'trade-automation', alias: 'automation' },
      { scope: 'trade-shared', alias: 'tradeShared' },
      'settings',
    ),
    provideIcons({
      tablerAlertTriangle,
      tablerCircleCheck,
      tablerInbox,
      tablerMinus,
      tablerRefresh,
      tablerSearch,
    }),
  ],
  templateUrl: './control-tower-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col gap-8 p-12' },
})
export class ControlTowerPage {
  private static nextId = 0;
  protected readonly uid = `control-tower-${++ControlTowerPage.nextId}`;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly scopeState = inject(ScopeState);
  private readonly tracker = inject(BulkJobsTracker);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly lang = inject(LanguageState).current;

  private readonly headerCheckboxEl = viewChild('pageCb', { read: ElementRef<HTMLElement> });

  readonly statusParam = input<string | undefined>(undefined, { alias: 'status' });
  readonly severityParam = input<string | undefined>(undefined, { alias: 'severity' });
  readonly categoryParam = input<string | undefined>(undefined, { alias: 'category' });
  readonly pageParam = input<string | undefined>(undefined, { alias: 'page' });
  readonly sizeParam = input<string | undefined>(undefined, { alias: 'size' });
  readonly idParam = input<string | undefined>(undefined, { alias: 'id' });
  readonly scopeParam = input<string | undefined>(undefined, { alias: 'scope' });
  readonly branchParam = input<string | undefined>(undefined, { alias: 'branch' });
  readonly sortParam = input<string | undefined>(undefined, { alias: 'sort' });
  /** Bulk job report deep link (backend reportRoute: /trade/automation/control-tower?job=<id>). */
  readonly jobParam = input<string | undefined>(undefined, { alias: 'job' });

  protected readonly canResolve = CAN.resolve;
  protected readonly pageSizes = [...PAGE_SIZES];
  protected readonly skeletonRows = [1, 2, 3, 4, 5];
  protected readonly gridCols = computed(() =>
    this.canResolve ? 'grid-cols-auto-tower-row-select' : 'grid-cols-auto-tower-row',
  );

  private readonly refreshTick = signal(0);
  private readonly selectionMode = signal<'ids' | 'query'>('ids');
  private readonly selectedById = signal<ReadonlyMap<string, TowerException>>(new Map());
  private readonly excludedIds = signal<ReadonlySet<string>>(new Set());
  private readonly queryTotal = signal(0);

  private lastShiftKey = false;
  private lastClickedId: string | null = null;
  private lastFilterKey = '';
  private lastCompanyId: string | null = null;
  private readonly refreshedJobIds = new Set<string>();

  protected readonly statusFilter = computed<TowerStepStatus>(() =>
    parseStepStatus(this.statusParam()),
  );
  protected readonly severityFilter = computed<SeverityFilter>(() =>
    parseSeverity(this.severityParam()),
  );
  protected readonly categoryFilter = computed<CategoryFilter>(() =>
    parseCategory(this.categoryParam()),
  );
  protected readonly page = computed(() => parsePositiveInt(this.pageParam(), DEFAULT_PAGE));
  protected readonly pageSize = computed(() => parsePageSize(this.sizeParam()));
  protected readonly selectedExceptionId = computed(() => this.idParam()?.trim() || null);

  protected readonly scopeTarget = computed<ScopeTarget>(() =>
    parseScope(this.scopeParam(), !!this.scopeState.company()?.id),
  );

  /** Scope context (sent as headers): TENANT none, COMPANY company, BRANCH company + branch. */
  protected readonly context = computed<TradeContext>(() =>
    tradeContext(this.scopeState, this.scopeTarget()),
  );

  protected readonly sortFilter = computed<TowerSort>(() => parseSort(this.sortParam()));

  /** Branch filter: company context only, and only a branch of the context company. */
  protected readonly branchFilter = computed<string>(() => {
    if (this.scopeTarget() !== 'COMPANY') return '';
    const raw = this.branchParam()?.trim() ?? '';
    return this.scopeState.branches().some((b) => b.id === raw) ? raw : '';
  });

  /** Company context shows the company and all its branches unless one branch is picked. */
  protected readonly scopeFilter = computed<TowerScopeFilter>(() => {
    if (this.scopeTarget() !== 'COMPANY' || !this.context().companyId) return {};
    const branchId = this.branchFilter();
    return branchId ? { branchId } : { includeBranches: true };
  });

  protected readonly filterQuery = computed<TowerSelectionQuery>(() => {
    const severity = this.severityFilter();
    const category = this.categoryFilter();
    const sort = this.sortFilter();
    return {
      status: [...STEP_STATUSES[this.statusFilter()]],
      ...(severity ? { severity: severity as TowerSeverity } : {}),
      ...(category ? { category: category as TowerCategory } : {}),
      ...(sort !== 'createdAt' ? { sort } : {}),
      ...this.scopeFilter(),
    };
  });

  private readonly countsResource = resource({
    params: () => ({
      ctx: this.context(),
      scope: this.scopeFilter(),
      tick: this.refreshTick(),
    }),
    loader: ({ params }) => getCounts(params.ctx, params.scope),
  });

  private readonly listResource = resource({
    params: () => ({
      ctx: this.context(),
      query: this.filterQuery(),
      page: this.page(),
      limit: Math.min(100, this.pageSize()),
      tick: this.refreshTick(),
    }),
    loader: ({ params }) =>
      listExceptions(params.ctx, { ...params.query, page: params.page, limit: params.limit }),
  });

  protected readonly counts = computed<TowerCardCounts | null>(() =>
    this.countsResource.hasValue() ? toTowerCardCounts(this.countsResource.value()) : null,
  );
  protected readonly countsFailed = computed(() => !!this.countsResource.error());
  protected readonly countsLoading = computed(
    () => this.countsResource.isLoading() && !this.countsResource.hasValue(),
  );

  protected readonly loading = computed(
    () => this.listResource.isLoading() && !this.listResource.hasValue(),
  );
  protected readonly refreshing = computed(
    () => this.listResource.isLoading() || this.countsResource.isLoading(),
  );
  protected readonly failed = computed(() => !!this.listResource.error());
  /** A scope denial (branch filter or branch rows outside the company scope) says why; anything else is generic. */
  protected readonly loadFailedText = computed(() => {
    this.i18n();
    const error = this.listResource.error();
    return error instanceof ApiError && error.code === 'TRADE.CONTROL_TOWER.SCOPE_DENIED'
      ? translateTowerError(this.transloco, error)
      : this.transloco.translate('tower.states.loadFailed');
  });

  protected readonly items = computed<TowerException[]>(() =>
    this.listResource.hasValue() ? this.listResource.value().items : [],
  );
  protected readonly total = computed(() =>
    this.listResource.hasValue() ? this.listResource.value().total : 0,
  );

  protected readonly hasSecondaryFilters = computed(
    () => this.severityFilter() !== '' || this.categoryFilter() !== '' || this.branchFilter() !== '',
  );

  protected readonly statCards = computed<StatCardItem[]>(() => {
    this.i18n();
    const c = this.counts();
    if (!c) return [];
    const totalShown = c.total;
    return [
      {
        id: 'open',
        label: this.transloco.translate('tower.stats.open'),
        value: c.open,
        sub: this.transloco.translate('tower.stats.openSub'),
        barClass: 'bg-danger',
        percent: ratioPercent(c.open, totalShown),
      },
      {
        id: 'actionPending',
        label: this.transloco.translate('tower.stats.actionPending'),
        value: c.actionPending,
        sub: this.transloco.translate('tower.stats.actionPendingSub'),
        barClass: 'bg-warning',
        percent: ratioPercent(c.actionPending, totalShown),
      },
      {
        id: 'resolvedToday',
        label: this.transloco.translate('tower.stats.resolvedToday'),
        value: c.resolvedToday,
        sub: this.transloco.translate('tower.stats.resolvedTodaySub'),
        barClass: 'bg-success',
        percent: ratioPercent(c.resolvedToday, totalShown),
      },
      {
        id: 'highOrCritical',
        label: this.transloco.translate('tower.stats.highOrCritical'),
        value: c.highOrCritical,
        sub: this.transloco.translate('tower.stats.highOrCriticalSub', { total: totalShown }),
        barClass: 'bg-danger',
        percent: ratioPercent(c.highOrCritical, totalShown),
      },
    ];
  });

  protected readonly stepOptions = computed<StepOption[]>(() => {
    this.i18n();
    const c = this.counts();
    return [
      {
        id: 'OPEN',
        label: this.transloco.translate('tower.steps.OPEN'),
        count: c ? c.open : null,
      },
      {
        id: 'ACTION_PENDING',
        label: this.transloco.translate('tower.steps.ACTION_PENDING'),
        count: c ? c.actionPending : null,
      },
      {
        id: 'RESOLVED',
        label: this.transloco.translate('tower.steps.RESOLVED'),
        tone: 'success',
        count: c ? c.resolved : null,
      },
      {
        id: 'QUARANTINED',
        label: this.transloco.translate('tower.steps.QUARANTINED'),
        count: c ? c.quarantined : null,
      },
    ];
  });

  protected readonly severityOptions = computed<DropdownOption<SeverityFilter>[]>(() => {
    this.i18n();
    return [
      { value: '', label: this.transloco.translate('tower.filters.allSeverities') },
      { value: 'HIGH', label: this.transloco.translate('tower.filters.HIGH') },
      { value: 'CRITICAL', label: this.transloco.translate('tower.filters.CRITICAL') },
    ];
  });

  protected readonly categoryOptions = computed<DropdownOption<CategoryFilter>[]>(() => {
    this.i18n();
    return [
      { value: '', label: this.transloco.translate('tower.filters.allCategories') },
      ...VALID_CATEGORIES.map((category) => ({
        value: category as CategoryFilter,
        label: this.transloco.translate(`tower.categories.${category}`),
      })),
    ];
  });

  protected readonly sortOptions = computed<DropdownOption<TowerSort>[]>(() => {
    this.i18n();
    return [
      { value: 'createdAt', label: this.transloco.translate('tower.filters.sortCreatedAt') },
      { value: 'severity', label: this.transloco.translate('tower.filters.sortSeverity') },
    ];
  });

  protected readonly showBranchFilter = computed(
    () => this.scopeTarget() === 'COMPANY' && this.scopeState.branches().length > 0,
  );

  protected readonly branchOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const ar = this.lang() === 'ar';
    return [
      { value: '', label: this.transloco.translate('tower.filters.allBranches') },
      ...this.scopeState.branches().map((b) => ({ value: b.id, label: ar ? b.nameAr : b.nameEn })),
    ];
  });

  protected readonly selectablePageRows = computed<TowerException[]>(() =>
    this.items().filter((row) => isTowerRowSelectable(row)),
  );

  protected readonly pageState = computed<'none' | 'some' | 'all'>(() => {
    const selectable = this.selectablePageRows();
    if (selectable.length === 0) return 'none';
    let selected = 0;
    for (const row of selectable) {
      if (this.isSelected(row.id)) selected++;
    }
    if (selected === 0) return 'none';
    if (selected === selectable.length) return 'all';
    return 'some';
  });

  protected readonly selectionModeValue = computed(() => this.selectionMode());

  protected readonly selectionCount = computed(() => {
    if (this.selectionMode() === 'query') {
      return Math.max(0, this.queryTotal() - this.excludedIds().size);
    }
    return this.selectedById().size;
  });

  protected readonly selectedIds = computed<string[]>(() =>
    Array.from(this.selectedById().keys()),
  );

  protected readonly excludedIdsList = computed<string[]>(() =>
    Array.from(this.excludedIds()),
  );

  protected readonly hiddenSelectedCount = computed(() => {
    if (this.selectionMode() === 'query' || this.loading()) return 0;
    const visible = new Set(this.items().map((row) => row.id));
    let hidden = 0;
    for (const id of this.selectedById().keys()) {
      if (!visible.has(id)) hidden++;
    }
    return hidden;
  });

  private readonly canSelectAllShape = computed(
    () =>
      this.selectionMode() === 'ids' &&
      this.statusFilter() !== 'RESOLVED' &&
      this.statusFilter() !== 'QUARANTINED' &&
      this.selectablePageRows().length > 0 &&
      this.pageState() === 'all' &&
      this.total() > this.items().length,
  );

  // "Select all matching" needs one category, so every matching row shares the same resolution codes.
  // That also keeps the count honest: a category with codes has no unselectable rows.
  protected readonly canOfferSelectAll = computed(() => {
    const category = this.categoryFilter();
    return this.canSelectAllShape() && category !== '' && resolutionCodesFor(category).length > 0;
  });

  protected readonly selectAllNeedsCategory = computed(
    () => this.canSelectAllShape() && this.categoryFilter() === '',
  );

  protected readonly bulkAllowedCodes = computed<readonly TowerResolutionCode[]>(() => {
    if (this.selectionMode() === 'query') {
      const category = this.categoryFilter();
      return category ? resolutionCodesFor(category) : [];
    }
    return intersectResolutionCodes(this.selectedById().values());
  });

  constructor() {
    let prevPage = this.page();
    effect(() => {
      const next = this.page();
      if (next !== prevPage) {
        prevPage = next;
        this.host.nativeElement.closest('main')?.scrollTo({ top: 0 });
      }
    });

    effect(() => {
      const state = this.pageState();
      const inputEl = this.headerCheckboxEl()?.nativeElement.querySelector(
        'input[type="checkbox"]',
      ) as HTMLInputElement | null;
      if (inputEl) {
        inputEl.indeterminate = state === 'some';
      }
    });

    effect(() => {
      const companyId = this.scopeState.company()?.id ?? '';
      const q = this.filterQuery();
      const key = JSON.stringify({ q, ctx: this.context() });

      untracked(() => {
        if (this.lastCompanyId !== null && this.lastCompanyId !== companyId) {
          this.clearSelection();
        }
        this.lastCompanyId = companyId;

        if (this.lastFilterKey !== '' && this.lastFilterKey !== key) {
          if (this.selectionMode() === 'query') {
            this.clearSelection();
          }
        }
        this.lastFilterKey = key;
      });
    });

    // ?job=<id> (from the bulk job notification) opens that job's report, then leaves the URL clean.
    effect(() => {
      const jobId = this.jobParam()?.trim();
      if (!jobId) return;
      untracked(() => {
        this.tracker.openReport('trading', jobId);
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { job: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      });
    });

    const initialFinished = this.tracker.finished();
    if (initialFinished) {
      this.refreshedJobIds.add(initialFinished.id);
    }

    effect(() => {
      const finished = this.tracker.finished();
      if (!finished || finished.module !== 'trading.control-tower-exceptions') return;
      if (this.refreshedJobIds.has(finished.id)) return;
      this.refreshedJobIds.add(finished.id);
      untracked(() => {
        this.clearSelection();
        this.reload();
      });
    });

    effect(() => {
      if (this.listResource.isLoading() || !this.listResource.hasValue()) return;
      const res = this.listResource.value();
      const currentPage = this.page();
      if (res.total > 0 && res.items.length === 0 && currentPage > 1) {
        const lastPage = Math.max(1, Math.ceil(res.total / Math.max(1, this.pageSize())));
        if (lastPage < currentPage) {
          untracked(() => this.setPage(lastPage));
        }
      }
    });
  }

  protected reload(): void {
    this.refreshTick.update((n) => n + 1);
  }

  protected setStatus(next: string): void {
    const resolved = parseStepStatus(next);
    if (resolved === this.statusFilter()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        status: resolved === 'OPEN' ? null : resolved,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected setSeverity(next: SeverityFilter): void {
    if (next === this.severityFilter()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        severity: next || null,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected setCategory(next: CategoryFilter): void {
    if (next === this.categoryFilter()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        category: next || null,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected setSort(next: TowerSort): void {
    if (next === this.sortFilter()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { sort: next === 'createdAt' ? null : next, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected setBranch(next: string): void {
    if (next === this.branchFilter()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { branch: next || null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected clearFilters(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        severity: null,
        category: null,
        branch: null,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected setPage(next: number): void {
    const safe = Math.max(DEFAULT_PAGE, next);
    if (safe === this.page()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: safe === DEFAULT_PAGE ? null : safe },
      queryParamsHandling: 'merge',
    });
  }

  protected setPageSize(next: number): void {
    if (!PAGE_SIZES.includes(next) || next === this.pageSize()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        size: next === DEFAULT_PAGE_SIZE ? null : next,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected openException(row: TowerException): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { id: row.id },
      queryParamsHandling: 'merge',
    });
  }

  protected onModalClosed(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { id: null },
      queryParamsHandling: 'merge',
    });
  }

  protected onExceptionResolved(updated: TowerException): void {
    if (this.selectedById().has(updated.id)) {
      this.selectedById.update((map) => {
        const next = new Map(map);
        next.delete(updated.id);
        return next;
      });
    }
    this.reload();
  }

  protected onRowKeydown(event: KeyboardEvent, row: TowerException): void {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      this.openException(row);
      return;
    }
    if ((event.key === ' ' || event.code === 'Space') && this.canResolve && isTowerRowSelectable(row)) {
      event.preventDefault();
      this.applyRowSelection(row, event.shiftKey);
    }
  }

  protected onSourceClick(event: MouseEvent, link: TowerSourceRoute): void {
    event.preventDefault();
    event.stopPropagation();
    void this.router.navigate(link.commands, {
      ...(link.queryParams ? { queryParams: link.queryParams } : {}),
    });
  }

  protected sourceLabelText(row: TowerException): string {
    return towerSourceLabel(row);
  }

  protected sourceLinkFor(row: TowerException): TowerSourceRoute | null {
    return resolveTowerSourceLink(row);
  }

  protected sourceHref(link: TowerSourceRoute): string {
    return this.router.serializeUrl(
      this.router.createUrlTree(link.commands, {
        ...(link.queryParams ? { queryParams: link.queryParams } : {}),
      }),
    );
  }

  protected problemText(code: string | null | undefined): string {
    this.i18n();
    return translateTowerProblem(
      this.transloco,
      code,
      this.transloco.translate('tower.common.none'),
    );
  }

  protected formatDateTime(iso: string | null | undefined): string {
    return formatTowerDateTime(iso, this.lang(), this.transloco.translate('tower.common.none'));
  }

  protected isRowSelectable(row: TowerException): boolean {
    return isTowerRowSelectable(row);
  }

  protected unselectableReason(row: TowerException): string {
    this.i18n();
    if (row.status === 'QUARANTINED') {
      return this.transloco.translate('tower.table.unselectableQuarantined');
    }
    if (!isResolvableStatus(row.status)) {
      return this.transloco.translate('tower.table.unselectableResolved');
    }
    return this.transloco.translate('tower.table.unselectableCategory');
  }

  protected isSelected(id: string): boolean {
    if (this.selectionMode() === 'query') {
      return !this.excludedIds().has(id);
    }
    return this.selectedById().has(id);
  }

  protected togglePage(cb?: Checkbox): void {
    const selectable = this.selectablePageRows();
    if (!this.canResolve || selectable.length === 0) {
      cb?.checked.set(false);
      return;
    }
    const select = this.pageState() !== 'all';
    this.setRowsSelection(selectable, select);
    cb?.checked.set(this.pageState() === 'all');
  }

  protected onRowCheckboxClick(event: MouseEvent): void {
    this.lastShiftKey = event.shiftKey;
    event.stopPropagation();
  }

  protected onRowCheckedChange(row: TowerException, cb?: Checkbox): void {
    const shift = this.lastShiftKey;
    this.lastShiftKey = false;
    this.applyRowSelection(row, shift);
    cb?.checked.set(this.isSelected(row.id));
  }

  protected onSelectCellClick(event: MouseEvent, row: TowerException, cb?: Checkbox): void {
    event.stopPropagation();
    if (!this.canResolve || !isTowerRowSelectable(row)) return;
    this.applyRowSelection(row, event.shiftKey);
    cb?.checked.set(this.isSelected(row.id));
  }

  protected selectAllMatching(): void {
    if (this.total() <= 0 || !this.canOfferSelectAll()) return;
    this.selectionMode.set('query');
    this.selectedById.set(new Map());
    this.excludedIds.set(new Set());
    this.queryTotal.set(this.total());
  }

  protected selectOnlyPage(): void {
    const next = new Map<string, TowerException>();
    for (const row of this.selectablePageRows()) {
      next.set(row.id, row);
    }
    this.selectionMode.set('ids');
    this.excludedIds.set(new Set());
    this.queryTotal.set(0);
    this.selectedById.set(next);
  }

  protected clearSelection(): void {
    this.selectionMode.set('ids');
    this.selectedById.set(new Map());
    this.excludedIds.set(new Set());
    this.queryTotal.set(0);
    this.lastClickedId = null;
  }

  protected onBulkSubmitted(event: { immediateRefresh: boolean }): void {
    this.clearSelection();
    if (event.immediateRefresh) {
      this.reload();
    }
  }

  private applyRowSelection(row: TowerException, shiftKey: boolean): void {
    if (!this.canResolve || !isTowerRowSelectable(row)) return;
    const selectable = this.selectablePageRows();

    if (shiftKey && this.lastClickedId) {
      const startIndex = selectable.findIndex((item) => item.id === this.lastClickedId);
      const endIndex = selectable.findIndex((item) => item.id === row.id);
      if (startIndex !== -1 && endIndex !== -1) {
        const from = Math.min(startIndex, endIndex);
        const to = Math.max(startIndex, endIndex);
        this.setRowsSelection(selectable.slice(from, to + 1), true);
        this.lastClickedId = row.id;
        return;
      }
    }

    if (this.selectionMode() === 'query') {
      this.excludedIds.update((set) => {
        const next = new Set(set);
        if (next.has(row.id)) next.delete(row.id);
        else next.add(row.id);
        return next;
      });
    } else {
      this.selectedById.update((map) => {
        const next = new Map(map);
        if (next.has(row.id)) next.delete(row.id);
        else next.set(row.id, row);
        return next;
      });
    }
    this.lastClickedId = row.id;
  }

  private setRowsSelection(rows: readonly TowerException[], selected: boolean): void {
    if (this.selectionMode() === 'query') {
      this.excludedIds.update((set) => {
        const next = new Set(set);
        for (const row of rows) {
          if (selected) next.delete(row.id);
          else next.add(row.id);
        }
        return next;
      });
      return;
    }

    this.selectedById.update((map) => {
      const next = new Map(map);
      for (const row of rows) {
        if (selected) next.set(row.id, row);
        else next.delete(row.id);
      }
      return next;
    });
  }
}

import {
  Component,
  ElementRef,
  Injector,
  computed,
  effect,
  inject,
  input,
  resource,
  signal,
  untracked,
} from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerCircleCheck,
  tablerInbox,
  tablerRefresh,
  tablerSearch,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { ScopeState } from '../../../../core/scope/scope';
import { Button } from '../../../../shared/ui/button/button';
import { Dropdown, type DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../shared/ui/field/field';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { Pagination } from '../../../../shared/ui/pagination/pagination';
import { StepFilter, type StepOption } from '../../../../shared/ui/step-filter/step-filter';
import { ApiError, type TradeContext, tradeContext } from '../../shared/trade-api';
import type { ScopeTarget } from '../automation-fake-actors';
import { AutomationBadge } from '../automation-shared/automation-badge/automation-badge';
import { ScopeChip } from '../automation-shared/scope-chip/scope-chip';
import {
  formatTowerDateTime,
  formatTowerSafeErrorCode,
  resolveTowerSourceLink,
  towerSourceLabel,
  translateTowerError,
} from '../tower.util';
import { ExceptionModal } from '../exception-modal/exception-modal';
import { getCounts, listExceptions } from '../tower.api';
import {
  TOWER_CATEGORIES,
  type TowerCardCounts,
  type TowerCategory,
  type TowerException,
  type TowerScopeFilter,
  type TowerSelectionQuery,
  type TowerSeverity,
  type TowerSort,
  type TowerSourceRoute,
  type TowerStatus,
  toTowerCardCounts,
} from '../tower.model';
import {
  TOWER_PERMISSIONS,
  contextForException,
  hasTowerGrantForContext,
  hasTowerReadGrant,
  isTowerFilterScopeError,
  isTowerForbiddenError,
  isTowerNotReadyError,
  isTowerQueryInvalidError,
} from './tower-access';

type TowerStepStatus = 'OPEN' | 'ACTION_PENDING' | 'RESOLVED' | 'QUARANTINED';
type SeverityFilter = '' | 'HIGH' | 'CRITICAL';
type CategoryFilter = '' | TowerCategory;
type FilterFieldKey = 'severity' | 'category' | 'branch' | 'sort';

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

@Component({
  selector: 'app-control-tower-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    Dropdown,
    Field,
    FullState,
    Pagination,
    StepFilter,
    AutomationBadge,
    ScopeChip,
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
  private readonly injector = inject(Injector);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly scopeState = inject(ScopeState);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly lang = inject(LanguageState).current;

  readonly statusParam = input<string | undefined>(undefined, { alias: 'status' });
  readonly severityParam = input<string | undefined>(undefined, { alias: 'severity' });
  readonly categoryParam = input<string | undefined>(undefined, { alias: 'category' });
  readonly pageParam = input<string | undefined>(undefined, { alias: 'page' });
  readonly sizeParam = input<string | undefined>(undefined, { alias: 'size' });
  readonly idParam = input<string | undefined>(undefined, { alias: 'id' });
  readonly scopeParam = input<string | undefined>(undefined, { alias: 'scope' });
  readonly branchParam = input<string | undefined>(undefined, { alias: 'branch' });
  readonly sortParam = input<string | undefined>(undefined, { alias: 'sort' });

  protected readonly pageSizes = [...PAGE_SIZES];
  protected readonly skeletonRows = [1, 2, 3, 4, 5];
  protected readonly gridCols = 'grid-cols-auto-tower-row';

  protected readonly forbidden = signal(false);
  protected readonly canRead = computed(() => hasTowerReadGrant(this.injector));

  private readonly refreshTick = signal(0);
  private readonly openedRowContext = signal<{ id: string; ctx: TradeContext } | null>(null);

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

  private readonly availableBranches = computed(() => {
    const direct = this.scopeState.branches().filter((b) => b.nameEn || b.nameAr);
    if (direct.length > 0) return direct;
    return this.scopeState.company().branches.filter((b) => b.nameEn || b.nameAr);
  });

  protected readonly showBranchFilter = computed(
    () => this.scopeTarget() === 'COMPANY' && this.availableBranches().length > 0,
  );

  /** Branch filter: company context only, and only a branch of the context company. */
  protected readonly branchFilter = computed<string>(() => {
    if (this.scopeTarget() !== 'COMPANY') return '';
    const raw = this.branchParam()?.trim() ?? '';
    if (!raw) return '';
    const known =
      this.availableBranches().some((b) => b.id === raw) ||
      this.scopeState.company().branches.some((b) => b.id === raw);
    return known ? raw : '';
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
    params: () => {
      if (!this.canRead() || this.forbidden()) return undefined;
      return {
        ctx: this.context(),
        scope: this.scopeFilter(),
        tick: this.refreshTick(),
      };
    },
    loader: async ({ params }) => {
      try {
        return await getCounts(params.ctx, params.scope);
      } catch (error) {
        if (isTowerForbiddenError(error)) {
          this.forbidden.set(true);
        }
        throw error;
      }
    },
  });

  private readonly listResource = resource({
    params: () => {
      if (!this.canRead() || this.forbidden()) return undefined;
      return {
        ctx: this.context(),
        query: this.filterQuery(),
        page: this.page(),
        limit: Math.min(100, this.pageSize()),
        tick: this.refreshTick(),
      };
    },
    loader: async ({ params }) => {
      try {
        return await listExceptions(params.ctx, {
          ...params.query,
          page: params.page,
          limit: params.limit,
        });
      } catch (error) {
        if (isTowerForbiddenError(error)) {
          this.forbidden.set(true);
        }
        throw error;
      }
    },
  });

  protected readonly isForbidden = computed(
    () =>
      !this.canRead() ||
      this.forbidden() ||
      isTowerForbiddenError(this.listResource.error()) ||
      isTowerForbiddenError(this.countsResource.error()),
  );

  protected readonly items = computed<TowerException[]>(() =>
    this.listResource.hasValue() ? this.listResource.value().items : [],
  );
  protected readonly total = computed(() =>
    this.listResource.hasValue() ? this.listResource.value().total : 0,
  );
  protected readonly asOf = computed<string | null>(() =>
    this.listResource.hasValue() ? this.listResource.value().asOf : null,
  );

  protected readonly selectedExceptionContext = computed<TradeContext>(() => {
    const activeId = this.selectedExceptionId();
    if (activeId) {
      const opened = this.openedRowContext();
      if (opened && opened.id === activeId) return opened.ctx;
      const found = this.items().find((row) => row.id === activeId);
      if (found) return contextForException(found);
    }
    const base = this.context();
    const branchId = this.branchFilter();
    if (base.companyId && !base.branchId && branchId) {
      return { companyId: base.companyId, branchId };
    }
    return base;
  });

  protected readonly canResolve = computed(
    () =>
      !this.isForbidden() &&
      hasTowerGrantForContext(
        this.injector,
        TOWER_PERMISSIONS.resolve,
        this.selectedExceptionContext(),
      ),
  );

  protected readonly counts = computed<TowerCardCounts | null>(() =>
    this.countsResource.hasValue() ? toTowerCardCounts(this.countsResource.value()) : null,
  );
  protected readonly notReadyError = computed(() => {
    const err = this.listResource.error();
    return isTowerNotReadyError(err) ? err : null;
  });
  protected readonly countsNotReady = computed(() =>
    isTowerNotReadyError(this.countsResource.error()),
  );
  protected readonly countsFailed = computed(
    () =>
      !!this.countsResource.error() &&
      !this.isForbidden() &&
      !(this.notReadyError() && this.countsNotReady()),
  );
  protected readonly countsLoading = computed(
    () => this.countsResource.isLoading() && !this.countsResource.hasValue(),
  );

  protected readonly loading = computed(
    () => this.listResource.isLoading() && !this.listResource.hasValue(),
  );
  protected readonly refreshing = computed(
    () => this.listResource.isLoading() || this.countsResource.isLoading(),
  );
  protected readonly failed = computed(
    () => !!this.listResource.error() && !this.isForbidden() && !this.notReadyError(),
  );

  protected readonly notReadyText = computed(() => {
    this.i18n();
    const error = this.notReadyError();
    return error ? translateTowerError(this.transloco, error) : '';
  });

  protected readonly countsFailedText = computed(() => {
    this.i18n();
    const error = this.countsResource.error();
    if (
      isTowerNotReadyError(error) ||
      isTowerFilterScopeError(error) ||
      isTowerQueryInvalidError(error)
    ) {
      return translateTowerError(this.transloco, error);
    }
    return this.transloco.translate('tower.states.countsFailed');
  });

  protected readonly loadFailedText = computed(() => {
    this.i18n();
    const error = this.listResource.error();
    if (isTowerFilterScopeError(error) || isTowerQueryInvalidError(error)) {
      return translateTowerError(this.transloco, error);
    }
    return this.transloco.translate('tower.states.loadFailed');
  });

  protected readonly filterErrors = computed<Partial<Record<FilterFieldKey, string>>>(() => {
    this.i18n();
    const error = this.listResource.error() ?? this.countsResource.error();
    if (!error || this.isForbidden()) return {};

    if (isTowerFilterScopeError(error)) {
      return this.showBranchFilter() ? { branch: translateTowerError(this.transloco, error) } : {};
    }

    const isQueryErr =
      isTowerQueryInvalidError(error) ||
      (error instanceof ApiError && error.code === 'TRADE.VALIDATION_FAILED');
    if (!isQueryErr) return {};

    const message = translateTowerError(this.transloco, error);
    const details = error instanceof ApiError ? error.details : undefined;
    const mapped: Partial<Record<FilterFieldKey, string>> = {};
    if (details?.['severity']) mapped.severity = message;
    if (details?.['category']) mapped.category = message;
    if (details?.['branchId'] && this.showBranchFilter()) mapped.branch = message;
    if (details?.['sort']) mapped.sort = message;

    if (Object.keys(mapped).length === 0 && isTowerQueryInvalidError(error)) {
      if (this.branchFilter() && this.showBranchFilter()) mapped.branch = message;
      else if (this.categoryFilter()) mapped.category = message;
      else if (this.severityFilter()) mapped.severity = message;
      else if (this.sortFilter() !== 'createdAt') mapped.sort = message;
      else mapped.severity = message;
    }

    return mapped;
  });

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

  protected readonly branchOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const ar = this.lang() === 'ar';
    return [
      { value: '', label: this.transloco.translate('tower.filters.allBranches') },
      ...this.availableBranches().map((b) => ({
        value: b.id,
        label: (ar ? b.nameAr : b.nameEn) || b.nameEn || b.nameAr,
      })),
    ];
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

  protected goHome(): void {
    void this.router.navigateByUrl('/workspace/home');
  }

  protected onForbidden(): void {
    this.forbidden.set(true);
  }

  protected reload(): void {
    if (this.isForbidden()) return;
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
    this.openedRowContext.set({ id: row.id, ctx: contextForException(row) });
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { id: row.id },
      queryParamsHandling: 'merge',
    });
  }

  protected onModalClosed(): void {
    this.openedRowContext.set(null);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { id: null },
      queryParamsHandling: 'merge',
    });
  }

  protected onExceptionResolved(_updated: TowerException): void {
    this.reload();
  }

  protected onRowKeydown(event: KeyboardEvent, row: TowerException): void {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.openException(row);
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
    return formatTowerSafeErrorCode(code, this.transloco.translate('tower.common.none'));
  }

  protected formatDateTime(iso: string | null | undefined): string {
    return formatTowerDateTime(iso, this.lang(), this.transloco.translate('tower.common.none'));
  }
}

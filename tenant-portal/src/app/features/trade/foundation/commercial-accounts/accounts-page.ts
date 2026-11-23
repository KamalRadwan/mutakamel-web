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
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAddressBook,
  tablerArrowsSort,
  tablerCloudOff,
  tablerLayoutGrid,
  tablerPlus,
  tablerRefresh,
  tablerSearch,
  tablerTable,
  tablerX,
} from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { ApiError as CoreApiError } from '../../../../core/api/api-errors';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import type { BulkJob } from '../../../../shared/bulk-jobs/bulk-jobs.model';
import { BulkJobsTracker } from '../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { Button } from '../../../../shared/ui/button/button';
import { Dropdown, type DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { Pagination } from '../../../../shared/ui/pagination/pagination';
import { StepFilter, type StepOption } from '../../../../shared/ui/step-filter/step-filter';
import { UnsavedDialog } from '../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { ViewSwitcher, type ViewOption } from '../../../../shared/ui/view-switcher/view-switcher';
import { branchGrants } from '../../shared/trade-access';
import { ApiError, errorCodeOf, errorKey, newIdempotencyKey, tradeContext, type TradeContext } from '../../shared/trade-api';
import { itemName, listReasons } from '../../shared/trade-foundation.api';
import type { ReasonCode } from '../../shared/trade-foundation.model';
import { AccountSelection } from './account-bulk/account-selection';
import { TRADE_ACCOUNTS_BULK_MODULE_ID } from './account-bulk/accounts-bulk.descriptor';
import { AccountBulkMenu } from './account-bulk/bulk-menu/account-bulk-menu';
import { AccountSelectionBar } from './account-bulk/selection-bar/account-selection-bar';
import { AccountCards } from './account-cards/account-cards';
import { AccountModal } from './account-modal/account-modal';
import { AccountStatusDialog } from './account-status-dialog/account-status-dialog';
import { AccountTable } from './account-table/account-table';
import {
  blockAccount,
  countAccounts,
  getAccount,
  listAccountLookups,
  listAccounts,
  unblockAccount,
} from './commercial-accounts.api';
import {
  type AccountDetail,
  type AccountListFilter,
  type AccountRoleFilter,
  type AccountSortDirection,
  type AccountSortField,
  type AccountSortOption,
  type AccountStatusCounts,
  type AccountStatusFilter,
  type AccountStatusTransitionInput,
  type AccountView,
  type AccountWithParty,
  type PriceBookOption,
} from './commercial-accounts.model';

function isForbiddenError(error: unknown): boolean {
  return (error instanceof ApiError || error instanceof CoreApiError) && error.status === 403;
}

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 24;
const ALLOWED_PAGE_SIZES = [12, 24, 48, 96] as const;
const SEARCH_DEBOUNCE_MS = 250;

const SORT_QUERY: Record<AccountSortOption, { sort: AccountSortField; direction: AccountSortDirection }> = {
  created: { sort: 'createdAt', direction: 'DESC' },
  name: { sort: 'partyName', direction: 'ASC' },
  limit: { sort: 'creditLimit', direction: 'DESC' },
};

function parseView(raw: string | null): AccountView {
  return raw === 'cards' ? 'cards' : 'table';
}

function parseRole(raw: string | null): AccountRoleFilter {
  if (raw === 'CUSTOMER' || raw === 'SUPPLIER') return raw;
  return 'all';
}

function parseStatus(raw: string | null): AccountStatusFilter {
  if (raw === 'ACTIVE' || raw === 'BLOCKED') return raw;
  return 'all';
}

function parseSort(raw: string | null): AccountSortOption {
  if (raw === 'name' || raw === 'limit') return raw;
  return 'created';
}

function parsePage(raw: string | null): number {
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_PAGE;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : DEFAULT_PAGE;
}

function parsePageSize(raw: string | null): number {
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_PAGE_SIZE;
  const parsed = Number(raw);
  return (ALLOWED_PAGE_SIZES as readonly number[]).includes(parsed) ? parsed : DEFAULT_PAGE_SIZE;
}

@Component({
  selector: 'app-accounts-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    AccountBulkMenu,
    AccountCards,
    AccountModal,
    AccountSelectionBar,
    AccountStatusDialog,
    AccountTable,
    Button,
    Dropdown,
    FullState,
    Pagination,
    StepFilter,
    UnsavedDialog,
    ViewSwitcher,
  ],
  providers: [
    AccountSelection,
    provideTranslocoScope('settings', { scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-accounts', alias: 'tradeAccounts' }),
    provideIcons({
      tablerPlus,
      tablerSearch,
      tablerArrowsSort,
      tablerLayoutGrid,
      tablerTable,
      tablerRefresh,
      tablerCloudOff,
      tablerAddressBook,
      tablerX,
    }),
  ],
  templateUrl: './accounts-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col gap-8 p-12' },
})
export class AccountsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly scope = inject(ScopeState);
  private readonly notify = inject(Notify);
  private readonly tracker = inject(BulkJobsTracker);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;
  private readonly queryParams = toSignal(this.route.queryParamMap);
  protected readonly selection = inject(AccountSelection);

  private readonly accountModal = viewChild.required(AccountModal);
  private readonly statusDialog = viewChild.required(AccountStatusDialog);
  private readonly conflictDialog = viewChild.required<UnsavedDialog>('conflictDialog');

  protected readonly forbidden = signal(false);
  protected readonly canRead = computed(() => this.hasGrant('trade.commercial_accounts.read'));
  protected readonly canManage = computed(
    () => !this.forbidden() && this.hasGrant('trade.commercial_accounts.manage'),
  );
  protected readonly canViewCredit = computed(
    () => !this.forbidden() && this.hasGrant('trade.credit.view'),
  );
  protected readonly pageSizes: number[] = [...ALLOWED_PAGE_SIZES];

  protected readonly view = computed<AccountView>(() => parseView(this.queryParams()?.get('view') ?? null));
  protected readonly roleFilter = computed<AccountRoleFilter>(() => parseRole(this.queryParams()?.get('role') ?? null));
  protected readonly statusFilter = computed<AccountStatusFilter>(() =>
    parseStatus(this.queryParams()?.get('status') ?? null),
  );
  protected readonly sortOption = computed<AccountSortOption>(() => parseSort(this.queryParams()?.get('sort') ?? null));
  protected readonly page = computed<number>(() => parsePage(this.queryParams()?.get('page') ?? null));
  protected readonly pageSize = computed<number>(() => parsePageSize(this.queryParams()?.get('size') ?? null));
  protected readonly openId = computed<string | null>(() => {
    const qp = this.queryParams();
    const raw = qp?.get('open')?.trim() || qp?.get('account')?.trim();
    return raw ? raw : null;
  });

  protected readonly ctx = computed<TradeContext>(() => tradeContext(this.scope, 'BRANCH'));
  protected readonly currentBranchName = computed(() => {
    const branch = this.scope.branch();
    return (this.language() === 'ar' ? branch?.nameAr : branch?.nameEn) ?? '';
  });

  protected readonly search = signal('');
  protected readonly appliedSearch = signal('');
  protected readonly accounts = signal<readonly AccountWithParty[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);

  protected readonly counts = signal<AccountStatusCounts | null>(null);
  protected readonly priceBooks = signal<readonly PriceBookOption[]>([]);
  protected readonly blockReasons = signal<readonly ReasonCode[]>([]);

  protected readonly statusTarget = signal<AccountWithParty | null>(null);
  protected readonly statusMode = signal<'block' | 'unblock'>('block');
  protected readonly statusSaving = signal(false);

  private listSeq = 0;
  private countsSeq = 0;
  private booksSeq = 0;
  private reasonsSeq = 0;
  private statusKey: string | null = null;
  private statusFingerprint: string | null = null;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private lastScopeKey: string | null = null;
  private readonly refreshedJobKeys = new Set<string>();

  protected readonly filter = computed<AccountListFilter>(() => {
    const role = this.roleFilter();
    const status = this.statusFilter();
    const search = this.appliedSearch().trim();
    return {
      ...(role !== 'all' ? { accountRole: role } : {}),
      ...(status !== 'all' ? { status } : {}),
      ...(search ? { search } : {}),
    };
  });

  protected readonly visibleIds = computed<ReadonlySet<string> | null>(() => {
    if (this.loading()) return null;
    return new Set(this.accounts().map((account) => account.id));
  });

  protected readonly priceBookNames = computed<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const book of this.priceBooks()) {
      map[book.id] = book.name;
    }
    return map;
  });

  protected readonly blockReasonNames = computed<Readonly<Record<string, string>>>(() => {
    this.i18n();
    const lang = this.language();
    const map: Record<string, string> = {};
    for (const reason of this.blockReasons()) {
      map[reason.code] = itemName(reason, lang) || reason.code;
    }
    return map;
  });

  protected readonly hasActiveFilters = computed(
    () =>
      this.roleFilter() !== 'all' ||
      this.statusFilter() !== 'all' ||
      this.appliedSearch().trim().length > 0,
  );

  protected readonly roleSteps = computed<StepOption[]>(() => {
    this.i18n();
    const counts = this.counts();
    const allCount = counts ? counts.byRole.CUSTOMER + counts.byRole.SUPPLIER : null;
    return [
      { id: 'all', label: this.transloco.translate('tradeAccounts.filters.all'), count: allCount },
      {
        id: 'CUSTOMER',
        label: this.transloco.translate('tradeAccounts.filters.customers'),
        count: counts ? counts.byRole.CUSTOMER : null,
      },
      {
        id: 'SUPPLIER',
        label: this.transloco.translate('tradeAccounts.filters.suppliers'),
        count: counts ? counts.byRole.SUPPLIER : null,
      },
    ];
  });

  protected readonly statusOptions = computed<DropdownOption<AccountStatusFilter>[]>(() => {
    this.i18n();
    const counts = this.counts();
    const allLabel = this.transloco.translate('tradeAccounts.filters.allStatuses');
    const activeLabel = this.transloco.translate('tradeShared.accountStatus.ACTIVE');
    const blockedLabel = this.transloco.translate('tradeShared.accountStatus.BLOCKED');
    return [
      { value: 'all', label: counts ? `${allLabel} (${counts.total})` : allLabel },
      { value: 'ACTIVE', label: counts ? `${activeLabel} (${counts.ACTIVE})` : activeLabel },
      { value: 'BLOCKED', label: counts ? `${blockedLabel} (${counts.BLOCKED})` : blockedLabel },
    ];
  });

  protected readonly sortOptions = computed<DropdownOption<AccountSortOption>[]>(() => {
    this.i18n();
    return [
      { value: 'created', label: this.transloco.translate('tradeAccounts.sort.created') },
      { value: 'name', label: this.transloco.translate('tradeAccounts.sort.name') },
      { value: 'limit', label: this.transloco.translate('tradeAccounts.sort.limit') },
    ];
  });

  protected readonly viewOptions = computed<ViewOption[]>(() => {
    this.i18n();
    return [
      { id: 'cards', icon: 'tablerLayoutGrid', label: this.transloco.translate('tradeAccounts.views.cards') },
      { id: 'table', icon: 'tablerTable', label: this.transloco.translate('tradeAccounts.views.table') },
    ];
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.searchTimer !== null) {
        clearTimeout(this.searchTimer);
        this.searchTimer = null;
      }
    });

    const initialFinished = this.tracker.finished();
    if (initialFinished) {
      this.refreshedJobKeys.add(`${initialFinished.id}:${initialFinished.revision}`);
    }

    effect(() => {
      const allowed = this.canRead();
      const ctx = this.ctx();
      const role = this.roleFilter();
      const status = this.statusFilter();
      const search = this.appliedSearch().trim();
      const sort = this.sortOption();
      const page = this.page();
      const limit = this.pageSize();
      const _lang = this.language();
      untracked(() => {
        if (!allowed) {
          this.listSeq += 1;
          this.accounts.set([]);
          this.total.set(0);
          this.loading.set(false);
          this.loadFailed.set(false);
          return;
        }
        this.forbidden.set(false);
        void this.loadAccounts(ctx, { page, limit, role, status, search, sort });
      });
    });

    effect(() => {
      const allowed = this.canRead();
      const ctx = this.ctx();
      const role = this.roleFilter();
      const search = this.appliedSearch().trim();
      untracked(() => {
        if (!allowed) {
          this.countsSeq += 1;
          this.counts.set(null);
          return;
        }
        void this.loadCounts(ctx, role, search);
      });
    });

    effect(() => {
      const allowed = this.canRead();
      const ctx = this.ctx();
      untracked(() => {
        if (!allowed) {
          this.booksSeq += 1;
          this.reasonsSeq += 1;
          this.priceBooks.set([]);
          this.blockReasons.set([]);
          return;
        }
        void this.loadLookups(ctx);
        void this.loadBlockReasons(ctx);
      });
    });

    effect(() => {
      const ctx = this.ctx();
      const scopeKey = `${ctx.companyId ?? ''}:${ctx.branchId ?? ''}`;
      untracked(() => {
        if (this.lastScopeKey !== null && this.lastScopeKey !== scopeKey) {
          this.selection.clear();
        }
        this.lastScopeKey = scopeKey;
      });
    });

    effect(() => {
      const view = this.view();
      untracked(() => {
        if (view !== 'table' && (this.selection.count() > 0 || this.selection.mode() === 'all')) {
          this.selection.clear();
        }
      });
    });

    effect(() => {
      const filter = this.filter();
      untracked(() => {
        this.selection.onFilterChange(filter);
      });
    });

    effect(() => {
      const finished = this.tracker.finished();
      const companyId = this.ctx().companyId;
      if (!finished || finished.app !== 'trading' || finished.module !== TRADE_ACCOUNTS_BULK_MODULE_ID) return;
      if (finished.scope.companyId && finished.scope.companyId !== companyId) return;
      untracked(() => this.onBulkJobFinished(finished));
    });

    effect(() => {
      const allowed = this.canRead();
      const isForbidden = this.forbidden();
      const id = this.openId();
      untracked(() => {
        if (!allowed || isForbidden) {
          this.accountModal().forceClose();
          return;
        }
        if (!id) {
          const openModalId = this.accountModal().openAccountId();
          if (openModalId) {
            void this.accountModal().requestClose().then((closed) => {
              if (!closed && this.openId() === null && this.accountModal().openAccountId() === openModalId) {
                void this.router.navigate([], {
                  relativeTo: this.route,
                  queryParams: { open: openModalId },
                  queryParamsHandling: 'merge',
                  replaceUrl: true,
                });
              }
            });
          }
          return;
        }
        if (this.accountModal().openAccountId() === id) return;
        this.accountModal().openEdit(id);
      });
    });
  }

  protected goHome(): void {
    void this.router.navigateByUrl('/workspace/home');
  }

  protected onForbidden(): void {
    this.forbidden.set(true);
    this.loadFailed.set(false);
    this.loading.set(false);
  }

  protected reload(): void {
    if (!this.canRead()) {
      this.forbidden.set(true);
      this.loadFailed.set(false);
      this.loading.set(false);
      return;
    }
    this.forbidden.set(false);
    const ctx = this.ctx();
    const search = this.appliedSearch().trim();
    void this.loadAccounts(ctx, {
      page: this.page(),
      limit: this.pageSize(),
      role: this.roleFilter(),
      status: this.statusFilter(),
      search,
      sort: this.sortOption(),
    });
    void this.loadCounts(ctx, this.roleFilter(), search);
    void this.loadLookups(ctx);
    void this.loadBlockReasons(ctx);
  }

  protected onBulkJobFinished(job: BulkJob): void {
    const key = `${job.id}:${job.revision}`;
    if (this.refreshedJobKeys.has(key)) return;
    this.refreshedJobKeys.add(key);
    this.reload();
  }

  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.search.set(value);
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      this.applySearchValue(value);
    }, SEARCH_DEBOUNCE_MS);
  }

  protected clearSearch(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    this.search.set('');
    this.applySearchValue('');
  }

  protected setView(view: string): void {
    const next: AccountView = view === 'cards' ? 'cards' : 'table';
    if (next !== 'table') {
      this.selection.clear();
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: next === 'table' ? null : next },
      queryParamsHandling: 'merge',
    });
  }

  protected setRole(role: string): void {
    const next = parseRole(role);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        role: next === 'all' ? null : next,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected setStatus(status: AccountStatusFilter): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        status: status === 'all' ? null : status,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected setSort(sort: AccountSortOption): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        sort: sort === 'created' ? null : sort,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected setPage(page: number): void {
    const next = Math.max(DEFAULT_PAGE, page);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: next === DEFAULT_PAGE ? null : next },
      queryParamsHandling: 'merge',
    });
  }

  protected setPageSize(size: number): void {
    if (size === this.pageSize()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        size: size === DEFAULT_PAGE_SIZE ? null : size,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected openCreate(): void {
    if (!this.canManage()) return;
    this.accountModal().openCreate();
  }

  protected openAccount(account: AccountWithParty): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { open: account.id, account: null },
      queryParamsHandling: 'merge',
    });
  }

  protected onModalClosed(): void {
    const qp = this.queryParams();
    if (qp?.get('open') || qp?.get('account')) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { open: null, account: null },
        queryParamsHandling: 'merge',
      });
    }
  }

  protected onAccountSaved(detail: AccountDetail): void {
    if (this.openId() !== detail.id) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { open: detail.id, account: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
    this.reload();
  }

  protected openBlockDialog(account: AccountWithParty): void {
    if (!this.canManage()) return;
    this.statusTarget.set(account);
    this.statusMode.set('block');
    this.statusKey = null;
    this.statusFingerprint = null;
    this.statusDialog().open();
  }

  protected openUnblockDialog(account: AccountWithParty): void {
    if (!this.canManage()) return;
    this.statusTarget.set(account);
    this.statusMode.set('unblock');
    this.statusKey = null;
    this.statusFingerprint = null;
    this.statusDialog().open();
  }

  protected onStatusCancelled(): void {
    this.statusTarget.set(null);
  }

  protected async onStatusConfirmed(input: AccountStatusTransitionInput): Promise<void> {
    const target = this.statusTarget();
    if (!target || this.statusSaving()) return;

    const mode = this.statusMode();
    const ctx = this.ctx();
    const fingerprint = JSON.stringify({ mode, id: target.id, version: target.version, input });
    if (fingerprint !== this.statusFingerprint || !this.statusKey) {
      this.statusFingerprint = fingerprint;
      this.statusKey = newIdempotencyKey();
    }

    this.statusSaving.set(true);
    try {
      if (mode === 'block') {
        await blockAccount(ctx, target.id, target.version, input, this.statusKey);
      } else {
        await unblockAccount(ctx, target.id, target.version, input, this.statusKey);
      }
      this.statusDialog().close();
      this.statusTarget.set(null);
      this.notify.success(
        this.transloco.translate(mode === 'block' ? 'tradeAccounts.toast.blocked' : 'tradeAccounts.toast.unblocked'),
      );
      this.reload();
    } catch (error) {
      if (isForbiddenError(error)) {
        this.statusDialog().close();
        this.statusTarget.set(null);
        this.statusKey = null;
        this.statusFingerprint = null;
        this.forbidden.set(true);
        return;
      }
      const code = errorCodeOf(error);
      if (code === 'GW.IDEM.MISMATCH' || code === 'TRADE.IDEMPOTENCY.MISMATCH') {
        this.statusKey = null;
        this.statusFingerprint = null;
      }
      if (error instanceof ApiError && error.status === 409 && error.code === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.statusDialog().close();
        this.statusSaving.set(false);
        await this.handleStatusConflict(target.id, mode, input);
        return;
      }
      this.notify.error(this.transloco.translate(errorKey(error)));
    } finally {
      this.statusSaving.set(false);
    }
  }

  private applySearchValue(value: string): void {
    if (this.appliedSearch() === value) return;
    this.appliedSearch.set(value);
    if (this.page() !== DEFAULT_PAGE) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { page: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  private async handleStatusConflict(
    id: string,
    mode: 'block' | 'unblock',
    input: AccountStatusTransitionInput,
  ): Promise<void> {
    const choice = await this.conflictDialog().open();
    if (choice === 'cancel') {
      this.statusTarget.set(null);
      return;
    }
    if (choice === 'save') {
      this.statusTarget.set(null);
      this.reload();
      return;
    }

    try {
      const fresh = await getAccount(this.ctx(), id);
      const key = newIdempotencyKey();
      if (mode === 'block') {
        await blockAccount(this.ctx(), id, fresh.version, input, key);
      } else {
        await unblockAccount(this.ctx(), id, fresh.version, input, key);
      }
      this.statusTarget.set(null);
      this.notify.success(
        this.transloco.translate(mode === 'block' ? 'tradeAccounts.toast.blocked' : 'tradeAccounts.toast.unblocked'),
      );
      this.reload();
    } catch (error) {
      this.statusTarget.set(null);
      if (isForbiddenError(error)) {
        this.forbidden.set(true);
        return;
      }
      this.notify.error(this.transloco.translate(errorKey(error)));
      this.reload();
    }
  }

  private hasGrant(key: string): boolean {
    const grants = runInInjectionContext(this.injector, () => branchGrants(key));
    if (grants === 'ALL') return true;
    const company = this.scope.company();
    if (!company?.id) return grants.size > 0;
    const branchId = company.branches.length > 0 ? this.scope.branch()?.id : undefined;
    if (branchId && grants.has(branchId)) return true;
    return !branchId && company.branches.some((branch) => grants.has(branch.id));
  }

  private async loadAccounts(
    ctx: TradeContext,
    params: {
      page: number;
      limit: number;
      role: AccountRoleFilter;
      status: AccountStatusFilter;
      search: string;
      sort: AccountSortOption;
    },
  ): Promise<void> {
    const seq = ++this.listSeq;
    const sortQuery = SORT_QUERY[params.sort];
    this.loading.set(true);
    this.loadFailed.set(false);
    try {
      const res = await listAccounts(ctx, {
        page: params.page,
        limit: params.limit,
        sort: sortQuery.sort,
        direction: sortQuery.direction,
        ...(params.role !== 'all' ? { accountRole: params.role } : {}),
        ...(params.status !== 'all' ? { status: params.status } : {}),
        ...(params.search ? { search: params.search } : {}),
      });
      if (seq !== this.listSeq) return;

      const totalPages = Math.max(1, Math.ceil(res.total / params.limit));
      if (params.page > totalPages && res.total > 0) {
        this.setPage(totalPages);
        return;
      }

      this.accounts.set(res.items);
      this.total.set(res.total);
    } catch (error) {
      if (seq !== this.listSeq) return;
      this.accounts.set([]);
      this.total.set(0);
      if (isForbiddenError(error)) {
        this.forbidden.set(true);
        this.loadFailed.set(false);
      } else {
        this.loadFailed.set(true);
      }
    } finally {
      if (seq === this.listSeq) {
        this.loading.set(false);
      }
    }
  }

  private async loadCounts(
    ctx: TradeContext,
    role: AccountRoleFilter,
    search: string,
  ): Promise<void> {
    const seq = ++this.countsSeq;
    try {
      const res = await countAccounts(ctx, {
        ...(role !== 'all' ? { accountRole: role } : {}),
        ...(search ? { search } : {}),
      });
      if (seq !== this.countsSeq) return;
      this.counts.set(res);
    } catch (error) {
      if (seq !== this.countsSeq) return;
      this.counts.set(null);
      if (isForbiddenError(error)) {
        this.forbidden.set(true);
      }
    }
  }

  private async loadLookups(ctx: TradeContext): Promise<void> {
    const seq = ++this.booksSeq;
    try {
      const lookups = await listAccountLookups(ctx);
      if (seq !== this.booksSeq) return;
      this.priceBooks.set(lookups.priceBooks);
    } catch (error) {
      if (seq !== this.booksSeq) return;
      this.priceBooks.set([]);
      if (isForbiddenError(error)) {
        this.forbidden.set(true);
      }
    }
  }

  private async loadBlockReasons(ctx: TradeContext): Promise<void> {
    const seq = ++this.reasonsSeq;
    try {
      const reasons = await listReasons('ACCOUNT_BLOCK', { includeInactive: true }, ctx);
      if (seq !== this.reasonsSeq) return;
      this.blockReasons.set(reasons);
    } catch (error) {
      if (seq !== this.reasonsSeq) return;
      this.blockReasons.set([]);
      if (isForbiddenError(error)) {
        this.forbidden.set(true);
      }
    }
  }
}

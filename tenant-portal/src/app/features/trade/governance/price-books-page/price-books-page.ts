import { Component, DestroyRef, Injector, computed, effect, inject, input, resource, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerBook,
  tablerEdit,
  tablerEye,
  tablerInbox,
  tablerLayoutGrid,
  tablerPlayerPause,
  tablerPlayerPlay,
  tablerPlus,
  tablerRefresh,
  tablerSearch,
  tablerStar,
  tablerStarOff,
  tablerTable,
  tablerX,
} from '@ng-icons/tabler-icons';
import { tablerStarFill } from '@ng-icons/tabler-icons/fill';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import type { ActionItem, ActionSelection } from '../../../../shared/ui/actions-menu/actions-menu';
import { ActionsMenu } from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, type DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { Pagination } from '../../../../shared/ui/pagination/pagination';
import { StepFilter, type StepOption } from '../../../../shared/ui/step-filter/step-filter';
import { ViewSwitcher, type ViewOption } from '../../../../shared/ui/view-switcher/view-switcher';
import { errorCodeOf, newIdempotencyKey, tradeContext } from '../../shared/trade-api';
import { CompanyDefaultsModal } from '../company-defaults-modal/company-defaults-modal';
import { ConflictDialog } from '../governance-shared/conflict-dialog/conflict-dialog';
import { ScopeChip } from '../governance-shared/scope-chip/scope-chip';
import { VersionStatusBadge } from '../governance-shared/version-status-badge/version-status-badge';
import { NewVersionModal, resolvePricingError } from '../new-version-modal/new-version-modal';
import { PriceBookCard } from '../price-book-card/price-book-card';
import { PriceBookModal } from '../price-book-modal/price-book-modal';
import {
  deleteCompanyDefault,
  getKpis,
  getReferenceData,
  listCompanyDefaults,
  listPriceBooks,
  updatePriceBook,
  upsertCompanyDefault,
} from '../pricing.api';
import type {
  CompanyDefault,
  CreatedPriceBook,
  GovernanceState,
  PriceBookListItem,
  PriceBookStatus,
  PricePurpose,
  VersionHead,
} from '../pricing.model';
import {
  bookGovernanceState,
  hasPricingGrant,
  isAwaitingActivation,
  isForbiddenError,
  isLiveScheduled,
  rangeText,
} from '../pricing.service';

type ViewMode = 'cards' | 'table';
type PurposeFilter = 'all' | PricePurpose;
type StatusFilter = 'all' | PriceBookStatus;
type StateFilter = 'all' | GovernanceState;

const PAGE_SIZES = [12, 24, 48, 96];
const DEFAULT_PAGE = 1;
const DEFAULT_SIZE = 24;
const DEFAULT_VIEW: ViewMode = 'table';
const EN_INT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

const PURPOSES: readonly PricePurpose[] = ['SALES', 'PURCHASE'];
const STATUSES: readonly PriceBookStatus[] = ['ACTIVE', 'INACTIVE'];
const STATES: readonly GovernanceState[] = ['PUBLISHED', 'SCHEDULED', 'TESTED', 'DRAFT_ONLY', 'INACTIVE'];

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw || !/^\d+$/.test(raw)) return fallback;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= 1 ? n : fallback;
}

function pctWidth(part: number, total: number): string {
  if (total <= 0 || part <= 0) return '0%';
  const pct = Math.max(4, Math.min(100, Math.round((part / total) * 100)));
  return `${pct}%`;
}

@Component({
  selector: 'app-price-books-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    ActionsMenu,
    Button,
    CompanyDefaultsModal,
    ConfirmDialog,
    ConflictDialog,
    Dropdown,
    FullState,
    NewVersionModal,
    Pagination,
    PriceBookCard,
    PriceBookModal,
    ScopeChip,
    StepFilter,
    VersionStatusBadge,
    ViewSwitcher,
  ],
  providers: [
    provideTranslocoScope({ scope: 'trade-governance', alias: 'governance' }, { scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-gov-price-books', alias: 'priceBooks' }),
    provideIcons({
      tablerAlertTriangle,
      tablerBook,
      tablerEdit,
      tablerEye,
      tablerInbox,
      tablerLayoutGrid,
      tablerPlayerPause,
      tablerPlayerPlay,
      tablerPlus,
      tablerRefresh,
      tablerSearch,
      tablerStar,
      tablerStarFill,
      tablerStarOff,
      tablerTable,
      tablerX,
    }),
  ],
  templateUrl: './price-books-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col gap-8 p-12' },
})
export class PriceBooksPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly scope = inject(ScopeState);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly notify = inject(Notify);
  protected readonly language = inject(LanguageState).current;

  private readonly createModal = viewChild.required(PriceBookModal);
  private readonly newVersionModal = viewChild.required(NewVersionModal);
  private readonly defaultsModal = viewChild.required(CompanyDefaultsModal);
  private readonly deactivateDialog = viewChild.required(ConfirmDialog);
  private readonly conflictDialog = viewChild.required(ConflictDialog);

  readonly qParam = input<string | undefined>(undefined, { alias: 'q' });
  readonly purposeParam = input<string | undefined>(undefined, { alias: 'purpose' });
  readonly statusParam = input<string | undefined>(undefined, { alias: 'status' });
  readonly stateParam = input<string | undefined>(undefined, { alias: 'state' });
  readonly viewParam = input<string | undefined>(undefined, { alias: 'view' });
  readonly pageParam = input<string | undefined>(undefined, { alias: 'page' });
  readonly sizeParam = input<string | undefined>(undefined, { alias: 'size' });

  protected readonly forbidden = signal(false);
  protected readonly canRead = computed(() =>
    hasPricingGrant(this.injector, this.scope, 'trade.pricing.read'),
  );
  protected readonly canManage = computed(
    () => !this.forbidden() && hasPricingGrant(this.injector, this.scope, 'trade.pricing.manage'),
  );
  protected readonly canManageDefaults = computed(
    () =>
      !this.forbidden() &&
      hasPricingGrant(this.injector, this.scope, 'trade.configuration.manage'),
  );
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly skeletonRows = [0, 1, 2, 3, 4];
  protected readonly skeletonCards = [0, 1, 2, 3, 4, 5];

  protected readonly refreshTick = signal(0);
  protected readonly searchDraft = signal('');
  protected readonly deactivatingName = signal('');
  private readonly rowBusyIds = new Set<string>();
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly currentQuery = computed(() => (this.qParam() ?? '').trim());
  protected readonly currentPurpose = computed<PurposeFilter>(() => {
    const raw = this.purposeParam();
    return (PURPOSES as readonly string[]).includes(raw ?? '') ? (raw as PricePurpose) : 'all';
  });
  protected readonly currentStatus = computed<StatusFilter>(() => {
    const raw = this.statusParam();
    return (STATUSES as readonly string[]).includes(raw ?? '') ? (raw as PriceBookStatus) : 'all';
  });
  protected readonly currentState = computed<StateFilter>(() => {
    const raw = this.stateParam();
    return (STATES as readonly string[]).includes(raw ?? '') ? (raw as GovernanceState) : 'all';
  });
  protected readonly currentView = computed<ViewMode>(() =>
    this.viewParam() === 'cards' ? 'cards' : DEFAULT_VIEW,
  );
  protected readonly page = computed(() => parsePositiveInt(this.pageParam(), DEFAULT_PAGE));
  protected readonly pageSize = computed(() => {
    const parsed = parsePositiveInt(this.sizeParam(), DEFAULT_SIZE);
    return PAGE_SIZES.includes(parsed) ? parsed : DEFAULT_SIZE;
  });

  protected readonly hasFilters = computed(
    () =>
      this.currentQuery() !== '' ||
      this.currentPurpose() !== 'all' ||
      this.currentStatus() !== 'all' ||
      this.currentState() !== 'all',
  );

  private readonly kpisResource = resource({
    params: () => ({
      tick: this.refreshTick(),
      lang: this.language(),
      companyId: this.scope.company()?.id ?? '',
      canRead: this.canRead(),
    }),
    loader: async ({ params }) => {
      if (!params.canRead) return null;
      try {
        return await getKpis({}, tradeContext(this.scope, 'COMPANY'));
      } catch (error) {
        if (isForbiddenError(error)) {
          this.forbidden.set(true);
          return null;
        }
        throw error;
      }
    },
  });

  private readonly defaultsResource = resource({
    params: () => ({
      tick: this.refreshTick(),
      companyId: this.scope.company()?.id ?? '',
      canRead: this.canRead(),
    }),
    loader: async ({ params }) => {
      if (!params.canRead) return [] as CompanyDefault[];
      try {
        const res = await listCompanyDefaults(tradeContext(this.scope, 'COMPANY'));
        return res.items;
      } catch (error) {
        if (isForbiddenError(error)) {
          this.forbidden.set(true);
        }
        return [] as CompanyDefault[];
      }
    },
  });

  private readonly refDataResource = resource({
    params: () => ({ companyId: this.scope.company()?.id ?? '', canRead: this.canRead() }),
    loader: async ({ params }) => {
      if (!params.canRead) return { branches: [], currencies: [] };
      try {
        return await getReferenceData(tradeContext(this.scope, 'COMPANY'));
      } catch (error) {
        if (isForbiddenError(error)) {
          this.forbidden.set(true);
        }
        return { branches: [], currencies: [] };
      }
    },
  });

  private readonly booksResource = resource({
    params: () => ({
      q: this.currentQuery(),
      purpose: this.currentPurpose(),
      status: this.currentStatus(),
      state: this.currentState(),
      page: this.page(),
      limit: this.pageSize(),
      tick: this.refreshTick(),
      lang: this.language(),
      companyId: this.scope.company()?.id ?? '',
      canRead: this.canRead(),
    }),
    loader: async ({ params }) => {
      if (!params.canRead) {
        return { items: [] as PriceBookListItem[], total: 0, page: params.page, limit: params.limit };
      }
      const ctx = tradeContext(this.scope, 'COMPANY');
      const query = {
        page: params.page,
        limit: params.limit,
        ...(params.q ? { q: params.q } : {}),
        ...(params.purpose !== 'all' ? { purpose: params.purpose } : {}),
        ...(params.status !== 'all' ? { status: params.status } : {}),
        ...(params.state !== 'all' ? { governanceState: params.state } : {}),
      };
      try {
        const res = await listPriceBooks(query, ctx);
        if (res.items.length === 0 && params.page > 1) {
          const lastPage = res.total > 0 ? Math.max(1, Math.ceil(res.total / params.limit)) : 1;
          if (lastPage !== params.page) {
            this.updateQuery({ page: lastPage === DEFAULT_PAGE ? null : lastPage }, true);
            if (res.total > 0) {
              return await listPriceBooks({ ...query, page: lastPage }, ctx);
            }
          }
        }
        return res;
      } catch (error) {
        if (isForbiddenError(error)) {
          this.forbidden.set(true);
          return { items: [] as PriceBookListItem[], total: 0, page: params.page, limit: params.limit };
        }
        throw error;
      }
    },
  });

  protected readonly kpisLoading = computed(() => this.kpisResource.isLoading() && !this.kpisResource.hasValue());
  protected readonly kpis = computed(() => (this.kpisResource.hasValue() ? this.kpisResource.value() : null));

  protected readonly listLoading = computed(() => this.booksResource.isLoading());
  protected readonly listFailed = computed(() => !!this.booksResource.error());
  protected readonly books = computed<PriceBookListItem[]>(() =>
    this.booksResource.hasValue() ? this.booksResource.value().items : [],
  );
  protected readonly totalBooks = computed(() =>
    this.booksResource.hasValue() ? this.booksResource.value().total : 0,
  );

  protected readonly purposeOptions = computed<DropdownOption<PurposeFilter>[]>(() => {
    this.i18n();
    const salesLabel = this.transloco.translate('priceBooks.purpose.SALES');
    const purchaseLabel = this.transloco.translate('priceBooks.purpose.PURCHASE');
    return [
      { value: 'all', label: this.transloco.translate('priceBooks.toolbar.purposeAll') },
      { value: 'SALES', label: this.transloco.translate('priceBooks.toolbar.purposeOption', { label: salesLabel }) },
      {
        value: 'PURCHASE',
        label: this.transloco.translate('priceBooks.toolbar.purposeOption', { label: purchaseLabel }),
      },
    ];
  });

  protected readonly statusOptions = computed<DropdownOption<StatusFilter>[]>(() => {
    this.i18n();
    const activeLabel = this.transloco.translate('priceBooks.status.ACTIVE');
    const inactiveLabel = this.transloco.translate('priceBooks.status.INACTIVE');
    return [
      { value: 'all', label: this.transloco.translate('priceBooks.toolbar.statusAll') },
      { value: 'ACTIVE', label: this.transloco.translate('priceBooks.toolbar.statusOption', { label: activeLabel }) },
      {
        value: 'INACTIVE',
        label: this.transloco.translate('priceBooks.toolbar.statusOption', { label: inactiveLabel }),
      },
    ];
  });

  protected readonly viewOptions = computed<ViewOption[]>(() => {
    this.i18n();
    return [
      { id: 'cards', icon: 'tablerLayoutGrid', label: this.transloco.translate('priceBooks.toolbar.viewCards') },
      { id: 'table', icon: 'tablerTable', label: this.transloco.translate('priceBooks.toolbar.viewTable') },
    ];
  });

  protected readonly stepOptions = computed<StepOption[]>(() => {
    this.i18n();
    const k = this.kpis();
    return [
      { id: 'all', label: this.transloco.translate('priceBooks.steps.all'), count: k ? k.total : null },
      {
        id: 'PUBLISHED',
        label: this.transloco.translate('governance.governanceState.PUBLISHED'),
        tone: 'success',
        count: k ? k.publishedBooks : null,
      },
      {
        id: 'SCHEDULED',
        label: this.transloco.translate('governance.governanceState.SCHEDULED'),
        count: k ? k.scheduledBooks : null,
      },
      {
        id: 'TESTED',
        label: this.transloco.translate('governance.governanceState.TESTED'),
        count: k ? k.testedBooks : null,
      },
      {
        id: 'DRAFT_ONLY',
        label: this.transloco.translate('governance.governanceState.DRAFT_ONLY'),
        count: k ? k.draftOnlyBooks : null,
      },
      {
        id: 'INACTIVE',
        label: this.transloco.translate('governance.governanceState.INACTIVE'),
        tone: 'danger',
        count: k ? k.inactive : null,
      },
    ];
  });

  protected readonly activeBarWidth = computed(() => {
    const k = this.kpis();
    if (!k || k.total <= 0) return '0%';
    return `${Math.round((k.active / k.total) * 100)}%`;
  });

  protected readonly inactiveBarWidth = computed(() => {
    const k = this.kpis();
    if (!k || k.total <= 0) return '0%';
    return `${Math.round((k.inactive / k.total) * 100)}%`;
  });

  protected readonly publishedBarWidth = computed(() => {
    const k = this.kpis();
    return k ? pctWidth(k.publishedBooks, k.total) : '0%';
  });

  protected readonly scheduledBarWidth = computed(() => {
    const k = this.kpis();
    return k ? pctWidth(k.scheduledBooks, k.total) : '0%';
  });

  protected readonly draftBarWidth = computed(() => {
    const k = this.kpis();
    return k ? pctWidth(k.draftOnlyBooks, k.total) : '0%';
  });

  protected readonly currenciesSummary = computed(() => {
    const k = this.kpis();
    return k?.distinctCurrencies.join(' · ') || '—';
  });

  constructor() {
    effect(() => {
      this.searchDraft.set(this.qParam() ?? '');
    });

    inject(DestroyRef).onDestroy(() => {
      if (this.searchTimer !== null) {
        clearTimeout(this.searchTimer);
      }
    });
  }

  protected formatCount(value: number): string {
    return EN_INT.format(value);
  }

  protected bookDisplayName(book: PriceBookListItem): string {
    const lang = this.language();
    return book.localizedNames[lang] || book.localizedNames['en'] || book.localizedNames['ar'] || book.name || book.code;
  }

  protected liveVersionOf(book: PriceBookListItem): VersionHead | null {
    if (book.status === 'INACTIVE') return null;
    // A superseded version keeps applying until its supersededAt; effectiveTo is never rewritten.
    const nowMs = Date.now();
    const stillApplies = (v: VersionHead) => !v.supersededAt || Date.parse(v.supersededAt) > nowMs;
    return (
      book.versions.find((v) => v.status === 'PUBLISHED' && stillApplies(v) && Date.parse(v.effectiveFrom) <= nowMs) ??
      book.versions.find((v) => v.status === 'PUBLISHED' && !v.supersededAt) ??
      book.versions.find((v) => v.status === 'SCHEDULED' && !v.supersededAt) ??
      null
    );
  }

  protected isVersionLiveScheduled(version: VersionHead): boolean {
    return isLiveScheduled(version);
  }

  protected isVersionAwaitingActivation(version: VersionHead): boolean {
    return isAwaitingActivation(version);
  }

  protected goHome(): void {
    void this.router.navigate(['/']);
  }

  protected versionRange(version: VersionHead): string {
    return rangeText(version.effectiveFrom, version.supersededAt ?? version.effectiveTo, this.language());
  }

  protected actionsFor(book: PriceBookListItem): ActionItem[] {
    this.i18n();
    const items: ActionItem[] = [
      {
        id: 'open',
        title: this.transloco.translate('priceBooks.actions.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
      {
        id: 'edit',
        title: this.transloco.translate('priceBooks.actions.edit'),
        icon: 'tablerEdit',
        tile: 'bg-icon-orange',
      },
    ];

    if (this.canManage()) {
      items.push({
        id: 'newVersion',
        title: this.transloco.translate('priceBooks.actions.newVersion'),
        icon: 'tablerPlus',
        tile: 'bg-icon-green',
      });
    }

    if (this.canManageDefaults()) {
      if (book.status === 'ACTIVE' && !book.isCompanyDefault) {
        items.push({
          id: 'makeDefault',
          title: this.transloco.translate('priceBooks.actions.makeDefault'),
          icon: 'tablerStar',
          tile: 'bg-icon-orange',
        });
      } else if (book.isCompanyDefault) {
        items.push({
          id: 'removeDefault',
          title: this.transloco.translate('priceBooks.actions.removeDefault'),
          icon: 'tablerStarOff',
          tile: 'bg-icon-gray',
        });
      }
    }

    if (this.canManage()) {
      if (book.status === 'ACTIVE') {
        items.push({
          id: 'deactivate',
          title: this.transloco.translate('priceBooks.actions.deactivate'),
          icon: 'tablerPlayerPause',
          tile: 'bg-icon-gray',
        });
      } else {
        items.push({
          id: 'activate',
          title: this.transloco.translate('priceBooks.actions.activate'),
          icon: 'tablerPlayerPlay',
          tile: 'bg-icon-green',
        });
      }
    }

    return items;
  }

  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value.slice(0, 120);
    this.searchDraft.set(value);
    if (this.searchTimer !== null) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      this.commitSearch(value);
    }, 250);
  }

  protected onSearchEnter(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    this.commitSearch(this.searchDraft());
  }

  protected clearSearch(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    this.searchDraft.set('');
    this.commitSearch('');
  }

  protected setPurpose(next: PurposeFilter): void {
    if (next === this.currentPurpose()) return;
    this.updateQuery({ purpose: next === 'all' ? null : next, page: null });
  }

  protected setStatus(next: StatusFilter): void {
    if (next === this.currentStatus()) return;
    this.updateQuery({ status: next === 'all' ? null : next, page: null });
  }

  protected setState(next: string): void {
    const resolved: StateFilter = (STATES as readonly string[]).includes(next) ? (next as GovernanceState) : 'all';
    if (resolved === this.currentState()) return;
    this.updateQuery({ state: resolved === 'all' ? null : resolved, page: null });
  }

  protected setView(next: string): void {
    const resolved: ViewMode = next === 'cards' ? 'cards' : DEFAULT_VIEW;
    if (resolved === this.currentView()) return;
    this.updateQuery({ view: resolved === DEFAULT_VIEW ? null : resolved });
  }

  protected setPage(next: number): void {
    const safe = Math.max(DEFAULT_PAGE, next);
    if (safe === this.page()) return;
    this.updateQuery({ page: safe === DEFAULT_PAGE ? null : safe });
  }

  protected setPageSize(next: number): void {
    if (!PAGE_SIZES.includes(next) || next === this.pageSize()) return;
    this.updateQuery({ size: next === DEFAULT_SIZE ? null : next, page: null });
  }

  protected clearAllFilters(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    this.searchDraft.set('');
    this.updateQuery({
      q: null,
      purpose: null,
      status: null,
      state: null,
      page: null,
    });
  }

  protected openCreateModal(): void {
    if (!this.canManage()) return;
    void this.createModal().open();
  }

  protected openDefaultsModal(): void {
    if (!this.canManageDefaults()) return;
    void this.defaultsModal().open();
  }

  protected openBook(book: Pick<PriceBookListItem, 'id'>): void {
    void this.router.navigate(['/trade/governance/price-books', book.id], {
      state: { backQueryParams: this.currentUrlParams() },
    });
  }

  protected onBookCreated(book: CreatedPriceBook): void {
    this.refreshAll();
    this.openBook(book);
  }

  protected onVersionCreated(event: { bookId: string; version: { id: string } }): void {
    this.refreshAll();
    void this.router.navigate(['/trade/governance/price-books', event.bookId, 'versions', event.version.id]);
  }

  protected onActionSelected(book: PriceBookListItem, selection: ActionSelection): void {
    switch (selection.id) {
      case 'open':
      case 'edit':
        this.openBook(book);
        break;
      case 'newVersion':
        this.openNewVersionFor(book);
        break;
      case 'makeDefault':
        void this.makeCompanyDefault(book);
        break;
      case 'removeDefault':
        void this.removeCompanyDefault(book);
        break;
      case 'deactivate':
        void this.toggleBookStatus(book, 'INACTIVE');
        break;
      case 'activate':
        void this.toggleBookStatus(book, 'ACTIVE');
        break;
    }
  }

  protected onRowKeydown(event: KeyboardEvent, book: PriceBookListItem): void {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.openBook(book);
    }
  }

  protected refreshAll(): void {
    this.forbidden.set(false);
    this.refreshTick.update((n) => n + 1);
  }

  private openNewVersionFor(book: PriceBookListItem): void {
    if (!this.canManage()) return;
    const currencies = this.refDataResource.hasValue() ? this.refDataResource.value().currencies : [];
    const decimals = currencies.find((c) => c.code === book.currencyCode)?.decimalPlaces ?? 3;
    void this.newVersionModal().open({
      bookId: book.id,
      bookVersion: book.version,
      purpose: book.purpose,
      currencyCode: book.currencyCode,
      currencyDecimals: decimals,
      preset: null,
    });
  }

  protected stateOf(book: PriceBookListItem): GovernanceState {
    return bookGovernanceState(book);
  }

  private async makeCompanyDefault(book: PriceBookListItem): Promise<void> {
    if (this.rowBusyIds.has(book.id)) return;
    this.rowBusyIds.add(book.id);
    const ctx = tradeContext(this.scope, 'COMPANY');
    try {
      const defaults = this.defaultsResource.hasValue()
        ? this.defaultsResource.value()
        : (await listCompanyDefaults(ctx)).items;
      const existing = defaults.find(
        (d) => d.purpose === book.purpose && d.currencyCode === book.currencyCode,
      );
      await upsertCompanyDefault(
        book.purpose,
        book.currencyCode,
        book.id,
        existing?.version ?? 0,
        newIdempotencyKey(),
        ctx,
      );
      this.notify.success(this.transloco.translate('priceBooks.toasts.defaultSet'));
      this.refreshAll();
    } catch (error) {
      if (isForbiddenError(error)) {
        this.forbidden.set(true);
        return;
      }
      if (errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.conflictDialog().open();
        return;
      }
      this.notify.error(resolvePricingError(this.transloco, error));
    } finally {
      this.rowBusyIds.delete(book.id);
    }
  }

  private async removeCompanyDefault(book: PriceBookListItem): Promise<void> {
    if (this.rowBusyIds.has(book.id)) return;
    this.rowBusyIds.add(book.id);
    const ctx = tradeContext(this.scope, 'COMPANY');
    try {
      const defaults = this.defaultsResource.hasValue()
        ? this.defaultsResource.value()
        : (await listCompanyDefaults(ctx)).items;
      const existing = defaults.find(
        (d) => d.purpose === book.purpose && d.currencyCode === book.currencyCode && d.priceBookId === book.id,
      );
      if (!existing) {
        this.refreshAll();
        return;
      }
      await deleteCompanyDefault(
        book.purpose,
        book.currencyCode,
        existing.version,
        newIdempotencyKey(),
        ctx,
      );
      this.notify.success(this.transloco.translate('priceBooks.toasts.defaultRemoved'));
      this.refreshAll();
    } catch (error) {
      if (isForbiddenError(error)) {
        this.forbidden.set(true);
        return;
      }
      if (errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.conflictDialog().open();
        return;
      }
      this.notify.error(resolvePricingError(this.transloco, error));
    } finally {
      this.rowBusyIds.delete(book.id);
    }
  }

  private async toggleBookStatus(book: PriceBookListItem, nextStatus: PriceBookStatus): Promise<void> {
    if (this.rowBusyIds.has(book.id)) return;
    if (nextStatus === 'INACTIVE') {
      this.deactivatingName.set(this.bookDisplayName(book));
      const confirmed = await this.deactivateDialog().open();
      if (!confirmed) return;
    }

    this.rowBusyIds.add(book.id);
    try {
      await updatePriceBook(
        book.id,
        { status: nextStatus },
        book.version,
        newIdempotencyKey(),
        tradeContext(this.scope, 'COMPANY'),
      );
      this.notify.success(
        this.transloco.translate(
          nextStatus === 'ACTIVE' ? 'priceBooks.toasts.activated' : 'priceBooks.toasts.deactivated',
        ),
      );
      this.refreshAll();
    } catch (error) {
      if (isForbiddenError(error)) {
        this.forbidden.set(true);
        return;
      }
      if (errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.conflictDialog().open();
        return;
      }
      this.notify.error(resolvePricingError(this.transloco, error));
    } finally {
      this.rowBusyIds.delete(book.id);
    }
  }

  private commitSearch(raw: string): void {
    const trimmed = raw.trim();
    if (trimmed === this.currentQuery()) return;
    this.updateQuery({ q: trimmed || null, page: null });
  }

  private currentUrlParams(): Params {
    return { ...this.route.snapshot.queryParams };
  }

  private updateQuery(patch: Params, replaceUrl = false): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: patch,
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  }
}

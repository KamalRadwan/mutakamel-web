import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  resource,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerChevronDown,
  tablerChevronUp,
  tablerCurrencyDollar,
  tablerStar,
} from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Pagination } from '../../../../../shared/ui/pagination/pagination';
import { ApiError, errorCodeOf } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { SettingsFrame } from '../../../../../shared/ui/settings-frame/settings-frame';
import { SettingsNotice } from '../../../../../shared/ui/settings-notice/settings-notice';
import {
  deactivateCurrency,
  getDefaultCurrency,
  listCurrencies,
  updateCurrency,
} from '../currencies.api';
import {
  CURRENCY_LIMITS,
  Currency,
  CurrencyListQuery,
  CurrencySortBy,
  currencyErrorMessage,
} from '../currencies.model';
import { CurrencyModal } from '../currency-modal/currency-modal';
import { DeactivateBlockerModal } from '../deactivate-blocker-modal/deactivate-blocker-modal';
import { SetDefaultDialog } from '../set-default-dialog/set-default-dialog';

const CAN_MANAGE = true; // later: currencies.currency.manage with a tenant-wide grant (company grants are not enough)
const SEARCH_DEBOUNCE_MS = 300;
const SKELETON_ROWS = [0, 1, 2, 3, 4] as const;

type CurrencyFilterKey = 'all' | 'active' | 'inactive' | 'default' | 'nonDefault';

const DEACTIVATE_BLOCKER_CODES: ReadonlySet<string> = new Set([
  'CURRENCY_DEFAULT_DELETE',
  'CURRENCY_IN_USE',
  'CURRENCY_COMPANY_IN_USE',
  'CURRENCY_NOT_FOUND',
]);

const REACTIVATE_BLOCKER_CODES: ReadonlySet<string> = new Set([
  'CURRENCY_EXCHANGE_RATE_REQUIRED',
  'CURRENCY_NOT_FOUND',
]);

@Component({
  selector: 'app-currencies-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    ActionsMenu,
    Button,
    ConfirmDialog,
    Dropdown,
    Field,
    Pagination,
    SettingsFrame,
    SettingsNotice,
    CurrencyModal,
    SetDefaultDialog,
    DeactivateBlockerModal,
  ],
  providers: [
    provideTranslocoScope('settings', { scope: 'ws-currencies', alias: 'wsCurrencies' }),
    provideIcons({ tablerCurrencyDollar, tablerChevronUp, tablerChevronDown, tablerStar }),
  ],
  templateUrl: './currencies-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class CurrenciesPage {
  private static nextId = 0;
  protected readonly uid = `currencies-page-${++CurrenciesPage.nextId}`;

  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly currencyModal = viewChild.required(CurrencyModal);
  private readonly setDefaultDialog = viewChild.required(SetDefaultDialog);
  private readonly blockerModal = viewChild.required(DeactivateBlockerModal);
  private readonly deactivateConfirm = viewChild.required<ConfirmDialog>('deactivateConfirm');

  protected readonly canManage = CAN_MANAGE;
  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly pageSizes: number[] = [...CURRENCY_LIMITS.pageSizes];
  protected readonly gridColumns = CAN_MANAGE
    ? 'grid-cols-ws-currency-row-actions'
    : 'grid-cols-ws-currency-row';

  protected readonly search = signal('');
  protected readonly debouncedSearch = signal('');
  protected readonly filter = signal<CurrencyFilterKey>('all');
  protected readonly sortBy = signal<CurrencySortBy>('code');
  protected readonly sortDir = signal<'ASC' | 'DESC'>('ASC');
  protected readonly page = signal(1);
  protected readonly pageSize = signal<number>(CURRENCY_LIMITS.pageSizes[0]);
  protected readonly busy = signal(false);
  protected readonly pendingDeactivate = signal<Currency | null>(null);

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly knownHasCurrencies = signal(false);

  private readonly listQuery = computed<CurrencyListQuery>(() => {
    const query: CurrencyListQuery = {
      page: this.page(),
      limit: this.pageSize(),
      sortBy: this.sortBy(),
      sortDir: this.sortDir(),
    };
    const term = this.debouncedSearch().trim();
    if (term) {
      query.search = term;
    }
    switch (this.filter()) {
      case 'active':
        query.status = 'ACTIVE';
        break;
      case 'inactive':
        query.status = 'INACTIVE';
        break;
      case 'default':
        query.isDefault = true;
        break;
      case 'nonDefault':
        query.isDefault = false;
        break;
      case 'all':
        break;
    }
    return query;
  });

  private readonly listResource = resource({
    params: () => this.listQuery(),
    loader: ({ params }) => listCurrencies(params),
  });

  private readonly defaultResource = resource({
    loader: () => getDefaultCurrency(),
  });

  protected readonly items = computed(() =>
    this.listResource.hasValue() ? this.listResource.value().data : [],
  );
  protected readonly total = computed(() =>
    this.listResource.hasValue() ? this.listResource.value().meta.total : 0,
  );
  protected readonly loading = this.listResource.isLoading;
  protected readonly loadFailed = computed(() => !this.loading() && Boolean(this.listResource.error()));
  protected readonly loadForbidden = computed(() => {
    const error = this.listResource.error();
    const cause = error instanceof ApiError ? error : (error as { cause?: unknown } | undefined)?.cause;
    return this.loadFailed() && cause instanceof ApiError && cause.status === 403;
  });

  protected readonly defaultCurrency = computed(() =>
    this.defaultResource.hasValue() ? this.defaultResource.value() : null,
  );
  protected readonly defaultLoading = this.defaultResource.isLoading;
  protected readonly showDefaultUnknown = computed(
    () =>
      !this.defaultLoading() &&
      (Boolean(this.defaultResource.error()) || !this.defaultCurrency()) &&
      this.items().length > 0,
  );

  protected readonly hasActiveFilters = computed(
    () =>
      this.filter() !== 'all' ||
      this.search().trim().length > 0 ||
      this.debouncedSearch().trim().length > 0,
  );

  protected readonly hasCurrencies = computed(
    () => Boolean(this.defaultCurrency()) || this.total() > 0 || this.knownHasCurrencies(),
  );

  protected readonly filterOptions = computed<DropdownOption<CurrencyFilterKey>[]>(() => {
    this.i18n();
    const t = (key: string) => this.transloco.translate(key);
    return [
      { value: 'all', label: t('wsCurrencies.filters.all') },
      { value: 'active', label: t('wsCurrencies.filters.active') },
      { value: 'inactive', label: t('wsCurrencies.filters.inactive') },
      { value: 'default', label: t('wsCurrencies.filters.default') },
      { value: 'nonDefault', label: t('wsCurrencies.filters.nonDefault') },
    ];
  });

  constructor() {
    effect(() => {
      const term = this.search().trim();
      if (this.searchTimer !== null) {
        clearTimeout(this.searchTimer);
        this.searchTimer = null;
      }
      if (term === untracked(() => this.debouncedSearch())) return;
      this.searchTimer = setTimeout(() => {
        this.searchTimer = null;
        this.page.set(1);
        this.debouncedSearch.set(term);
      }, SEARCH_DEBOUNCE_MS);
    });

    effect(() => {
      if (!this.listResource.hasValue()) return;
      if (!this.hasActiveFilters()) {
        this.knownHasCurrencies.set(this.listResource.value().meta.total > 0);
      } else if (this.listResource.value().meta.total > 0) {
        this.knownHasCurrencies.set(true);
      }
    });

    effect(() => {
      if (!this.listResource.hasValue()) return;
      const result = this.listResource.value();
      const currentPage = untracked(() => this.page());
      if (result.meta.total > 0 && result.data.length === 0 && result.meta.totalPages > 0 && currentPage > result.meta.totalPages) {
        this.page.set(result.meta.totalPages);
      }
    });

    inject(DestroyRef).onDestroy(() => {
      if (this.searchTimer !== null) {
        clearTimeout(this.searchTimer);
        this.searchTimer = null;
      }
    });
  }

  protected reload(): void {
    this.listResource.reload();
    this.defaultResource.reload();
  }

  protected onFilterChange(next: CurrencyFilterKey): void {
    if (next === this.filter()) return;
    this.page.set(1);
    this.filter.set(next);
  }

  protected clearFilters(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    this.search.set('');
    this.debouncedSearch.set('');
    this.filter.set('all');
    this.page.set(1);
  }

  protected toggleSort(column: Extract<CurrencySortBy, 'code' | 'name' | 'exchangeRate'>): void {
    if (this.sortBy() === column) {
      this.sortDir.update((dir) => (dir === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      this.sortBy.set(column);
      this.sortDir.set('ASC');
    }
    this.page.set(1);
  }

  protected ariaSortFor(column: CurrencySortBy): 'ascending' | 'descending' | 'none' {
    if (this.sortBy() !== column) return 'none';
    return this.sortDir() === 'ASC' ? 'ascending' : 'descending';
  }

  protected onPageChange(nextPage: number): void {
    this.page.set(nextPage);
  }

  protected onPageSizeChange(nextSize: number): void {
    if (nextSize === this.pageSize()) return;
    this.pageSize.set(nextSize);
    this.page.set(1);
  }

  protected openCreate(): void {
    if (!this.canManage) return;
    this.currencyModal().openCreate();
  }

  protected openEdit(currency: Currency): void {
    this.currencyModal().openEdit(currency);
  }

  protected onRowClick(currency: Currency, event: Event): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, [data-row-action]')) return;
    this.openEdit(currency);
  }

  protected actionsFor(currency: Currency): ActionItem[] {
    this.i18n();
    const t = (key: string) => this.transloco.translate(key);

    let setDefaultReason = t('wsCurrencies.actions.setDefaultDesc');
    let setDefaultDisabled = false;
    if (currency.isDefault) {
      setDefaultDisabled = true;
      setDefaultReason = t('wsCurrencies.actions.setDefaultIsDefault');
    } else if (currency.status === 'INACTIVE') {
      setDefaultDisabled = true;
      setDefaultReason = t('wsCurrencies.actions.setDefaultInactive');
    }

    const items: ActionItem[] = [
      {
        id: 'setDefault',
        title: t('wsCurrencies.actions.setDefault'),
        icon: 'tablerStar',
        tile: setDefaultDisabled ? 'bg-icon-gray' : 'bg-icon-orange',
        disabled: setDefaultDisabled,
        reason: setDefaultReason,
      },
    ];

    if (currency.status === 'INACTIVE') {
      items.push({
        id: 'reactivate',
        title: t('wsCurrencies.actions.reactivate'),
        icon: 'tablerArrowBackUp',
        tile: 'bg-icon-green',
        reason: t('wsCurrencies.actions.reactivateDesc'),
      });
    } else {
      const deactivateDisabled = currency.isDefault;
      items.push({
        id: 'deactivate',
        title: t('wsCurrencies.actions.deactivate'),
        icon: 'tablerCircleOff',
        tile: deactivateDisabled ? 'bg-icon-gray' : 'bg-icon-red',
        danger: true,
        disabled: deactivateDisabled,
        reason: deactivateDisabled
          ? t('wsCurrencies.actions.deactivateDefault')
          : t('wsCurrencies.actions.deactivateDesc'),
      });
    }

    return items;
  }

  protected onRowAction(currency: Currency, selection: ActionSelection): void {
    if (!this.canManage) return;
    switch (selection.id) {
      case 'setDefault':
        this.setDefaultDialog().open(currency, this.defaultCurrency());
        break;
      case 'reactivate':
        void this.handleReactivate(currency);
        break;
      case 'deactivate':
        void this.handleDeactivate(currency);
        break;
    }
  }

  protected onModalSaved(): void {
    this.reload();
  }

  protected onModalNotFound(): void {
    this.reload();
  }

  protected onDefaultConfirmed(): void {
    this.reload();
  }

  protected onSetDefaultBlocked(event: { currency: Currency; error: ApiError }): void {
    this.blockerModal().open('setDefault', event.currency, event.error);
    if (event.error.code === 'CURRENCY_NOT_FOUND') {
      this.reload();
    }
  }

  private async handleReactivate(currency: Currency): Promise<void> {
    if (!this.canManage || this.busy()) return;
    if (currency.exchangeRate === null) {
      this.currencyModal().openEdit(currency, { reactivate: true });
      return;
    }

    this.busy.set(true);
    try {
      const updated = await updateCurrency(currency.id, { status: 'ACTIVE' }, newIdempotencyKey());
      this.notify.success(this.transloco.translate('wsCurrencies.toast.reactivated', { code: updated.code }));
      this.reload();
    } catch (error) {
      const code = errorCodeOf(error);
      if (error instanceof ApiError && code && REACTIVATE_BLOCKER_CODES.has(code)) {
        this.blockerModal().open('reactivate', currency, error);
        if (code === 'CURRENCY_NOT_FOUND') {
          this.reload();
        }
        return;
      }
      this.notify.error(currencyErrorMessage(error, this.transloco));
    } finally {
      this.busy.set(false);
    }
  }

  private async handleDeactivate(currency: Currency): Promise<void> {
    if (!this.canManage || this.busy() || currency.isDefault) return;

    this.pendingDeactivate.set(currency);
    const confirmed = await this.deactivateConfirm().open();
    if (!confirmed) {
      this.pendingDeactivate.set(null);
      return;
    }

    this.busy.set(true);
    try {
      await deactivateCurrency(currency.id, newIdempotencyKey());
      this.notify.success(this.transloco.translate('wsCurrencies.toast.deactivated', { code: currency.code }));
      this.reload();
    } catch (error) {
      const code = errorCodeOf(error);
      if (error instanceof ApiError && code && DEACTIVATE_BLOCKER_CODES.has(code)) {
        this.blockerModal().open('deactivate', currency, error);
        if (code === 'CURRENCY_NOT_FOUND') {
          this.reload();
        }
        return;
      }
      this.notify.error(currencyErrorMessage(error, this.transloco));
    } finally {
      this.busy.set(false);
      this.pendingDeactivate.set(null);
    }
  }
}

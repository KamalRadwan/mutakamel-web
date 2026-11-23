import { Component, DestroyRef, computed, effect, inject, resource, signal, untracked, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerArrowBackUp,
  tablerChevronDown,
  tablerChevronUp,
  tablerCircleOff,
  tablerReceiptTax,
} from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Pagination } from '../../../../../shared/ui/pagination/pagination';
import { ApiError, errorCodeOf } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { SettingsFrame } from '../../../../../shared/ui/settings-frame/settings-frame';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { AuthSession } from '../../../../../core/auth/auth-session';
import { WorkspaceLookups } from '../../../../../shared/widgets/workspace-lookups/workspace-lookups.api';
import { ActionKeys } from '../../core-response.model';
import { TaxModal } from '../tax-modal/tax-modal';
import { TaxesApi } from '../taxes.api';
import {
  TAX_LIMITS,
  Tax,
  TaxListQuery,
  TaxSortBy,
  TaxStatus,
  canManageTax,
  taxPermissions,
  taxCompanyOptions,
  formatRate,
  translateTaxError,
} from '../taxes.model';

const SEARCH_DEBOUNCE_MS = 300;
const SKELETON_ROWS = [0, 1, 2, 3, 4] as const;

type SortableColumn = 'code' | 'name' | 'rate';
type InclusiveFilterValue = '' | 'true' | 'false';
type StatusFilterValue = '' | TaxStatus;

@Component({
  selector: 'app-taxes-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    ActionsMenu,
    Button,
    ConfirmDialog,
    Dropdown,
    Field,
    Modal,
    Pagination,
    SettingsFrame,
    Switch,
    TaxModal,
  ],
  providers: [
    provideTranslocoScope('settings', { scope: 'ws-taxes', alias: 'wsTaxes' }),
    provideIcons({
      tablerReceiptTax,
      tablerChevronUp,
      tablerChevronDown,
      tablerAlertTriangle,
      tablerCircleOff,
      tablerArrowBackUp,
    }),
  ],
  templateUrl: './taxes-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col' },
})
export class TaxesPage {
  private static nextId = 0;
  protected readonly uid = `taxes-page-${++TaxesPage.nextId}`;

  private readonly api = inject(TaxesApi);
  private readonly auth = inject(AuthSession);
  private readonly lookups = inject(WorkspaceLookups);
  private readonly actionKeys = new ActionKeys(newIdempotencyKey);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly taxModal = viewChild.required(TaxModal);
  private readonly deactivateConfirm = viewChild.required<ConfirmDialog>('deactivateConfirm');
  private readonly reactivateBlockerModal = viewChild.required<Modal>('reactivateBlockerModal');

  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly pageSizes = [...TAX_LIMITS.pageSizes];

  protected readonly search = signal('');
  protected readonly debouncedSearch = signal('');
  protected readonly companyFilter = signal('');
  protected readonly statusFilter = signal<StatusFilterValue>('');
  protected readonly inclusiveFilter = signal<InclusiveFilterValue>('');
  protected readonly sortBy = signal<TaxSortBy>('code');
  protected readonly sortDir = signal<'ASC' | 'DESC'>('ASC');
  protected readonly page = signal(1);
  protected readonly pageSize = signal<number>(TAX_LIMITS.pageSizes[0]);

  protected readonly modalCanManage = signal(true);
  protected readonly deactivatingTax = signal<Tax | null>(null);
  private readonly busyTaxIds = signal<ReadonlySet<string>>(new Set());

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly permissions = computed(() => taxPermissions(this.auth.me()));
  protected readonly tenantWideAllowed = computed(() => this.permissions().tenantWideAllowed);
  protected readonly showInactiveCompanies = signal(false);

  private readonly companiesResource = resource({
    params: () => this.api.scopeRevision(),
    loader: () => this.lookups.allCompanies(),
  });

  protected readonly companyStatusesKnown = computed(() => this.companiesResource.hasValue());
  protected readonly companies = computed(() => {
    this.i18n();
    return taxCompanyOptions(this.auth.me(), this.companiesResource.hasValue() ? this.companiesResource.value() : null,
      (id) => this.transloco.translate('wsTaxes.companyFallback', { id }));
  });
  private readonly companyById = computed(() => new Map(this.companies().map((company) => [company.id, company])));
  protected readonly canCreate = computed(() => this.tenantWideAllowed() ||
    this.companies().some((company) => company.canManage && company.status !== 'INACTIVE'));

  private readonly listQuery = computed<TaxListQuery>(() => {
    const query: TaxListQuery = {
      page: this.page(),
      limit: this.pageSize(),
      sortBy: this.sortBy(),
      sortDir: this.sortDir(),
    };
    const term = this.debouncedSearch();
    if (term) query.search = term.slice(0, 200);
    const status = this.statusFilter();
    if (status) query.status = status;
    const companyId = this.companyFilter();
    if (companyId) query.companyId = companyId;
    const inclusive = this.inclusiveFilter();
    if (inclusive === 'true') query.isInclusive = true;
    else if (inclusive === 'false') query.isInclusive = false;
    return query;
  });

  private readonly taxesResource = resource({
    params: () => ({ query: this.listQuery(), scope: this.api.scopeRevision() }),
    loader: ({ params }) => this.api.listTaxes(params.query),
  });

  protected readonly taxes = computed(() => {
    const taxes = this.taxesResource.hasValue() ? this.taxesResource.value().data : [];
    if (!this.companyStatusesKnown() || this.showInactiveCompanies()) return taxes;
    return taxes.filter((tax) => tax.companyId === null || this.companyById().get(tax.companyId)?.status === 'ACTIVE');
  });
  protected readonly loading = this.taxesResource.isLoading;
  private readonly listError = computed(() => {
    const error = this.taxesResource.error();
    return error instanceof ApiError ? error : (error as { cause?: unknown } | undefined)?.cause;
  });
  protected readonly loadFailed = computed(() => !this.loading() && Boolean(this.listError()));
  protected readonly loadForbidden = computed(() => {
    const error = this.listError();
    return this.loadFailed() && error instanceof ApiError && error.status === 403;
  });
  protected readonly displayTotal = computed(() => this.taxesResource.hasValue() ? this.taxesResource.value().meta.total : 0);

  protected readonly hasActiveFilters = computed(() =>
    Boolean(
      this.search().trim() ||
        this.debouncedSearch() ||
        this.companyFilter() ||
        this.statusFilter() ||
        this.inclusiveFilter(),
    ),
  );

  protected readonly showActionsColumn = computed(
    () => this.canCreate() || this.taxes().some((tax) => this.canManageTax(tax)),
  );

  protected readonly gridColumns = computed(() =>
    this.showActionsColumn()
      ? 'grid-cols-ws-tax-row-actions'
      : 'grid-cols-ws-tax-row',
  );

  protected readonly companyOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const allLabel = this.transloco.translate('wsTaxes.filters.allCompanies');
    const inactiveSuffix = this.transloco.translate('wsTaxes.filters.inactiveSuffix');
    return [
      { value: '', label: allLabel },
      ...this.companies().map((company) => ({
        value: company.id,
        label: company.status === 'INACTIVE' ? `${company.name} ${inactiveSuffix}` : company.name,
      })),
    ];
  });

  protected readonly statusOptions = computed<DropdownOption<StatusFilterValue>[]>(() => {
    this.i18n();
    return [
      { value: '', label: this.transloco.translate('wsTaxes.filters.allStatuses') },
      { value: 'ACTIVE', label: this.transloco.translate('settings.common.active') },
      { value: 'INACTIVE', label: this.transloco.translate('settings.common.inactive') },
    ];
  });

  protected readonly inclusiveOptions = computed<DropdownOption<InclusiveFilterValue>[]>(() => {
    this.i18n();
    return [
      { value: '', label: this.transloco.translate('wsTaxes.filters.allInclusive') },
      { value: 'true', label: this.transloco.translate('settings.common.yes') },
      { value: 'false', label: this.transloco.translate('settings.common.no') },
    ];
  });

  constructor() {
    effect(() => {
      const error = this.listError();
      if (error instanceof ApiError && error.status === 0) {
        this.notify.connectionLost(this.transloco.translate('session.connectionLost.title'),
          this.transloco.translate('session.connectionLost.text'));
      } else if (this.taxesResource.hasValue()) {
        this.notify.connectionRestored();
      }
      if (error instanceof ApiError && error.status === 422 && error.code === 'COMPANY_INVALID' && this.companyFilter()) {
        this.notify.error(translateTaxError(error, this.transloco));
        this.companyFilter.set('');
        this.page.set(1);
      }
    });

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
      if (!this.taxesResource.hasValue()) return;
      const result = this.taxesResource.value();
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

  protected canManageTax(tax: Tax): boolean {
    return canManageTax(tax, this.permissions());
  }

  protected scopeLabel(tax: Tax): string {
    this.i18n();
    if (tax.companyId === null) {
      return this.transloco.translate('wsTaxes.table.workspaceWide');
    }
    const company = this.companyById().get(tax.companyId);
    return company ? company.name : this.transloco.translate('wsTaxes.companyFallback', { id: tax.companyId.slice(0, 8) });
  }

  protected formatRateValue(rate: string): string {
    return formatRate(rate);
  }

  protected ariaSortFor(column: SortableColumn): 'ascending' | 'descending' | 'none' {
    if (this.sortBy() !== column) return 'none';
    return this.sortDir() === 'ASC' ? 'ascending' : 'descending';
  }

  protected toggleSort(column: SortableColumn): void {
    if (this.sortBy() === column) {
      this.sortDir.update((dir) => (dir === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      this.sortBy.set(column);
      this.sortDir.set('ASC');
    }
    this.page.set(1);
  }

  protected onCompanyFilterChange(value: string): void {
    if (value === this.companyFilter()) return;
    this.companyFilter.set(value);
    this.page.set(1);
  }

  protected onStatusFilterChange(value: StatusFilterValue): void {
    if (value === this.statusFilter()) return;
    this.statusFilter.set(value);
    this.page.set(1);
  }

  protected onInclusiveFilterChange(value: InclusiveFilterValue): void {
    if (value === this.inclusiveFilter()) return;
    this.inclusiveFilter.set(value);
    this.page.set(1);
  }

  protected onPageSizeChange(size: number): void {
    if (size === this.pageSize()) return;
    this.pageSize.set(size);
    this.page.set(1);
  }

  protected clearFilters(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    this.search.set('');
    this.debouncedSearch.set('');
    this.companyFilter.set('');
    this.statusFilter.set('');
    this.inclusiveFilter.set('');
    this.page.set(1);
  }

  protected reload(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    const term = this.search().trim();
    if (term !== this.debouncedSearch()) {
      this.page.set(1);
      this.debouncedSearch.set(term);
      return;
    }
    this.taxesResource.reload();
  }

  protected openCreate(): void {
    if (!this.canCreate()) return;
    this.modalCanManage.set(true);
    this.taxModal().openCreate();
  }

  protected openEdit(tax: Tax): void {
    this.modalCanManage.set(this.canManageTax(tax));
    this.taxModal().openEdit(tax);
  }

  protected onRowClick(tax: Tax, event: Event): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, [data-row-action]')) return;
    this.openEdit(tax);
  }

  protected onModalSaved(): void {
    this.taxesResource.reload();
  }

  protected onModalNotFound(): void {
    this.taxesResource.reload();
  }

  protected actionsFor(tax: Tax): ActionItem[] {
    this.i18n();
    const busy = this.busyTaxIds().has(tax.id);
    if (tax.status === 'ACTIVE') {
      return [
        {
          id: 'deactivate',
          title: this.transloco.translate('wsTaxes.actions.deactivate'),
          icon: 'tablerCircleOff',
          tile: busy ? 'bg-icon-gray' : 'bg-icon-red',
          danger: true,
          disabled: busy,
        },
      ];
    }
    return [
      {
        id: 'reactivate',
        title: this.transloco.translate('wsTaxes.actions.reactivate'),
        icon: 'tablerArrowBackUp',
        tile: busy ? 'bg-icon-gray' : 'bg-icon-green',
        disabled: busy,
      },
    ];
  }

  protected onAction(tax: Tax, selection: ActionSelection): void {
    if (!this.canManageTax(tax)) return;
    if (selection.id === 'deactivate') {
      void this.requestDeactivate(tax);
    } else if (selection.id === 'reactivate') {
      void this.reactivate(tax);
    }
  }

  private async requestDeactivate(tax: Tax): Promise<void> {
    if (!this.canManageTax(tax) || this.busyTaxIds().has(tax.id)) return;
    this.deactivatingTax.set(tax);
    const confirmed = await this.deactivateConfirm().open();
    if (!confirmed || !this.canManageTax(tax) || this.busyTaxIds().has(tax.id)) return;

    this.setBusy(tax.id, true);
    try {
      await this.api.deactivateTax(tax.id, this.actionKeys.keyFor(`deactivate:${tax.id}`));
      this.actionKeys.done(`deactivate:${tax.id}`);
      this.notify.success(this.transloco.translate('wsTaxes.toast.deactivated', { code: tax.code }));
      this.taxesResource.reload();
    } catch (error) {
      this.handleWriteError(error);
    } finally {
      this.setBusy(tax.id, false);
    }
  }

  private async reactivate(tax: Tax): Promise<void> {
    if (!this.canManageTax(tax) || this.busyTaxIds().has(tax.id)) return;

    this.setBusy(tax.id, true);
    try {
      const updated = await this.api.updateTax(tax.id, { status: 'ACTIVE' }, this.actionKeys.keyFor(`reactivate:${tax.id}`));
      this.actionKeys.done(`reactivate:${tax.id}`);
      this.notify.success(this.transloco.translate('wsTaxes.toast.reactivated', { code: updated.code }));
      this.taxesResource.reload();
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'COMPANY_INVALID') {
        this.reactivateBlockerModal().open();
        return;
      }
      this.handleWriteError(error);
    } finally {
      this.setBusy(tax.id, false);
    }
  }

  private handleWriteError(error: unknown): void {
    if (error instanceof ApiError && error.status === 0) {
      this.notify.connectionLost(this.transloco.translate('session.connectionLost.title'),
        this.transloco.translate('session.connectionLost.text'));
    } else {
      this.notify.error(translateTaxError(error, this.transloco, 'write'));
    }
    if (errorCodeOf(error) === 'TAX_NOT_FOUND' || (error instanceof ApiError && error.status === 404)) {
      this.taxesResource.reload();
    }
  }

  private setBusy(id: string, busy: boolean): void {
    this.busyTaxIds.update((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }
}

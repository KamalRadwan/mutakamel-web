import { Component, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAdjustmentsHorizontal,
  tablerBuildingSkyscraper,
  tablerCheck,
  tablerCircleOff,
  tablerCloudOff,
  tablerEdit,
  tablerEye,
  tablerPlus,
  tablerTrash,
  tablerUsers,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Modal } from '../../../../shared/ui/modal/modal';
import { SeatCascadeConfirm } from '../../seats/cascade-confirm/cascade-confirm';
import { isCascadeRequired, seatErrorMessage } from '../../seats/seat-errors';
import { SeatImpact } from '../../seats/seat-impact/seat-impact';
import { SeatChange } from '../../seats/seats.model';
import { BlockersDialog } from '../shared/blockers-dialog/blockers-dialog';
import { StaffSession } from '../shared/staff-session';
import { StaffList } from '../shared/staff-list/staff-list';
import { StatusBadge as StaffStatusBadge } from '../shared/status-badge/status-badge';
import {
  ApiError,
  deleteCompany,
  errorCodeOf,
  errorMessage,
  getCompany,
  listCompanies,
  listCurrencies,
  newIdempotencyKey,
  updateCompany,
} from '../shared/staff.api';
import { Company, Currency, ListQuery, OrgStatus, StaffListFilter, StaffListSortOption } from '../shared/staff.model';
import { CompanyModal } from './company-modal/company-modal';

type CompanySort = 'name' | 'code' | 'createdAt';

const SKELETON_ROWS = [1, 2, 3, 4, 5] as const;
const TABLE_COLUMNS = 'grid-cols-staff-company-row-actions';

@Component({
  selector: 'app-companies-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    ActionsMenu,
    BlockersDialog,
    Button,
    ConfirmDialog,
    CompanyModal,
    Modal,
    SeatImpact,
    StaffList,
    StaffStatusBadge,
  ],
  providers: [
    provideTranslocoScope(
      'settings',
      { scope: 'staff', alias: 'staff' },
      { scope: 'staff-companies', alias: 'companies' },
      { scope: 'seats', alias: 'seats' },
    ),
    provideIcons({
      tablerBuildingSkyscraper,
      tablerCloudOff,
      tablerEye,
      tablerEdit,
      tablerPlus,
      tablerUsers,
      tablerAdjustmentsHorizontal,
      tablerCheck,
      tablerCircleOff,
      tablerTrash,
    }),
  ],
  templateUrl: './companies-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class CompaniesPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly session = inject(StaffSession);
  private readonly cascadeConfirm = inject(SeatCascadeConfirm);
  private readonly queryParams = toSignal(this.route.queryParamMap);

  private readonly companyModal = viewChild.required(CompanyModal);
  private readonly deleteConfirm = viewChild.required<ConfirmDialog>('deleteConfirm');
  private readonly statusDialog = viewChild.required<Modal>('statusDialog');
  private readonly blockersDialog = viewChild.required(BlockersDialog);

  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly tableColumns = TABLE_COLUMNS;

  protected readonly search = signal('');
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly sort = signal<string>('name');
  protected readonly filterValues = signal<Record<string, string | null>>({});

  protected readonly rows = signal<Company[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly currencies = signal<Currency[]>([]);
  protected readonly busyIds = signal<ReadonlySet<string>>(new Set());

  protected readonly pendingDeleteCompany = signal<Company | null>(null);
  protected readonly pendingStatusChange = signal<{ company: Company; nextStatus: OrgStatus } | null>(null);
  protected readonly statusSeatBlocked = signal(false);

  protected readonly isOwner = computed(() => this.session.isOwner());
  protected readonly statusSeatChanges = computed<SeatChange[] | null>(() => {
    const pending = this.pendingStatusChange();
    return pending ? [{ kind: 'ORG_STATUS', companyId: pending.company.id, status: pending.nextStatus }] : null;
  });
  protected readonly statusConfirmBlocked = computed(
    () => this.pendingStatusChange()?.nextStatus === 'ACTIVE' && this.statusSeatBlocked(),
  );

  protected readonly canManage = computed(() => this.session.isTenantWide('org.company.manage'));

  protected readonly hasActiveFiltersOrSearch = computed(
    () => Boolean(this.search().trim()) || Boolean(this.filterValues()['status']),
  );

  protected readonly filters = computed<StaffListFilter[]>(() => {
    this.i18n();
    return [
      {
        id: 'status',
        label: this.transloco.translate('companies.filters.status'),
        options: [
          { value: 'ACTIVE', label: this.transloco.translate('companies.filters.active') },
          { value: 'INACTIVE', label: this.transloco.translate('companies.filters.inactive') },
        ],
        value: this.filterValues()['status'] ?? null,
      },
    ];
  });

  protected readonly sortOptions = computed<StaffListSortOption[]>(() => {
    this.i18n();
    return [
      { value: 'name', label: this.transloco.translate('companies.sort.name') },
      { value: 'code', label: this.transloco.translate('companies.sort.code') },
      { value: 'createdAt', label: this.transloco.translate('companies.sort.newest') },
    ];
  });

  private loadSeq = 0;
  private prevCriteriaSignature: string | null = null;
  private handledDeepLinkKey = '';
  private statusConfirmResolver: ((confirmed: boolean) => void) | null = null;

  constructor() {
    if (!this.session.me()) {
      void this.session.load();
    }
    void this.loadCurrencies();

    effect(() => {
      const search = this.search().trim();
      const sort = this.sort() as CompanySort;
      const status = this.filterValues()['status'] ?? null;
      const page = this.page();
      const pageSize = this.pageSize();

      const criteriaSignature = `${search}|${sort}|${status ?? ''}`;
      const criteriaChanged = this.prevCriteriaSignature !== null && this.prevCriteriaSignature !== criteriaSignature;
      this.prevCriteriaSignature = criteriaSignature;

      if (criteriaChanged && page !== 1) {
        untracked(() => this.page.set(1));
        return;
      }

      void untracked(() => this.loadList({ search, sort, status, page, pageSize }));
    });

    effect(() => {
      const params = this.queryParams();
      const me = this.session.me();
      if (!params || !me) return;

      const openId = params.get('open');
      const isNew = params.get('new') === '1';
      if (!openId && !isNew) return;

      const key = `${openId ?? ''}|${isNew ? '1' : ''}`;
      if (key === this.handledDeepLinkKey) return;
      this.handledDeepLinkKey = key;

      untracked(() => {
        if (openId) {
          void this.openCompanyById(openId);
          this.clearQueryParams(['open', 'new']);
        } else if (isNew) {
          if (this.canManage()) {
            this.openCreate();
          }
          this.clearQueryParams(['new']);
        }
      });
    });
  }

  protected reload(): void {
    void this.loadCurrencies();
    void this.loadList({
      search: this.search().trim(),
      sort: this.sort() as CompanySort,
      status: this.filterValues()['status'] ?? null,
      page: this.page(),
      pageSize: this.pageSize(),
    });
  }

  protected openCreate(): void {
    if (!this.canManage()) return;
    this.companyModal().openCreate();
  }

  protected openEdit(company: Company): void {
    this.companyModal().openEdit(company);
  }

  protected onModalSaved(event: { company: Company; isNew: boolean }): void {
    if (this.companyModal().editingId() === event.company.id) {
      this.companyModal().syncCompany(event.company);
    }
    this.reload();
  }

  protected formatDate(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat(`${this.language()}-u-nu-latn`, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  protected actionsFor(company: Company): ActionItem[] {
    this.i18n();
    const t = (key: string) => this.transloco.translate(key);
    const manage = this.canManage();
    const busy = this.busyIds().has(company.id);
    const isActive = company.status === 'ACTIVE';

    const items: ActionItem[] = [
      {
        id: 'open',
        title: t('companies.actions.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
    ];

    if (manage) {
      items.push(
        {
          id: 'edit',
          title: t('companies.actions.edit'),
          icon: 'tablerEdit',
          tile: 'bg-icon-orange',
        },
        {
          id: 'addBranch',
          title: t('companies.actions.addBranch'),
          icon: 'tablerPlus',
          tile: isActive ? 'bg-icon-green' : 'bg-icon-gray',
          disabled: !isActive,
          reason: !isActive ? t('companies.actions.inactiveCompanyReason') : undefined,
        },
      );
    }

    items.push(
      {
        id: 'viewUsers',
        title: t('companies.actions.viewUsers'),
        icon: 'tablerUsers',
        tile: 'bg-icon-blue',
      },
      {
        id: 'activation',
        title: t('companies.actions.activation'),
        icon: 'tablerAdjustmentsHorizontal',
        tile: 'bg-icon-violet',
      },
    );

    if (manage) {
      items.push(
        {
          id: 'toggleStatus',
          title: t(isActive ? 'companies.actions.deactivate' : 'companies.actions.activate'),
          icon: isActive ? 'tablerCircleOff' : 'tablerCheck',
          tile: busy ? 'bg-icon-gray' : isActive ? 'bg-icon-orange' : 'bg-icon-green',
          disabled: busy,
        },
        {
          id: 'delete',
          title: t('companies.actions.delete'),
          icon: 'tablerTrash',
          tile: 'bg-icon-red',
          danger: true,
          disabled: busy,
        },
      );
    }

    return items;
  }

  protected onAction(company: Company, selection: ActionSelection): void {
    switch (selection.id) {
      case 'open':
      case 'edit':
        this.openEdit(company);
        break;
      case 'addBranch':
        if (this.canManage() && company.status === 'ACTIVE') {
          void this.router.navigate(['/workspace/staff/branches'], {
            queryParams: { new: 1, companyId: company.id },
          });
        }
        break;
      case 'viewUsers':
        void this.router.navigate(['/workspace/staff/users'], {
          queryParams: { companyId: company.id },
        });
        break;
      case 'activation':
        void this.router.navigate(['/workspace/operations/application-activation'], {
          queryParams: { companyId: company.id },
        });
        break;
      case 'toggleStatus':
        if (this.canManage()) {
          void this.requestToggleStatus(company);
        }
        break;
      case 'delete':
        if (this.canManage()) {
          void this.requestDelete(company);
        }
        break;
    }
  }

  protected async requestDelete(company: Company): Promise<void> {
    if (!this.canManage() || this.busyIds().has(company.id)) return;
    this.pendingDeleteCompany.set(company);
    if (!(await this.deleteConfirm().open())) {
      this.pendingDeleteCompany.set(null);
      return;
    }

    this.setBusy(company.id, true);
    try {
      try {
        await deleteCompany(company.id, newIdempotencyKey());
      } catch (error) {
        const cascade = isCascadeRequired(error);
        if (!cascade) throw error;
        if (!(await this.cascadeConfirm.confirm(cascade.addons))) return;
        await deleteCompany(company.id, newIdempotencyKey(), { confirmAddonCascade: true });
      }
      if (this.companyModal().editingId() === company.id) {
        this.companyModal().closeImmediate();
      }
      this.notify.success(this.transloco.translate('companies.toast.deleted'));
      this.reload();
    } catch (error) {
      if (errorCodeOf(error) === 'ORG_NODE_NOT_EMPTY') {
        this.openCompanyBlockers(company, this.extractBlockers(error));
        return;
      }
      this.notify.error(this.resolveError(error));
    } finally {
      this.setBusy(company.id, false);
      this.pendingDeleteCompany.set(null);
    }
  }

  protected onDeactivateBlocked(event: { company: Company; blockers: string[] }): void {
    this.openCompanyBlockers(event.company, event.blockers);
  }

  protected settleStatusConfirm(confirmed: boolean): void {
    if (confirmed && this.statusConfirmBlocked()) return;
    const resolve = this.statusConfirmResolver;
    this.statusConfirmResolver = null;
    if (resolve) {
      this.statusDialog().close();
    }
    resolve?.(confirmed);
  }

  protected onStatusDialogClosed(): void {
    const resolve = this.statusConfirmResolver;
    this.statusConfirmResolver = null;
    resolve?.(false);
  }

  private openStatusConfirm(): Promise<boolean> {
    this.statusConfirmResolver?.(false);
    this.statusSeatBlocked.set(false);
    this.statusDialog().open();
    return new Promise<boolean>((resolve) => {
      this.statusConfirmResolver = resolve;
    });
  }

  private async requestToggleStatus(company: Company): Promise<void> {
    if (this.busyIds().has(company.id)) return;
    const nextStatus: OrgStatus = company.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    this.pendingStatusChange.set({ company, nextStatus });
    if (!(await this.openStatusConfirm())) {
      this.pendingStatusChange.set(null);
      return;
    }

    this.setBusy(company.id, true);
    try {
      let updated: Company;
      try {
        updated = await updateCompany(company.id, { status: nextStatus }, newIdempotencyKey());
      } catch (error) {
        const cascade = isCascadeRequired(error);
        if (!cascade) throw error;
        const confirmed = await this.cascadeConfirm.confirm(cascade.addons);
        if (!confirmed) return;
        updated = await updateCompany(company.id, { status: nextStatus }, newIdempotencyKey(), {
          confirmAddonCascade: true,
        });
      }
      this.companyModal().syncCompany(updated);
      this.notify.success(this.transloco.translate('companies.toast.saved'));
      this.reload();
    } catch (error) {
      if (errorCodeOf(error) === 'ORG_NODE_NOT_EMPTY') {
        this.openCompanyBlockers(company, this.extractBlockers(error));
        return;
      }
      this.notify.error(this.resolveError(error));
    } finally {
      this.setBusy(company.id, false);
      this.pendingStatusChange.set(null);
    }
  }

  private openCompanyBlockers(company: Company, blockers: string[]): void {
    const t = (key: string) => this.transloco.translate(key);
    const branchesLink = {
      label: t('companies.actions.viewBranches'),
      route: ['/workspace/staff/branches'],
      queryParams: { companyId: company.id },
    };
    const usersLink = {
      label: t('companies.actions.viewUsers'),
      route: ['/workspace/staff/users'],
      queryParams: { companyId: company.id },
    };

    void this.blockersDialog().open({
      title: company.name,
      blockers,
      links: {
        'company has branches': branchesLink,
        'company has active branches': branchesLink,
        'company has placed users': usersLink,
        'company has team memberships': usersLink,
      },
    });
  }

  private async openCompanyById(id: string): Promise<void> {
    const existing = this.rows().find((c) => c.id === id);
    if (existing) {
      this.openEdit(existing);
      return;
    }
    try {
      const company = await getCompany(id);
      this.openEdit(company);
    } catch (error) {
      this.notify.error(this.resolveError(error));
    }
  }

  private async loadCurrencies(): Promise<void> {
    try {
      const list = await listCurrencies();
      this.currencies.set(list);
    } catch {
      // Non-blocking lookup for company currency dropdown
    }
  }

  private async loadList(params: {
    search: string;
    sort: CompanySort;
    status: string | null;
    page: number;
    pageSize: number;
  }): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);

    const query: ListQuery = {
      page: params.page,
      limit: params.pageSize,
      sortBy: params.sort,
      sortDir: params.sort === 'createdAt' ? 'DESC' : 'ASC',
    };
    if (params.search) query.search = params.search;
    if (params.status) query.status = params.status;

    try {
      const result = await listCompanies(query);
      if (seq !== this.loadSeq) return;
      this.rows.set(result.data);
      this.total.set(result.meta.total);
    } catch {
      if (seq !== this.loadSeq) return;
      this.loadFailed.set(true);
      this.rows.set([]);
      this.total.set(0);
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private clearQueryParams(keys: string[]): void {
    const clear: Record<string, null> = {};
    for (const key of keys) clear[key] = null;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: clear,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private extractBlockers(error: unknown): string[] {
    const raw = error instanceof ApiError ? error.details?.['blockers'] : undefined;
    return Array.isArray(raw) ? raw.map(String) : [];
  }

  private setBusy(id: string, busy: boolean): void {
    this.busyIds.update((current) => {
      const next = new Set(current);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  private resolveError(error: unknown): string {
    const seatMsg = seatErrorMessage(this.transloco, error);
    if (seatMsg) return seatMsg;
    const msg = errorMessage(error, 'staff', this.transloco);
    if (msg && msg !== 'settings.errors.generic') return msg;
    const fallback = this.transloco.translate('staff.errors.generic');
    return fallback !== 'staff.errors.generic' ? fallback : msg;
  }
}

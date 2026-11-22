import { Component, DestroyRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerBuildingStore,
  tablerCheck,
  tablerCircleOff,
  tablerCloudOff,
  tablerEdit,
  tablerEye,
  tablerPlus,
  tablerStar,
  tablerTrash,
  tablerUsers,
} from '@ng-icons/tabler-icons';
import { listCountries } from '../../../../core/geo/geo.api';
import { GeoCountry } from '../../../../core/geo/geo.model';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Modal } from '../../../../shared/ui/modal/modal';
import { normalizePhone } from '../../../../shared/ui/phone-input/phone';
import { PhoneActions } from '../../../../shared/widgets/phone-actions/phone-actions';
import { SeatCascadeConfirm } from '../../seats/cascade-confirm/cascade-confirm';
import { isCascadeRequired, seatErrorMessage } from '../../seats/seat-errors';
import { SeatImpact } from '../../seats/seat-impact/seat-impact';
import { SeatChange } from '../../seats/seats.model';
import { BlockersDialog } from '../shared/blockers-dialog/blockers-dialog';
import { StaffList } from '../shared/staff-list/staff-list';
import { StaffSession } from '../shared/staff-session';
import { OrganizationReadApi } from '../shared/organization-read.api';
import { StatusBadge as StaffStatusBadge } from '../shared/status-badge/status-badge';
import {
  ApiError,
  deleteBranch,
  errorCodeOf,
  errorMessage,
  listAllPages,
  newIdempotencyKey,
  updateBranch,
} from '../shared/staff.api';
import { BlockerLink, Branch, Company, ListQuery, OrgStatus, StaffListFilter, StaffListSortOption } from '../shared/staff.model';
import { BranchModal } from './branch-modal/branch-modal';
import { HqTransferModal } from './hq-transfer-modal/hq-transfer-modal';

type BranchSort = 'name' | 'code' | 'createdAt';

const SKELETON_ROWS = [1, 2, 3, 4, 5] as const;
const TABLE_COLUMNS = 'grid-cols-staff-branch-row-actions';

@Component({
  selector: 'app-branches-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    ActionsMenu,
    BlockersDialog,
    BranchModal,
    Button,
    ConfirmDialog,
    HqTransferModal,
    Modal,
    PhoneActions,
    SeatImpact,
    StaffList,
    StaffStatusBadge,
  ],
  providers: [
    provideTranslocoScope(
      'settings',
      { scope: 'staff', alias: 'staff' },
      { scope: 'staff-branches', alias: 'branches' },
      { scope: 'seats', alias: 'seats' },
    ),
    provideIcons({
      tablerBuildingStore,
      tablerAlertTriangle,
      tablerCloudOff,
      tablerStar,
      tablerEye,
      tablerEdit,
      tablerPlus,
      tablerUsers,
      tablerCheck,
      tablerCircleOff,
      tablerTrash,
    }),
  ],
  templateUrl: './branches-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class BranchesPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly session = inject(StaffSession);
  private readonly destroyRef = inject(DestroyRef);
  private readonly organization = inject(OrganizationReadApi);
  private readonly cascadeConfirm = inject(SeatCascadeConfirm);
  private readonly queryParams = toSignal(this.route.queryParamMap);

  private readonly branchModal = viewChild.required(BranchModal);
  private readonly hqTransferModal = viewChild.required(HqTransferModal);
  private readonly deleteConfirm = viewChild.required<ConfirmDialog>('deleteConfirm');
  private readonly statusDialog = viewChild.required<Modal>('statusDialog');
  private readonly hqConfirm = viewChild.required<ConfirmDialog>('hqConfirm');
  private readonly blockersDialog = viewChild.required(BlockersDialog);

  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly tableColumns = TABLE_COLUMNS;

  protected readonly search = signal('');
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly sort = signal<string>('name');
  protected readonly filterValues = signal<Record<string, string | null>>({});

  private readonly loadedRows = signal<Branch[]>([]);
  private readonly loadedTotal = signal<{ revision: string | null; count: number } | null>(null);
  protected readonly rows = computed(() =>
    this.loadedTotal()?.revision === this.session.scopeRevision() ? this.loadedRows() : [],
  );
  protected readonly total = computed(() => {
    const result = this.loadedTotal();
    return result && result.revision === this.session.scopeRevision() ? result.count : 0;
  });
  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly loadForbidden = signal(false);
  private readonly companyLookup = signal<{ revision: string | null; rows: Company[] } | null>(null);
  protected readonly companies = computed(() => {
    const lookup = this.companyLookup();
    return lookup && lookup.revision === this.session.scopeRevision() ? lookup.rows : [];
  });
  protected readonly allBranches = signal<Branch[]>([]);
  protected readonly countries = signal<GeoCountry[]>([]);
  protected readonly busyIds = signal<ReadonlySet<string>>(new Set());

  protected readonly modalBranch = signal<Branch | null>(null);
  protected readonly pendingDeleteBranch = signal<Branch | null>(null);
  protected readonly pendingStatusChange = signal<{ branch: Branch; nextStatus: OrgStatus } | null>(null);
  protected readonly pendingHqBranch = signal<{ branch: Branch; companyName: string; oldHqName: string } | null>(null);
  protected readonly statusSeatBlocked = signal(false);

  protected readonly isOwner = computed(() => this.session.isOwner());
  protected readonly statusSeatChanges = computed<SeatChange[] | null>(() => {
    const pending = this.pendingStatusChange();
    return pending ? [{ kind: 'ORG_STATUS', branchId: pending.branch.id, status: pending.nextStatus }] : null;
  });
  protected readonly statusConfirmBlocked = computed(
    () => this.pendingStatusChange()?.nextStatus === 'ACTIVE' && this.statusSeatBlocked(),
  );

  private readonly companyMap = computed(() => new Map(this.companies().map((c) => [c.id, c])));

  // Keep fixture mutations unavailable for records loaded from Core.
  protected readonly canAddBranch = () => false;

  protected readonly modalCanManage = computed(() => {
    const editing = this.modalBranch();
    if (editing) {
      return this.canManageBranch(editing);
    }
    return this.canAddBranch();
  });

  protected readonly hasActiveFiltersOrSearch = computed(
    () =>
      Boolean(this.search().trim()) ||
      Boolean(this.filterValues()['companyId']) ||
      Boolean(this.filterValues()['status']),
  );

  protected readonly filters = computed<StaffListFilter[]>(() => {
    this.i18n();
    const vals = this.filterValues();
    return [
      {
        id: 'companyId',
        label: this.transloco.translate('branches.filters.company'),
        options: this.companies().map((company) => ({ value: company.id, label: company.name })),
        value: vals['companyId'] ?? null,
      },
      {
        id: 'status',
        label: this.transloco.translate('branches.filters.status'),
        options: [
          { value: 'ACTIVE', label: this.transloco.translate('branches.filters.active') },
          { value: 'INACTIVE', label: this.transloco.translate('branches.filters.inactive') },
        ],
        value: vals['status'] ?? null,
      },
    ];
  });

  protected readonly sortOptions = computed<StaffListSortOption[]>(() => {
    this.i18n();
    return [
      { value: 'name', label: this.transloco.translate('branches.sort.name') },
      { value: 'code', label: this.transloco.translate('branches.sort.code') },
      { value: 'createdAt', label: this.transloco.translate('branches.sort.newest') },
    ];
  });

  private loadSeq = 0;
  private detailSeq = 0;
  private detailRevision: string | null = null;
  private prevCriteriaSignature: string | null = null;
  private handledDeepLinkKey = '';
  private appliedCompanyFilterKey = '';
  private statusConfirmResolver: ((confirmed: boolean) => void) | null = null;

  constructor() {
    if (!this.session.me()) {
      void this.session.load();
    }
    effect(() => {
      this.session.scopeRevision();
      void untracked(() => this.loadLookups());
    });

    const initialCompanyId = this.route.snapshot.queryParamMap.get('companyId');
    if (initialCompanyId) {
      this.appliedCompanyFilterKey = initialCompanyId;
      this.filterValues.set({ companyId: initialCompanyId });
    }

    effect(() => {
      const search = this.search().trim();
      const sort = this.sort() as BranchSort;
      const filters = this.filterValues();
      const companyId = filters['companyId'] ?? null;
      const status = filters['status'] ?? null;
      const page = this.page();
      const pageSize = this.pageSize();

      const revision = this.session.scopeRevision();
      if (this.detailRevision && this.detailRevision !== revision) {
        this.detailRevision = null;
        untracked(() => this.branchModal().closeImmediate());
      }
      const criteriaSignature = `${revision}|${search}|${sort}|${companyId ?? ''}|${status ?? ''}`;
      const criteriaChanged = this.prevCriteriaSignature !== null && this.prevCriteriaSignature !== criteriaSignature;
      this.prevCriteriaSignature = criteriaSignature;

      if (criteriaChanged && page !== 1) {
        untracked(() => this.page.set(1));
        return;
      }

      void untracked(() => this.loadList({ search, sort, companyId, status, page, pageSize }));
    });

    effect(() => {
      const params = this.queryParams();
      if (!params) return;

      const companyId = params.get('companyId');
      if (companyId && companyId !== this.appliedCompanyFilterKey) {
        this.appliedCompanyFilterKey = companyId;
        untracked(() => {
          this.filterValues.update((current) => ({ ...current, companyId }));
        });
      }

      const me = this.session.me();
      if (!me) return;

      const openId = params.get('open');
      const isNew = params.get('new') === '1';
      if (!openId && !isNew) return;

      const key = `${openId ?? ''}|${isNew ? '1' : ''}|${companyId ?? ''}`;
      if (key === this.handledDeepLinkKey) return;
      this.handledDeepLinkKey = key;

      untracked(() => {
        if (openId) {
          void this.openBranchById(openId);
          this.clearQueryParams(['open', 'new']);
        } else if (isNew) {
          if (this.canAddBranch()) {
            this.openCreate(companyId ?? this.filterValues()['companyId'] ?? null);
          }
          this.clearQueryParams(['new']);
        }
      });
    });
  }

  protected reload(): void {
    void this.loadLookups();
    const filters = this.filterValues();
    void this.loadList({
      search: this.search().trim(),
      sort: this.sort() as BranchSort,
      companyId: filters['companyId'] ?? null,
      status: filters['status'] ?? null,
      page: this.page(),
      pageSize: this.pageSize(),
    });
  }

  protected canManageBranch(branch: Branch): boolean {
    return this.canAddBranch() &&
      this.session.can('org.branch.manage', { companyId: branch.companyId, branchId: branch.id });
  }

  private canReadBranch(branch: Branch): boolean {
    return this.rows().some((row) => row.id === branch.id);
  }

  private canChangeHeadquarters(branch: Branch): boolean {
    return this.canManageBranch(branch) && this.session.can('org.branch.manage', { companyId: branch.companyId });
  }

  private canChangeLifecycle(branch: Branch): boolean {
    return branch.isHeadquarters ? this.canChangeHeadquarters(branch) : this.canManageBranch(branch);
  }

  protected canAddDepartmentTo(branch: Branch): boolean {
    return this.canAddBranch() &&
      this.session.can('org.department.manage', { companyId: branch.companyId, branchId: branch.id });
  }

  protected companyName(companyId: string): string {
    return this.companyMap().get(companyId)?.name ?? '—';
  }

  protected formatPhone(phone: string | null): string {
    return phone ? normalizePhone(phone) : '';
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

  protected openCreate(presetCompanyId?: string | null): void {
    if (!this.canAddBranch()) return;
    const companyId = presetCompanyId ?? this.filterValues()['companyId'] ?? null;
    if (companyId && !this.session.canCreateBranch(companyId)) return;
    this.modalBranch.set(null);
    this.branchModal().openCreate(companyId);
  }

  protected openEdit(branch: Branch): void {
    if (!this.canReadBranch(branch)) return;
    void this.openBranchById(branch.id);
  }

  protected onModalSaved(event: { branch: Branch; isNew: boolean }): void {
    if (this.branchModal().editingId() === event.branch.id) {
      this.branchModal().syncBranch(event.branch);
    }
    this.reload();
  }

  protected onTransferAddBranch(companyId: string): void {
    this.openCreate(companyId);
  }

  protected onHqTransferred(): void {
    void this.loadLookups();
  }

  protected actionsFor(branch: Branch): ActionItem[] {
    this.i18n();
    const t = (key: string) => this.transloco.translate(key);
    const manage = this.canManageBranch(branch);
    const busy = this.busyIds().has(branch.id);
    const isActive = branch.status === 'ACTIVE';

    const items: ActionItem[] = !this.canReadBranch(branch) ? [] : [
      {
        id: 'open',
        title: t('branches.actions.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
    ];

    if (manage) {
      items.push({
        id: 'edit',
        title: t('branches.actions.edit'),
        icon: 'tablerEdit',
        tile: 'bg-icon-orange',
      });

      if (!branch.isHeadquarters && this.canChangeHeadquarters(branch)) {
        items.push({
          id: 'makeHq',
          title: t('branches.actions.makeHq'),
          icon: 'tablerStar',
          tile: !isActive || busy ? 'bg-icon-gray' : 'bg-icon-blue',
          disabled: !isActive || busy,
          reason: !isActive ? t('branches.actions.inactiveBranchReason') : undefined,
        });
      }
    }

    if (this.canAddDepartmentTo(branch)) {
      items.push({
        id: 'addDepartment',
        title: t('branches.actions.addDepartment'),
        icon: 'tablerPlus',
        tile: isActive ? 'bg-icon-green' : 'bg-icon-gray',
        disabled: !isActive,
        reason: !isActive ? t('branches.actions.inactiveBranchReason') : undefined,
      });
    }

    if (this.session.can('users.user.read', { companyId: branch.companyId, branchId: branch.id })) items.push({
      id: 'viewUsers',
      title: t('branches.actions.viewUsers'),
      icon: 'tablerUsers',
      tile: 'bg-icon-blue',
    });

    if (this.canChangeLifecycle(branch)) {
      items.push(
        {
          id: 'toggleStatus',
          title: t(isActive ? 'branches.actions.deactivate' : 'branches.actions.activate'),
          icon: isActive ? 'tablerCircleOff' : 'tablerCheck',
          tile: busy ? 'bg-icon-gray' : isActive ? 'bg-icon-orange' : 'bg-icon-green',
          disabled: busy,
        },
        {
          id: 'delete',
          title: t('branches.actions.delete'),
          icon: 'tablerTrash',
          tile: 'bg-icon-red',
          danger: true,
          disabled: busy,
        },
      );
    }

    return items;
  }

  protected onAction(branch: Branch, selection: ActionSelection): void {
    switch (selection.id) {
      case 'open':
      case 'edit':
        this.openEdit(branch);
        break;
      case 'makeHq':
        if (this.canChangeHeadquarters(branch) && branch.status === 'ACTIVE' && !branch.isHeadquarters) {
          void this.requestMakeHq(branch);
        }
        break;
      case 'addDepartment':
        if (this.canAddDepartmentTo(branch) && branch.status === 'ACTIVE') {
          void this.router.navigate(['/workspace/staff/departments'], {
            queryParams: { new: 1, branchId: branch.id },
          });
        }
        break;
      case 'viewUsers':
        if (this.session.can('users.user.read', { companyId: branch.companyId, branchId: branch.id })) {
          void this.router.navigate(['/workspace/staff/users'], { queryParams: { branchId: branch.id } });
        }
        break;
      case 'toggleStatus':
        if (this.canChangeLifecycle(branch)) {
          void this.requestToggleStatus(branch);
        }
        break;
      case 'delete':
        if (this.canChangeLifecycle(branch)) {
          void this.requestDelete(branch);
        }
        break;
    }
  }

  protected async requestDelete(branch: Branch): Promise<void> {
    if (!this.canChangeLifecycle(branch) || this.busyIds().has(branch.id)) return;
    this.pendingDeleteBranch.set(branch);
    if (!(await this.deleteConfirm().open())) {
      this.pendingDeleteBranch.set(null);
      return;
    }
    await this.performDelete(branch);
  }

  protected onDeactivateBlocked(event: { branch: Branch; blockers: string[] }): void {
    this.openBranchBlockers(event.branch, event.blockers);
  }

  protected onHqTransferRequired(event: { branch: Branch; action: 'deactivate' | 'delete' }): void {
    void this.openHqTransfer(event.branch, event.action);
  }

  private async requestMakeHq(branch: Branch): Promise<void> {
    if (!this.canChangeHeadquarters(branch) || this.busyIds().has(branch.id)) return;
    const oldHq = this.allBranches().find(
      (b) => b.companyId === branch.companyId && b.isHeadquarters && b.id !== branch.id,
    );
    this.pendingHqBranch.set({
      branch,
      companyName: this.companyName(branch.companyId),
      oldHqName: oldHq?.name ?? '—',
    });

    if (!(await this.hqConfirm().open()) || !this.canChangeHeadquarters(branch)) {
      this.pendingHqBranch.set(null);
      return;
    }

    this.setBusy(branch.id, true);
    try {
      const updated = await updateBranch(branch.id, { isHeadquarters: true }, newIdempotencyKey());
      this.branchModal().syncBranch(updated);
      this.notify.success(this.transloco.translate('branches.toast.saved'));
      this.reload();
    } catch (error) {
      this.notify.error(this.resolveError(error));
    } finally {
      this.setBusy(branch.id, false);
      this.pendingHqBranch.set(null);
    }
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

  private async requestToggleStatus(branch: Branch): Promise<void> {
    if (!this.canChangeLifecycle(branch) || this.busyIds().has(branch.id)) return;
    const nextStatus: OrgStatus = branch.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    this.pendingStatusChange.set({ branch, nextStatus });
    if (!(await this.openStatusConfirm())) {
      this.pendingStatusChange.set(null);
      return;
    }

    if (nextStatus === 'INACTIVE') {
      await this.performDeactivate(branch);
    } else {
      await this.performActivate(branch);
    }
  }

  private async performActivate(branch: Branch): Promise<void> {
    if (!this.canChangeLifecycle(branch)) { this.pendingStatusChange.set(null); return; }
    this.setBusy(branch.id, true);
    try {
      let updated: Branch;
      try {
        updated = await updateBranch(branch.id, { status: 'ACTIVE' }, newIdempotencyKey());
      } catch (error) {
        const cascade = isCascadeRequired(error);
        if (!cascade) throw error;
        const confirmed = await this.cascadeConfirm.confirm(cascade.addons);
        if (!confirmed || !this.canChangeLifecycle(branch)) return;
        updated = await updateBranch(branch.id, { status: 'ACTIVE' }, newIdempotencyKey(), {
          confirmAddonCascade: true,
        });
      }
      this.branchModal().syncBranch(updated);
      this.notify.success(this.transloco.translate('branches.toast.saved'));
      this.reload();
    } catch (error) {
      this.notify.error(this.resolveError(error));
    } finally {
      this.setBusy(branch.id, false);
      this.pendingStatusChange.set(null);
    }
  }

  private async performDeactivate(branch: Branch): Promise<void> {
    if (!this.canChangeLifecycle(branch)) { this.pendingStatusChange.set(null); return; }
    this.setBusy(branch.id, true);
    try {
      let updated: Branch;
      try {
        updated = await updateBranch(branch.id, { status: 'INACTIVE' }, newIdempotencyKey());
      } catch (error) {
        const cascade = isCascadeRequired(error);
        if (!cascade) throw error;
        const confirmed = await this.cascadeConfirm.confirm(cascade.addons);
        if (!confirmed || !this.canChangeLifecycle(branch)) return;
        updated = await updateBranch(branch.id, { status: 'INACTIVE' }, newIdempotencyKey(), {
          confirmAddonCascade: true,
        });
      }
      this.branchModal().syncBranch(updated);
      this.notify.success(this.transloco.translate('branches.toast.saved'));
      this.reload();
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'ORG_HQ_TRANSFER_REQUIRED') {
        await this.openHqTransfer(branch, 'deactivate');
        return;
      }
      if (code === 'ORG_NODE_NOT_EMPTY') {
        this.openBranchBlockers(branch, this.extractBlockers(error));
        return;
      }
      this.notify.error(this.resolveError(error));
    } finally {
      this.setBusy(branch.id, false);
      this.pendingStatusChange.set(null);
    }
  }

  private async performDelete(branch: Branch): Promise<void> {
    if (!this.canChangeLifecycle(branch)) { this.pendingDeleteBranch.set(null); return; }
    this.setBusy(branch.id, true);
    try {
      try {
        await deleteBranch(branch.id, newIdempotencyKey());
      } catch (error) {
        const cascade = isCascadeRequired(error);
        if (!cascade) throw error;
        if (!(await this.cascadeConfirm.confirm(cascade.addons)) || !this.canChangeLifecycle(branch)) return;
        await deleteBranch(branch.id, newIdempotencyKey(), { confirmAddonCascade: true });
      }
      if (this.branchModal().editingId() === branch.id) {
        this.branchModal().closeImmediate();
      }
      this.notify.success(this.transloco.translate('branches.toast.deleted'));
      this.reload();
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'ORG_HQ_TRANSFER_REQUIRED') {
        await this.openHqTransfer(branch, 'delete');
        return;
      }
      if (code === 'ORG_NODE_NOT_EMPTY') {
        this.openBranchBlockers(branch, this.extractBlockers(error));
        return;
      }
      this.notify.error(this.resolveError(error));
    } finally {
      this.setBusy(branch.id, false);
      this.pendingDeleteBranch.set(null);
    }
  }

  private async openHqTransfer(branch: Branch, action: 'deactivate' | 'delete'): Promise<void> {
    if (!this.canChangeHeadquarters(branch)) return;
    let candidates: Branch[];
    try {
      const list = await listAllPages(
        (query) => this.organization.listBranches(query),
        { companyId: branch.companyId, status: 'ACTIVE', limit: 100 },
      );
      candidates = list.filter((b) => b.id !== branch.id && b.status === 'ACTIVE');
    } catch {
      candidates = this.allBranches().filter(
        (b) => b.companyId === branch.companyId && b.id !== branch.id && b.status === 'ACTIVE',
      );
    }

    if (!this.canChangeHeadquarters(branch)) return;
    this.hqTransferModal().open({
      branch,
      companyName: this.companyName(branch.companyId),
      candidateBranches: candidates.filter((candidate) =>
        candidate.companyId === branch.companyId && this.canChangeHeadquarters(candidate),
      ),
      retryAction: () => (action === 'delete' ? this.performDelete(branch) : this.performDeactivate(branch)),
    });
  }

  private openBranchBlockers(branch: Branch, blockers: string[]): void {
    const t = (key: string) => this.transloco.translate(key);
    const departmentsLink: BlockerLink = {
      label: t('branches.blockers.viewDepartments'),
      route: ['/workspace/staff/departments'],
      queryParams: { branchId: branch.id },
    };
    const usersLink: BlockerLink = {
      label: t('branches.blockers.viewUsers'),
      route: ['/workspace/staff/users'],
      queryParams: { branchId: branch.id },
    };

    const hasDeactivateSuggestion = blockers.some((phrase) => {
      const normalized = phrase.toLowerCase();
      return (
        normalized === 'branch has references; deactivate the branch instead' ||
        normalized === 'branch reference checks are unavailable; deactivate the branch instead' ||
        normalized.includes('deactivate instead') ||
        normalized.includes('references')
      );
    });

    void this.blockersDialog().open({
      title: branch.name,
      blockers,
      links: {
        'branch has departments': departmentsLink,
        'branch has active departments': departmentsLink,
        'branch has placed users': usersLink,
        'branch has team memberships': usersLink,
      },
      primaryAction:
        hasDeactivateSuggestion && branch.status === 'ACTIVE' && this.canChangeLifecycle(branch)
          ? {
              label: t('branches.blockers.deactivateInstead'),
              run: () => this.performDeactivate(branch),
            }
          : undefined,
    });
  }

  private async openBranchById(id: string): Promise<void> {
    const seq = ++this.detailSeq;
    const revision = this.session.scopeRevision();
    try {
      const branch = await this.organization.getBranch(id);
      if (!this.destroyRef.destroyed && seq === this.detailSeq && revision === this.session.scopeRevision()) {
        this.detailRevision = revision;
        this.modalBranch.set(branch);
        this.branchModal().openEdit(branch);
      }
    } catch (error) {
      if (!this.destroyRef.destroyed && seq === this.detailSeq && revision === this.session.scopeRevision()) {
        this.notify.error(this.resolveError(error));
      }
    }
  }

  private async loadLookups(): Promise<void> {
    const revision = this.session.scopeRevision();
    const [companiesRes, countriesRes] = await Promise.allSettled([
      this.session.can('org.company.read')
        ? listAllPages((query) => this.organization.listCompanies(query), { limit: 100 })
        : Promise.resolve([]),
      listCountries(),
    ]);
    if (revision !== this.session.scopeRevision()) return;
    this.companyLookup.set({ revision, rows: companiesRes.status === 'fulfilled' ? companiesRes.value : [] });
    if (countriesRes.status === 'fulfilled') {
      this.countries.set(countriesRes.value);
    }
  }

  private async loadList(params: {
    search: string;
    sort: BranchSort;
    companyId: string | null;
    status: string | null;
    page: number;
    pageSize: number;
  }): Promise<void> {
    const seq = ++this.loadSeq;
    const revision = this.session.scopeRevision();
    this.loading.set(true);
    this.loadFailed.set(false);
    this.loadForbidden.set(false);

    const query: ListQuery = {
      page: params.page,
      limit: params.pageSize,
      sortBy: params.sort,
      sortDir: params.sort === 'createdAt' ? 'DESC' : 'ASC',
    };
    if (params.search) query.search = params.search;
    if (params.companyId) query.companyId = params.companyId;
    if (params.status) query.status = params.status;

    try {
      const result = await this.organization.listBranches(query);
      if (seq !== this.loadSeq || revision !== this.session.scopeRevision()) return;
      this.loadedRows.set(result.data);
      this.loadedTotal.set({ revision, count: result.meta.total });
    } catch (error) {
      if (seq !== this.loadSeq || revision !== this.session.scopeRevision()) return;
      this.loadFailed.set(true);
      this.loadForbidden.set(error instanceof ApiError && error.status === 403);
      this.loadedRows.set([]);
      this.loadedTotal.set(null);
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

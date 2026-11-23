import { Component, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerCloudOff,
  tablerEye,
  tablerPlus,
  tablerSitemap,
  tablerUsers,
  tablerCheck,
  tablerCircleOff,
  tablerEdit,
  tablerTrash,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { ConflictDialog } from '../../../../shared/ui/conflict-dialog/conflict-dialog';
import { BlockersDialog } from '../shared/blockers-dialog/blockers-dialog';
import { StaffList } from '../shared/staff-list/staff-list';
import { StaffSession } from '../shared/staff-session';
import { StatusBadge } from '../shared/status-badge/status-badge';
import { ApiError, errorCodeOf } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { OrganizationReadApi } from '../shared/organization-read.api';
import { staffErrorMessage, listAllPages } from '../shared/staff.api';
import { OrganizationWriteApi } from '../shared/organization-write.api';
import {
  Branch,
  Company,
  Department,
  ListQuery,
  OrgStatus,
  StaffListFilter,
  StaffListSortOption,
} from '../shared/staff.model';
import { DepartmentModal } from './department-modal/department-modal';

type DepartmentSort = 'name' | 'code' | 'createdAt';

const SKELETON_ROWS = [1, 2, 3, 4, 5] as const;
const TABLE_COLUMNS = 'grid-cols-staff-department-row-actions';

@Component({
  selector: 'app-departments-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    ActionsMenu,
    Button,
    ConfirmDialog,
    ConflictDialog,
    BlockersDialog,
    DepartmentModal,
    StaffList,
    StatusBadge,
  ],
  providers: [
    provideTranslocoScope(
      'settings',
      { scope: 'staff', alias: 'staff' },
      { scope: 'staff-departments', alias: 'departments' },
    ),
    provideIcons({
      tablerSitemap,
      tablerCloudOff,
      tablerEye,
      tablerPlus,
      tablerUsers,
      tablerCheck,
      tablerCircleOff,
      tablerEdit,
      tablerTrash,
    }),
  ],
  templateUrl: './departments-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col' },
})
export class DepartmentsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly session = inject(StaffSession);
  private readonly organization = inject(OrganizationReadApi);
  private readonly writeApi = inject(OrganizationWriteApi);
  private readonly queryParams = toSignal(this.route.queryParamMap);

  private readonly departmentModal = viewChild.required(DepartmentModal);
  private readonly statusDialog = viewChild.required<ConfirmDialog>('statusDialog');
  private readonly deleteConfirm = viewChild.required<ConfirmDialog>('deleteConfirm');
  private readonly blockersDialog = viewChild.required(BlockersDialog);
  protected readonly openedDepartment = signal<Department | null>(null);
  protected readonly modalCanManage = computed(() => {
    const department = this.openedDepartment();
    return department !== null && this.canManageDepartment(department);
  });
  protected readonly busyIds = signal<ReadonlySet<string>>(new Set());
  protected readonly pendingStatusChange = signal<{ department: Department; nextStatus: OrgStatus } | null>(null);
  protected readonly pendingDeleteDepartment = signal<Department | null>(null);
  protected readonly conflictDepartment = signal<Department | null>(null);
  protected readonly conflictOpen = signal(false);
  private readonly actionKeys = new Map<string, string>();
  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly tableColumns = TABLE_COLUMNS;

  protected readonly search = signal('');
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly sort = signal<string>('name');
  protected readonly filterValues = signal<Record<string, string | null>>({});

  private readonly result = signal<{ revision: string; rows: Department[]; total: number } | null>(null);
  private readonly currentResult = computed(() => {
    const result = this.result();
    return result?.revision === this.session.scopeRevision() ? result : null;
  });
  protected readonly rows = computed(() => this.currentResult()?.rows ?? []);
  protected readonly total = computed(() => this.currentResult()?.total ?? 0);
  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly loadForbidden = signal(false);
  private readonly lookupsReady = signal(false);
  protected readonly companies = signal<Company[]>([]);
  protected readonly branches = signal<Branch[]>([]);
  protected readonly teamCounts = signal<Record<string, number>>({});

  private readonly companyMap = computed(() => new Map(this.companies().map((c) => [c.id, c])));
  private readonly branchMap = computed(() => new Map(this.branches().map((b) => [b.id, b])));

  protected readonly createBranches = computed(() => this.branches().filter((branch) =>
    branch.status === 'ACTIVE' && this.companyMap().has(branch.companyId) &&
    this.session.can('org.department.manage', { companyId: branch.companyId, branchId: branch.id }),
  ));
  protected readonly canAddDepartment = computed(() => this.createBranches().length > 0);

  protected readonly hasActiveFiltersOrSearch = computed(
    () =>
      Boolean(this.search().trim()) ||
      Boolean(this.filterValues()['companyId']) ||
      Boolean(this.filterValues()['branchId']) ||
      Boolean(this.filterValues()['status']),
  );

  protected readonly filters = computed<StaffListFilter[]>(() => {
    this.i18n();
    const vals = this.filterValues();
    const companyId = vals['companyId'] ?? null;
    const branchOptions = this.branches()
      .filter((branch) => !companyId || branch.companyId === companyId)
      .map((branch) => ({ value: branch.id, label: branch.name }));

    return [
      {
        id: 'companyId',
        label: this.transloco.translate('departments.filters.company'),
        options: this.companies().map((company) => ({ value: company.id, label: company.name })),
        value: companyId,
      },
      {
        id: 'branchId',
        label: this.transloco.translate('departments.filters.branch'),
        options: branchOptions,
        value: vals['branchId'] ?? null,
      },
      {
        id: 'status',
        label: this.transloco.translate('departments.filters.status'),
        options: [
          { value: 'ACTIVE', label: this.transloco.translate('departments.filters.active') },
          { value: 'INACTIVE', label: this.transloco.translate('departments.filters.inactive') },
        ],
        value: vals['status'] ?? null,
      },
    ];
  });

  protected readonly sortOptions = computed<StaffListSortOption[]>(() => {
    this.i18n();
    return [
      { value: 'name', label: this.transloco.translate('departments.sort.name') },
      { value: 'code', label: this.transloco.translate('departments.sort.code') },
      { value: 'createdAt', label: this.transloco.translate('departments.sort.newest') },
    ];
  });

  private loadSeq = 0;
  private lookupSeq = 0;
  private detailSeq = 0;
  private countsSeq = 0;
  private prevCompanyFilter: string | null = null;
  private prevCriteriaSignature: string | null = null;
  private handledDeepLinkKey = '';
  private appliedUrlFilterKey = '';

  constructor() {
    if (!this.session.me()) {
      void this.session.load();
    }
    effect(() => {
      this.session.scopeRevision();
      untracked(() => {
        this.lookupsReady.set(false);
        this.companies.set([]);
        this.branches.set([]);
        void this.loadLookups();
      });
    });

    const initialParams = this.route.snapshot.queryParamMap;
    const initialCompany = initialParams.get('companyId');
    const initialBranch = initialParams.get('branchId');
    if (initialCompany || initialBranch) {
      this.appliedUrlFilterKey = `${initialCompany ?? ''}|${initialBranch ?? ''}`;
      this.prevCompanyFilter = initialCompany;
      this.filterValues.set({
        ...(initialCompany ? { companyId: initialCompany } : {}),
        ...(initialBranch ? { branchId: initialBranch } : {}),
      });
    }

    effect(() => {
      const filters = this.filterValues();
      const companyId = filters['companyId'] ?? null;
      const branchId = filters['branchId'] ?? null;
      const prevCompany = this.prevCompanyFilter;
      this.prevCompanyFilter = companyId;

      if (prevCompany !== companyId && branchId) {
        const branch = untracked(() => this.branchMap().get(branchId));
        if (!branch || (companyId && branch.companyId !== companyId)) {
          untracked(() => {
            this.filterValues.update((current) => ({ ...current, branchId: null }));
          });
          return;
        }
      }

      const search = this.search().trim();
      const sort = this.sort() as DepartmentSort;
      const status = filters['status'] ?? null;
      const page = this.page();
      const pageSize = this.pageSize();

      const criteriaSignature = `${this.session.scopeRevision()}|${search}|${sort}|${companyId ?? ''}|${branchId ?? ''}|${status ?? ''}`;
      const criteriaChanged = this.prevCriteriaSignature !== null && this.prevCriteriaSignature !== criteriaSignature;
      this.prevCriteriaSignature = criteriaSignature;

      if (criteriaChanged && page !== 1) {
        untracked(() => this.page.set(1));
        return;
      }

      void untracked(() => this.loadList({ search, sort, companyId, branchId, status, page, pageSize }));
    });

    effect(() => {
      const params = this.queryParams();
      if (!params) return;

      const companyId = params.get('companyId');
      const branchId = params.get('branchId');
      const urlFilterKey = `${companyId ?? ''}|${branchId ?? ''}`;
      if ((companyId || branchId) && urlFilterKey !== this.appliedUrlFilterKey) {
        this.appliedUrlFilterKey = urlFilterKey;
        untracked(() => {
          const resolvedCompanyId =
            companyId ?? (branchId ? (this.branchMap().get(branchId)?.companyId ?? null) : null);
          if (resolvedCompanyId) {
            this.prevCompanyFilter = resolvedCompanyId;
          }
          this.filterValues.update((current) => ({
            ...current,
            ...(resolvedCompanyId ? { companyId: resolvedCompanyId } : {}),
            ...(branchId ? { branchId } : {}),
          }));
        });
      }

      const me = this.session.me();
      if (!me) return;

      const openId = params.get('open');
      const isNew = params.get('new') === '1';
      if ((!openId && !isNew) || (isNew && !openId && !this.lookupsReady())) return;

      const key = `${openId ?? ''}|${isNew ? '1' : ''}|${companyId ?? ''}|${branchId ?? ''}`;
      if (key === this.handledDeepLinkKey) return;
      this.handledDeepLinkKey = key;

      untracked(() => {
        if (openId) {
          void this.openDepartmentById(openId);
          this.clearQueryParams(['open', 'new']);
        } else if (isNew) {
          if (this.canAddDepartment()) {
            const targetBranchId = branchId ?? this.filterValues()['branchId'] ?? null;
            const targetCompanyId =
              companyId ??
              (targetBranchId ? this.branchMap().get(targetBranchId)?.companyId : null) ??
              this.filterValues()['companyId'] ??
              null;
            this.openCreate({ companyId: targetCompanyId, branchId: targetBranchId });
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
      sort: this.sort() as DepartmentSort,
      companyId: filters['companyId'] ?? null,
      branchId: filters['branchId'] ?? null,
      status: filters['status'] ?? null,
      page: this.page(),
      pageSize: this.pageSize(),
    });
  }

  protected canAddTeamTo(department: Department): boolean {
    const target = { branchId: department.branchId };
    return this.session.can('org.team.read', target) && this.session.can('org.team.manage', target);
  }

  protected canManageDepartment(department: Department): boolean {
    return this.session.can('org.department.manage', {
      companyId: this.branchMap().get(department.branchId)?.companyId,
      branchId: department.branchId,
    });
  }

  protected branchName(branchId: string): string {
    return this.branchMap().get(branchId)?.name ?? '—';
  }

  protected companyNameForBranch(branchId: string): string {
    const companyId = this.branchMap().get(branchId)?.companyId;
    return companyId ? (this.companyMap().get(companyId)?.name ?? '') : '';
  }

  protected teamCountText(departmentId: string): string {
    const department = this.rows().find(({ id }) => id === departmentId);
    if (!department || !this.session.can('org.team.read', { branchId: department.branchId })) return '—';
    const count = this.teamCounts()[departmentId];
    return typeof count === 'number' ? String(count) : '—';
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

  protected openCreate(preset?: { companyId?: string | null; branchId?: string | null }): void {
    if (!this.canAddDepartment()) return;
    const filters = this.filterValues();
    const companyId = preset?.companyId ?? filters['companyId'];
    const branchId = preset?.branchId ?? filters['branchId'];
    const matching = this.createBranches().filter((branch) =>
      (!companyId || branch.companyId === companyId) && (!branchId || branch.id === branchId),
    );
    if (preset && matching.length === 0) return;

    const branch = matching.length === 1 ? matching[0] : null;
    this.detailSeq++;
    this.openedDepartment.set(null);
    this.departmentModal().openCreate({
      companyId: branch?.companyId ?? (matching.length ? companyId : null),
      branchId: branch?.id,
    });
  }

  protected openEdit(department: Department): void {
    void this.openDepartmentById(department.id);
  }

  protected onModalSaved(): void {
    this.reload();
  }

  protected actionsFor(department: Department): ActionItem[] {
    this.i18n();
    const t = (key: string) => this.transloco.translate(key);
    const items: ActionItem[] = [{
      id: 'open',
      title: t('departments.actions.open'),
      icon: 'tablerEye',
      tile: 'bg-icon-blue',
    }];

    const manage = this.canManageDepartment(department);
    const busy = this.busyIds().has(department.id);
    if (manage) items.push({ id: 'edit', title: t('departments.actions.edit'), icon: 'tablerEdit', tile: 'bg-icon-orange' });

    if (this.canAddTeamTo(department)) {
      const inactive = department.status !== 'ACTIVE';
      items.push({
        id: 'addTeam',
        title: t('departments.actions.addTeam'),
        icon: 'tablerPlus',
        tile: inactive ? 'bg-icon-gray' : 'bg-icon-green',
        disabled: inactive,
        reason: inactive ? t('departments.actions.addTeamInactiveReason') : undefined,
      });
    }
    if (this.session.can('users.user.read', { branchId: department.branchId })) {
      items.push({ id: 'viewUsers', title: t('departments.actions.viewUsers'), icon: 'tablerUsers', tile: 'bg-icon-blue' });
    }
    if (manage) {
      const active = department.status === 'ACTIVE';
      items.push(
        { id: 'toggleStatus', title: t(active ? 'departments.actions.deactivate' : 'departments.actions.activate'),
          icon: active ? 'tablerCircleOff' : 'tablerCheck', tile: busy ? 'bg-icon-gray' : active ? 'bg-icon-orange' : 'bg-icon-green', disabled: busy },
        { id: 'delete', title: t('departments.actions.delete'), icon: 'tablerTrash', tile: 'bg-icon-red', danger: true, disabled: busy },
      );
    }
    return items;
  }

  protected onAction(department: Department, selection: ActionSelection): void {
    switch (selection.id) {
      case 'open':
      case 'edit':
        this.openEdit(department);
        break;
      case 'addTeam':
        if (this.canAddTeamTo(department) && department.status === 'ACTIVE') {
          void this.router.navigate(['/workspace/staff/teams'], {
            queryParams: { new: 1, departmentId: department.id },
          });
        }
        break;
      case 'viewUsers':
        if (this.session.can('users.user.read', { branchId: department.branchId })) {
          void this.router.navigate(['/workspace/staff/users'], { queryParams: { departmentId: department.id } });
        }
        break;
      case 'toggleStatus':
        void this.requestToggleStatus(department);
        break;
      case 'delete':
        void this.requestDelete(department);
        break;
    }
  }

  protected async requestToggleStatus(department: Department): Promise<void> {
    if (!this.canManageDepartment(department) || this.busyIds().has(department.id) || this.pendingStatusChange()) return;
    const nextStatus: OrgStatus = department.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    this.pendingStatusChange.set({ department, nextStatus });
    try {
      if (!(await this.statusDialog().open()) || !this.canManageDepartment(department)) return;
      this.setBusy(department.id, true);
      const action = `${nextStatus}:${department.id}`;
      const updated = await this.writeApi.updateDepartment(department.id, { status: nextStatus }, this.keyFor(action));
      this.actionKeys.delete(action);
      this.departmentModal().syncDepartment(updated);
      if (this.openedDepartment()?.id === updated.id) this.openedDepartment.set(updated);
      this.notify.success(this.transloco.translate(nextStatus === 'ACTIVE' ? 'departments.toast.activated' : 'departments.toast.deactivated'));
      this.reload();
    } catch (error) {
      this.handleWriteError(error, department);
    } finally {
      this.setBusy(department.id, false);
      this.pendingStatusChange.set(null);
    }
  }

  protected async requestDelete(department: Department): Promise<void> {
    if (!this.canManageDepartment(department) || this.busyIds().has(department.id) || this.pendingDeleteDepartment()) return;
    this.pendingDeleteDepartment.set(department);
    try {
      if (!(await this.deleteConfirm().open()) || !this.canManageDepartment(department)) return;
      this.setBusy(department.id, true);
      const action = `delete:${department.id}`;
      await this.writeApi.deleteDepartment(department.id, this.keyFor(action));
      this.actionKeys.delete(action);
      if (this.departmentModal().editingId() === department.id) this.departmentModal().closeImmediate();
      this.notify.success(this.transloco.translate('departments.toast.deleted'));
      this.reload();
    } catch (error) {
      this.handleWriteError(error, department);
    } finally {
      this.setBusy(department.id, false);
      this.pendingDeleteDepartment.set(null);
    }
  }

  protected onDeactivateBlocked(event: { department: Department; blockers: string[] }): void {
    this.openDepartmentBlockers(event.department, event.blockers);
  }

  private openDepartmentBlockers(department: Department, blockers: string[]): void {
    const teamsLink = { label: this.transloco.translate('departments.blockers.viewTeams'), route: ['/workspace/staff/teams'], queryParams: { departmentId: department.id } };
    const usersLink = { label: this.transloco.translate('departments.blockers.viewUsers'), route: ['/workspace/staff/users'], queryParams: { departmentId: department.id } };
    void this.blockersDialog().open({ title: department.name, blockers, links: {
      'department has teams': teamsLink,
      'department has active teams': teamsLink,
      'department has placed users': usersLink,
      'department has team memberships': usersLink,
    } });
  }

  private handleWriteError(error: unknown, department: Department): void {
    const code = errorCodeOf(error);
    if (code === 'ORG_NODE_NOT_EMPTY') {
      const blockers = error instanceof ApiError ? error.details?.['blockers'] : undefined;
      this.openDepartmentBlockers(department, Array.isArray(blockers) ? blockers.filter((v): v is string => typeof v === 'string') : []);
      return;
    }
    if (code === 'ORG_NODE_SCOPE_STALE' || code === 'ORG_BRANCH_SCOPE_STALE') {
      this.conflictDepartment.set(department);
      this.conflictOpen.set(true);
      return;
    }
    const message = code === 'ORG_PARENT_INACTIVE'
      ? this.transloco.translate('departments.parentInactive')
      : staffErrorMessage(error, 'staff', this.transloco, 'write');
    if (code === 'GW.IDEM.IN_FLIGHT') this.notify.info(message);
    else if (code === 'GW.IDEM.MISMATCH') this.notify.warning(message);
    else this.notify.error(message);
    if (error instanceof ApiError && error.status === 404) {
      if (this.departmentModal().editingId() === department.id) this.departmentModal().closeImmediate();
      this.reload();
    }
  }

  protected async resolveActionConflict(keepChanges: boolean): Promise<void> {
    this.conflictOpen.set(false);
    const department = this.conflictDepartment();
    if (!department) return;
    try {
      const fresh = await this.organization.getDepartment(department.id);
      this.departmentModal().syncDepartment(fresh);
      for (const action of ['ACTIVE', 'INACTIVE', 'delete']) this.actionKeys.delete(`${action}:${department.id}`);
      this.reload();
      if (keepChanges) this.openedDepartment.set(fresh);
    } catch (error) {
      this.notify.error(staffErrorMessage(error, 'staff', this.transloco));
      if (this.departmentModal().editingId() === department.id) this.departmentModal().closeImmediate();
      this.reload();
    }
  }

  private keyFor(action: string): string {
    let key = this.actionKeys.get(action);
    if (!key) {
      key = newIdempotencyKey();
      this.actionKeys.set(action, key);
    }
    return key;
  }

  private setBusy(id: string, busy: boolean): void {
    this.busyIds.update((current) => {
      const next = new Set(current);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  private async openDepartmentById(id: string): Promise<void> {
    const seq = ++this.detailSeq;
    const revision = this.session.scopeRevision();
    try {
      const department = await this.organization.getDepartment(id);
      if (seq !== this.detailSeq || revision !== this.session.scopeRevision()) return;
      this.openedDepartment.set(department);
      this.departmentModal().openEdit(department, this.branchMap().get(department.branchId)?.companyId);
    } catch (error) {
      if (seq === this.detailSeq && revision === this.session.scopeRevision()) this.notify.error(staffErrorMessage(error, 'staff', this.transloco));
    }
  }

  private async loadLookups(): Promise<void> {
    const seq = ++this.lookupSeq;
    const revision = this.session.scopeRevision();
    if (!revision) return;
    const [companiesRes, branchesRes] = await Promise.allSettled([
      listAllPages((query) => this.organization.listCompanies(query), { limit: 100 }),
      listAllPages((query) => this.organization.listBranches(query), { limit: 100 }),
    ]);
    if (seq !== this.lookupSeq || revision !== this.session.scopeRevision()) return;
    this.lookupsReady.set(true);
    if (companiesRes.status === 'fulfilled') {
      this.companies.set(companiesRes.value);
    }
    if (branchesRes.status === 'fulfilled') {
      this.branches.set(branchesRes.value);
      const branchFilter = this.filterValues()['branchId'];
      if (branchFilter && !this.filterValues()['companyId']) {
        const branch = branchesRes.value.find((b) => b.id === branchFilter);
        if (branch) {
          this.prevCompanyFilter = branch.companyId;
          this.filterValues.update((current) => ({ ...current, companyId: branch.companyId }));
        }
      }
    }
  }

  private async loadList(params: {
    search: string;
    sort: DepartmentSort;
    companyId: string | null;
    branchId: string | null;
    status: string | null;
    page: number;
    pageSize: number;
  }): Promise<void> {
    const seq = ++this.loadSeq;
    const revision = this.session.scopeRevision();
    if (!revision) return;
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
    if (params.branchId) query.branchId = params.branchId;
    if (params.status) query.status = params.status;

    try {
      const result = await this.organization.listDepartments(query);
      if (seq !== this.loadSeq || revision !== this.session.scopeRevision()) return;
      this.result.set({ revision, rows: result.data, total: result.meta.total });
      void this.loadTeamCounts(result.data);
    } catch (error) {
      if (seq !== this.loadSeq || revision !== this.session.scopeRevision()) return;
      this.loadFailed.set(true);
      this.loadForbidden.set(error instanceof ApiError && error.status === 403);
      this.result.set(null);
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private async loadTeamCounts(items: Department[]): Promise<void> {
    const seq = ++this.countsSeq;
    const revision = this.session.scopeRevision();
    this.teamCounts.set({});
    const results = await Promise.allSettled(
      items.map(async (dept) => {
        if (!this.session.can('org.team.read', { branchId: dept.branchId })) return null;
        const page = await this.organization.listTeams({ departmentId: dept.id, limit: 1 });
        return [dept.id, page.meta.total] as const;
      }),
    );
    if (seq !== this.countsSeq || revision !== this.session.scopeRevision()) return;
    const next: Record<string, number> = {};
    for (const res of results) {
      if (res.status === 'fulfilled' && res.value) {
        next[res.value[0]] = res.value[1];
      }
    }
    this.teamCounts.set(next);
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

}

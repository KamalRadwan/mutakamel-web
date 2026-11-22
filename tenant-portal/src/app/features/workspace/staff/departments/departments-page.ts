import { Component, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerCheck,
  tablerCircleOff,
  tablerCloudOff,
  tablerEdit,
  tablerEye,
  tablerPlus,
  tablerSitemap,
  tablerTrash,
  tablerUsers,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { BlockersDialog } from '../shared/blockers-dialog/blockers-dialog';
import { StaffList } from '../shared/staff-list/staff-list';
import { StaffSession } from '../shared/staff-session';
import { StatusBadge } from '../shared/status-badge/status-badge';
import {
  ApiError,
  deleteDepartment,
  errorCodeOf,
  errorMessage,
  getBranch,
  getDepartment,
  listAllPages,
  listBranches,
  listCompanies,
  listDepartments,
  listTeams,
  newIdempotencyKey,
  updateDepartment,
} from '../shared/staff.api';
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
    BlockersDialog,
    Button,
    ConfirmDialog,
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
      tablerEdit,
      tablerPlus,
      tablerUsers,
      tablerCheck,
      tablerCircleOff,
      tablerTrash,
    }),
  ],
  templateUrl: './departments-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class DepartmentsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly session = inject(StaffSession);
  private readonly queryParams = toSignal(this.route.queryParamMap);

  private readonly departmentModal = viewChild.required(DepartmentModal);
  private readonly deleteConfirm = viewChild.required<ConfirmDialog>('deleteConfirm');
  private readonly blockersDialog = viewChild.required(BlockersDialog);

  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly tableColumns = TABLE_COLUMNS;

  protected readonly search = signal('');
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly sort = signal<string>('name');
  protected readonly filterValues = signal<Record<string, string | null>>({});

  protected readonly rows = signal<Department[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly companies = signal<Company[]>([]);
  protected readonly branches = signal<Branch[]>([]);
  protected readonly teamCounts = signal<Record<string, number>>({});
  protected readonly busyIds = signal<ReadonlySet<string>>(new Set());

  protected readonly modalDepartment = signal<Department | null>(null);
  protected readonly pendingDeleteDepartment = signal<Department | null>(null);

  private readonly companyMap = computed(() => new Map(this.companies().map((c) => [c.id, c])));
  private readonly branchMap = computed(() => new Map(this.branches().map((b) => [b.id, b])));

  protected readonly canAddDepartment = computed(
    () =>
      this.session.isTenantWide('org.department.manage') ||
      this.session.can('org.department.manage') ||
      this.branches().some((b) =>
        this.session.can('org.department.manage', { companyId: b.companyId, branchId: b.id }),
      ),
  );

  protected readonly modalCanManage = computed(() => {
    const editing = this.modalDepartment();
    if (editing) {
      return this.canManageDepartment(editing);
    }
    return this.canAddDepartment();
  });

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
  private countsSeq = 0;
  private prevCompanyFilter: string | null = null;
  private prevCriteriaSignature: string | null = null;
  private handledDeepLinkKey = '';
  private appliedUrlFilterKey = '';

  constructor() {
    if (!this.session.me()) {
      void this.session.load();
    }
    void this.loadLookups();

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

      const criteriaSignature = `${search}|${sort}|${companyId ?? ''}|${branchId ?? ''}|${status ?? ''}`;
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
      if (!openId && !isNew) return;

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

  protected canManageDepartment(department: Department): boolean {
    const companyId = this.branchMap().get(department.branchId)?.companyId ?? null;
    return this.session.can('org.department.manage', { companyId, branchId: department.branchId });
  }

  protected canAddTeamTo(department: Department): boolean {
    const companyId = this.branchMap().get(department.branchId)?.companyId ?? null;
    return this.session.can('org.team.manage', { companyId, branchId: department.branchId });
  }

  protected branchName(branchId: string): string {
    return this.branchMap().get(branchId)?.name ?? '—';
  }

  protected companyNameForBranch(branchId: string): string {
    const companyId = this.branchMap().get(branchId)?.companyId;
    return companyId ? (this.companyMap().get(companyId)?.name ?? '') : '';
  }

  protected teamCountText(departmentId: string): string {
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
    this.modalDepartment.set(null);
    const branchId = preset?.branchId ?? this.filterValues()['branchId'] ?? null;
    const companyId =
      preset?.companyId ??
      (branchId ? this.branchMap().get(branchId)?.companyId : undefined) ??
      this.filterValues()['companyId'] ??
      null;
    this.departmentModal().openCreate({ companyId, branchId });
  }

  protected openEdit(department: Department): void {
    this.modalDepartment.set(department);
    const companyId = this.branchMap().get(department.branchId)?.companyId ?? null;
    this.departmentModal().openEdit(department, companyId);
  }

  protected onModalSaved(event: { department: Department; isNew: boolean }): void {
    const companyId = this.branchMap().get(event.department.branchId)?.companyId ?? null;
    if (this.departmentModal().editingId() === event.department.id) {
      this.departmentModal().syncDepartment(event.department, companyId);
    }
    this.reload();
  }

  protected actionsFor(department: Department): ActionItem[] {
    this.i18n();
    const t = (key: string) => this.transloco.translate(key);
    const manage = this.canManageDepartment(department);
    const busy = this.busyIds().has(department.id);
    const isActive = department.status === 'ACTIVE';

    const items: ActionItem[] = [
      {
        id: 'open',
        title: t('departments.actions.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
    ];

    if (manage) {
      items.push({
        id: 'edit',
        title: t('departments.actions.edit'),
        icon: 'tablerEdit',
        tile: 'bg-icon-orange',
      });
    }

    if (this.canAddTeamTo(department)) {
      items.push({
        id: 'addTeam',
        title: t('departments.actions.addTeam'),
        icon: 'tablerPlus',
        tile: isActive ? 'bg-icon-green' : 'bg-icon-gray',
        disabled: !isActive,
        reason: !isActive ? t('departments.actions.addTeamInactiveReason') : undefined,
      });
    }

    items.push({
      id: 'viewUsers',
      title: t('departments.actions.viewUsers'),
      icon: 'tablerUsers',
      tile: 'bg-icon-blue',
    });

    if (manage) {
      items.push(
        {
          id: 'toggleStatus',
          title: t(isActive ? 'departments.actions.deactivate' : 'departments.actions.activate'),
          icon: isActive ? 'tablerCircleOff' : 'tablerCheck',
          tile: busy ? 'bg-icon-gray' : isActive ? 'bg-icon-orange' : 'bg-icon-green',
          disabled: busy,
        },
        {
          id: 'delete',
          title: t('departments.actions.delete'),
          icon: 'tablerTrash',
          tile: 'bg-icon-red',
          danger: true,
          disabled: busy,
        },
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
        void this.router.navigate(['/workspace/staff/users'], {
          queryParams: { departmentId: department.id },
        });
        break;
      case 'toggleStatus':
        if (this.canManageDepartment(department)) {
          void this.toggleStatus(department);
        }
        break;
      case 'delete':
        if (this.canManageDepartment(department)) {
          void this.requestDelete(department);
        }
        break;
    }
  }

  protected async requestDelete(department: Department): Promise<void> {
    if (!this.canManageDepartment(department) || this.busyIds().has(department.id)) return;
    this.pendingDeleteDepartment.set(department);
    if (!(await this.deleteConfirm().open())) {
      this.pendingDeleteDepartment.set(null);
      return;
    }

    this.setBusy(department.id, true);
    try {
      await deleteDepartment(department.id, newIdempotencyKey());
      if (this.departmentModal().editingId() === department.id) {
        this.departmentModal().closeImmediate();
      }
      this.notify.success(this.transloco.translate('departments.toast.deleted'));
      this.reload();
    } catch (error) {
      if (errorCodeOf(error) === 'ORG_NODE_NOT_EMPTY') {
        this.openDepartmentBlockers(department, this.extractBlockers(error));
        return;
      }
      this.notify.error(this.resolveError(error));
      if (errorCodeOf(error) === 'ORG_NODE_NOT_FOUND' || (error instanceof ApiError && error.status === 404)) {
        if (this.departmentModal().editingId() === department.id) {
          this.departmentModal().closeImmediate();
        }
        this.reload();
      }
    } finally {
      this.setBusy(department.id, false);
      this.pendingDeleteDepartment.set(null);
    }
  }

  protected onDeactivateBlocked(event: { department: Department; blockers: string[] }): void {
    this.openDepartmentBlockers(event.department, event.blockers);
  }

  private async toggleStatus(department: Department): Promise<void> {
    if (this.busyIds().has(department.id)) return;
    const nextStatus: OrgStatus = department.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    this.setBusy(department.id, true);
    try {
      const updated = await updateDepartment(department.id, { status: nextStatus }, newIdempotencyKey());
      const companyId = this.branchMap().get(updated.branchId)?.companyId ?? null;
      this.departmentModal().syncDepartment(updated, companyId);
      this.notify.success(
        this.transloco.translate(nextStatus === 'ACTIVE' ? 'departments.toast.activated' : 'departments.toast.deactivated'),
      );
      this.reload();
    } catch (error) {
      if (errorCodeOf(error) === 'ORG_NODE_NOT_EMPTY') {
        this.openDepartmentBlockers(department, this.extractBlockers(error));
        return;
      }
      this.notify.error(this.resolveError(error));
    } finally {
      this.setBusy(department.id, false);
    }
  }

  private openDepartmentBlockers(department: Department, blockers: string[]): void {
    const t = (key: string) => this.transloco.translate(key);
    const teamsLink = {
      label: t('departments.actions.viewTeams'),
      route: ['/workspace/staff/teams'],
      queryParams: { departmentId: department.id },
    };
    const usersLink = {
      label: t('departments.actions.viewUsers'),
      route: ['/workspace/staff/users'],
      queryParams: { departmentId: department.id },
    };

    void this.blockersDialog().open({
      title: department.name,
      blockers,
      links: {
        'department has teams': teamsLink,
        'department has active teams': teamsLink,
        'active teams': teamsLink,
        'department has placed users': usersLink,
        'department has team memberships': usersLink,
        users: usersLink,
      },
    });
  }

  private async openDepartmentById(id: string): Promise<void> {
    const existing = this.rows().find((d) => d.id === id);
    if (existing) {
      this.openEdit(existing);
      return;
    }
    try {
      const department = await getDepartment(id);
      let companyId = this.branchMap().get(department.branchId)?.companyId ?? null;
      if (!companyId) {
        try {
          const branch = await getBranch(department.branchId);
          companyId = branch.companyId;
        } catch {
          // DepartmentModal also resolves companyId as fallback.
        }
      }
      this.modalDepartment.set(department);
      this.departmentModal().openEdit(department, companyId);
    } catch (error) {
      this.notify.error(this.resolveError(error));
    }
  }

  private async loadLookups(): Promise<void> {
    const [companiesRes, branchesRes] = await Promise.allSettled([
      listAllPages(listCompanies, { limit: 100 }),
      listAllPages(listBranches, { limit: 100 }),
    ]);
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
    this.loading.set(true);
    this.loadFailed.set(false);

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
      const result = await listDepartments(query);
      if (seq !== this.loadSeq) return;
      this.rows.set(result.data);
      this.total.set(result.meta.total);
      void this.loadTeamCounts(result.data);
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

  private async loadTeamCounts(items: Department[]): Promise<void> {
    const seq = ++this.countsSeq;
    const results = await Promise.allSettled(
      items.map(async (dept) => [dept.id, (await listTeams({ departmentId: dept.id, limit: 1 })).meta.total] as const),
    );
    if (seq !== this.countsSeq) return;
    const next: Record<string, number> = {};
    for (const res of results) {
      if (res.status === 'fulfilled') {
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
    const msg = errorMessage(error, 'staff', this.transloco);
    if (msg && msg !== 'settings.errors.generic') return msg;
    const fallback = this.transloco.translate('staff.errors.generic');
    return fallback !== 'staff.errors.generic' ? fallback : msg;
  }
}

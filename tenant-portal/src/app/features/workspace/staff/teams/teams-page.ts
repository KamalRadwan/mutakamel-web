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
  tablerTrash,
  tablerUsers,
  tablerUsersGroup,
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
  deleteTeam,
  errorCodeOf,
  errorMessage,
  getBranch,
  getDepartment,
  getTeam,
  listAllPages,
  listBranches,
  listCompanies,
  listDepartments,
  listTeams,
  listUsers,
  newIdempotencyKey,
  updateTeam,
} from '../shared/staff.api';
import {
  Branch,
  Company,
  Department,
  ListQuery,
  OrgStatus,
  StaffListFilter,
  StaffListSortOption,
  Team,
  TenantUser,
} from '../shared/staff.model';
import { TeamModal } from './team-modal/team-modal';

type TeamSort = 'name' | 'code' | 'createdAt';

const SKELETON_ROWS = [1, 2, 3, 4, 5] as const;
const TABLE_COLUMNS = 'grid-cols-staff-team-row-actions';

@Component({
  selector: 'app-teams-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    ActionsMenu,
    BlockersDialog,
    Button,
    ConfirmDialog,
    StaffList,
    StatusBadge,
    TeamModal,
  ],
  providers: [
    provideTranslocoScope(
      'settings',
      { scope: 'staff', alias: 'staff' },
      { scope: 'staff-teams', alias: 'teams' },
    ),
    provideIcons({
      tablerUsersGroup,
      tablerCloudOff,
      tablerEye,
      tablerEdit,
      tablerUsers,
      tablerCheck,
      tablerCircleOff,
      tablerTrash,
    }),
  ],
  templateUrl: './teams-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class TeamsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly session = inject(StaffSession);
  private readonly queryParams = toSignal(this.route.queryParamMap);

  private readonly teamModal = viewChild.required(TeamModal);
  private readonly deleteConfirm = viewChild.required<ConfirmDialog>('deleteConfirm');
  private readonly blockersDialog = viewChild.required(BlockersDialog);

  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly tableColumns = TABLE_COLUMNS;

  protected readonly search = signal('');
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly sort = signal<string>('name');
  protected readonly filterValues = signal<Record<string, string | null>>({});

  private readonly loadedRows = signal<Team[]>([]);
  protected readonly rows = computed(() => this.loadedRows().filter((row) =>
    this.canOnTeam('org.team.read', row),
  ));
  private readonly loadedTotal = signal<{ revision: string | null; count: number } | null>(null);
  protected readonly total = computed(() => {
    const result = this.loadedTotal();
    return result && result.revision === this.session.scopeRevision() &&
      this.rows().length === this.loadedRows().length ? result.count : this.rows().length;
  });
  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly companies = signal<Company[]>([]);
  protected readonly branches = signal<Branch[]>([]);
  protected readonly departments = signal<Department[]>([]);
  protected readonly users = signal<TenantUser[]>([]);
  protected readonly memberCounts = signal<Record<string, number>>({});
  protected readonly busyIds = signal<ReadonlySet<string>>(new Set());

  protected readonly modalTeam = signal<Team | null>(null);
  protected readonly pendingDeleteTeam = signal<Team | null>(null);

  private readonly branchMap = computed(() => new Map(this.branches().map((b) => [b.id, b])));
  private readonly departmentMap = computed(() => new Map(this.departments().map((d) => [d.id, d])));
  private readonly userMap = computed(() => new Map(this.users().map((u) => [u.id, u])));

  protected readonly canAddTeam = computed(
    () =>
      this.branches().some((b) =>
        this.session.can('org.team.manage', { companyId: b.companyId, branchId: b.id }),
      ),
  );

  protected readonly modalCanManage = computed(() => {
    const editing = this.modalTeam();
    if (editing) {
      return this.canManageTeam(editing);
    }
    return this.canAddTeam();
  });

  protected readonly hasActiveFiltersOrSearch = computed(
    () =>
      Boolean(this.search().trim()) ||
      Boolean(this.filterValues()['companyId']) ||
      Boolean(this.filterValues()['branchId']) ||
      Boolean(this.filterValues()['departmentId']) ||
      Boolean(this.filterValues()['status']),
  );

  protected readonly filters = computed<StaffListFilter[]>(() => {
    this.i18n();
    const vals = this.filterValues();
    const companyId = vals['companyId'] ?? null;
    const branchId = vals['branchId'] ?? null;
    const branchMap = this.branchMap();

    const branchOptions = this.branches()
      .filter((branch) => !companyId || branch.companyId === companyId)
      .map((branch) => ({ value: branch.id, label: branch.name }));

    const departmentOptions = this.departments()
      .filter((dept) => {
        if (branchId) return dept.branchId === branchId;
        if (companyId) return branchMap.get(dept.branchId)?.companyId === companyId;
        return true;
      })
      .map((dept) => ({ value: dept.id, label: dept.name }));

    return [
      {
        id: 'companyId',
        label: this.transloco.translate('teams.filters.company'),
        options: this.companies().map((company) => ({ value: company.id, label: company.name })),
        value: companyId,
      },
      {
        id: 'branchId',
        label: this.transloco.translate('teams.filters.branch'),
        options: branchOptions,
        value: branchId,
      },
      {
        id: 'departmentId',
        label: this.transloco.translate('teams.filters.department'),
        options: departmentOptions,
        value: vals['departmentId'] ?? null,
      },
      {
        id: 'status',
        label: this.transloco.translate('teams.filters.status'),
        options: [
          { value: 'ACTIVE', label: this.transloco.translate('teams.filters.active') },
          { value: 'INACTIVE', label: this.transloco.translate('teams.filters.inactive') },
        ],
        value: vals['status'] ?? null,
      },
    ];
  });

  protected readonly sortOptions = computed<StaffListSortOption[]>(() => {
    this.i18n();
    return [
      { value: 'name', label: this.transloco.translate('teams.sort.name') },
      { value: 'code', label: this.transloco.translate('teams.sort.code') },
      { value: 'createdAt', label: this.transloco.translate('teams.sort.newest') },
    ];
  });

  private loadSeq = 0;
  private countsSeq = 0;
  private prevCompanyFilter: string | null = null;
  private prevBranchFilter: string | null = null;
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
    const initialDepartment = initialParams.get('departmentId');
    if (initialCompany || initialBranch || initialDepartment) {
      this.appliedUrlFilterKey = `${initialCompany ?? ''}|${initialBranch ?? ''}|${initialDepartment ?? ''}`;
      this.prevCompanyFilter = initialCompany;
      this.prevBranchFilter = initialBranch;
      this.filterValues.set({
        ...(initialCompany ? { companyId: initialCompany } : {}),
        ...(initialBranch ? { branchId: initialBranch } : {}),
        ...(initialDepartment ? { departmentId: initialDepartment } : {}),
      });
    }

    effect(() => {
      const filters = this.filterValues();
      const companyId = filters['companyId'] ?? null;
      const branchId = filters['branchId'] ?? null;
      const departmentId = filters['departmentId'] ?? null;
      const prevCompany = this.prevCompanyFilter;
      const prevBranch = this.prevBranchFilter;
      this.prevCompanyFilter = companyId;
      this.prevBranchFilter = branchId;

      if (prevCompany !== companyId) {
        const nextUpdates: Record<string, string | null> = {};
        if (branchId) {
          const branch = untracked(() => this.branchMap().get(branchId));
          if (!branch || (companyId && branch.companyId !== companyId)) {
            nextUpdates['branchId'] = null;
          }
        }
        if (departmentId) {
          const dept = untracked(() => this.departmentMap().get(departmentId));
          const deptBranch = dept ? untracked(() => this.branchMap().get(dept.branchId)) : null;
          if (!dept || (companyId && deptBranch?.companyId !== companyId)) {
            nextUpdates['departmentId'] = null;
          }
        }
        if (Object.keys(nextUpdates).length > 0) {
          untracked(() => {
            this.filterValues.update((current) => ({ ...current, ...nextUpdates }));
          });
          return;
        }
      }

      if (prevBranch !== branchId && departmentId) {
        const dept = untracked(() => this.departmentMap().get(departmentId));
        if (!dept || (branchId && dept.branchId !== branchId)) {
          untracked(() => {
            this.filterValues.update((current) => ({ ...current, departmentId: null }));
          });
          return;
        }
      }

      const search = this.search().trim();
      const sort = this.sort() as TeamSort;
      const status = filters['status'] ?? null;
      const page = this.page();
      const pageSize = this.pageSize();

      const criteriaSignature = `${this.session.scopeRevision()}|${search}|${sort}|${companyId ?? ''}|${branchId ?? ''}|${departmentId ?? ''}|${status ?? ''}`;
      const criteriaChanged = this.prevCriteriaSignature !== null && this.prevCriteriaSignature !== criteriaSignature;
      this.prevCriteriaSignature = criteriaSignature;

      if (criteriaChanged && page !== 1) {
        untracked(() => this.page.set(1));
        return;
      }

      void untracked(() =>
        this.loadList({ search, sort, companyId, branchId, departmentId, status, page, pageSize }),
      );
    });

    effect(() => {
      const params = this.queryParams();
      if (!params) return;

      const companyId = params.get('companyId');
      const branchId = params.get('branchId');
      const departmentId = params.get('departmentId');
      const urlFilterKey = `${companyId ?? ''}|${branchId ?? ''}|${departmentId ?? ''}`;
      if ((companyId || branchId || departmentId) && urlFilterKey !== this.appliedUrlFilterKey) {
        this.appliedUrlFilterKey = urlFilterKey;
        untracked(() => {
          const resolved = this.resolveParentIds({ companyId, branchId, departmentId });
          this.prevCompanyFilter = resolved.companyId;
          this.prevBranchFilter = resolved.branchId;
          this.filterValues.update((current) => ({
            ...current,
            ...(resolved.companyId ? { companyId: resolved.companyId } : {}),
            ...(resolved.branchId ? { branchId: resolved.branchId } : {}),
            ...(departmentId ? { departmentId } : {}),
          }));
        });
      }

      const me = this.session.me();
      if (!me) return;

      const openId = params.get('open');
      const isNew = params.get('new') === '1';
      if (!openId && !isNew) return;

      const key = `${openId ?? ''}|${isNew ? '1' : ''}|${urlFilterKey}`;
      if (key === this.handledDeepLinkKey) return;
      this.handledDeepLinkKey = key;

      untracked(() => {
        if (openId) {
          void this.openTeamById(openId);
          this.clearQueryParams(['open', 'new']);
        } else if (isNew) {
          if (this.canAddTeam()) {
            const vals = this.filterValues();
            const targetDepartmentId = departmentId ?? vals['departmentId'] ?? null;
            const resolved = this.resolveParentIds({
              companyId: companyId ?? vals['companyId'] ?? null,
              branchId: branchId ?? vals['branchId'] ?? null,
              departmentId: targetDepartmentId,
            });
            this.openCreate({
              companyId: resolved.companyId,
              branchId: resolved.branchId,
              departmentId: targetDepartmentId,
            });
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
      sort: this.sort() as TeamSort,
      companyId: filters['companyId'] ?? null,
      branchId: filters['branchId'] ?? null,
      departmentId: filters['departmentId'] ?? null,
      status: filters['status'] ?? null,
      page: this.page(),
      pageSize: this.pageSize(),
    });
  }

  protected canManageTeam(team: Team): boolean {
    return this.canOnTeam('org.team.manage', team);
  }

  private canOnTeam(permission: string, team: Team): boolean {
    const branchId = this.departmentMap().get(team.departmentId)?.branchId;
    if (!branchId) return false;
    return this.session.can(permission, { branchId, companyId: this.branchMap().get(branchId)?.companyId });
  }

  protected departmentName(departmentId: string): string {
    return this.departmentMap().get(departmentId)?.name ?? '—';
  }

  protected branchNameForDepartment(departmentId: string): string {
    const branchId = this.departmentMap().get(departmentId)?.branchId;
    return branchId ? (this.branchMap().get(branchId)?.name ?? '') : '';
  }

  protected leadUser(leadUserId: string | null): TenantUser | null {
    return leadUserId ? (this.userMap().get(leadUserId) ?? null) : null;
  }

  protected userName(user: TenantUser): string {
    return `${user.firstName} ${user.lastName}`.trim();
  }

  protected userInitials(user: TenantUser): string {
    const first = user.firstName.trim().charAt(0);
    const last = user.lastName.trim().charAt(0);
    return `${first}${last}`.toUpperCase() || '?';
  }

  protected memberCountText(teamId: string): string {
    if (this.loadedTotal()?.revision !== this.session.scopeRevision()) return '—';
    const team = this.rows().find(({ id }) => id === teamId);
    if (!team || !this.canOnTeam('users.user.read', team)) return '—';
    const count = this.memberCounts()[teamId];
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

  protected openCreate(preset?: { companyId?: string | null; branchId?: string | null; departmentId?: string | null }): void {
    if (!this.canAddTeam()) return;
    this.modalTeam.set(null);
    const vals = this.filterValues();
    const departmentId = preset?.departmentId ?? vals['departmentId'] ?? null;
    const resolved = this.resolveParentIds({
      companyId: preset?.companyId ?? vals['companyId'] ?? null,
      branchId: preset?.branchId ?? vals['branchId'] ?? null,
      departmentId,
    });
    this.teamModal().openCreate({
      companyId: resolved.companyId,
      branchId: resolved.branchId,
      departmentId,
    });
  }

  protected openEdit(team: Team): void {
    if (!this.canOnTeam('org.team.read', team)) return;
    this.modalTeam.set(team);
    const resolved = this.resolveParentIds({ departmentId: team.departmentId });
    this.teamModal().openEdit(team, resolved);
  }

  protected onModalSaved(event: { team: Team; isNew: boolean }): void {
    const resolved = this.resolveParentIds({ departmentId: event.team.departmentId });
    if (this.teamModal().editingId() === event.team.id) {
      this.teamModal().syncTeam(event.team, resolved);
    }
    this.reload();
  }

  protected actionsFor(team: Team): ActionItem[] {
    this.i18n();
    const t = (key: string) => this.transloco.translate(key);
    const manage = this.canManageTeam(team);
    const busy = this.busyIds().has(team.id);
    const isActive = team.status === 'ACTIVE';

    const items: ActionItem[] = [
      {
        id: 'open',
        title: t('teams.actions.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
    ];

    if (manage) {
      items.push({
        id: 'edit',
        title: t('teams.actions.edit'),
        icon: 'tablerEdit',
        tile: 'bg-icon-orange',
      });
    }

    if (this.canOnTeam('users.user.read', team)) items.push({
      id: 'viewMembers',
      title: t('teams.actions.viewMembers'),
      icon: 'tablerUsers',
      tile: 'bg-icon-blue',
    });

    if (manage) {
      items.push(
        {
          id: 'toggleStatus',
          title: t(isActive ? 'teams.actions.deactivate' : 'teams.actions.activate'),
          icon: isActive ? 'tablerCircleOff' : 'tablerCheck',
          tile: busy ? 'bg-icon-gray' : isActive ? 'bg-icon-orange' : 'bg-icon-green',
          disabled: busy,
        },
        {
          id: 'delete',
          title: t('teams.actions.delete'),
          icon: 'tablerTrash',
          tile: 'bg-icon-red',
          danger: true,
          disabled: busy,
        },
      );
    }

    return items;
  }

  protected onAction(team: Team, selection: ActionSelection): void {
    switch (selection.id) {
      case 'open':
      case 'edit':
        this.openEdit(team);
        break;
      case 'viewMembers':
        if (this.canOnTeam('users.user.read', team)) {
          void this.router.navigate(['/workspace/staff/users'], { queryParams: { teamId: team.id } });
        }
        break;
      case 'toggleStatus':
        if (this.canManageTeam(team)) {
          void this.toggleStatus(team);
        }
        break;
      case 'delete':
        if (this.canManageTeam(team)) {
          void this.requestDelete(team);
        }
        break;
    }
  }

  protected async requestDelete(team: Team): Promise<void> {
    if (!this.canManageTeam(team) || this.busyIds().has(team.id)) return;
    this.pendingDeleteTeam.set(team);
    if (!(await this.deleteConfirm().open())) {
      this.pendingDeleteTeam.set(null);
      return;
    }

    this.setBusy(team.id, true);
    try {
      await deleteTeam(team.id, newIdempotencyKey());
      if (this.teamModal().editingId() === team.id) {
        this.teamModal().closeImmediate();
      }
      this.notify.success(this.transloco.translate('teams.toast.deleted'));
      this.reload();
    } catch (error) {
      if (errorCodeOf(error) === 'ORG_NODE_NOT_EMPTY') {
        this.openTeamBlockers(team, this.extractBlockers(error));
        return;
      }
      this.notify.error(this.resolveError(error));
      if (errorCodeOf(error) === 'ORG_NODE_NOT_FOUND' || (error instanceof ApiError && error.status === 404)) {
        if (this.teamModal().editingId() === team.id) {
          this.teamModal().closeImmediate();
        }
        this.reload();
      }
    } finally {
      this.setBusy(team.id, false);
      this.pendingDeleteTeam.set(null);
    }
  }

  protected onDeactivateBlocked(event: { team: Team; blockers: string[] }): void {
    this.openTeamBlockers(event.team, event.blockers);
  }

  private async toggleStatus(team: Team): Promise<void> {
    if (this.busyIds().has(team.id)) return;
    const nextStatus: OrgStatus = team.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    this.setBusy(team.id, true);
    try {
      const updated = await updateTeam(team.id, { status: nextStatus }, newIdempotencyKey());
      const resolved = this.resolveParentIds({ departmentId: updated.departmentId });
      this.teamModal().syncTeam(updated, resolved);
      this.notify.success(
        this.transloco.translate(nextStatus === 'ACTIVE' ? 'teams.toast.activated' : 'teams.toast.deactivated'),
      );
      this.reload();
    } catch (error) {
      if (errorCodeOf(error) === 'ORG_NODE_NOT_EMPTY') {
        this.openTeamBlockers(team, this.extractBlockers(error));
        return;
      }
      this.notify.error(this.resolveError(error));
    } finally {
      this.setBusy(team.id, false);
    }
  }

  private openTeamBlockers(team: Team, blockers: string[]): void {
    const t = (key: string) => this.transloco.translate(key);
    const membersLink = {
      label: t('teams.actions.viewMembers'),
      route: ['/workspace/staff/users'],
      queryParams: { teamId: team.id },
    };

    void this.blockersDialog().open({
      title: team.name,
      blockers,
      links: {
        'team has placed users': membersLink,
        'team has memberships': membersLink,
      },
    });
  }

  private async openTeamById(id: string): Promise<void> {
    const existing = this.rows().find((t) => t.id === id);
    if (existing) {
      this.openEdit(existing);
      return;
    }
    try {
      const team = await getTeam(id);
      let resolved = this.resolveParentIds({ departmentId: team.departmentId });
      if (!resolved.branchId || !resolved.companyId) {
        try {
          const dept = await getDepartment(team.departmentId);
          const branch = await getBranch(dept.branchId);
          resolved = { companyId: branch.companyId, branchId: dept.branchId };
        } catch {
          // TeamModal also resolves parent chain as fallback.
        }
      }
      this.modalTeam.set(team);
      this.teamModal().openEdit(team, resolved);
    } catch (error) {
      this.notify.error(this.resolveError(error));
    }
  }

  private resolveParentIds(input: {
    companyId?: string | null;
    branchId?: string | null;
    departmentId?: string | null;
  }): { companyId: string | null; branchId: string | null } {
    let branchId = input.branchId || null;
    let companyId = input.companyId || null;
    if (!branchId && input.departmentId) {
      branchId = this.departmentMap().get(input.departmentId)?.branchId ?? null;
    }
    if (!companyId && branchId) {
      companyId = this.branchMap().get(branchId)?.companyId ?? null;
    }
    return { companyId, branchId };
  }

  private async loadLookups(): Promise<void> {
    const [companiesRes, branchesRes, deptsRes, usersRes] = await Promise.allSettled([
      listAllPages(listCompanies, { limit: 100 }),
      listAllPages(listBranches, { limit: 100 }),
      listAllPages(listDepartments, { limit: 100 }),
      listAllPages(listUsers, { limit: 100 }),
    ]);
    if (companiesRes.status === 'fulfilled') {
      this.companies.set(companiesRes.value);
    }
    if (branchesRes.status === 'fulfilled') {
      this.branches.set(branchesRes.value);
    }
    if (deptsRes.status === 'fulfilled') {
      this.departments.set(deptsRes.value);
    }
    if (usersRes.status === 'fulfilled') {
      this.users.set(usersRes.value);
    }

    const vals = this.filterValues();
    const resolved = this.resolveParentIds({
      companyId: vals['companyId'] ?? null,
      branchId: vals['branchId'] ?? null,
      departmentId: vals['departmentId'] ?? null,
    });
    if ((resolved.branchId && !vals['branchId']) || (resolved.companyId && !vals['companyId'])) {
      this.prevCompanyFilter = resolved.companyId;
      this.prevBranchFilter = resolved.branchId;
      this.filterValues.update((current) => ({
        ...current,
        ...(resolved.companyId ? { companyId: resolved.companyId } : {}),
        ...(resolved.branchId ? { branchId: resolved.branchId } : {}),
      }));
    }
  }

  private async loadList(params: {
    search: string;
    sort: TeamSort;
    companyId: string | null;
    branchId: string | null;
    departmentId: string | null;
    status: string | null;
    page: number;
    pageSize: number;
  }): Promise<void> {
    const seq = ++this.loadSeq;
    const revision = this.session.scopeRevision();
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
    if (params.departmentId) query.departmentId = params.departmentId;
    if (params.status) query.status = params.status;

    try {
      const result = await listTeams(query, (scope) => this.session.can('org.team.read', scope));
      if (seq !== this.loadSeq || revision !== this.session.scopeRevision()) return;
      this.loadedRows.set(result.data);
      this.loadedTotal.set({ revision, count: result.meta.total });
      void this.loadMemberCounts(result.data);
    } catch {
      if (seq !== this.loadSeq) return;
      this.loadFailed.set(true);
      this.loadedRows.set([]);
      this.loadedTotal.set(null);
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private async loadMemberCounts(items: Team[]): Promise<void> {
    const seq = ++this.countsSeq;
    const revision = this.session.scopeRevision();
    this.memberCounts.set({});
    const results = await Promise.allSettled(
      items.map(async (team) => {
        const page = await listUsers({ teamId: team.id, limit: 1 }, (scope) =>
          this.session.can('users.user.read', scope),
        );
        return [team.id, page.meta.total] as const;
      }),
    );
    if (seq !== this.countsSeq || revision !== this.session.scopeRevision()) return;
    const next: Record<string, number> = {};
    for (const res of results) {
      if (res.status === 'fulfilled') {
        next[res.value[0]] = res.value[1];
      }
    }
    this.memberCounts.set(next);
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

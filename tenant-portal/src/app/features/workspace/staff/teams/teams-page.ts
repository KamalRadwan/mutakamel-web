import { Component, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerCloudOff,
  tablerEye,
  tablerUsers,
  tablerUsersGroup,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { StaffList } from '../shared/staff-list/staff-list';
import { StaffSession } from '../shared/staff-session';
import { StatusBadge } from '../shared/status-badge/status-badge';
import { ApiError } from '../../../../core/api/api-errors';
import { OrganizationReadApi } from '../shared/organization-read.api';
import { errorMessage, listAllPages } from '../shared/staff.api';
import { StaffUsersApi } from '../users/users.api';
import {
  Branch,
  Company,
  Department,
  ListQuery,
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
    Button,
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
      tablerUsers,
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
  private readonly organization = inject(OrganizationReadApi);
  private readonly usersApi = inject(StaffUsersApi);
  private readonly queryParams = toSignal(this.route.queryParamMap);

  private readonly teamModal = viewChild.required(TeamModal);
  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly tableColumns = TABLE_COLUMNS;

  protected readonly search = signal('');
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly sort = signal<string>('name');
  protected readonly filterValues = signal<Record<string, string | null>>({});

  private readonly result = signal<{ revision: string; rows: Team[]; total: number } | null>(null);
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
  protected readonly departments = signal<Department[]>([]);
  protected readonly users = signal<TenantUser[]>([]);
  protected readonly memberCounts = signal<Record<string, number>>({});

  private readonly branchMap = computed(() => new Map(this.branches().map((b) => [b.id, b])));
  private readonly departmentMap = computed(() => new Map(this.departments().map((d) => [d.id, d])));
  private readonly userMap = computed(() => new Map(this.users().map((u) => [u.id, u])));

  protected readonly createDepartments = computed(() => this.departments().filter((department) => {
    const branch = this.branchMap().get(department.branchId);
    return department.status === 'ACTIVE' && branch &&
      this.companies().some((company) => company.id === branch.companyId) &&
      this.session.can('org.team.manage', { companyId: branch.companyId, branchId: branch.id });
  }));
  protected readonly canAddTeam = computed(() => this.createDepartments().length > 0);

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
  private lookupSeq = 0;
  private detailSeq = 0;
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
    effect(() => {
      this.session.scopeRevision();
      untracked(() => {
        this.lookupsReady.set(false);
        this.companies.set([]);
        this.branches.set([]);
        this.departments.set([]);
        this.users.set([]);
        void this.loadLookups();
      });
    });
    effect(() => {
      const result = this.currentResult();
      if (!result || !this.lookupsReady()) return;
      void untracked(() => this.loadMemberCounts(result.rows));
    });

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
      if ((!openId && !isNew) || (isNew && !openId && !this.lookupsReady())) return;

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
    const filters = this.filterValues();
    const companyId = preset?.companyId ?? filters['companyId'];
    const branchId = preset?.branchId ?? filters['branchId'];
    const departmentId = preset?.departmentId ?? filters['departmentId'];
    const matching = this.createDepartments().filter((department) =>
      (!companyId || this.branchMap().get(department.branchId)?.companyId === companyId) &&
      (!branchId || department.branchId === branchId) && (!departmentId || department.id === departmentId),
    );
    if (preset && matching.length === 0) return;

    const department = matching.length === 1 ? matching[0] : null;
    this.detailSeq++;
    this.teamModal().openCreate({
      companyId: department ? this.branchMap().get(department.branchId)?.companyId : matching.length ? companyId : null,
      branchId: department?.branchId ?? (matching.length ? branchId : null),
      departmentId: department?.id,
    });
  }

  protected openDetails(team: Team): void {
    void this.openTeamById(team.id);
  }

  protected async onModalSaved(): Promise<void> {
    const revision = this.session.scopeRevision();
    if (!revision) return;
    await this.organization.invalidateScope(revision);
    if (revision === this.session.scopeRevision()) this.reload();
  }

  protected actionsFor(team: Team): ActionItem[] {
    this.i18n();
    const t = (key: string) => this.transloco.translate(key);
    const items: ActionItem[] = [{
      id: 'open',
      title: t('teams.actions.open'),
      icon: 'tablerEye',
      tile: 'bg-icon-blue',
    }];

    if (this.canOnTeam('users.user.read', team)) {
      items.push({ id: 'viewMembers', title: t('teams.actions.viewMembers'), icon: 'tablerUsers', tile: 'bg-icon-blue' });
    }
    return items;
  }

  protected onAction(team: Team, selection: ActionSelection): void {
    if (selection.id === 'open') this.openDetails(team);
    if (selection.id === 'viewMembers' && this.canOnTeam('users.user.read', team)) {
      void this.router.navigate(['/workspace/staff/users'], { queryParams: { teamId: team.id } });
    }
  }

  private async openTeamById(id: string): Promise<void> {
    const seq = ++this.detailSeq;
    const revision = this.session.scopeRevision();
    try {
      const team = await this.organization.getTeam(id);
      if (seq !== this.detailSeq || revision !== this.session.scopeRevision()) return;
      this.teamModal().openDetails(team, this.resolveParentIds({ departmentId: team.departmentId }));
    } catch (error) {
      if (seq === this.detailSeq && revision === this.session.scopeRevision()) this.notify.error(this.resolveError(error));
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
    const seq = ++this.lookupSeq;
    const revision = this.session.scopeRevision();
    if (!revision) return;
    const [companiesRes, branchesRes, deptsRes] = await Promise.allSettled([
      listAllPages((query) => this.organization.listCompanies(query), { limit: 100 }),
      listAllPages((query) => this.organization.listBranches(query), { limit: 100 }),
      listAllPages((query) => this.organization.listDepartments(query), { limit: 100 }),
    ]);
    if (seq !== this.lookupSeq || revision !== this.session.scopeRevision()) return;
    this.lookupsReady.set(true);
    if (companiesRes.status === 'fulfilled') {
      this.companies.set(companiesRes.value);
    }
    if (branchesRes.status === 'fulfilled') {
      this.branches.set(branchesRes.value);
    }
    if (deptsRes.status === 'fulfilled') {
      this.departments.set(deptsRes.value);
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
    if (params.departmentId) query.departmentId = params.departmentId;
    if (params.status) query.status = params.status;

    try {
      const result = await this.organization.listTeams(query);
      if (seq !== this.loadSeq || revision !== this.session.scopeRevision()) return;
      this.result.set({ revision, rows: result.data, total: result.meta.total });
      void this.loadLeads(result.data, seq, revision);
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

  private async loadLeads(teams: Team[], seq: number, revision: string): Promise<void> {
    this.users.set([]);
    if (!this.session.can('users.user.read')) return;
    const ids = new Set(teams.flatMap((team) => team.leadUserId ? [team.leadUserId] : []));
    const results = await Promise.allSettled([...ids].map((id) => this.usersApi.getUser(id)));
    if (seq !== this.loadSeq || revision !== this.session.scopeRevision()) return;
    this.users.set(results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []));
  }

  private async loadMemberCounts(items: Team[]): Promise<void> {
    const seq = ++this.countsSeq;
    const revision = this.session.scopeRevision();
    this.memberCounts.set({});
    const results = await Promise.allSettled(
      items.map(async (team) => {
        if (!this.canOnTeam('users.user.read', team)) return null;
        const page = await this.usersApi.listUsers({ teamId: team.id, limit: 1 });
        return [team.id, page.meta.total] as const;
      }),
    );
    if (seq !== this.countsSeq || revision !== this.session.scopeRevision()) return;
    const next: Record<string, number> = {};
    for (const res of results) {
      if (res.status === 'fulfilled' && res.value) {
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

  private resolveError(error: unknown): string {
    const msg = errorMessage(error, 'staff', this.transloco);
    if (msg && msg !== 'settings.errors.generic') return msg;
    const fallback = this.transloco.translate('staff.errors.generic');
    return fallback !== 'staff.errors.generic' ? fallback : msg;
  }
}

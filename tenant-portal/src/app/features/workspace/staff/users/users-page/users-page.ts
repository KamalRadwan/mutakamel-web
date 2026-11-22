import { Component, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCloudOff, tablerCrown } from '@ng-icons/tabler-icons';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { LanguageState } from '../../../../../core/i18n/language';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import { Button } from '../../../../../shared/ui/button/button';
import { SeatChips } from '../../../seats/seat-chips/seat-chips';
import { ModuleUsage, moduleNameIn } from '../../../seats/seats.model';
import { OrganizationReadApi } from '../../shared/organization-read.api';
import { listAllPages } from '../../shared/staff.api';
import { StaffList } from '../../shared/staff-list/staff-list';
import { StaffSession } from '../../shared/staff-session';
import { StatusBadge } from '../../shared/status-badge/status-badge';
import type { Branch, Company, CorePage, Department, ListQuery, StaffListFilter, StaffListSortOption, Team, TenantUser } from '../../shared/staff.model';
import { InviteModal } from '../invite-modal/invite-modal';
import { StaffUsersApi } from '../users.api';
import { avatarToneForName, formatStaffDate, userFullName, userInitials } from './users.model';

type UserSort = 'createdAt' | 'firstName' | 'email' | 'employeeCode';

const SKELETON_ROWS = [1, 2, 3, 4, 5] as const;

@Component({
  selector: 'app-users-page',
  imports: [NgIcon, TranslocoPipe, Button, InviteModal, SeatChips, StaffList, StatusBadge],
  providers: [
    provideTranslocoScope(
      'settings',
      { scope: 'staff', alias: 'staff' },
      { scope: 'staff-users', alias: 'users' },
      { scope: 'seats', alias: 'seats' },
    ),
    provideIcons({ tablerCrown, tablerCloudOff }),
  ],
  templateUrl: './users-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class UsersPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly seatsTranslation = toSignal(this.transloco.selectTranslation('seats'));
  private readonly language = inject(LanguageState).current;
  private readonly session = inject(StaffSession);
  private readonly scope = inject(TenantScopeState);
  private readonly organization = inject(OrganizationReadApi);
  private readonly usersApi = inject(StaffUsersApi);
  private readonly queryParams = toSignal(this.route.queryParamMap);

  private readonly inviteModal = viewChild.required(InviteModal);
  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly tableColumns = 'grid-cols-staff-user-row';

  protected readonly search = signal('');
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly sort = signal<string>('createdAt');
  protected readonly filterValues = signal<Record<string, string | null>>({});

  private readonly loadedRows = signal<TenantUser[]>([]);
  private readonly loadedTotal = signal<{ revision: string | null; count: number } | null>(null);
  protected readonly rows = computed(() => this.loadedTotal()?.revision === this.session.scopeRevision()
    ? this.loadedRows().filter((user) => this.canReadUser(user))
    : []);
  protected readonly total = computed(() => {
    const result = this.loadedTotal();
    return result && result.revision === this.session.scopeRevision() &&
      this.rows().length === this.loadedRows().length ? result.count : this.rows().length;
  });
  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);

  private readonly loadedLookups = signal<{
    revision: string;
    companies: Company[];
    branches: Branch[];
    departments: Department[];
    teams: Team[];
  } | null>(null);
  private readonly lookups = computed(() => {
    const result = this.loadedLookups();
    return result?.revision === this.session.scopeRevision() ? result : null;
  });
  protected readonly companies = computed(() => this.lookups()?.companies ?? []);
  protected readonly branches = computed(() => this.lookups()?.branches ?? []);
  protected readonly departments = computed(() => this.lookups()?.departments ?? []);
  protected readonly teams = computed(() => this.lookups()?.teams ?? []);
  protected readonly seatModules = signal<ModuleUsage[]>([]);
  private readonly branchMap = computed(() => new Map(this.branches().map((b) => [b.id, b])));
  private readonly departmentMap = computed(() => new Map(this.departments().map((d) => [d.id, d])));
  private readonly teamMap = computed(() => new Map(this.teams().map((t) => [t.id, t])));

  protected readonly hasInviteGrant = computed(() => this.session.me()?.permissions.includes('users.user.invite') === true);
  protected readonly inviteDepartments = computed(() => this.departments().filter((item) => item.status === 'ACTIVE'));
  protected readonly inviteBranches = computed(() => {
    const companies = new Set(this.companies().filter((item) => item.status === 'ACTIVE').map((item) => item.id));
    const departmentBranches = new Set(this.inviteDepartments().map((item) => item.branchId));
    return this.branches().filter((item) => item.status === 'ACTIVE' && companies.has(item.companyId) &&
      departmentBranches.has(item.id) && this.session.can('users.user.invite', { companyId: item.companyId, branchId: item.id }));
  });
  protected readonly inviteCompanies = computed(() => {
    const ids = new Set(this.inviteBranches().map((branch) => branch.companyId));
    return this.companies().filter((item) => ids.has(item.id));
  });
  protected readonly inviteTeams = computed(() => this.teams().filter((item) => item.status === 'ACTIVE'));
  protected readonly canInvite = computed(() => this.inviteBranches().length > 0);
  protected readonly inviteHint = computed(() => this.canInvite() ? '' : this.transloco.translate(
    this.lookups() ? 'users.invite.placementUnavailable' : 'users.invite.loadingPlacement',
  ));

  protected readonly hasActiveFiltersOrSearch = computed(() => {
    const f = this.filterValues();
    return Boolean(
      this.search().trim() ||
        f['status'] ||
        f['companyId'] ||
        f['branchId'] ||
        f['departmentId'] ||
        f['teamId'] ||
        f['seat'],
    );
  });

  protected readonly filters = computed<StaffListFilter[]>(() => {
    this.i18n();
    this.seatsTranslation();
    const vals = this.filterValues();
    const companyId = vals['companyId'] ?? null;
    const branchId = vals['branchId'] ?? null;
    const departmentId = vals['departmentId'] ?? null;
    const branchCompanies = this.scope.branchCompanies();
    const deptMap = this.departmentMap();

    const branchOptions = this.branches()
      .filter((branch) => !companyId || branch.companyId === companyId)
      .map((branch) => ({ value: branch.id, label: branch.name }));

    const departmentOptions = this.departments()
      .filter((dept) => {
        if (branchId) return dept.branchId === branchId;
        if (companyId) return branchCompanies.get(dept.branchId) === companyId;
        return true;
      })
      .map((dept) => ({ value: dept.id, label: dept.name }));

    const teamOptions = this.teams()
      .filter((team) => {
        if (departmentId) return team.departmentId === departmentId;
        const dept = deptMap.get(team.departmentId);
        const teamBranchId = dept?.branchId;
        if (branchId) return teamBranchId === branchId;
        if (companyId) return !!teamBranchId && branchCompanies.get(teamBranchId) === companyId;
        return true;
      })
      .map((team) => ({ value: team.id, label: team.name }));

    const lang = this.language();
    const seatOptions = [
      ...this.seatModules().map((mod) => {
        const key = `seats.module.${mod.moduleKey}`;
        const translated = this.transloco.translate(key);
        const moduleName = translated !== key ? translated : moduleNameIn(mod.nameI18n, lang);
        return {
          value: `module:${mod.moduleKey}`,
          label: this.transloco.translate('users.filters.seatModule', {
            module: moduleName,
          }),
        };
      }),
      {
        value: 'OVER_CAPACITY',
        label: this.transloco.translate('users.filters.seatReadOnly'),
      },
    ];

    return [
      {
        id: 'status',
        label: this.transloco.translate('users.filters.status'),
        options: [
          { value: 'INVITED', label: this.transloco.translate('staff.status.INVITED') },
          { value: 'ACTIVE', label: this.transloco.translate('staff.status.ACTIVE') },
          { value: 'SUSPENDED', label: this.transloco.translate('staff.status.SUSPENDED') },
        ],
        value: vals['status'] ?? null,
      },
      {
        id: 'seat',
        label: this.transloco.translate('users.filters.seat'),
        options: seatOptions,
        value: vals['seat'] ?? null,
      },
      {
        id: 'companyId',
        label: this.transloco.translate('users.filters.company'),
        options: this.companies().map((company) => ({ value: company.id, label: company.name })),
        value: companyId,
      },
      {
        id: 'branchId',
        label: this.transloco.translate('users.filters.branch'),
        options: branchOptions,
        value: branchId,
      },
      {
        id: 'departmentId',
        label: this.transloco.translate('users.filters.department'),
        options: departmentOptions,
        value: departmentId,
      },
      {
        id: 'teamId',
        label: this.transloco.translate('users.filters.team'),
        options: teamOptions,
        value: vals['teamId'] ?? null,
      },
    ];
  });

  protected readonly sortOptions = computed<StaffListSortOption[]>(() => {
    this.i18n();
    return [
      { value: 'createdAt', label: this.transloco.translate('users.sort.newest') },
      { value: 'firstName', label: this.transloco.translate('users.sort.name') },
      { value: 'email', label: this.transloco.translate('users.sort.email') },
      { value: 'employeeCode', label: this.transloco.translate('users.sort.code') },
    ];
  });

  private loadSeq = 0;
  private prevCompanyFilter: string | null = null;
  private lookupSeq = 0;
  private prevBranchFilter: string | null = null;
  private prevDepartmentFilter: string | null = null;
  private prevCriteriaSignature: string | null = null;
  private handledDeepLinkKey: string | null = null;
  private appliedUrlFilterKey = '';
  constructor() {
    if (!this.session.me()) {
      void this.session.load();
    }
    effect(() => {
      const revision = this.session.scopeRevision();
      if (revision) {
        untracked(() => {
          void this.loadLookups();
          void this.loadSeatModules(revision);
        });
      }
    });

    const initialParams = this.route.snapshot.queryParamMap;
    const initialCompany = initialParams.get('companyId');
    const initialBranch = initialParams.get('branchId');
    const initialDepartment = initialParams.get('departmentId');
    const initialTeam = initialParams.get('teamId');
    if (initialCompany || initialBranch || initialDepartment || initialTeam) {
      this.appliedUrlFilterKey = `${initialCompany ?? ''}|${initialBranch ?? ''}|${initialDepartment ?? ''}|${initialTeam ?? ''}`;
      this.prevCompanyFilter = initialCompany;
      this.prevBranchFilter = initialBranch;
      this.prevDepartmentFilter = initialDepartment;
      this.filterValues.set({
        ...(initialCompany ? { companyId: initialCompany } : {}),
        ...(initialBranch ? { branchId: initialBranch } : {}),
        ...(initialDepartment ? { departmentId: initialDepartment } : {}),
        ...(initialTeam ? { teamId: initialTeam } : {}),
      });
    }

    effect(() => {
      const filters = this.filterValues();
      const companyId = filters['companyId'] ?? null;
      const branchId = filters['branchId'] ?? null;
      const departmentId = filters['departmentId'] ?? null;
      const teamId = filters['teamId'] ?? null;

      const prevCompany = this.prevCompanyFilter;
      const prevBranch = this.prevBranchFilter;
      const prevDepartment = this.prevDepartmentFilter;
      this.prevCompanyFilter = companyId;
      this.prevBranchFilter = branchId;
      this.prevDepartmentFilter = departmentId;

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
        if (teamId) {
          const team = untracked(() => this.teamMap().get(teamId));
          const dept = team ? untracked(() => this.departmentMap().get(team.departmentId)) : null;
          const deptBranch = dept ? untracked(() => this.branchMap().get(dept.branchId)) : null;
          if (!team || !dept || (companyId && deptBranch?.companyId !== companyId)) {
            nextUpdates['teamId'] = null;
          }
        }
        if (Object.keys(nextUpdates).length > 0) {
          untracked(() => {
            this.filterValues.update((current) => ({ ...current, ...nextUpdates }));
          });
          return;
        }
      }

      if (prevBranch !== branchId) {
        const nextUpdates: Record<string, string | null> = {};
        if (departmentId) {
          const dept = untracked(() => this.departmentMap().get(departmentId));
          if (!dept || (branchId && dept.branchId !== branchId)) {
            nextUpdates['departmentId'] = null;
          }
        }
        if (teamId) {
          const team = untracked(() => this.teamMap().get(teamId));
          const dept = team ? untracked(() => this.departmentMap().get(team.departmentId)) : null;
          if (!team || !dept || (branchId && dept.branchId !== branchId)) {
            nextUpdates['teamId'] = null;
          }
        }
        if (Object.keys(nextUpdates).length > 0) {
          untracked(() => {
            this.filterValues.update((current) => ({ ...current, ...nextUpdates }));
          });
          return;
        }
      }

      if (prevDepartment !== departmentId && teamId) {
        const team = untracked(() => this.teamMap().get(teamId));
        if (!team || (departmentId && team.departmentId !== departmentId)) {
          untracked(() => {
            this.filterValues.update((current) => ({ ...current, teamId: null }));
          });
          return;
        }
      }

      const search = this.search().trim();
      const sort = (this.sort() as UserSort) || 'createdAt';
      const status = filters['status'] ?? null;
      const seat = filters['seat'] ?? null;
      const page = this.page();
      const pageSize = this.pageSize();

      const criteriaSignature = `${this.session.scopeRevision()}|${search}|${sort}|${status ?? ''}|${seat ?? ''}|${companyId ?? ''}|${branchId ?? ''}|${departmentId ?? ''}|${teamId ?? ''}`;
      const criteriaChanged =
        this.prevCriteriaSignature !== null && this.prevCriteriaSignature !== criteriaSignature;
      this.prevCriteriaSignature = criteriaSignature;

      if (criteriaChanged && page !== 1) {
        untracked(() => this.page.set(1));
        return;
      }

      void untracked(() =>
        this.loadList({
          search,
          sort,
          status,
          seat,
          companyId,
          branchId,
          departmentId,
          teamId,
          page,
          pageSize,
        }),
      );
    });

    effect(() => {
      const params = this.queryParams();
      if (!params) return;

      const companyId = params.get('companyId');
      const branchId = params.get('branchId');
      const departmentId = params.get('departmentId');
      const teamId = params.get('teamId');
      const urlFilterKey = `${companyId ?? ''}|${branchId ?? ''}|${departmentId ?? ''}|${teamId ?? ''}`;

      if ((companyId || branchId || departmentId || teamId) && urlFilterKey !== this.appliedUrlFilterKey) {
        this.appliedUrlFilterKey = urlFilterKey;
        untracked(() => {
          const resolved = this.resolveParentIds({ companyId, branchId, departmentId, teamId });
          this.prevCompanyFilter = resolved.companyId;
          this.prevBranchFilter = resolved.branchId;
          this.prevDepartmentFilter = resolved.departmentId;
          this.filterValues.update((current) => ({
            ...current,
            ...(resolved.companyId ? { companyId: resolved.companyId } : {}),
            ...(resolved.branchId ? { branchId: resolved.branchId } : {}),
            ...(resolved.departmentId ? { departmentId: resolved.departmentId } : {}),
            ...(teamId ? { teamId } : {}),
          }));
        });
      }

      if (params.get('new') !== '1') {
        this.handledDeepLinkKey = null;
        return;
      }
      if (!this.session.me() || !this.lookups()) return;
      if (urlFilterKey === this.handledDeepLinkKey) return;
      this.handledDeepLinkKey = urlFilterKey;
      untracked(() => {
        this.openInvite();
        this.clearQueryParams(['new']);
      });
    });
  }

  protected reload(): void {
    void this.loadLookups();
    const revision = this.session.scopeRevision();
    if (revision) void this.loadSeatModules(revision);
    const f = this.filterValues();
    void this.loadList({
      search: this.search().trim(),
      sort: (this.sort() as UserSort) || 'createdAt',
      status: f['status'] ?? null,
      seat: f['seat'] ?? null,
      companyId: f['companyId'] ?? null,
      branchId: f['branchId'] ?? null,
      departmentId: f['departmentId'] ?? null,
      teamId: f['teamId'] ?? null,
      page: this.page(),
      pageSize: this.pageSize(),
    });
  }

  protected clearAllFiltersAndSearch(): void {
    this.search.set('');
    this.filterValues.set({});
    this.page.set(1);
  }

  protected fullName(user: TenantUser): string {
    return userFullName(user);
  }

  protected initials(user: TenantUser): string {
    return userInitials(user);
  }

  protected avatarTone(user: TenantUser): string {
    return avatarToneForName(userFullName(user));
  }

  protected isSelf(user: TenantUser): boolean {
    return this.session.me()?.id === user.id;
  }

  protected placementLabel(user: TenantUser): string {
    const parts: string[] = [];
    const branch = this.branchMap().get(user.branchId)?.name;
    const dept = this.departmentMap().get(user.departmentId)?.name;
    const team = user.teamId ? this.teamMap().get(user.teamId)?.name : undefined;
    if (branch) parts.push(branch);
    if (dept) parts.push(dept);
    if (team) parts.push(team);
    return parts.join(' · ') || '—';
  }

  protected formatDate(iso: string): string {
    return formatStaffDate(iso, this.language());
  }

  protected openInvite(): void {
    if (!this.canInvite()) return;
    const f = this.filterValues();
    const resolved = this.resolveParentIds({
      companyId: f['companyId'] ?? null,
      branchId: f['branchId'] ?? null,
      departmentId: f['departmentId'] ?? null,
      teamId: f['teamId'] ?? null,
    });
    this.inviteModal().open({
      companyId: resolved.companyId,
      branchId: resolved.branchId,
      departmentId: resolved.departmentId,
      teamId: f['teamId'] ?? null,
    });
  }

  protected onUserInvited(): void {
    this.reload();
  }

  private canReadUser(user: TenantUser): boolean {
    return this.session.can('users.user.read', { companyId: user.companyId, branchId: user.branchId });
  }

  private resolveParentIds(input: {
    companyId?: string | null;
    branchId?: string | null;
    departmentId?: string | null;
    teamId?: string | null;
  }): { companyId: string | null; branchId: string | null; departmentId: string | null } {
    let departmentId = input.departmentId || null;
    let branchId = input.branchId || null;
    let companyId = input.companyId || null;

    if (!departmentId && input.teamId) {
      departmentId = this.teamMap().get(input.teamId)?.departmentId ?? null;
    }
    if (!branchId && departmentId) {
      branchId = this.departmentMap().get(departmentId)?.branchId ?? null;
    }
    if (!companyId && branchId) {
      companyId = this.scope.branchCompanies().get(branchId) ?? null;
    }

    return { companyId, branchId, departmentId };
  }

  private fetchAllPages<T>(
    permission: string,
    fetcher: (query: ListQuery) => Promise<CorePage<T>>,
  ): Promise<T[]> {
    return this.session.can(permission)
      ? listAllPages(fetcher, { limit: 100, sortBy: 'name', sortDir: 'ASC' })
      : Promise.resolve([]);
  }

  private async loadSeatModules(revision: string): Promise<void> {
    this.seatModules.set([]);
    try {
      const usage = await this.usersApi.getSeatUsage();
      if (revision === this.session.scopeRevision() && Array.isArray(usage.modules)) {
        this.seatModules.set(usage.modules);
      }
    } catch {
      // Seat filters are available once usage can be read.
    }
  }

  private async loadLookups(): Promise<void> {
    const revision = this.session.scopeRevision();
    if (!revision) return;
    const seq = ++this.lookupSeq;
    const [companies, branches, departments, teams] = await Promise.all([
      this.fetchAllPages('org.company.read', (q) => this.organization.listCompanies(q)).catch(() => []),
      this.fetchAllPages('org.branch.read', (q) => this.organization.listBranches(q)).catch(() => []),
      this.fetchAllPages('org.department.read', (q) => this.organization.listDepartments(q)).catch(() => []),
      this.fetchAllPages('org.team.read', (q) => this.organization.listTeams(q)).catch(() => []),
    ]);
    if (seq !== this.lookupSeq || revision !== this.session.scopeRevision()) return;
    this.loadedLookups.set({ revision, companies, branches, departments, teams });

    const vals = this.filterValues();
    let resolved = this.resolveParentIds({
      companyId: vals['companyId'] ?? null,
      branchId: vals['branchId'] ?? null,
      departmentId: vals['departmentId'] ?? null,
      teamId: vals['teamId'] ?? null,
    });

    if (!resolved.branchId && (vals['teamId'] || vals['departmentId'])) {
      try {
        const departmentId = resolved.departmentId ?? (await this.organization.getTeam(vals['teamId']!)).departmentId;
        const { branchId } = await this.organization.getDepartment(departmentId);
        resolved = this.resolveParentIds({ companyId: resolved.companyId, branchId, departmentId });
      } catch {
        // Ignore if lookup fallback fails.
      }
    }

    if (seq !== this.lookupSeq || revision !== this.session.scopeRevision()) return;
    if (resolved.branchId && !this.session.can('users.user.read', resolved)) return;
    if (
      (resolved.departmentId && !vals['departmentId']) ||
      (resolved.branchId && !vals['branchId']) ||
      (resolved.companyId && !vals['companyId'])
    ) {
      this.prevCompanyFilter = resolved.companyId;
      this.prevBranchFilter = resolved.branchId;
      this.prevDepartmentFilter = resolved.departmentId;
      this.filterValues.update((current) => ({
        ...current,
        ...(resolved.companyId ? { companyId: resolved.companyId } : {}),
        ...(resolved.branchId ? { branchId: resolved.branchId } : {}),
        ...(resolved.departmentId ? { departmentId: resolved.departmentId } : {}),
      }));
    }
  }

  private async loadList(params: {
    search: string;
    sort: UserSort;
    status: string | null;
    seat: string | null;
    companyId: string | null;
    branchId: string | null;
    departmentId: string | null;
    teamId: string | null;
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
    if (params.status) query.status = params.status;
    if (params.seat === 'OVER_CAPACITY') {
      query.seatState = 'OVER_CAPACITY';
    } else if (params.seat?.startsWith('module:')) {
      query.seatModuleKey = params.seat.slice('module:'.length);
    }
    if (params.companyId) query.companyId = params.companyId;
    if (params.branchId) query.branchId = params.branchId;
    if (params.departmentId) query.departmentId = params.departmentId;
    if (params.teamId) query.teamId = params.teamId;

    try {
      const result = await this.usersApi.listUsers(query);
      if (seq !== this.loadSeq || revision !== this.session.scopeRevision()) return;
      this.loadedRows.set(result.data);
      this.loadedTotal.set({ revision, count: result.meta.total });
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

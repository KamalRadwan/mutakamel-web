import { Component, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { PluralKeyPipe } from '../../../../../core/i18n/plural';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArmchair,
  tablerCheck,
  tablerCircleOff,
  tablerCloudOff,
  tablerCrown,
  tablerEdit,
  tablerEye,
  tablerLock,
  tablerMinus,
  tablerSend,
  tablerTrash,
  tablerUpload,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../../shared/ui/button/button';
import { Checkbox } from '../../../../../shared/ui/checkbox/checkbox';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Modal } from '../../../../../shared/ui/modal/modal';
import {
  activateUser,
  ApiError,
  deleteUser,
  errorCodeOf,
  getBranch,
  getDepartment,
  getTeam,
  getUser,
  listBranches,
  listCompanies,
  listDepartments,
  listRoles,
  listTeams,
  listUsers,
  newIdempotencyKey,
  resendInvite,
  revokeSessions,
  suspendUser,
} from '../../shared/staff.api';
import { SeatCascadeConfirm } from '../../../seats/cascade-confirm/cascade-confirm';
import { isCascadeRequired, seatErrorMessage } from '../../../seats/seat-errors';
import { SeatChips } from '../../../seats/seat-chips/seat-chips';
import { SeatImpact } from '../../../seats/seat-impact/seat-impact';
import { getSeatUsage, releaseSeats } from '../../../seats/seats.api';
import { ModuleUsage, SeatChange, SeatPreview, moduleNameIn } from '../../../seats/seats.model';
import { StaffList } from '../../shared/staff-list/staff-list';
import { StaffSession } from '../../shared/staff-session';
import { StatusBadge } from '../../shared/status-badge/status-badge';
import {
  Branch,
  Company,
  Department,
  ListQuery,
  Role,
  StaffListFilter,
  StaffListSortOption,
  Team,
  TenantUser,
} from '../../shared/staff.model';
import { BulkRoleModal } from '../bulk-role-modal/bulk-role-modal';
import { ImportModal } from '../import-modal/import-modal';
import { InviteModal } from '../invite-modal/invite-modal';
import { UserModal } from '../user-modal/user-modal';
import {
  UserModalTab,
  avatarToneForName,
  formatStaffDate,
  resolveStaffError,
  userFullName,
  userInitials,
} from './users.model';

type UserSort = 'createdAt' | 'firstName' | 'email' | 'employeeCode';
type StatusConfirmKind = 'suspend' | 'revoke' | 'activate' | 'revokeSessions';

const SKELETON_ROWS = [1, 2, 3, 4, 5] as const;
const VALID_TABS: readonly UserModalTab[] = ['profile', 'roles', 'teams', 'apps', 'phone', 'calls'];

@Component({
  selector: 'app-users-page',
  imports: [
    NgIcon,
    TranslocoPipe, PluralKeyPipe,
    ActionsMenu,
    BulkRoleModal,
    Button,
    Checkbox,
    ConfirmDialog,
    ImportModal,
    InviteModal,
    Modal,
    SeatChips,
    SeatImpact,
    StaffList,
    StatusBadge,
    UserModal,
  ],
  providers: [
    provideTranslocoScope(
      'settings',
      { scope: 'staff', alias: 'staff' },
      { scope: 'staff-users', alias: 'users' },
      { scope: 'seats', alias: 'seats' },
    ),
    provideIcons({
      tablerCrown,
      tablerCloudOff,
      tablerEye,
      tablerEdit,
      tablerSend,
      tablerCircleOff,
      tablerCheck,
      tablerArmchair,
      tablerLock,
      tablerTrash,
      tablerMinus,
      tablerUpload,
      tablerX,
    }),
  ],
  templateUrl: './users-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class UsersPage {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly seatsTranslation = toSignal(this.transloco.selectTranslation('seats'));
  private readonly language = inject(LanguageState).current;
  private readonly session = inject(StaffSession);
  private readonly cascadeConfirm = inject(SeatCascadeConfirm);
  private readonly queryParams = toSignal(this.route.queryParamMap);

  private readonly inviteModal = viewChild.required(InviteModal);
  private readonly bulkRoleModal = viewChild.required(BulkRoleModal);
  private readonly importModal = viewChild.required(ImportModal);
  private readonly userModal = viewChild.required(UserModal);
  private readonly deleteDialog = viewChild.required<Modal>('deleteDialog');
  private readonly releaseDialog = viewChild.required<Modal>('releaseDialog');
  private readonly statusConfirm = viewChild.required<ConfirmDialog>('statusConfirm');
  private readonly pageCheckboxEl = viewChild('pageCb', { read: ElementRef<HTMLElement> });
  private readonly importBtn = viewChild<ElementRef<HTMLButtonElement>>('importBtn');

  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly tableColumns = 'grid-cols-staff-user-row-select-actions';

  protected readonly search = signal('');
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly sort = signal<string>('createdAt');
  protected readonly filterValues = signal<Record<string, string | null>>({});

  protected readonly rows = signal<TenantUser[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);

  protected readonly companies = signal<Company[]>([]);
  protected readonly branches = signal<Branch[]>([]);
  protected readonly departments = signal<Department[]>([]);
  protected readonly teams = signal<Team[]>([]);
  protected readonly knownUsers = signal<TenantUser[]>([]);
  protected readonly roles = signal<Role[]>([]);
  protected readonly seatModules = signal<ModuleUsage[]>([]);
  protected readonly busyIds = signal<ReadonlySet<string>>(new Set());

  private seatModulesLoaded = false;

  protected readonly pendingDeleteUser = signal<TenantUser | null>(null);
  protected readonly pendingReleaseUser = signal<TenantUser | null>(null);
  protected readonly pendingStatusAction = signal<{ kind: StatusConfirmKind; user: TenantUser } | null>(null);
  protected readonly selectedIds = signal<ReadonlySet<string>>(new Set());

  private readonly branchMap = computed(() => new Map(this.branches().map((b) => [b.id, b])));
  private readonly departmentMap = computed(() => new Map(this.departments().map((d) => [d.id, d])));
  private readonly teamMap = computed(() => new Map(this.teams().map((t) => [t.id, t])));

  protected readonly isOwner = computed(() => this.session.isOwner());
  protected readonly selectedCount = computed(() => this.selectedIds().size);
  protected readonly selectedUserIds = computed(() => Array.from(this.selectedIds()));
  protected readonly pageSelectionState = computed<'none' | 'some' | 'all'>(() => {
    const visible = this.rows();
    if (visible.length === 0) return 'none';
    const selected = this.selectedIds();
    let count = 0;
    for (const u of visible) {
      if (selected.has(u.id)) count++;
    }
    if (count === 0) return 'none';
    return count === visible.length ? 'all' : 'some';
  });

  protected readonly deleteSeatChanges = computed<SeatChange[] | null>(() => {
    const user = this.pendingDeleteUser();
    return user ? [{ kind: 'USER_STATUS', userId: user.id, status: 'DEACTIVATED' }] : null;
  });

  protected readonly releaseSeatChanges = computed<SeatChange[] | null>(() => {
    const user = this.pendingReleaseUser();
    return user ? [{ kind: 'USER_STATUS', userId: user.id, status: 'RELEASED' }] : null;
  });

  protected readonly canInvite = computed(
    () =>
      this.session.isTenantWide('users.user.invite') ||
      this.session.can('users.user.invite') ||
      this.branches().some((b) =>
        this.session.can('users.user.invite', { companyId: b.companyId, branchId: b.id }),
      ),
  );

  protected readonly canAssignRoles = computed(
    () =>
      this.session.isTenantWide('users.user.assign_roles') ||
      this.session.can('users.user.assign_roles') ||
      this.branches().some((b) =>
        this.session.can('users.user.assign_roles', { companyId: b.companyId, branchId: b.id }),
      ),
  );

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
    const branchMap = this.branchMap();
    const deptMap = this.departmentMap();

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

    const teamOptions = this.teams()
      .filter((team) => {
        if (departmentId) return team.departmentId === departmentId;
        const dept = deptMap.get(team.departmentId);
        if (!dept) return false;
        if (branchId) return dept.branchId === branchId;
        if (companyId) return branchMap.get(dept.branchId)?.companyId === companyId;
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

  protected readonly statusActionsBuilder = computed<(user: TenantUser) => ActionItem[]>(() => {
    this.i18n();
    this.session.me();
    this.busyIds();
    return (user: TenantUser) => this.buildStatusActions(user);
  });

  protected readonly statusConfirmTitle = computed(() => {
    this.i18n();
    const pending = this.pendingStatusAction();
    if (!pending) return '';
    return this.transloco.translate(`users.confirm.${pending.kind}Title`);
  });

  protected readonly statusConfirmText = computed(() => {
    this.i18n();
    const pending = this.pendingStatusAction();
    if (!pending) return '';
    return this.transloco.translate(`users.confirm.${pending.kind}`, {
      name: userFullName(pending.user),
      email: pending.user.email,
    });
  });

  protected readonly statusConfirmButtonLabel = computed(() => {
    this.i18n();
    const pending = this.pendingStatusAction();
    if (!pending) return '';
    return this.transloco.translate(`users.actions.${pending.kind}`);
  });

  protected readonly deleteConfirmText = computed(() => {
    this.i18n();
    const user = this.pendingDeleteUser();
    return user ? this.transloco.translate('users.confirm.delete', { name: userFullName(user) }) : '';
  });

  protected readonly releaseConfirmText = computed(() => {
    this.i18n();
    const user = this.pendingReleaseUser();
    return user ? this.transloco.translate('users.confirm.releaseSeats', { name: userFullName(user) }) : '';
  });

  private loadSeq = 0;
  private prevCompanyFilter: string | null = null;
  private prevBranchFilter: string | null = null;
  private prevDepartmentFilter: string | null = null;
  private prevCriteriaSignature: string | null = null;
  private handledDeepLinkKey = '';
  private appliedUrlFilterKey = '';
  private lastClickedUserId: string | null = null;
  private lastShiftKey = false;
  private deleteConfirmResolver: ((confirmed: boolean) => void) | null = null;
  private releaseConfirmResolver: ((confirmed: boolean) => void) | null = null;

  constructor() {
    if (!this.session.me()) {
      void this.session.load();
    }
    void this.loadLookups();
    void this.loadSeatModules();

    effect(() => {
      const state = this.pageSelectionState();
      const input = this.pageCheckboxEl()?.nativeElement.querySelector(
        'input[type="checkbox"]',
      ) as HTMLInputElement | null;
      if (input) {
        input.indeterminate = state === 'some';
      }
    });

    effect(() => {
      const btn = this.importBtn()?.nativeElement;
      if (!btn) return;
      const toolbar = this.host.nativeElement.querySelector<HTMLElement>('app-staff-list > div');
      const searchBox = toolbar?.querySelector<HTMLInputElement>('input')?.parentElement;
      if (toolbar && searchBox && btn.parentElement !== toolbar) {
        toolbar.insertBefore(btn, searchBox);
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

      const criteriaSignature = `${search}|${sort}|${status ?? ''}|${seat ?? ''}|${companyId ?? ''}|${branchId ?? ''}|${departmentId ?? ''}|${teamId ?? ''}`;
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

      const me = this.session.me();
      if (!me) return;

      const openId = params.get('open');
      const rawTab = params.get('tab');
      const tab: UserModalTab = VALID_TABS.includes(rawTab as UserModalTab)
        ? (rawTab as UserModalTab)
        : 'profile';
      const isNew = params.get('new') === '1';
      if (!openId && !isNew) return;

      const key = `${openId ?? ''}|${tab}|${isNew ? '1' : ''}|${urlFilterKey}`;
      if (key === this.handledDeepLinkKey) return;
      this.handledDeepLinkKey = key;

      untracked(() => {
        if (openId) {
          void this.openUserById(openId, tab);
          this.clearQueryParams(['open', 'tab', 'new']);
        } else if (isNew) {
          if (this.canInvite()) {
            const vals = this.filterValues();
            const targetTeamId = teamId ?? vals['teamId'] ?? null;
            const targetDeptId = departmentId ?? vals['departmentId'] ?? null;
            const targetBranchId = branchId ?? vals['branchId'] ?? null;
            const targetCompanyId = companyId ?? vals['companyId'] ?? null;
            const resolved = this.resolveParentIds({
              companyId: targetCompanyId,
              branchId: targetBranchId,
              departmentId: targetDeptId,
              teamId: targetTeamId,
            });
            this.inviteModal().open({
              companyId: resolved.companyId,
              branchId: resolved.branchId,
              departmentId: resolved.departmentId,
              teamId: targetTeamId,
            });
          }
          this.clearQueryParams(['new']);
        }
      });
    });
  }

  protected reload(): void {
    void this.loadLookups();
    if (!this.seatModulesLoaded) {
      void this.loadSeatModules();
    }
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

  protected openImport(): void {
    if (!this.canInvite()) return;
    this.importModal().open();
  }

  protected openBulkRole(): void {
    if (!this.canAssignRoles() || this.selectedIds().size === 0) return;
    this.bulkRoleModal().open(this.selectedUserIds());
  }

  protected isRowSelected(userId: string): boolean {
    return this.selectedIds().has(userId);
  }

  protected toggleSelectPage(cb?: Checkbox): void {
    const visible = this.rows();
    if (visible.length === 0) {
      cb?.checked.set(false);
      return;
    }
    const selectAll = this.pageSelectionState() !== 'all';
    this.selectedIds.update((current) => {
      const next = new Set(current);
      for (const user of visible) {
        if (selectAll) next.add(user.id);
        else next.delete(user.id);
      }
      return next;
    });
    cb?.checked.set(this.pageSelectionState() === 'all');
  }

  protected onRowCheckboxClick(event: MouseEvent): void {
    this.lastShiftKey = event.shiftKey;
    event.stopPropagation();
  }

  protected onRowCheckedChange(user: TenantUser, cb?: Checkbox): void {
    const shift = this.lastShiftKey;
    this.lastShiftKey = false;
    this.applyRowSelection(user, shift);
    cb?.checked.set(this.isRowSelected(user.id));
  }

  protected onSelectCellClick(event: MouseEvent, user: TenantUser, cb?: Checkbox): void {
    event.stopPropagation();
    this.applyRowSelection(user, event.shiftKey);
    cb?.checked.set(this.isRowSelected(user.id));
  }

  protected clearSelection(): void {
    this.selectedIds.set(new Set());
    this.lastClickedUserId = null;
  }

  protected onBulkRoleAssigned(): void {
    this.clearSelection();
    this.reload();
  }

  protected onUsersImported(): void {
    this.reload();
  }

  protected settleDeleteConfirm(confirmed: boolean): void {
    const resolve = this.deleteConfirmResolver;
    this.deleteConfirmResolver = null;
    if (resolve) {
      this.deleteDialog().close();
    }
    resolve?.(confirmed);
  }

  protected onDeleteDialogClosed(): void {
    const resolve = this.deleteConfirmResolver;
    this.deleteConfirmResolver = null;
    resolve?.(false);
  }

  protected settleReleaseConfirm(confirmed: boolean): void {
    const resolve = this.releaseConfirmResolver;
    this.releaseConfirmResolver = null;
    if (resolve) {
      this.releaseDialog().close();
    }
    resolve?.(confirmed);
  }

  protected onReleaseDialogClosed(): void {
    const resolve = this.releaseConfirmResolver;
    this.releaseConfirmResolver = null;
    resolve?.(false);
  }

  protected openUser(user: TenantUser, tab: UserModalTab = 'profile'): void {
    this.userModal().open(user, tab);
  }

  protected onUserInvited(created: TenantUser): void {
    this.knownUsers.update((list) => [created, ...list.filter((u) => u.id !== created.id)]);
    this.reload();
    this.userModal().open(created, 'profile');
  }

  protected onUserUpdated(updated: TenantUser): void {
    this.rows.update((list) => list.map((u) => (u.id === updated.id ? updated : u)));
    this.knownUsers.update((list) => list.map((u) => (u.id === updated.id ? updated : u)));
    this.reload();
  }

  protected rowActionsFor(user: TenantUser): ActionItem[] {
    this.i18n();
    const t = (key: string) => this.transloco.translate(key);
    const editReason = this.protectionReason(user, 'users.user.update');
    const editDisabled = Boolean(editReason);

    return [
      {
        id: 'open',
        title: t('users.actions.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
      {
        id: 'edit',
        title: t('users.actions.edit'),
        icon: 'tablerEdit',
        tile: editDisabled ? 'bg-icon-gray' : 'bg-icon-orange',
        disabled: editDisabled,
        ...(editReason ? { reason: editReason } : {}),
      },
      ...this.buildStatusActions(user),
    ];
  }

  protected onRowAction(user: TenantUser, selection: ActionSelection): void {
    switch (selection.id) {
      case 'open':
      case 'edit':
        this.openUser(user, 'profile');
        break;
      default:
        void this.handleStatusAction(user, selection.id);
        break;
    }
  }

  protected onModalStatusAction(event: { user: TenantUser; actionId: string }): void {
    void this.handleStatusAction(event.user, event.actionId);
  }

  private buildStatusActions(user: TenantUser): ActionItem[] {
    this.i18n();
    const t = (key: string) => this.transloco.translate(key);
    const busy = this.busyIds().has(user.id);
    const items: ActionItem[] = [];

    const addItem = (
      id: string,
      titleKey: string,
      icon: string,
      activeTile: string,
      permission: string,
      danger = false,
    ) => {
      const permReason = this.protectionReason(user, permission);
      const disabled = busy || Boolean(permReason);
      items.push({
        id,
        title: t(titleKey),
        icon,
        tile: disabled ? 'bg-icon-gray' : activeTile,
        disabled,
        ...(permReason ? { reason: permReason } : {}),
        ...(danger ? { danger: true } : {}),
      });
    };

    if (user.status === 'INVITED') {
      addItem('resend', 'users.actions.resend', 'tablerSend', 'bg-icon-teal', 'users.user.invite');
      addItem('revoke', 'users.actions.revoke', 'tablerCircleOff', 'bg-icon-orange', 'users.user.deactivate');
    } else if (user.status === 'ACTIVE') {
      addItem('suspend', 'users.actions.suspend', 'tablerCircleOff', 'bg-icon-orange', 'users.user.deactivate');
    } else if (user.status === 'SUSPENDED') {
      addItem('activate', 'users.actions.activate', 'tablerCheck', 'bg-icon-green', 'users.user.deactivate');
      if (user.seats.length > 0) {
        addItem(
          'releaseSeats',
          'users.actions.releaseSeats',
          'tablerArmchair',
          'bg-icon-orange',
          'users.user.assign_roles',
        );
      }
    }

    addItem(
      'revokeSessions',
      'users.actions.revokeSessions',
      'tablerLock',
      'bg-icon-navy',
      'users.user.deactivate',
    );
    addItem('delete', 'users.actions.delete', 'tablerTrash', 'bg-icon-red', 'users.user.delete', true);

    return items;
  }

  private protectionReason(user: TenantUser, permission: string): string | null {
    if (user.isTenantOwner) return this.transloco.translate('staff.protected.owner');
    if (this.isSelf(user)) return this.transloco.translate('staff.protected.self');
    if (!this.session.can(permission, { companyId: user.companyId, branchId: user.branchId })) {
      return this.transloco.translate('staff.protected.scope');
    }
    return null;
  }

  private async handleStatusAction(user: TenantUser, actionId: string): Promise<void> {
    if (this.busyIds().has(user.id)) return;

    if (actionId === 'resend') {
      if (this.protectionReason(user, 'users.user.invite')) return;
      await this.executeResend(user);
      return;
    }

    if (actionId === 'revoke' || actionId === 'suspend' || actionId === 'activate' || actionId === 'revokeSessions') {
      if (this.protectionReason(user, 'users.user.deactivate')) return;
      this.pendingStatusAction.set({ kind: actionId, user });
      const confirmed = await this.statusConfirm().open();
      this.pendingStatusAction.set(null);
      if (!confirmed) return;
      await this.executeStatusChange(actionId, user);
      return;
    }

    if (actionId === 'releaseSeats') {
      if (this.protectionReason(user, 'users.user.assign_roles')) return;
      this.pendingReleaseUser.set(user);
      const confirmed = await this.openReleaseConfirm();
      this.pendingReleaseUser.set(null);
      if (!confirmed) return;
      await this.executeReleaseSeats(user);
      return;
    }

    if (actionId === 'delete') {
      if (this.protectionReason(user, 'users.user.delete')) return;
      this.pendingDeleteUser.set(user);
      const confirmed = await this.openDeleteConfirm();
      this.pendingDeleteUser.set(null);
      if (!confirmed) return;
      await this.executeDelete(user);
    }
  }

  private async executeResend(user: TenantUser): Promise<void> {
    this.setBusy(user.id, true);
    try {
      await resendInvite(user.id, newIdempotencyKey());
      this.notify.success(this.transloco.translate('users.toast.resent'));
    } catch (error) {
      const code = errorCodeOf(error);
      if (
        code === 'COMMON.GENERIC.RATE_LIMITED' ||
        code === 'TOO_MANY_REQUESTS' ||
        (error instanceof ApiError && error.status === 429)
      ) {
        this.notify.error(this.transloco.translate('users.toast.tooMany'));
      } else {
        this.notify.error(resolveStaffError(error, this.transloco));
        this.handleNotFoundIfNeeded(error, user.id);
      }
    } finally {
      this.setBusy(user.id, false);
    }
  }

  private async executeStatusChange(kind: StatusConfirmKind, user: TenantUser): Promise<void> {
    this.setBusy(user.id, true);
    try {
      const key = newIdempotencyKey();
      let updated: TenantUser;
      let toastKey: string;

      if (kind === 'revoke') {
        updated = await suspendUser(user.id, key);
        toastKey = 'users.toast.revoked';
      } else if (kind === 'suspend') {
        updated = await suspendUser(user.id, key);
        toastKey = 'users.toast.suspended';
      } else if (kind === 'activate') {
        updated = await activateUser(user.id, key);
        toastKey = updated.status === 'INVITED' ? 'users.toast.activatedInvited' : 'users.toast.activated';
      } else {
        updated = await revokeSessions(user.id, key);
        toastKey = 'users.toast.signedOut';
      }

      this.userModal().syncUser(updated);
      this.onUserUpdated(updated);
      this.notify.success(this.transloco.translate(toastKey));
    } catch (error) {
      this.notify.error(resolveStaffError(error, this.transloco));
      this.handleNotFoundIfNeeded(error, user.id);
    } finally {
      this.setBusy(user.id, false);
    }
  }

  private async executeReleaseSeats(user: TenantUser): Promise<void> {
    this.setBusy(user.id, true);
    try {
      let plan: SeatPreview;
      try {
        plan = await releaseSeats(user.id, {}, newIdempotencyKey());
      } catch (error) {
        const cascade = isCascadeRequired(error);
        if (!cascade) throw error;
        const confirmed = await this.cascadeConfirm.confirm(cascade.addons);
        if (!confirmed) return;
        plan = await releaseSeats(user.id, { confirmAddonCascade: true }, newIdempotencyKey());
      }
      const lang = this.language();
      const releasedModules = plan.modules
        .filter((mod) => mod.losing.some((entry) => entry.userId === user.id))
        .map((mod) => {
          const key = `seats.module.${mod.moduleKey}`;
          const translated = this.transloco.translate(key);
          return translated !== key ? translated : moduleNameIn(mod.nameI18n, lang);
        });
      const sep = lang === 'ar' ? '، ' : ', ';
      const toastText =
        releasedModules.length > 0
          ? this.transloco.translate('seats.released', { modules: releasedModules.join(sep) })
          : this.transloco.translate('users.toast.seatsReleased');
      const cleared: TenantUser = { ...user, seats: [] };
      this.userModal().syncUser(cleared);
      this.notify.success(toastText);
      this.reload();
    } catch (error) {
      this.notify.error(this.resolveSeatOrStaffError(error));
      this.handleNotFoundIfNeeded(error, user.id);
    } finally {
      this.setBusy(user.id, false);
    }
  }

  private async executeDelete(user: TenantUser): Promise<void> {
    this.setBusy(user.id, true);
    try {
      try {
        await deleteUser(user.id, newIdempotencyKey());
      } catch (error) {
        const cascade = isCascadeRequired(error);
        if (!cascade) throw error;
        const confirmed = await this.cascadeConfirm.confirm(cascade.addons);
        if (!confirmed) return;
        await deleteUser(user.id, newIdempotencyKey(), { confirmAddonCascade: true });
      }
      if (this.userModal().editingId() === user.id) {
        this.userModal().closeImmediate();
      }
      this.selectedIds.update((current) => {
        if (!current.has(user.id)) return current;
        const next = new Set(current);
        next.delete(user.id);
        return next;
      });
      this.knownUsers.update((list) => list.filter((u) => u.id !== user.id));
      this.notify.success(this.transloco.translate('users.toast.deleted'));
      this.reload();
    } catch (error) {
      this.notify.error(this.resolveSeatOrStaffError(error));
      this.handleNotFoundIfNeeded(error, user.id);
    } finally {
      this.setBusy(user.id, false);
    }
  }

  private openDeleteConfirm(): Promise<boolean> {
    this.deleteConfirmResolver?.(false);
    this.deleteDialog().open();
    return new Promise<boolean>((resolve) => {
      this.deleteConfirmResolver = resolve;
    });
  }

  private openReleaseConfirm(): Promise<boolean> {
    this.releaseConfirmResolver?.(false);
    this.releaseDialog().open();
    return new Promise<boolean>((resolve) => {
      this.releaseConfirmResolver = resolve;
    });
  }

  private applyRowSelection(user: TenantUser, shiftKey: boolean): void {
    const visible = this.rows();
    if (shiftKey && this.lastClickedUserId) {
      const startIndex = visible.findIndex((u) => u.id === this.lastClickedUserId);
      const endIndex = visible.findIndex((u) => u.id === user.id);
      if (startIndex !== -1 && endIndex !== -1) {
        const from = Math.min(startIndex, endIndex);
        const to = Math.max(startIndex, endIndex);
        this.selectedIds.update((current) => {
          const next = new Set(current);
          for (const item of visible.slice(from, to + 1)) {
            next.add(item.id);
          }
          return next;
        });
        this.lastClickedUserId = user.id;
        return;
      }
    }
    this.selectedIds.update((current) => {
      const next = new Set(current);
      if (next.has(user.id)) next.delete(user.id);
      else next.add(user.id);
      return next;
    });
    this.lastClickedUserId = user.id;
  }

  private resolveSeatOrStaffError(error: unknown): string {
    return seatErrorMessage(this.transloco, error) ?? resolveStaffError(error, this.transloco);
  }

  private handleNotFoundIfNeeded(error: unknown, userId: string): void {
    const code = errorCodeOf(error);
    if (code === 'TENANT_USER_NOT_FOUND' || (error instanceof ApiError && error.status === 404)) {
      if (this.userModal().editingId() === userId) {
        this.userModal().closeImmediate();
      }
      this.reload();
    }
  }

  private async openUserById(id: string, tab: UserModalTab): Promise<void> {
    const existing = this.rows().find((u) => u.id === id) ?? this.knownUsers().find((u) => u.id === id);
    if (existing) {
      this.openUser(existing, tab);
      return;
    }
    try {
      const user = await getUser(id);
      this.openUser(user, tab);
    } catch (error) {
      this.notify.error(resolveStaffError(error, this.transloco));
    }
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
      companyId = this.branchMap().get(branchId)?.companyId ?? null;
    }

    return { companyId, branchId, departmentId };
  }

  private async fetchAllPages<T>(fetcher: (q: ListQuery) => Promise<{ data: T[]; meta: { hasNext: boolean } }>): Promise<T[]> {
    const all: T[] = [];
    let page = 1;
    while (page <= 20) {
      const res = await fetcher({ page, limit: 100 });
      all.push(...res.data);
      if (!res.meta.hasNext) break;
      page += 1;
    }
    return all;
  }

  private async loadSeatModules(): Promise<void> {
    try {
      const usage = await getSeatUsage();
      this.seatModules.set(usage.modules);
      this.seatModulesLoaded = true;
    } catch {
      // Keep filter list empty if seat usage could not be loaded yet; retried on reload.
    }
  }

  private async loadLookups(): Promise<void> {
    const [companiesRes, branchesRes, deptsRes, teamsRes, usersRes, rolesRes] = await Promise.allSettled([
      this.fetchAllPages((q) => listCompanies(q)),
      this.fetchAllPages((q) => listBranches(q)),
      this.fetchAllPages((q) => listDepartments(q)),
      this.fetchAllPages((q) => listTeams(q)),
      this.fetchAllPages((q) => listUsers(q)),
      this.fetchAllPages((q) => listRoles(q)),
    ]);

    if (companiesRes.status === 'fulfilled') this.companies.set(companiesRes.value);
    if (branchesRes.status === 'fulfilled') this.branches.set(branchesRes.value);
    if (deptsRes.status === 'fulfilled') this.departments.set(deptsRes.value);
    if (teamsRes.status === 'fulfilled') this.teams.set(teamsRes.value);
    if (usersRes.status === 'fulfilled') this.knownUsers.set(usersRes.value);
    if (rolesRes.status === 'fulfilled') this.roles.set(rolesRes.value);

    const vals = this.filterValues();
    let resolved = this.resolveParentIds({
      companyId: vals['companyId'] ?? null,
      branchId: vals['branchId'] ?? null,
      departmentId: vals['departmentId'] ?? null,
      teamId: vals['teamId'] ?? null,
    });

    if (vals['teamId'] && !resolved.departmentId) {
      try {
        const team = await getTeam(vals['teamId']);
        const dept = await getDepartment(team.departmentId);
        const branch = await getBranch(dept.branchId);
        resolved = { companyId: branch.companyId, branchId: dept.branchId, departmentId: team.departmentId };
      } catch {
        // Ignore if lookup fallback fails.
      }
    } else if (vals['departmentId'] && !resolved.branchId) {
      try {
        const dept = await getDepartment(vals['departmentId']);
        const branch = await getBranch(dept.branchId);
        resolved = { companyId: branch.companyId, branchId: dept.branchId, departmentId: vals['departmentId'] };
      } catch {
        // Ignore if lookup fallback fails.
      }
    } else if (vals['branchId'] && !resolved.companyId) {
      try {
        const branch = await getBranch(vals['branchId']);
        resolved = { ...resolved, companyId: branch.companyId };
      } catch {
        // Ignore if lookup fallback fails.
      }
    }

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
      const result = await listUsers(query);
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

  private setBusy(id: string, busy: boolean): void {
    this.busyIds.update((current) => {
      const next = new Set(current);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }
}

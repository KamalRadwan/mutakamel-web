import { Component, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAdjustmentsHorizontal,
  tablerAlertTriangle,
  tablerCloudOff,
  tablerGitBranch,
  tablerLock,
  tablerPlus,
  tablerTrash,
} from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../../shared/ui/button/button';
import { Checkbox } from '../../../../../shared/ui/checkbox/checkbox';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Segmented, SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import {
  addMembership,
  ApiError,
  errorCodeOf,
  getReportingScopes,
  listBranches,
  listDepartments,
  listMemberships,
  listTeams,
  newIdempotencyKey,
  patchReportingScopes,
  removeMembership,
  setMemberships,
} from '../../shared/staff.api';
import { OrgCascade } from '../../shared/org-cascade/org-cascade';
import {
  Branch,
  Department,
  MembershipRole,
  ReportingScopes,
  STAFF_LIMITS,
  Team,
  TeamMembership,
  TenantUser,
} from '../../shared/staff.model';

type OrgLevel = 'company' | 'branch' | 'department' | 'team';

interface CascadeValue {
  companyId: string | null;
  branchId: string | null;
  departmentId: string | null;
  teamId: string | null;
}

const EMPTY_CASCADE: CascadeValue = {
  companyId: null,
  branchId: null,
  departmentId: null,
  teamId: null,
};

const ROLE_BADGE: Record<MembershipRole, string> = {
  LEAD: 'bg-brand-soft text-on-brand-soft',
  MANAGER: 'bg-neutral-soft text-icon-violet',
  MEMBER: 'bg-neutral-soft text-text-muted',
};

const SKELETON_ROWS = [0, 1, 2] as const;

@Component({
  selector: 'app-user-teams-tab',
  imports: [
    TranslocoPipe,
    NgIcon,
    ActionsMenu,
    Button,
    Checkbox,
    ConfirmDialog,
    Field,
    Modal,
    OrgCascade,
    Segmented,
  ],
  providers: [
    provideTranslocoScope('staff', 'settings', { scope: 'staff-user-access', alias: 'access' }),
    provideIcons({
      tablerLock,
      tablerPlus,
      tablerGitBranch,
      tablerAdjustmentsHorizontal,
      tablerTrash,
      tablerAlertTriangle,
      tablerCloudOff,
    }),
  ],
  templateUrl: './user-teams-tab.html',
  host: { class: 'flex flex-col gap-12' },
})
export class UserTeamsTab {
  private static nextId = 0;
  protected readonly uid = `user-teams-tab-${++UserTeamsTab.nextId}`;

  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly addTeamModal = viewChild.required<Modal>('addTeamModal');
  private readonly changeRoleModal = viewChild.required<Modal>('changeRoleModal');
  private readonly reportingModal = viewChild.required<Modal>('reportingModal');
  private readonly conflictModal = viewChild.required<Modal>('conflictModal');
  private readonly removeTeamConfirm = viewChild.required<ConfirmDialog>('removeTeamConfirm');

  readonly user = input.required<TenantUser>();
  readonly readonly = input(false);
  readonly readonlyReason = input<string | null>(null);
  readonly changed = output<void>();

  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly roleBadge = ROLE_BADGE;
  protected readonly reportingLimit = STAFF_LIMITS.reportingBranches;

  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly memberships = signal<TeamMembership[]>([]);
  protected readonly branches = signal<Branch[]>([]);
  protected readonly departments = signal<Department[]>([]);
  protected readonly teams = signal<Team[]>([]);
  protected readonly reportingCounts = signal<Record<string, number>>({});

  protected readonly cascadeValue = signal<CascadeValue>({ ...EMPTY_CASCADE });
  protected readonly cascadeErrors = signal<Partial<Record<OrgLevel, string>>>({});
  protected readonly addRole = signal<MembershipRole>('MEMBER');
  protected readonly savingAdd = signal(false);

  protected readonly editingMembership = signal<TeamMembership | null>(null);
  protected readonly nextRole = signal<MembershipRole>('MEMBER');
  protected readonly savingRole = signal(false);

  protected readonly pendingRemoveMembership = signal<TeamMembership | null>(null);
  protected readonly removing = signal(false);

  protected readonly reportingMembership = signal<TeamMembership | null>(null);
  protected readonly reportingLoading = signal(false);
  protected readonly reportingFailed = signal(false);
  protected readonly reportingScopes = signal<ReportingScopes | null>(null);
  protected readonly pendingAddBranchIds = signal<string[]>([]);
  protected readonly pendingRemoveBranchIds = signal<string[]>([]);
  protected readonly savingReporting = signal(false);

  protected readonly gridColumns = computed(() =>
    this.readonly()
      ? 'grid-cols-staff-user-team-row'
      : 'grid-cols-staff-user-team-row-actions',
  );

  protected readonly roleOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return (['MEMBER', 'LEAD', 'MANAGER'] as const).map((role) => ({
      value: role,
      label: this.transloco.translate(`access.teams.role.${role}`),
    }));
  });

  protected readonly canManageReporting = computed(
    () => !this.readonly() && (this.reportingScopes()?.capabilities.canManage ?? false),
  );

  protected readonly visibleExistingReporting = computed(() => {
    const scopes = this.reportingScopes();
    if (!scopes) return [];
    const removed = new Set(this.pendingRemoveBranchIds());
    return scopes.items.filter((item) => item.origin === 'HOME' || !removed.has(item.branchId));
  });

  protected readonly totalReportingCount = computed(
    () => this.visibleExistingReporting().length + this.pendingAddBranchIds().length,
  );

  protected readonly atReportingLimit = computed(
    () => this.totalReportingCount() >= STAFF_LIMITS.reportingBranches,
  );

  protected readonly addableBranches = computed(() => {
    const membership = this.reportingMembership();
    const scopes = this.reportingScopes();
    if (!membership || !scopes) return [];
    const listedIds = new Set(scopes.items.map((item) => item.branchId));
    return this.branches().filter(
      (branch) =>
        branch.companyId === membership.companyId &&
        branch.status === 'ACTIVE' &&
        !listedIds.has(branch.id),
    );
  });

  protected readonly removeConfirmText = computed(() => {
    this.i18n();
    const target = this.pendingRemoveMembership();
    if (!target) return '';
    const fullName = `${this.user().firstName} ${this.user().lastName}`.trim() || this.user().email;
    return this.transloco.translate('access.teams.removeText', {
      name: fullName,
      team: this.teamName(target),
    });
  });

  private loadSeq = 0;
  private reportingSeq = 0;
  private addKeyCache: { body: string; key: string } | null = null;
  private roleKeyCache: { body: string; key: string } | null = null;
  private removeKeyCache: { id: string; key: string } | null = null;
  private reportingKeyCache: { body: string; key: string } | null = null;

  constructor() {
    effect(() => {
      const userId = this.user().id;
      void this.loadAll(userId);
    });
  }

  protected reload(): void {
    void this.loadAll(this.user().id);
  }

  protected teamName(membership: TeamMembership): string {
    return (
      membership.team?.name ??
      this.teams().find((team) => team.id === membership.teamId)?.name ??
      membership.teamId
    );
  }

  protected departmentName(departmentId: string): string {
    return this.departments().find((dept) => dept.id === departmentId)?.name ?? '';
  }

  protected branchName(branchId: string): string {
    return this.branches().find((branch) => branch.id === branchId)?.name ?? branchId;
  }

  protected hasReportingAccess(role: MembershipRole): boolean {
    return role === 'LEAD' || role === 'MANAGER';
  }

  protected reportingCount(membership: TeamMembership): number {
    return this.reportingCounts()[membership.id] ?? 1;
  }

  protected actionsFor(membership: TeamMembership): ActionItem[] {
    this.i18n();
    const items: ActionItem[] = [
      {
        id: 'changeRole',
        title: this.transloco.translate('access.teams.changeRole'),
        icon: 'tablerAdjustmentsHorizontal',
        tile: 'bg-icon-blue',
      },
    ];

    if (this.hasReportingAccess(membership.role)) {
      items.push({
        id: 'reporting',
        title: this.transloco.translate('access.teams.reporting'),
        icon: 'tablerArrowsExchange',
        tile: 'bg-icon-teal',
      });
    }

    if (!membership.isPrimary) {
      items.push({
        id: 'remove',
        title: this.transloco.translate('access.teams.remove'),
        icon: 'tablerTrash',
        tile: 'bg-icon-red',
        danger: true,
      });
    }

    return items;
  }

  protected onAction(membership: TeamMembership, selection: ActionSelection): void {
    if (this.readonly()) return;
    switch (selection.id) {
      case 'changeRole':
        this.openChangeRoleModal(membership);
        break;
      case 'reporting':
        this.openReportingModal(membership);
        break;
      case 'remove':
        void this.requestRemove(membership);
        break;
    }
  }

  protected openAddTeamModal(): void {
    if (this.readonly()) return;
    this.cascadeValue.set({ ...EMPTY_CASCADE });
    this.cascadeErrors.set({});
    this.addRole.set('MEMBER');
    this.addKeyCache = null;
    this.addTeamModal().open();
  }

  protected setAddRole(value: string | null): void {
    if (value === 'MEMBER' || value === 'LEAD' || value === 'MANAGER') {
      this.addRole.set(value);
    }
  }

  protected async saveAddTeam(): Promise<void> {
    if (this.savingAdd() || this.readonly()) return;
    const cascade = this.cascadeValue();
    const requiredMsg = this.requiredText();
    const errors: Partial<Record<OrgLevel, string>> = {};
    if (!cascade.companyId) errors.company = requiredMsg;
    if (!cascade.branchId) errors.branch = requiredMsg;
    if (!cascade.departmentId) errors.department = requiredMsg;
    if (!cascade.teamId) errors.team = requiredMsg;
    this.cascadeErrors.set(errors);
    if (Object.keys(errors).length) return;

    const payload = { teamId: cascade.teamId!, role: this.addRole() };
    const body = JSON.stringify(payload);
    const key = this.addKeyCache?.body === body ? this.addKeyCache.key : newIdempotencyKey();
    this.addKeyCache = { body, key };

    this.savingAdd.set(true);
    try {
      const userId = this.user().id;
      const memberships = await addMembership(userId, payload, key);
      this.addKeyCache = null;
      this.addTeamModal().close();
      if (this.user().id === userId) {
        this.memberships.set(memberships);
        await this.refreshReportingCounts(userId, memberships);
      }
      this.changed.emit();
      this.notify.success(this.transloco.translate('access.common.saved'));
    } catch (error) {
      this.notify.error(this.resolveError(error));
    } finally {
      this.savingAdd.set(false);
    }
  }

  protected openChangeRoleModal(membership: TeamMembership): void {
    if (this.readonly()) return;
    this.editingMembership.set(membership);
    this.nextRole.set(membership.role);
    this.roleKeyCache = null;
    this.changeRoleModal().open();
  }

  protected setNextRole(value: string | null): void {
    if (value === 'MEMBER' || value === 'LEAD' || value === 'MANAGER') {
      this.nextRole.set(value);
    }
  }

  protected async saveRoleChange(): Promise<void> {
    const target = this.editingMembership();
    if (!target || this.savingRole() || this.readonly()) return;
    const role = this.nextRole();
    if (role === target.role) {
      this.changeRoleModal().close();
      return;
    }

    const updated = this.memberships().map((item) =>
      item.id === target.id ? { ...item, role } : item,
    );
    const body = JSON.stringify(updated.map((item) => ({ id: item.id, role: item.role })));
    const key = this.roleKeyCache?.body === body ? this.roleKeyCache.key : newIdempotencyKey();
    this.roleKeyCache = { body, key };

    this.savingRole.set(true);
    try {
      await setMemberships(this.user().id, updated, key);
      this.roleKeyCache = null;
      this.changeRoleModal().close();
      await this.loadMembershipsOnly(this.user().id);
      this.changed.emit();
      this.notify.success(this.transloco.translate('access.common.saved'));
    } catch (error) {
      this.notify.error(this.resolveError(error));
    } finally {
      this.savingRole.set(false);
    }
  }

  protected async requestRemove(membership: TeamMembership): Promise<void> {
    if (this.readonly() || this.removing() || membership.isPrimary) return;
    this.pendingRemoveMembership.set(membership);
    const confirmed = await this.removeTeamConfirm().open();
    if (!confirmed) {
      this.pendingRemoveMembership.set(null);
      return;
    }

    const key =
      this.removeKeyCache?.id === membership.id ? this.removeKeyCache.key : newIdempotencyKey();
    this.removeKeyCache = { id: membership.id, key };

    this.removing.set(true);
    try {
      await removeMembership(this.user().id, membership.id, key);
      this.removeKeyCache = null;
      await this.loadMembershipsOnly(this.user().id);
      this.changed.emit();
      this.notify.success(this.transloco.translate('access.common.removed'));
    } catch (error) {
      if (errorCodeOf(error) === 'PRIMARY_TEAM_MEMBERSHIP_PROTECTED') {
        this.notify.error(this.transloco.translate('access.teams.homeProtected'));
      } else {
        this.notify.error(this.resolveError(error));
      }
    } finally {
      this.removing.set(false);
      this.pendingRemoveMembership.set(null);
    }
  }

  protected openReportingModal(membership: TeamMembership): void {
    if (!this.hasReportingAccess(membership.role)) return;
    this.reportingMembership.set(membership);
    this.reportingScopes.set(null);
    this.pendingAddBranchIds.set([]);
    this.pendingRemoveBranchIds.set([]);
    this.reportingKeyCache = null;
    this.reportingModal().open();
    void this.loadReporting(this.user().id, membership.id);
  }

  protected stageRemoveExplicit(branchId: string): void {
    if (!this.canManageReporting()) return;
    this.pendingRemoveBranchIds.update((current) =>
      current.includes(branchId) ? current : [...current, branchId],
    );
  }

  protected isPendingAdd(branchId: string): boolean {
    return this.pendingAddBranchIds().includes(branchId);
  }

  protected togglePendingAdd(branchId: string, checked: boolean): void {
    if (!this.canManageReporting()) return;
    if (checked) {
      if (this.atReportingLimit() || this.isPendingAdd(branchId)) return;
      this.pendingAddBranchIds.update((current) => [...current, branchId]);
    } else {
      this.pendingAddBranchIds.update((current) => current.filter((id) => id !== branchId));
    }
  }

  protected async saveReporting(): Promise<void> {
    const membership = this.reportingMembership();
    const scopes = this.reportingScopes();
    if (!membership || !scopes || this.savingReporting() || !this.canManageReporting()) return;

    const addBranchIds = this.pendingAddBranchIds();
    const removeBranchIds = this.pendingRemoveBranchIds();
    const patch = {
      expectedRevision: scopes.revision,
      ...(addBranchIds.length ? { addBranchIds } : {}),
      ...(removeBranchIds.length ? { removeBranchIds } : {}),
    };
    const body = JSON.stringify(patch);
    const key =
      this.reportingKeyCache?.body === body ? this.reportingKeyCache.key : newIdempotencyKey();
    this.reportingKeyCache = { body, key };

    this.savingReporting.set(true);
    try {
      const result = await patchReportingScopes(this.user().id, membership.id, patch, key);
      this.reportingKeyCache = null;
      await this.loadReporting(this.user().id, membership.id);
      if (result.outcome === 'NO_CHANGE') {
        this.notify.info(this.transloco.translate('access.rep.noChange'));
      } else {
        this.changed.emit();
        this.notify.success(this.transloco.translate('access.common.saved'));
      }
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'TEAM_REPORTING_SCOPE_REVISION_CONFLICT') {
        this.conflictModal().open();
      } else if (code === 'TEAM_REPORTING_SCOPE_CHANGE_CONFLICT') {
        this.notify.warning(this.transloco.translate('access.rep.retry'));
      } else {
        this.notify.error(this.resolveError(error));
      }
    } finally {
      this.savingReporting.set(false);
    }
  }

  protected async reloadReportingAfterConflict(): Promise<void> {
    const membership = this.reportingMembership();
    this.conflictModal().close();
    if (!membership) return;
    await this.loadReporting(this.user().id, membership.id);
  }

  protected reloadCurrentReporting(): void {
    const membership = this.reportingMembership();
    if (!membership) return;
    void this.loadReporting(this.user().id, membership.id);
  }

  private async fetchAllPages<T>(
    fetcher: (q: { page: number; limit: number }) => Promise<{ data: T[]; meta: { hasNext: boolean } }>,
  ): Promise<T[]> {
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

  private async loadAll(userId: string): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    try {
      const [memberships, branches, depts, teams] = await Promise.all([
        listMemberships(userId),
        this.fetchAllPages((q) => listBranches(q)),
        this.fetchAllPages((q) => listDepartments(q)),
        this.fetchAllPages((q) => listTeams(q)),
      ]);
      if (seq !== this.loadSeq) return;
      this.memberships.set(memberships);
      this.branches.set(branches);
      this.departments.set(depts);
      this.teams.set(teams);
      void this.refreshReportingCounts(userId, memberships);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.loadFailed.set(true);
      this.notify.error(this.resolveError(error));
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private async loadMembershipsOnly(userId: string): Promise<void> {
    const memberships = await listMemberships(userId);
    if (this.user().id !== userId) return;
    this.memberships.set(memberships);
    await this.refreshReportingCounts(userId, memberships);
  }

  private async refreshReportingCounts(userId: string, list: TeamMembership[]): Promise<void> {
    const targets = list.filter((item) => this.hasReportingAccess(item.role));
    if (!targets.length) {
      this.reportingCounts.set({});
      return;
    }
    const entries = await Promise.all(
      targets.map(async (item) => {
        try {
          const scopes = await getReportingScopes(userId, item.id);
          return [item.id, scopes.items.length] as const;
        } catch {
          return [item.id, 1] as const;
        }
      }),
    );
    if (this.user().id !== userId) return;
    const map: Record<string, number> = {};
    for (const [id, count] of entries) {
      map[id] = count;
    }
    this.reportingCounts.set(map);
  }

  private async loadReporting(userId: string, membershipId: string): Promise<void> {
    const seq = ++this.reportingSeq;
    this.reportingLoading.set(true);
    this.reportingFailed.set(false);
    try {
      const scopes = await getReportingScopes(userId, membershipId);
      if (seq !== this.reportingSeq) return;
      this.reportingScopes.set(scopes);
      this.pendingAddBranchIds.set([]);
      this.pendingRemoveBranchIds.set([]);
      this.reportingCounts.update((current) => ({
        ...current,
        [membershipId]: scopes.items.length,
      }));
    } catch (error) {
      if (seq !== this.reportingSeq) return;
      this.reportingFailed.set(true);
      this.notify.error(this.resolveError(error));
    } finally {
      if (seq === this.reportingSeq) {
        this.reportingLoading.set(false);
      }
    }
  }

  private requiredText(): string {
    const settingsReq = this.transloco.translate('settings.common.required');
    if (settingsReq !== 'settings.common.required') return settingsReq;
    return this.transloco.translate('staff.common.required');
  }

  private resolveError(error: unknown): string {
    const code = errorCodeOf(error);
    const details = error instanceof ApiError ? error.details : undefined;
    if (code) {
      const accessKey = `access.errors.${code}`;
      const accessMsg = this.transloco.translate(accessKey, details);
      if (accessMsg && accessMsg !== accessKey) return accessMsg;

      const staffKey = `staff.errors.${code}`;
      const staffMsg = this.transloco.translate(staffKey, details);
      if (staffMsg && staffMsg !== staffKey) return staffMsg;
    }
    const settingsGeneric = this.transloco.translate('settings.errors.generic');
    if (settingsGeneric !== 'settings.errors.generic') return settingsGeneric;
    const staffGeneric = this.transloco.translate('staff.errors.generic');
    return staffGeneric !== 'staff.errors.generic'
      ? staffGeneric
      : this.transloco.translate('access.common.loadFailed');
  }
}

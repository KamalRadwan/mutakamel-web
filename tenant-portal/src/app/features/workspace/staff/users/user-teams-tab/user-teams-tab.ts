import { Component, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { fieldErrorsOf } from '../../../../../core/api/api-errors';
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
import { ApiError, errorCodeOf, listAllPages, newIdempotencyKey, staffErrorMessage } from '../../shared/staff.api';
import { StaffUserAccessApi } from '../user-access.api';
import { OrganizationReadApi } from '../../shared/organization-read.api';
import { ConflictDialog } from '../../../../../shared/ui/conflict-dialog/conflict-dialog';
import { OrgCascade } from '../../shared/org-cascade/org-cascade';
import { StaffSession } from '../../shared/staff-session';
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
    ConflictDialog,
    Field,
    Modal,
    OrgCascade,
    Segmented,
  ],
  viewProviders: [provideTranslocoScope('staff', 'settings', { scope: 'staff-user-access', alias: 'access' }, { scope: 'record-page', alias: 'recordPage' })],
  providers: [
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
  private readonly session = inject(StaffSession);
  private readonly api = inject(StaffUserAccessApi);
  private readonly organization = inject(OrganizationReadApi);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly addTeamModal = viewChild.required<Modal>('addTeamModal');
  private readonly changeRoleModal = viewChild.required<Modal>('changeRoleModal');
  private readonly reportingModal = viewChild.required<Modal>('reportingModal');
  protected readonly conflictOpen = signal(false);
  private readonly removeTeamConfirm = viewChild.required<ConfirmDialog>('removeTeamConfirm');

  readonly user = input.required<TenantUser>();
  readonly readonly = input(false);
  readonly readonlyReason = input<string | null>(null);
  readonly changed = output<void>();

  protected readonly effectiveReadonly = computed(() => this.readonly() || this.session.me()?.id === this.user().id || this.user().isTenantOwner);
  protected readonly effectiveReadonlyReason = computed(() => {
    this.i18n();
    if (this.session.me()?.id === this.user().id) return this.transloco.translate('staff.protected.self');
    if (this.user().isTenantOwner) return this.transloco.translate('staff.protected.owner');
    return this.readonlyReason();
  });

  protected readonly validationErrors = signal<Record<string, string[]>>({});
  protected fieldError(field: string): string | null {
    const messages = Object.entries(this.validationErrors())
      .filter(([path]) => path === field || path.startsWith(field + '.'))
      .flatMap(([, messages]) => messages);
    return messages.length ? messages.join(' ') : null;
  }

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
    this.effectiveReadonly()
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
    () => this.canManageMembership(this.reportingMembership()) &&
      (this.reportingScopes()?.capabilities.canManage ?? false),
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
  private actionUserId: string | null = null;
  private reportingSeq = 0;
  private addKeyCache: { bodyJson: string; key: string } | null = null;
  private roleKeyCache: { bodyJson: string; key: string } | null = null;
  private removeKeyCache: { id: string; key: string } | null = null;
  private reportingKeyCache: { bodyJson: string; key: string } | null = null;

  constructor() {
    effect(() => {
      const userId = this.user().id;
      if (this.actionUserId !== userId) {
        this.actionUserId = userId;
        this.addKeyCache = null;
        this.roleKeyCache = null;
        this.removeKeyCache = null;
        this.reportingKeyCache = null;
        this.validationErrors.set({});
      }
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
    const items: ActionItem[] = this.canManageMembership(membership) && this.canReplaceMemberships() ? [
      {
        id: 'changeRole',
        title: this.transloco.translate('access.teams.changeRole'),
        icon: 'tablerAdjustmentsHorizontal',
        tile: 'bg-icon-blue',
      },
    ] : [];

    if (this.hasReportingAccess(membership.role)) {
      items.push({
        id: 'reporting',
        title: this.transloco.translate('access.teams.reporting'),
        icon: 'tablerArrowsExchange',
        tile: 'bg-icon-teal',
      });
    }

    if (!membership.isPrimary && this.canManageMembership(membership)) {
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
    if (this.effectiveReadonly()) return;
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
    if (this.effectiveReadonly()) return;
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
    if (this.savingAdd() || this.effectiveReadonly()) return;
    const cascade = this.cascadeValue();
    const requiredMsg = this.requiredText();
    const errors: Partial<Record<OrgLevel, string>> = {};
    if (!cascade.companyId) errors.company = requiredMsg;
    if (!cascade.branchId) errors.branch = requiredMsg;
    if (!cascade.departmentId) errors.department = requiredMsg;
    if (!cascade.teamId) errors.team = requiredMsg;
    this.cascadeErrors.set(errors);
    if (Object.keys(errors).length) return;
    if (this.memberships().length >= 500) {
      await this.handleWriteError(new ApiError(422, 'TEAM_MEMBERSHIP_LIMIT_EXCEEDED'));
      return;
    }
    if (!this.canManageMembership(cascade)) return;

    const payload = { teamId: cascade.teamId!, role: this.addRole() };
    const bodyJson = JSON.stringify(payload);
    const key = this.addKeyCache?.bodyJson === bodyJson ? this.addKeyCache.key : newIdempotencyKey();
    this.addKeyCache = { bodyJson, key };

    this.validationErrors.set({});
    this.savingAdd.set(true);
    try {
      const userId = this.user().id;
      const memberships = await this.api.addMembership(userId, payload, key);
      this.addKeyCache = null;
      this.addTeamModal().close();
      if (this.user().id === userId) {
        this.memberships.set(memberships);
        await this.refreshReportingCounts(userId, memberships);
      }
      this.changed.emit();
      this.notify.success(this.transloco.translate('access.common.saved'));
    } catch (error) {
      await this.handleWriteError(error);
    } finally {
      this.savingAdd.set(false);
    }
  }

  protected openChangeRoleModal(membership: TeamMembership): void {
    if (!this.canManageMembership(membership) || !this.canReplaceMemberships()) return;
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
    const targetId = this.editingMembership()?.id;
    const current = this.memberships().find(({ id }) => id === targetId);
    if (!current || this.savingRole() ||
        !this.canManageMembership(current) || !this.canReplaceMemberships()) return;
    if (this.memberships().length > 500) {
      await this.handleWriteError(new ApiError(422, 'TEAM_MEMBERSHIP_LIMIT_EXCEEDED'));
      return;
    }
    const role = this.nextRole();
    if (role === current.role) {
      this.changeRoleModal().close();
      return;
    }

    const updated = this.memberships().map((item) => ({
      teamId: item.teamId, role: item.id === current.id ? role : item.role, isPrimary: item.isPrimary,
    }));
    const bodyJson = JSON.stringify(updated);
    const key = this.roleKeyCache?.bodyJson === bodyJson ? this.roleKeyCache.key : newIdempotencyKey();
    this.roleKeyCache = { bodyJson, key };

    this.validationErrors.set({});
    this.savingRole.set(true);
    try {
      await this.api.setMemberships(this.user().id, updated, key);
      this.roleKeyCache = null;
      this.changeRoleModal().close();
      await this.loadMembershipsOnly(this.user().id);
      this.changed.emit();
      this.notify.success(this.transloco.translate('access.common.saved'));
    } catch (error) {
      await this.handleWriteError(error);
    } finally {
      this.savingRole.set(false);
    }
  }

  protected async requestRemove(membership: TeamMembership): Promise<void> {
    if (!this.canManageMembership(membership) || this.removing() || membership.isPrimary) return;
    this.pendingRemoveMembership.set(membership);
    const confirmed = await this.removeTeamConfirm().open();
    const current = this.memberships().find(({ id }) => id === membership.id);
    if (!confirmed || !current || current.isPrimary || !this.canManageMembership(current)) {
      this.pendingRemoveMembership.set(null);
      return;
    }

    const key =
      this.removeKeyCache?.id === membership.id ? this.removeKeyCache.key : newIdempotencyKey();
    this.removeKeyCache = { id: membership.id, key };

    this.removing.set(true);
    try {
      await this.api.removeMembership(this.user().id, membership.id, key);
      this.removeKeyCache = null;
      await this.loadMembershipsOnly(this.user().id);
      this.changed.emit();
      this.notify.success(this.transloco.translate('access.common.removed'));
    } catch (error) {
      if (errorCodeOf(error) === 'PRIMARY_TEAM_MEMBERSHIP_PROTECTED') {
        this.notify.error(this.transloco.translate('access.teams.homeProtected'));
      } else {
        await this.handleWriteError(error);
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
    if (!this.canManageReporting() || !this.reportingScopes()?.items.some((item) => item.branchId === branchId && item.capabilities.canRemove && item.origin !== 'HOME')) return;
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
    if ([...addBranchIds, ...removeBranchIds].some((branchId) =>
      !this.session.can('users.user.manage_memberships', { branchId }),
    )) return;
    const patch = {
      expectedRevision: scopes.revision,
      ...(addBranchIds.length ? { addBranchIds } : {}),
      ...(removeBranchIds.length ? { removeBranchIds } : {}),
    };
    const bodyJson = JSON.stringify(patch);
    const key =
      this.reportingKeyCache?.bodyJson === bodyJson ? this.reportingKeyCache.key : newIdempotencyKey();
    this.reportingKeyCache = { bodyJson, key };

    this.validationErrors.set({});
    this.savingReporting.set(true);
    try {
      const result = await this.api.patchReportingScopes(this.user().id, membership.id, patch, key);
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
      if (code === 'TEAM_REPORTING_SCOPE_REVISION_CONFLICT' || code === 'TEAM_REPORTING_SCOPE_CHANGE_CONFLICT') {
        this.conflictOpen.set(true);
      } else if (code === 'TEAM_REPORTING_SCOPE_REVIEW_REQUIRED') {
        this.notify.warning(this.resolveError(error, true));
      } else {
        await this.handleWriteError(error);
      }
    } finally {
      this.savingReporting.set(false);
    }
  }

  protected async reloadReportingAfterConflict(): Promise<void> {
    this.pendingAddBranchIds.set([]);
    this.pendingRemoveBranchIds.set([]);
    const membership = this.reportingMembership();
    this.conflictOpen.set(false);
    this.reportingKeyCache = null;
    if (!membership) return;
    await this.loadReporting(this.user().id, membership.id);
  }

  protected reloadCurrentReporting(): void {
    const membership = this.reportingMembership();
    if (!membership) return;
    void this.loadReporting(this.user().id, membership.id);
  }

  protected async keepReportingAfterConflict(): Promise<void> {
    const membership = this.reportingMembership();
    this.conflictOpen.set(false);
    this.reportingKeyCache = null;
    if (membership) await this.loadReporting(this.user().id, membership.id, true);
  }

  private async loadAll(userId: string): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    try {
      const [memberships, branches, depts, teams] = await Promise.all([
        this.api.listMemberships(userId),
        listAllPages((q) => this.organization.listBranches(q)),
        listAllPages((q) => this.organization.listDepartments(q)),
        listAllPages((q) => this.organization.listTeams(q)),
      ]);
      if (seq !== this.loadSeq) return;
      this.memberships.set(memberships);
      this.branches.set(branches);
      this.departments.set(depts);
      this.teams.set(teams);
      void this.refreshReportingCounts(userId, memberships);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.loadFailed.set(!(error instanceof ApiError && error.status === 0 && this.memberships().length));
      if (!(error instanceof ApiError && error.status === 0)) this.notify.error(this.resolveError(error));
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private async loadMembershipsOnly(userId: string): Promise<void> {
    const memberships = await this.api.listMemberships(userId);
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
          const scopes = await this.api.getReportingScopes(userId, item.id);
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

  private async loadReporting(userId: string, membershipId: string, keepChanges = false): Promise<void> {
    const seq = ++this.reportingSeq;
    this.reportingLoading.set(true);
    this.reportingFailed.set(false);
    try {
      const scopes = await this.api.getReportingScopes(userId, membershipId);
      if (seq !== this.reportingSeq || this.user().id !== userId || this.reportingMembership()?.id !== membershipId) return;
      this.reportingScopes.set(scopes);
      if (!keepChanges) {
        this.pendingAddBranchIds.set([]);
        this.pendingRemoveBranchIds.set([]);
      }
      this.memberships.update((rows) => rows.map((row) => row.id === membershipId ? { ...row, reportingScopeRevision: scopes.revision } : row));
      this.reportingCounts.update((current) => ({
        ...current,
        [membershipId]: scopes.items.length,
      }));
    } catch (error) {
      if (seq !== this.reportingSeq || this.user().id !== userId || this.reportingMembership()?.id !== membershipId) return;
      this.reportingFailed.set(!(error instanceof ApiError && error.status === 0 && this.reportingScopes()));
      if (!(error instanceof ApiError && error.status === 0)) this.notify.error(this.resolveError(error));
    } finally {
      if (seq === this.reportingSeq) {
        this.reportingLoading.set(false);
      }
    }
  }

  private canManageMembership(target: Pick<CascadeValue, 'companyId' | 'branchId'> | null): boolean {
    return !this.effectiveReadonly() && !!target?.branchId &&
      this.session.can('users.user.manage_memberships', target);
  }

  private canReplaceMemberships(): boolean {
    return this.session.isTenantWide('users.user.manage_memberships') &&
      this.memberships().every((membership) => this.canManageMembership(membership));
  }

  private requiredText(): string {
    const settingsReq = this.transloco.translate('settings.common.required');
    if (settingsReq !== 'settings.common.required') return settingsReq;
    return this.transloco.translate('staff.common.required');
  }

  private async handleWriteError(error: unknown): Promise<void> {
    const fields = fieldErrorsOf(error);
    if (Object.keys(fields).length) {
      const cascade: Partial<Record<OrgLevel, string>> = {};
      for (const level of ['company', 'branch', 'department', 'team'] as const) {
        const messages = fields[level + 'Id'];
        if (messages?.length) cascade[level] = messages.join(' ');
      }
      this.cascadeErrors.set(cascade);
    }
    this.validationErrors.set(fields);
    if (Object.keys(fields).length) {
      if (fields['_']?.length) this.notify.error(fields['_'].join(' '));
      return;
    }
    const code = errorCodeOf(error);
    if (code === 'GW.IDEM.IN_FLIGHT') this.notify.info(this.resolveError(error, true));
    else if (code === 'GW.IDEM.MISMATCH' || code === 'TEAM_REPORTING_SCOPE_IDEMPOTENCY_CONFLICT') {
      const messageError = code === 'TEAM_REPORTING_SCOPE_IDEMPOTENCY_CONFLICT'
        ? new ApiError(422, 'GW.IDEM.MISMATCH') : error;
      this.notify.warning(this.resolveError(messageError, true));
      this.addKeyCache = this.roleKeyCache = this.reportingKeyCache = null;
      this.removeKeyCache = null;
      const membership = this.reportingMembership();
      await this.loadAll(this.user().id);
      if (membership) await this.loadReporting(this.user().id, membership.id);
    } else if (!(error instanceof ApiError && error.status === 0)) this.notify.error(this.resolveError(error, true));
    if (code === 'TENANT_USER_NOT_FOUND') this.changed.emit();
  }

  private resolveError(error: unknown, write = false): string {
    return staffErrorMessage(error, 'access', this.transloco, write ? 'write' : 'read');
  }
}

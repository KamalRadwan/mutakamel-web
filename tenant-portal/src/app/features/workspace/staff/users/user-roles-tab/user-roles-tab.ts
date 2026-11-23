import { Component, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { pluralKey } from '../../../../../core/i18n/plural';
import { fieldErrorsOf } from '../../../../../core/api/api-errors';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCloudOff, tablerLock, tablerPlus, tablerTrash } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Checkbox } from '../../../../../shared/ui/checkbox/checkbox';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Segmented, SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import {
  ApiError,
  errorCodeOf,
  listAllPages,
  newIdempotencyKey,
  staffErrorMessage,
} from '../../shared/staff.api';
import { StaffUserAccessApi } from '../user-access.api';
import { OrganizationReadApi } from '../../shared/organization-read.api';
import { RolesApi } from '../../roles/roles.api';
import { SeatCascadeConfirm } from '../../../seats/cascade-confirm/cascade-confirm';
import { isCascadeRequired, seatErrorMessage } from '../../../seats/seat-errors';
import { SeatImpact } from '../../../seats/seat-impact/seat-impact';
import { SeatChange } from '../../../seats/seats.model';
import { StaffSession } from '../../shared/staff-session';
import {
  AssignmentOptions,
  Branch,
  BranchRoleAssignment,
  Company,
  I18n,
  Role,
  ScopeRoleAssignment,
  ScopeTarget,
  TenantUser,
} from '../../shared/staff.model';

type AssignmentChoice = AssignmentOptions['choices'][number];

const EXCLUDED_ROLE_NAME = 'Tenant Super Admin';
const SKELETON_ROWS = [0, 1, 2] as const;

function choiceKey(choice: Pick<AssignmentChoice, 'branchId' | 'roleId'>): string {
  return `${choice.branchId}:${choice.roleId}`;
}

function isExcludedRoleName(name: string, nameI18n?: I18n): boolean {
  return name === EXCLUDED_ROLE_NAME || nameI18n?.en === EXCLUDED_ROLE_NAME;
}

/** 422 SCOPE_ROLE_ASSIGNMENT_INVALID details { indexes: ['1', '2'] }: the request indexes as numbers. */
export function scopeAssignmentInvalidIndexes(error: unknown): number[] {
  const raw = error instanceof ApiError ? error.details?.['indexes'] : undefined;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((idx): idx is string => typeof idx === 'string' && /^\d+$/.test(idx))
    .map(Number);
}

@Component({
  selector: 'app-user-roles-tab',
  imports: [TranslocoPipe, NgIcon, Button, Checkbox, Dropdown, Field, Modal, SeatImpact, Segmented],
  viewProviders: [
    provideTranslocoScope(
      'staff',
      'settings',
      { scope: 'staff-user-access', alias: 'access' },
      { scope: 'seats', alias: 'seats' },
    ),
  ],
  providers: [provideIcons({ tablerCloudOff, tablerLock, tablerPlus, tablerTrash })],
  templateUrl: './user-roles-tab.html',
  host: { class: 'flex flex-col gap-16' },
})
export class UserRolesTab {
  private static nextId = 0;
  protected readonly uid = `user-roles-tab-${++UserRolesTab.nextId}`;

  private readonly session = inject(StaffSession);
  private readonly api = inject(StaffUserAccessApi);
  private readonly organization = inject(OrganizationReadApi);
  private readonly rolesApi = inject(RolesApi);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;
  private readonly cascadeConfirm = inject(SeatCascadeConfirm);

  private readonly addBranchModal = viewChild.required<Modal>('addBranchModal');
  private readonly removeBranchConfirm = viewChild.required<Modal>('removeBranchConfirm');
  private readonly addScopeModal = viewChild.required<Modal>('addScopeModal');

  readonly user = input.required<TenantUser>();
  readonly readonly = input(false);
  readonly readonlyReason = input<string | null>(null);
  readonly changed = output<void>();

  protected readonly validationErrors = signal<Record<string, string[]>>({});
  protected fieldError(field: string): string | null {
    const messages = Object.entries(this.validationErrors())
      .filter(([path]) => path === field || path.startsWith(field + '.'))
      .flatMap(([, messages]) => messages);
    return messages.length ? messages.join(' ') : null;
  }

  protected readonly skeletonRows = SKELETON_ROWS;

  protected readonly loadingBranch = signal(false);
  protected readonly branchLoadFailed = signal(false);
  protected readonly branchRoles = signal<BranchRoleAssignment[]>([]);
  protected readonly removingBranchId = signal<string | null>(null);
  protected readonly pendingRemoveBranch = signal<BranchRoleAssignment | null>(null);

  protected readonly loadingScope = signal(false);
  protected readonly scopeLoadFailed = signal(false);
  protected readonly scopeRoles = signal<ScopeRoleAssignment[]>([]);
  protected readonly savingScope = signal(false);
  protected readonly invalidScopeIndexes = signal<number[]>([]);

  protected readonly branches = signal<Branch[]>([]);
  protected readonly companies = signal<Company[]>([]);
  protected readonly roles = signal<Role[]>([]);
  protected readonly extraBranchLabels = signal<Record<string, string>>({});
  protected readonly extraCompanyLabels = signal<Record<string, string>>({});
  protected readonly extraRoleLabels = signal<Record<string, { name: string; nameI18n?: I18n }>>({});

  protected readonly choiceSearch = signal('');
  protected readonly choices = signal<AssignmentChoice[]>([]);
  protected readonly choicesHasMore = signal(false);
  protected readonly loadingChoices = signal(false);
  protected readonly choicesLoadFailed = signal(false);
  protected readonly loadingMoreChoices = signal(false);
  protected readonly selectedChoices = signal<AssignmentChoice[]>([]);
  protected readonly addBranchSeatBlocked = signal(false);
  protected readonly savingBranchAdd = signal(false);

  protected readonly scopeModalOpen = signal(false);
  protected readonly scopeTarget = signal<ScopeTarget>('TENANT');
  protected readonly scopeCompanyId = signal('');
  protected readonly scopeBranchId = signal('');
  protected readonly scopeRoleId = signal('');
  protected readonly scopeSeatBlocked = signal(false);

  protected readonly addBranchSeatChanges = computed<SeatChange[] | null>(() => {
    const selected = this.selectedChoices();
    if (!selected.length) return null;
    return [
      {
        kind: 'ADD_BRANCH_ROLES',
        userId: this.user().id,
        items: selected.map((item) => ({ branchId: item.branchId, roleId: item.roleId })),
      },
    ];
  });

  protected readonly removeBranchSeatChanges = computed<SeatChange[] | null>(() => {
    const row = this.pendingRemoveBranch();
    if (!row) return null;
    return [{ kind: 'REMOVE_BRANCH_ROLE', userId: this.user().id, assignmentId: row.id }];
  });

  protected readonly draftScopeAssignments = computed(() => {
    if (!this.scopeModalOpen()) return null;
    const roleId = this.scopeRoleId();
    if (!roleId) return null;
    const target = this.scopeTarget();
    const companyId = target === 'COMPANY' || target === 'BRANCH' ? this.scopeCompanyId() : undefined;
    const branchId = target === 'BRANCH' ? this.scopeBranchId() : undefined;
    if (target === 'COMPANY' && !companyId) return null;
    if (target === 'BRANCH' && (!companyId || !branchId)) return null;
    return [
      ...this.scopeRoles().map((item) => ({
        scopeTarget: item.scopeTarget,
        roleId: item.roleId,
        ...(item.companyId ? { companyId: item.companyId } : {}),
        ...(item.branchId ? { branchId: item.branchId } : {}),
      })),
      {
        scopeTarget: target,
        roleId,
        ...(companyId ? { companyId } : {}),
        ...(branchId ? { branchId } : {}),
      },
    ];
  });

  protected readonly scopeSeatChanges = computed<SeatChange[] | null>(() => {
    const assignments = this.draftScopeAssignments();
    if (!assignments) return null;
    return [{ kind: 'SET_SCOPE_ROLES', userId: this.user().id, assignments }];
  });

  protected readonly isOwnerActor = computed(() => this.session.isOwner());
  protected readonly isSelf = computed(() => this.session.me()?.id === this.user().id);
  protected readonly hasAssignRoles = computed(
    () => this.session.can('users.user.assign_roles', {
      companyId: this.user().companyId,
      branchId: this.user().branchId,
    }),
  );
  protected readonly canViewBranchRoles = computed(() => !this.isSelf() && this.hasAssignRoles());
  protected readonly isRolesLocked = computed(
    () => this.user().status !== 'ACTIVE' && this.user().status !== 'INVITED',
  );
  protected readonly effectiveReadonly = computed(
    () =>
      this.readonly() ||
      this.user().isTenantOwner ||
      this.isSelf() ||
      this.isRolesLocked() ||
      !this.hasAssignRoles(),
  );
  protected readonly effectiveReadonlyReason = computed(() => {
    this.i18n();
    const external = this.readonlyReason();
    if (external) return external;
    if (this.user().isTenantOwner) return this.transloco.translate('access.roles.ownerReadonly');
    if (this.isSelf()) return this.transloco.translate('access.roles.selfReadonly');
    if (!this.hasAssignRoles()) return this.transloco.translate('staff.protected.scope');
    if (this.isRolesLocked()) return this.transloco.translate('access.roles.suspendedReadonly');
    return null;
  });

  protected readonly branchGridColumns = computed(() =>
    this.effectiveReadonly()
      ? 'grid-cols-staff-user-branch-row'
      : 'grid-cols-staff-user-branch-row-actions',
  );

  protected readonly scopeGridColumns = computed(() =>
    this.effectiveReadonly()
      ? 'grid-cols-staff-user-scope-row'
      : 'grid-cols-staff-user-scope-row-actions',
  );

  protected readonly scopeTargetOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return (['TENANT', 'COMPANY', 'BRANCH'] as const).map((target) => ({
      value: target,
      label: this.transloco.translate(`access.roles.scopeTarget.${target}`),
    }));
  });

  protected readonly companyOptions = computed<DropdownOption<string>[]>(() =>
    this.companies()
      .filter((company) => company.status === 'ACTIVE')
      .map((company) => ({ value: company.id, label: company.name })),
  );

  protected readonly scopeBranchOptions = computed<DropdownOption<string>[]>(() => {
    const companyId = this.scopeCompanyId();
    return this.branches()
      .filter((branch) => branch.status === 'ACTIVE' && (!companyId || branch.companyId === companyId))
      .map((branch) => ({ value: branch.id, label: branch.name }));
  });

  protected readonly scopeRoleOptions = computed<DropdownOption<string>[]>(() => {
    const lang = this.language();
    const roles = this.roles();
    const options = roles.length ? roles : Object.entries(this.extraRoleLabels()).map(([id, role]) => ({ id, ...role }));
    return options
      .filter((role) => !isExcludedRoleName(role.name, role.nameI18n))
      .map((role) => ({
        value: role.id,
        label: role.nameI18n?.[lang] || role.name,
      }));
  });

  protected readonly canSaveScopeModal = computed(() => {
    if (this.savingScope() || this.scopeSeatBlocked() || !this.scopeRoleId()) return false;
    const target = this.scopeTarget();
    const roleId = this.scopeRoleId();
    const companyId = this.scopeCompanyId();
    const branchId = this.scopeBranchId();
    if (target === 'COMPANY' && !companyId) return false;
    if (target === 'BRANCH' && (!companyId || !branchId)) return false;
    const duplicate = this.scopeRoles().some(
      (item) =>
        item.scopeTarget === target &&
        item.roleId === roleId &&
        (target !== 'COMPANY' || item.companyId === companyId) &&
        (target !== 'BRANCH' || (item.companyId === companyId && item.branchId === branchId)),
    );
    return !duplicate;
  });

  protected readonly removeBranchRoleName = computed(() => {
    const row = this.pendingRemoveBranch();
    return row ? this.roleLabel(row.roleId) : '';
  });

  protected readonly removeBranchName = computed(() => {
    const row = this.pendingRemoveBranch();
    return row ? this.branchName(row.branchId) : '';
  });

  private loadSeq = 0;
  private actionUserId: string | null = null;
  private scopeSeq = 0;
  private loadedScopeKey: string | null = null;
  private choicesSeq = 0;
  private choicesPage = 1;
  private addKeyCache: { bodyJson: string; key: string; confirmAddonCascade?: boolean } | null = null;
  private removeKeyCache: { id: string; key: string; confirmAddonCascade?: boolean } | null = null;
  private scopeKeyCache: { bodyJson: string; key: string; confirmAddonCascade?: boolean } | null = null;
  private removeBranchConfirmResolver: ((confirmed: boolean) => void) | null = null;

  constructor() {
    effect(() => {
      const userId = this.user().id;
      if (this.actionUserId !== userId) {
        this.actionUserId = userId;
        this.addKeyCache = null;
        this.removeKeyCache = null;
        this.scopeKeyCache = null;
        this.validationErrors.set({});
      }
      this.invalidScopeIndexes.set([]);
      this.loadedScopeKey = null;
      void this.loadAll(userId);
    });

    effect(() => {
      const u = this.user();
      const key = `${u.id}:${u.status}`;
      if (!this.isSelf() && this.isOwnerActor() && !this.isRolesLocked() && this.loadedScopeKey !== key) {
        void this.loadScope(u.id);
      }
    });
  }

  protected reloadBranch(): void {
    void this.loadBranch(this.user().id);
  }

  protected reloadScope(): void {
    void this.loadScope(this.user().id);
  }

  protected branchName(branchId: string | null): string {
    if (!branchId) return '';
    return (
      this.branches().find((branch) => branch.id === branchId)?.name ??
      this.extraBranchLabels()[branchId] ??
      branchId
    );
  }

  protected companyOfBranch(branchId: string): string {
    const branch = this.branches().find((item) => item.id === branchId);
    if (!branch) return '';
    return this.companyName(branch.companyId);
  }

  protected companyName(companyId: string | null): string {
    if (!companyId) return '';
    return (
      this.companies().find((company) => company.id === companyId)?.name ??
      this.extraCompanyLabels()[companyId] ??
      companyId
    );
  }

  protected roleRecord(roleId: string): Role | undefined {
    return this.roles().find((role) => role.id === roleId);
  }

  protected roleLabel(roleId: string): string {
    const lang = this.language();
    const role = this.roleRecord(roleId);
    if (role) return role.nameI18n[lang] || role.name;
    const extra = this.extraRoleLabels()[roleId];
    if (extra) return extra.nameI18n?.[lang] || extra.name;
    return roleId;
  }

  protected choiceRoleLabel(choice: AssignmentChoice): string {
    return choice.roleNameI18n[this.language()] || choice.roleName;
  }

  protected scopeDescription(row: ScopeRoleAssignment): string {
    this.i18n();
    if (row.scopeTarget === 'COMPANY') {
      return this.transloco.translate('access.roles.scope.COMPANY', { name: this.companyName(row.companyId) });
    }
    if (row.scopeTarget === 'BRANCH') {
      return this.transloco.translate('access.roles.scope.BRANCH', { name: this.branchName(row.branchId) });
    }
    return this.transloco.translate('access.roles.scope.TENANT');
  }

  protected isInvalidScopeRow(index: number): boolean {
    return this.invalidScopeIndexes().includes(index);
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

  protected openAddBranchModal(): void {
    if (this.effectiveReadonly()) return;
    this.choiceSearch.set('');
    this.selectedChoices.set([]);
    this.addBranchSeatBlocked.set(false);
    this.addKeyCache = null;
    this.choicesPage = 1;
    this.addBranchModal().open();
    void this.fetchChoices(true);
  }

  protected onAddBranchModalClosed(): void {
    this.selectedChoices.set([]);
    this.addBranchSeatBlocked.set(false);
  }

  protected onChoiceSearchInput(event: Event): void {
    this.choiceSearch.set((event.target as HTMLInputElement).value);
    this.choicesPage = 1;
    void this.fetchChoices(true);
  }

  protected loadMoreChoices(): void {
    if (this.loadingMoreChoices() || !this.choicesHasMore()) return;
    this.choicesPage += 1;
    void this.fetchChoices(false);
  }

  protected retryChoices(): void {
    this.choicesPage = 1;
    void this.fetchChoices(true);
  }

  protected choiceId(choice: AssignmentChoice): string {
    return choiceKey(choice);
  }

  protected isChoiceSelected(choice: AssignmentChoice): boolean {
    const id = choiceKey(choice);
    return this.selectedChoices().some((item) => choiceKey(item) === id);
  }

  protected toggleChoice(choice: AssignmentChoice, checked: boolean): void {
    if (checked && (this.effectiveReadonly() ||
        !this.session.can('users.user.assign_roles', { branchId: choice.branchId }))) return;
    const id = choiceKey(choice);
    this.selectedChoices.update((current) => {
      if (checked) {
        if (current.some((item) => choiceKey(item) === id)) return current;
        return [...current, choice];
      }
      return current.filter((item) => choiceKey(item) !== id);
    });
    if (!this.selectedChoices().length) {
      this.addBranchSeatBlocked.set(false);
    }
  }

  protected async saveBranchChoices(): Promise<void> {
    if (this.savingBranchAdd() || this.addBranchSeatBlocked() || this.effectiveReadonly() || this.loadingBranch() || this.branchLoadFailed()) return;
    const userId = this.user().id;
    const queue = this.selectedChoices().slice();
    if (!queue.length || queue.some((choice) => !this.session.can('users.user.assign_roles', { branchId: choice.branchId }))) return;
    const assignments = [...this.branchRoles(), ...queue].map(({ branchId, roleId }) => ({ branchId, roleId }));
    if (assignments.length > 500) {
      this.notify.error(this.resolveError(new ApiError(422, 'TENANT_ROLE_ASSIGNMENT_LIMIT_EXCEEDED')));
      return;
    }
    const bodyJson = JSON.stringify(assignments);
    if (this.addKeyCache?.bodyJson !== bodyJson) this.addKeyCache = { bodyJson, key: newIdempotencyKey() };

    this.validationErrors.set({});
    this.savingBranchAdd.set(true);
    try {
      try {
        await this.api.setBranchRoles(userId, assignments, this.addKeyCache.key, this.addKeyCache);
      } catch (error) {
        const cascade = isCascadeRequired(error);
        if (!cascade) throw error;
        if (!await this.cascadeConfirm.confirm(cascade.addons) || this.effectiveReadonly() || this.user().id !== userId) return;
        this.addKeyCache = { bodyJson, key: newIdempotencyKey(), confirmAddonCascade: true };
        await this.api.setBranchRoles(userId, assignments, this.addKeyCache.key, this.addKeyCache);
      }
      this.addKeyCache = null;
      this.addBranchModal().close();
      await this.loadBranch(this.user().id);
      this.changed.emit();
      const addedCount = queue.length;
      this.notify.success(this.transloco.translate(pluralKey('access.roles.addedPlural', addedCount, this.language()), { n: addedCount }));
    } catch (error) {
      await this.handleWriteError(error);
    } finally {
      this.savingBranchAdd.set(false);
    }
  }

  protected settleRemoveBranchConfirm(confirmed: boolean): void {
    const resolve = this.removeBranchConfirmResolver;
    this.removeBranchConfirmResolver = null;
    if (resolve) {
      this.removeBranchConfirm().close();
    }
    resolve?.(confirmed);
  }

  protected onRemoveBranchConfirmClosed(): void {
    const resolve = this.removeBranchConfirmResolver;
    this.removeBranchConfirmResolver = null;
    resolve?.(false);
  }

  private openRemoveBranchConfirm(): Promise<boolean> {
    this.removeBranchConfirmResolver?.(false);
    this.removeBranchConfirm().open();
    return new Promise<boolean>((resolve) => {
      this.removeBranchConfirmResolver = resolve;
    });
  }

  protected async requestRemoveBranch(row: BranchRoleAssignment): Promise<void> {
    const userId = this.user().id;
    const allowed = () => this.user().id === userId && !this.effectiveReadonly() &&
      this.session.can('users.user.assign_roles', { branchId: row.branchId });
    if (!allowed() || this.removingBranchId()) return;
    this.pendingRemoveBranch.set(row);
    const confirmed = await this.openRemoveBranchConfirm();
    if (!confirmed || !allowed()) {
      this.pendingRemoveBranch.set(null);
      return;
    }

    const key =
      this.removeKeyCache?.id === row.id ? this.removeKeyCache.key : newIdempotencyKey();
    if (this.removeKeyCache?.id !== row.id) this.removeKeyCache = { id: row.id, key };
    this.removingBranchId.set(row.id);
    try {
      try {
        await this.api.removeBranchRole(this.user().id, row.id, key, this.removeKeyCache);
      } catch (error) {
        const cascade = isCascadeRequired(error);
        if (!cascade) throw error;
        const cascadeConfirmed = await this.cascadeConfirm.confirm(cascade.addons);
        if (!cascadeConfirmed || !allowed()) return;
        this.removeKeyCache = { id: row.id, key: newIdempotencyKey(), confirmAddonCascade: true };
        await this.api.removeBranchRole(this.user().id, row.id, this.removeKeyCache.key, this.removeKeyCache);
      }
      this.removeKeyCache = null;
      await this.loadBranch(this.user().id);
      this.changed.emit();
      this.notify.success(this.transloco.translate('access.common.removed'));
    } catch (error) {
      await this.handleWriteError(error);
    } finally {
      this.removingBranchId.set(null);
      this.pendingRemoveBranch.set(null);
    }
  }

  protected openAddScopeModal(): void {
    if (this.effectiveReadonly() || !this.isOwnerActor() || this.loadingScope() || this.scopeLoadFailed()) return;
    this.scopeTarget.set('TENANT');
    const firstCompanyId = this.companies().find((c) => c.status === 'ACTIVE')?.id ?? '';
    this.scopeCompanyId.set(firstCompanyId);
    const firstBranchId =
      this.branches().find((branch) => branch.status === 'ACTIVE' && branch.companyId === firstCompanyId)?.id ?? '';
    this.scopeBranchId.set(firstBranchId);
    this.scopeRoleId.set(this.scopeRoleOptions()[0]?.value ?? '');
    this.scopeSeatBlocked.set(false);
    this.scopeModalOpen.set(true);
    this.addScopeModal().open();
  }

  protected onScopeModalClosed(): void {
    this.scopeModalOpen.set(false);
    this.scopeSeatBlocked.set(false);
  }

  protected onScopeTargetChange(value: string | null): void {
    if (value !== 'TENANT' && value !== 'COMPANY' && value !== 'BRANCH') return;
    this.scopeTarget.set(value);
    if ((value === 'COMPANY' || value === 'BRANCH') && !this.scopeCompanyId()) {
      this.scopeCompanyId.set(this.companies().find((c) => c.status === 'ACTIVE')?.id ?? '');
    }
    if (value === 'BRANCH') {
      const firstBranch = this.branches().find(
        (branch) => branch.status === 'ACTIVE' && branch.companyId === this.scopeCompanyId(),
      );
      this.scopeBranchId.set(firstBranch?.id ?? '');
    }
  }

  protected onScopeCompanyChange(companyId: string): void {
    this.scopeCompanyId.set(companyId);
    const firstBranch = this.branches().find(
      (branch) => branch.status === 'ACTIVE' && branch.companyId === companyId,
    );
    this.scopeBranchId.set(firstBranch?.id ?? '');
  }

  protected async saveScopeModal(): Promise<void> {
    if (!this.canSaveScopeModal() || this.effectiveReadonly() || !this.isOwnerActor()) return;
    const target = this.scopeTarget();
    const roleId = this.scopeRoleId();
    const companyId = target === 'COMPANY' || target === 'BRANCH' ? this.scopeCompanyId() : undefined;
    const branchId = target === 'BRANCH' ? this.scopeBranchId() : undefined;

    const payload = [
      ...this.scopeRoles().map((item) => ({
        scopeTarget: item.scopeTarget,
        roleId: item.roleId,
        ...(item.companyId ? { companyId: item.companyId } : {}),
        ...(item.branchId ? { branchId: item.branchId } : {}),
      })),
      {
        scopeTarget: target,
        roleId,
        ...(companyId ? { companyId } : {}),
        ...(branchId ? { branchId } : {}),
      },
    ];

    const applied = await this.commitScopeRoles(payload);
    if (applied) {
      this.addScopeModal().close();
      this.notify.success(this.transloco.translate('access.common.saved'));
    }
  }

  protected async removeScopeAssignment(index: number): Promise<void> {
    if (this.savingScope() || this.effectiveReadonly() || !this.isOwnerActor()) return;
    const payload = this.scopeRoles()
      .filter((_, idx) => idx !== index)
      .map((item) => ({
        scopeTarget: item.scopeTarget,
        roleId: item.roleId,
        ...(item.companyId ? { companyId: item.companyId } : {}),
        ...(item.branchId ? { branchId: item.branchId } : {}),
      }));

    const applied = await this.commitScopeRoles(payload);
    if (applied) {
      this.notify.success(this.transloco.translate('access.common.removed'));
    }
  }

  private async commitScopeRoles(
    assignments: { scopeTarget: ScopeTarget; roleId: string; companyId?: string; branchId?: string }[],
  ): Promise<boolean> {
    if (this.effectiveReadonly() || !this.isOwnerActor() || this.loadingScope() || this.scopeLoadFailed()) return false;
    const userId = this.user().id;
    if (assignments.length > 500) {
      this.notify.error(this.resolveError(new ApiError(422, 'SCOPE_ROLE_ASSIGNMENT_LIMIT_EXCEEDED')));
      return false;
    }
    const bodyJson = JSON.stringify(assignments);
    if (this.scopeKeyCache?.bodyJson !== bodyJson) this.scopeKeyCache = { bodyJson, key: newIdempotencyKey() };
    this.validationErrors.set({});
    this.savingScope.set(true);
    this.invalidScopeIndexes.set([]);
    try {
      try {
        await this.api.setScopeRoles(userId, assignments, this.scopeKeyCache.key, this.scopeKeyCache);
      } catch (error) {
        const cascade = isCascadeRequired(error);
        if (!cascade) throw error;
        if (!await this.cascadeConfirm.confirm(cascade.addons) || this.effectiveReadonly() || !this.isOwnerActor() || this.user().id !== userId) return false;
        this.scopeKeyCache = { bodyJson, key: newIdempotencyKey(), confirmAddonCascade: true };
        await this.api.setScopeRoles(userId, assignments, this.scopeKeyCache.key, this.scopeKeyCache);
      }
      this.scopeKeyCache = null;
      await this.loadScope(this.user().id);
      this.changed.emit();
      return true;
    } catch (error) {
      if (errorCodeOf(error) === 'SCOPE_ROLE_ASSIGNMENT_INVALID') {
        this.invalidScopeIndexes.set(scopeAssignmentInvalidIndexes(error));
      }
      await this.handleWriteError(error);
      return false;
    } finally {
      this.savingScope.set(false);
    }
  }

  private async loadAll(userId: string): Promise<void> {
    const seq = ++this.loadSeq;
    if (!this.session.me()) {
      try { await this.session.load(); } catch { return; }
      if (seq !== this.loadSeq) return;
    }
    if (this.isSelf()) {
      this.branchRoles.set([]);
      this.scopeRoles.set([]);
      return;
    }
    await Promise.all([
      this.loadBranch(userId),
      this.loadScope(userId),
      listAllPages((q) => this.organization.listBranches(q)).then((rows) => {
        if (seq === this.loadSeq) this.branches.set(rows);
      }).catch(() => {}),
      listAllPages((q) => this.organization.listCompanies(q)).then((rows) => {
        if (seq === this.loadSeq) this.companies.set(rows);
      }).catch(() => {}),
      this.isOwnerActor() ? listAllPages((q) => this.rolesApi.list(q)).then((rows) => {
        if (seq === this.loadSeq) this.roles.set(rows);
      }).catch(() => {
        if (seq === this.loadSeq) this.roles.set([]);
      }) : Promise.resolve(),
    ]);
    // Labels remain available when the actor cannot read the organization or role catalogues.
    if (seq === this.loadSeq && this.canViewBranchRoles()) await this.fetchChoices(true);
  }

  private async loadBranch(userId: string): Promise<void> {
    if (!this.canViewBranchRoles()) {
      this.branchRoles.set([]);
      this.loadingBranch.set(false);
      this.branchLoadFailed.set(false);
      return;
    }
    this.loadingBranch.set(true);
    this.branchLoadFailed.set(false);
    try {
      const rows = await this.api.listBranchRoles(userId);
      if (this.user().id !== userId) return;
      this.branchRoles.set(rows);
    } catch (error) {
      if (this.user().id !== userId) return;
      this.branchLoadFailed.set(!(error instanceof ApiError && error.status === 0 && this.branchRoles().length));
      if (!(error instanceof ApiError && error.status === 0)) this.notify.error(this.resolveError(error));
    } finally {
      if (this.user().id === userId) {
        this.loadingBranch.set(false);
      }
    }
  }

  private async loadScope(userId: string): Promise<void> {
    if (this.isSelf() || !this.isOwnerActor() || this.isRolesLocked()) {
      this.scopeRoles.set([]);
      this.loadingScope.set(false);
      this.scopeLoadFailed.set(false);
      return;
    }
    const seq = ++this.scopeSeq;
    this.loadedScopeKey = `${userId}:${this.user().status}`;
    this.loadingScope.set(true);
    this.scopeLoadFailed.set(false);
    try {
      const rows = await this.api.listScopeRoles(userId);
      if (seq !== this.scopeSeq || this.user().id !== userId) return;
      this.scopeRoles.set(rows);
    } catch (error) {
      if (seq !== this.scopeSeq || this.user().id !== userId) return;
      this.scopeLoadFailed.set(!(error instanceof ApiError && error.status === 0 && this.scopeRoles().length));
      if (!(error instanceof ApiError && error.status === 0)) this.notify.error(this.resolveError(error));
    } finally {
      if (seq === this.scopeSeq && this.user().id === userId) {
        this.loadingScope.set(false);
      }
    }
  }

  private async fetchChoices(reset: boolean): Promise<void> {
    if (!this.canViewBranchRoles()) return;
    const seq = ++this.choicesSeq;
    this.choicesLoadFailed.set(false);
    if (reset) {
      this.loadingChoices.set(true);
    } else {
      this.loadingMoreChoices.set(true);
    }
    try {
      const search = this.choiceSearch().trim().slice(0, 200);
      const result = await this.api.listAssignmentOptions(this.user().id, {
        page: this.choicesPage,
        limit: 20,
        ...(search ? { search } : {}),
      });
      if (seq !== this.choicesSeq) return;
      this.mergeOptionLabels(result.labels);
      const heldKeys = new Set(this.branchRoles().map((row) => `${row.branchId}:${row.roleId}`));
      const filtered = result.choices.filter(
        (choice) =>
          !this.effectiveReadonly() &&
          this.session.can('users.user.assign_roles', { branchId: choice.branchId }) &&
          !isExcludedRoleName(choice.roleName, choice.roleNameI18n) &&
          !heldKeys.has(choiceKey(choice)),
      );
      this.choices.update((current) => (reset ? filtered : [...current, ...filtered]));
      this.choicesHasMore.set(result.hasMore);
    } catch (error) {
      if (seq === this.choicesSeq) {
        if (!reset) this.choicesPage -= 1;
        this.choicesLoadFailed.set(!(error instanceof ApiError && error.status === 0 && this.choices().length));
        if (!(error instanceof ApiError && error.status === 0)) this.notify.error(this.resolveError(error));
      }
    } finally {
      if (seq === this.choicesSeq) {
        this.loadingChoices.set(false);
        this.loadingMoreChoices.set(false);
      }
    }
  }

  private mergeOptionLabels(labels: AssignmentOptions['labels']): void {
    if (!labels?.length) return;
    const branchUpdates: Record<string, string> = {};
    const companyUpdates: Record<string, string> = {};
    const roleUpdates: Record<string, { name: string; nameI18n?: I18n }> = {};
    for (const entry of labels) {
      if (entry.kind === 'branch') branchUpdates[entry.id] = entry.name;
      else if (entry.kind === 'company') companyUpdates[entry.id] = entry.name;
      else if (entry.kind === 'role') roleUpdates[entry.id] = { name: entry.name, nameI18n: entry.nameI18n };
    }
    if (Object.keys(branchUpdates).length) {
      this.extraBranchLabels.update((cur) => ({ ...cur, ...branchUpdates }));
    }
    if (Object.keys(companyUpdates).length) {
      this.extraCompanyLabels.update((cur) => ({ ...cur, ...companyUpdates }));
    }
    if (Object.keys(roleUpdates).length) {
      this.extraRoleLabels.update((cur) => ({ ...cur, ...roleUpdates }));
    }
  }

  private async handleWriteError(error: unknown): Promise<void> {
    const fields = fieldErrorsOf(error);
    this.validationErrors.set(fields);
    if (Object.keys(fields).length) {
      if (fields['_']?.length) this.notify.error(fields['_'].join(' '));
      return;
    }
    const code = errorCodeOf(error);
    if (code === 'GW.IDEM.IN_FLIGHT') this.notify.info(this.resolveError(error, true));
    else if (code === 'GW.IDEM.MISMATCH') this.notify.warning(this.resolveError(error, true));
    else if (!(error instanceof ApiError && error.status === 0)) this.notify.error(this.resolveError(error, true));
    if (code === 'TENANT_USER_NOT_FOUND') this.changed.emit();
    if (code === 'BRANCH_OR_ROLE_INVALID') {
      this.choicesPage = 1;
      await this.fetchChoices(true);
    }
    if (code === 'ASSIGNMENT_EXISTS' || code === 'ASSIGNMENT_NOT_FOUND') await this.loadBranch(this.user().id);
    if (code === 'GW.IDEM.MISMATCH') {
      this.addKeyCache = null;
      this.removeKeyCache = null;
      this.scopeKeyCache = null;
      await Promise.all([this.loadBranch(this.user().id), this.loadScope(this.user().id)]);
    }
  }

  private resolveError(error: unknown, write = false): string {
    return seatErrorMessage(this.transloco, error) ??
      staffErrorMessage(error, 'access', this.transloco, write ? 'write' : 'read');
  }
}

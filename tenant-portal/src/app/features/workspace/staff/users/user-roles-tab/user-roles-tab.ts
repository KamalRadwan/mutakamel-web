import { Component, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { pluralKey } from '../../../../../core/i18n/plural';
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
  addBranchRole,
  ApiError,
  errorCodeOf,
  listAssignmentOptions,
  listBranches,
  listBranchRoles,
  listCompanies,
  listRoles,
  listScopeRoles,
  newIdempotencyKey,
  removeBranchRole,
  setScopeRoles,
} from '../../shared/staff.api';
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
  providers: [
    provideTranslocoScope(
      'staff',
      'settings',
      { scope: 'staff-user-access', alias: 'access' },
      { scope: 'seats', alias: 'seats' },
    ),
    provideIcons({ tablerCloudOff, tablerLock, tablerPlus, tablerTrash }),
  ],
  templateUrl: './user-roles-tab.html',
  host: { class: 'flex flex-col gap-16' },
})
export class UserRolesTab {
  private static nextId = 0;
  protected readonly uid = `user-roles-tab-${++UserRolesTab.nextId}`;

  private readonly session = inject(StaffSession);
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
    () => this.isOwnerActor() || this.session.can('users.user.assign_roles'),
  );
  protected readonly canViewBranchRoles = computed(() => !this.isSelf() && this.hasAssignRoles());
  protected readonly isNotActive = computed(() => this.user().status !== 'ACTIVE');
  protected readonly effectiveReadonly = computed(
    () =>
      this.readonly() ||
      this.user().isTenantOwner ||
      this.isSelf() ||
      this.isNotActive() ||
      !this.hasAssignRoles(),
  );
  protected readonly effectiveReadonlyReason = computed(() => {
    this.i18n();
    const external = this.readonlyReason();
    if (external) return external;
    if (this.user().isTenantOwner) return this.transloco.translate('access.roles.ownerReadonly');
    if (this.isSelf()) return this.transloco.translate('access.roles.selfReadonly');
    if (!this.hasAssignRoles()) return this.transloco.translate('staff.protected.scope');
    if (this.isNotActive()) return this.transloco.translate('access.roles.notActiveReadonly');
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
    return this.roles()
      .filter((role) => !isExcludedRoleName(role.name, role.nameI18n))
      .map((role) => ({
        value: role.id,
        label: role.nameI18n[lang] || role.name,
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
  private scopeSeq = 0;
  private loadedScopeKey: string | null = null;
  private choicesSeq = 0;
  private choicesPage = 1;
  private addKeys = new Map<string, string>();
  private removeKeyCache: { id: string; key: string } | null = null;
  private scopeKeyCache: { body: string; key: string } | null = null;
  private removeBranchConfirmResolver: ((confirmed: boolean) => void) | null = null;

  constructor() {
    effect(() => {
      const userId = this.user().id;
      this.invalidScopeIndexes.set([]);
      this.loadedScopeKey = null;
      void this.loadAll(userId);
    });

    effect(() => {
      const u = this.user();
      const key = `${u.id}:${u.status}`;
      if (this.isOwnerActor() && u.status === 'ACTIVE' && this.loadedScopeKey !== key) {
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
    this.addKeys.clear();
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

  protected choiceId(choice: AssignmentChoice): string {
    return choiceKey(choice);
  }

  protected isChoiceSelected(choice: AssignmentChoice): boolean {
    const id = choiceKey(choice);
    return this.selectedChoices().some((item) => choiceKey(item) === id);
  }

  protected toggleChoice(choice: AssignmentChoice, checked: boolean): void {
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
    if (this.savingBranchAdd() || this.addBranchSeatBlocked() || this.effectiveReadonly()) return;
    const queue = this.selectedChoices().slice();
    if (!queue.length) return;

    this.savingBranchAdd.set(true);
    let addedCount = 0;
    const succeededKeys = new Set<string>();

    try {
      for (const choice of queue) {
        const keyId = choiceKey(choice);
        const idempotencyKey = this.addKeys.get(keyId) ?? newIdempotencyKey();
        this.addKeys.set(keyId, idempotencyKey);
        await addBranchRole(
          this.user().id,
          { branchId: choice.branchId, roleId: choice.roleId },
          idempotencyKey,
        );
        this.addKeys.delete(keyId);
        succeededKeys.add(keyId);
        addedCount += 1;
      }

      this.addBranchModal().close();
      await this.loadBranch(this.user().id);
      this.changed.emit();
      this.notify.success(this.transloco.translate(pluralKey('access.roles.addedPlural', addedCount, this.language()), { n: addedCount }));
    } catch (error) {
      if (addedCount > 0) {
        this.selectedChoices.update((current) => current.filter((item) => !succeededKeys.has(choiceKey(item))));
        await this.loadBranch(this.user().id);
        this.changed.emit();
        this.notify.warning(this.transloco.translate('access.roles.partial', { n: addedCount }));
      }
      this.notify.error(this.resolveError(error));
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
    if (this.effectiveReadonly() || this.removingBranchId()) return;
    this.pendingRemoveBranch.set(row);
    const confirmed = await this.openRemoveBranchConfirm();
    if (!confirmed) {
      this.pendingRemoveBranch.set(null);
      return;
    }

    const key =
      this.removeKeyCache?.id === row.id ? this.removeKeyCache.key : newIdempotencyKey();
    this.removeKeyCache = { id: row.id, key };
    this.removingBranchId.set(row.id);
    try {
      try {
        await removeBranchRole(this.user().id, row.id, key);
      } catch (error) {
        const cascade = isCascadeRequired(error);
        if (!cascade) throw error;
        const cascadeConfirmed = await this.cascadeConfirm.confirm(cascade.addons);
        if (!cascadeConfirmed) return;
        await (
          removeBranchRole as (
            userId: string,
            assignmentId: string,
            idemKey: string,
            opts?: { confirmAddonCascade?: boolean },
          ) => Promise<void>
        )(this.user().id, row.id, newIdempotencyKey(), { confirmAddonCascade: true });
      }
      this.removeKeyCache = null;
      await this.loadBranch(this.user().id);
      this.changed.emit();
      this.notify.success(this.transloco.translate('access.common.removed'));
    } catch (error) {
      this.notify.error(this.resolveError(error));
    } finally {
      this.removingBranchId.set(null);
      this.pendingRemoveBranch.set(null);
    }
  }

  protected openAddScopeModal(): void {
    if (this.effectiveReadonly() || !this.isOwnerActor() || this.user().status !== 'ACTIVE') return;
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
    confirmAddonCascade = false,
  ): Promise<boolean> {
    const body = JSON.stringify(assignments);
    const key = confirmAddonCascade
      ? newIdempotencyKey()
      : this.scopeKeyCache?.body === body
        ? this.scopeKeyCache.key
        : newIdempotencyKey();
    if (!confirmAddonCascade) {
      this.scopeKeyCache = { body, key };
    }
    this.savingScope.set(true);
    this.invalidScopeIndexes.set([]);
    try {
      if (confirmAddonCascade) {
        await (
          setScopeRoles as (
            userId: string,
            payload: typeof assignments,
            idemKey: string,
            opts?: { confirmAddonCascade?: boolean },
          ) => Promise<ScopeRoleAssignment[]>
        )(this.user().id, assignments, key, { confirmAddonCascade: true });
      } else {
        await setScopeRoles(this.user().id, assignments, key);
      }
      this.scopeKeyCache = null;
      await this.loadScope(this.user().id);
      this.changed.emit();
      return true;
    } catch (error) {
      const cascade = isCascadeRequired(error);
      if (cascade && !confirmAddonCascade) {
        this.savingScope.set(false);
        const confirmed = await this.cascadeConfirm.confirm(cascade.addons);
        if (confirmed) {
          return this.commitScopeRoles(assignments, true);
        }
        return false;
      }
      if (error instanceof ApiError && error.code === 'SCOPE_ROLE_ASSIGNMENT_INVALID') {
        this.invalidScopeIndexes.set(scopeAssignmentInvalidIndexes(error));
      }
      this.notify.error(this.resolveError(error));
      return false;
    } finally {
      this.savingScope.set(false);
    }
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
    const canFetchBranch = !this.isSelf() && this.hasAssignRoles();
    this.loadingBranch.set(canFetchBranch);
    this.branchLoadFailed.set(false);
    if (!this.session.me()) {
      try {
        await this.session.load();
      } catch {
        // Ignore session load failure here; branch roles can still attempt to load.
      }
      if (seq !== this.loadSeq) return;
    }

    const owner = this.isOwnerActor();
    const canFetchScope = owner && this.user().status === 'ACTIVE';
    if (owner) {
      this.loadedScopeKey = `${userId}:${this.user().status}`;
      this.loadingScope.set(canFetchScope);
      this.scopeLoadFailed.set(false);
    }

    try {
      const [branchRoles, branches, companies, roles, scopeRoles] = await Promise.all([
        !this.isSelf() && (this.isOwnerActor() || this.session.can('users.user.assign_roles'))
          ? listBranchRoles(userId)
          : Promise.resolve<BranchRoleAssignment[]>([]),
        this.fetchAllPages((q) => listBranches(q)),
        this.fetchAllPages((q) => listCompanies(q)),
        this.fetchAllPages((q) => listRoles(q)),
        canFetchScope ? listScopeRoles(userId) : Promise.resolve<ScopeRoleAssignment[]>([]),
      ]);
      if (seq !== this.loadSeq) return;
      this.branchRoles.set(branchRoles);
      this.branches.set(branches);
      this.companies.set(companies);
      this.roles.set(roles);
      this.scopeRoles.set(scopeRoles);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      if (canFetchBranch) {
        this.branchLoadFailed.set(true);
      }
      if (canFetchScope) {
        this.scopeLoadFailed.set(true);
      }
      this.notify.error(this.resolveError(error));
    } finally {
      if (seq === this.loadSeq) {
        this.loadingBranch.set(false);
        this.loadingScope.set(false);
      }
    }
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
      const rows = await listBranchRoles(userId);
      if (this.user().id !== userId) return;
      this.branchRoles.set(rows);
    } catch (error) {
      if (this.user().id !== userId) return;
      this.branchLoadFailed.set(true);
      this.notify.error(this.resolveError(error));
    } finally {
      if (this.user().id === userId) {
        this.loadingBranch.set(false);
      }
    }
  }

  private async loadScope(userId: string): Promise<void> {
    if (!this.isOwnerActor() || this.user().status !== 'ACTIVE') {
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
      const rows = await listScopeRoles(userId);
      if (seq !== this.scopeSeq || this.user().id !== userId) return;
      this.scopeRoles.set(rows);
    } catch (error) {
      if (seq !== this.scopeSeq || this.user().id !== userId) return;
      this.scopeLoadFailed.set(true);
      this.notify.error(this.resolveError(error));
    } finally {
      if (seq === this.scopeSeq && this.user().id === userId) {
        this.loadingScope.set(false);
      }
    }
  }

  private async fetchChoices(reset: boolean): Promise<void> {
    const seq = ++this.choicesSeq;
    if (reset) {
      this.loadingChoices.set(true);
    } else {
      this.loadingMoreChoices.set(true);
    }
    try {
      const search = this.choiceSearch().trim();
      const result = await listAssignmentOptions(this.user().id, {
        page: this.choicesPage,
        limit: 20,
        ...(search ? { search } : {}),
      });
      if (seq !== this.choicesSeq) return;
      this.mergeOptionLabels(result.labels);
      const heldKeys = new Set(this.branchRoles().map((row) => `${row.branchId}:${row.roleId}`));
      const filtered = result.choices.filter(
        (choice) =>
          !isExcludedRoleName(choice.roleName, choice.roleNameI18n) &&
          !heldKeys.has(choiceKey(choice)),
      );
      this.choices.update((current) => (reset ? filtered : [...current, ...filtered]));
      this.choicesHasMore.set(result.hasMore);
    } catch (error) {
      if (seq === this.choicesSeq) {
        this.notify.error(this.resolveError(error));
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

  private resolveError(error: unknown): string {
    const seatMsg = seatErrorMessage(this.transloco, error);
    if (seatMsg) return seatMsg;
    const code = errorCodeOf(error);
    const details = error instanceof ApiError ? error.details : undefined;
    if (code) {
      if (code === 'ROLE_PRIVILEGE_ESCALATION') {
        const msg = this.transloco.translate('access.roles.err.escalation', details);
        if (msg !== 'access.roles.err.escalation') return msg;
      }
      if (code === 'ROLE_BRANCH_SCOPE_INVALID') {
        const msg = this.transloco.translate('access.roles.err.noProfile', details);
        if (msg !== 'access.roles.err.noProfile') return msg;
      }
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

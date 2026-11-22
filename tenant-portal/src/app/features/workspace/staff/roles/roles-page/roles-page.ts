import { Component, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { ActivatedRoute } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAdjustmentsHorizontal,
  tablerAlertTriangle,
  tablerBuildingStore,
  tablerCloudOff,
  tablerCopy,
  tablerEdit,
  tablerEye,
  tablerListCheck,
  tablerLock,
  tablerShieldLock,
  tablerTrash,
  tablerWorld,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Modal } from '../../../../../shared/ui/modal/modal';
import {
  ApiError,
  createRole,
  deleteRole,
  errorCodeOf,
  errorMessage,
  getRole,
  listRoles,
  newIdempotencyKey,
  roleHolderCount,
} from '../../shared/staff.api';
import { SeatCascadeConfirm } from '../../../seats/cascade-confirm/cascade-confirm';
import { isCascadeRequired, seatErrorMessage } from '../../../seats/seat-errors';
import { SeatImpact } from '../../../seats/seat-impact/seat-impact';
import { SeatChange } from '../../../seats/seats.model';
import { BlockersDialog } from '../../shared/blockers-dialog/blockers-dialog';
import { StaffSession } from '../../shared/staff-session';
import { StaffList } from '../../shared/staff-list/staff-list';
import { Role, RoleDetail, STAFF_LIMITS } from '../../shared/staff.model';
import { AssignPermissionsWizard } from '../assign-wizard/assign-wizard';
import { GlobalPermissionsModal } from '../global-permissions-modal/global-permissions-modal';
import { RoleModal } from '../role-modal/role-modal';

const DEFAULT_PAGE_SIZE = 20;

function resolveKey(transloco: TranslocoService, key: string, params?: Record<string, unknown>): string | null {
  const value = transloco.translate(key, params);
  return value && value !== key ? value : null;
}

function translateError(error: unknown, transloco: TranslocoService): string {
  const seatMsg = seatErrorMessage(transloco, error);
  if (seatMsg) return seatMsg;
  const code = errorCodeOf(error);
  const details = error instanceof ApiError ? error.details : undefined;
  if (code) {
    const fromRoles = resolveKey(transloco, `roles.errors.${code}`, details);
    if (fromRoles) return fromRoles;
    const fromStaff = resolveKey(transloco, `staff.errors.${code}`, details);
    if (fromStaff) return fromStaff;
  }
  const fromSettings = errorMessage(error, 'staff', transloco);
  if (fromSettings && fromSettings !== 'settings.errors.generic') {
    return fromSettings;
  }
  return resolveKey(transloco, 'staff.errors.generic') ?? transloco.translate('roles.errors.generic');
}

function uniqueCopyName(baseName: string, suffix: string, existingNames: ReadonlySet<string>): string {
  const fit = (base: string, tail: string) => {
    const tailChars = Array.from(tail);
    const maxBase = Math.max(1, STAFF_LIMITS.roleName - tailChars.length);
    const baseChars = Array.from(base).slice(0, maxBase).join('').trimEnd();
    return `${baseChars}${tail}`;
  };

  const first = fit(baseName, ` ${suffix}`);
  if (!existingNames.has(first)) return first;

  let index = 2;
  while (index <= 100) {
    const candidate = fit(baseName, ` ${suffix} ${index}`);
    if (!existingNames.has(candidate)) return candidate;
    index++;
  }
  return fit(baseName, ` ${suffix} ${Date.now()}`);
}

@Component({
  selector: 'app-roles-page',
  imports: [
    TranslocoPipe,
    NgIcon,
    ActionsMenu,
    AssignPermissionsWizard,
    BlockersDialog,
    Button,
    ConfirmDialog,
    GlobalPermissionsModal,
    Modal,
    RoleModal,
    SeatImpact,
    StaffList,
  ],
  providers: [
    provideTranslocoScope('staff', 'settings', { scope: 'staff-roles', alias: 'roles' }, { scope: 'seats', alias: 'seats' }),
    provideIcons({
      tablerShieldLock,
      tablerLock,
      tablerWorld,
      tablerBuildingStore,
      tablerEye,
      tablerEdit,
      tablerAdjustmentsHorizontal,
      tablerListCheck,
      tablerCopy,
      tablerTrash,
      tablerAlertTriangle,
      tablerCloudOff,
    }),
  ],
  templateUrl: './roles-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class RolesPage {
  private readonly route = inject(ActivatedRoute);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly session = inject(StaffSession);
  private readonly cascadeConfirm = inject(SeatCascadeConfirm);

  private readonly roleModal = viewChild(RoleModal);
  private readonly globalPermissionsModal = viewChild.required(GlobalPermissionsModal);
  private readonly assignWizard = viewChild.required(AssignPermissionsWizard);
  private readonly blockersDialog = viewChild.required(BlockersDialog);
  private readonly deleteDialog = viewChild.required<Modal>('deleteDialog');
  private readonly convertDialog = viewChild.required<ConfirmDialog>('convertDialog');
  private readonly modeChoiceModal = viewChild.required<Modal>('modeChoiceModal');

  private readonly queryParams = toSignal(this.route.queryParamMap);

  protected readonly skeletonRows = [1, 2, 3, 4, 5];
  protected readonly gridColumns = 'grid-cols-staff-role-row-actions';

  protected readonly search = signal('');
  protected readonly page = signal(1);
  protected readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  protected readonly sort = signal('name');
  protected readonly filterValues = signal<Record<string, string | null>>({ type: null });

  protected readonly roles = signal<Role[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly loadError = signal(false);
  protected readonly holderCounts = signal<Record<string, number | null>>({});

  protected readonly pendingDeleteRole = signal<Role | null>(null);
  protected readonly pendingConvertRole = signal<Role | null>(null);
  protected readonly pendingModeRole = signal<RoleDetail | null>(null);
  protected readonly deleting = signal(false);
  protected readonly duplicating = signal(false);

  private loadSeq = 0;
  private holdersSeq = 0;
  private deepLinkHandled = '';
  private deleteConfirmResolver: ((confirmed: boolean) => void) | null = null;

  protected readonly deleteSeatChanges = computed<SeatChange[] | null>(() => {
    const role = this.pendingDeleteRole();
    return role ? [{ kind: 'DELETE_ROLE', roleId: role.id }] : null;
  });

  protected readonly isOwner = computed(() => this.session.isOwner());
  protected readonly canCreate = computed(() => this.isOwner() || this.session.isTenantWide('roles.role.create'));
  protected readonly canUpdate = computed(() => this.isOwner() || this.session.isTenantWide('roles.role.update'));
  protected readonly canDelete = computed(() => this.isOwner() || this.session.isTenantWide('roles.role.delete'));

  protected readonly filters = computed(() => {
    this.i18n();
    const typeValue = this.filterValues()['type'] ?? null;
    return [
      {
        id: 'type',
        label: this.transloco.translate('roles.filters.type'),
        value: typeValue,
        options: [
          { value: 'custom', label: this.transloco.translate('roles.type.custom') },
          { value: 'system', label: this.transloco.translate('roles.type.system') },
        ],
      },
    ];
  });

  protected readonly sortOptions = computed(() => {
    this.i18n();
    return [
      { value: 'name', label: this.transloco.translate('roles.sort.name') },
      { value: 'newest', label: this.transloco.translate('roles.sort.newest') },
    ];
  });

  protected readonly hasActiveFilters = computed(
    () => this.search().trim().length > 0 || Boolean(this.filterValues()['type']),
  );

  protected readonly selectedRoleHolderCount = computed(() => {
    const id = this.roleModal()?.editingId();
    return id ? (this.holderCounts()[id] ?? null) : null;
  });

  constructor() {
    if (!this.session.me()) {
      void this.session.load().catch(() => undefined);
    }

    effect(() => {
      this.search();
      this.page();
      this.pageSize();
      this.sort();
      this.filterValues();
      untracked(() => {
        void this.load();
      });
    });

    effect(() => {
      const modal = this.roleModal();
      const params = this.queryParams();
      if (!modal || !params) return;
      const openId = params.get('open');
      const isNew = params.get('new') === '1';
      const key = `${openId ?? ''}:${isNew ? '1' : '0'}`;
      if ((!openId && !isNew) || key === this.deepLinkHandled) return;
      this.deepLinkHandled = key;
      untracked(() => void this.handleDeepLink(openId, isNew));
    });
  }

  protected async load(): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadError.set(false);

    const typeFilter = this.filterValues()['type'];
    const isSystem = typeFilter === 'system' ? true : typeFilter === 'custom' ? false : undefined;
    const sortBy = this.sort() === 'newest' ? 'createdAt' : 'name';
    const sortDir = this.sort() === 'newest' ? 'DESC' : 'ASC';

    try {
      const res = await listRoles({
        page: this.page(),
        limit: this.pageSize(),
        search: this.search().trim() || undefined,
        sortBy,
        sortDir,
        ...(isSystem !== undefined ? { isSystem } : {}),
      });
      if (seq !== this.loadSeq) return;
      this.roles.set(res.data);
      this.total.set(res.meta.total);
      void this.loadHolderCounts(res.data);
    } catch {
      if (seq !== this.loadSeq) return;
      this.loadError.set(true);
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  protected onSearchChange(value: string): void {
    this.search.set(value);
    if (this.page() !== 1) this.page.set(1);
  }

  protected onPageSizeChange(value: number): void {
    if (value === this.pageSize()) return;
    this.pageSize.set(value);
    if (this.page() !== 1) this.page.set(1);
  }

  protected onSortChange(value: string): void {
    this.sort.set(value);
    if (this.page() !== 1) this.page.set(1);
  }

  protected onFilterValuesChange(value: Record<string, string | null>): void {
    this.filterValues.set(value);
    if (this.page() !== 1) this.page.set(1);
  }

  protected isAdminRole(role: Role): boolean {
    return (
      role.isSystem &&
      (role.name.toLowerCase() === 'admin' ||
        role.nameI18n?.en?.toLowerCase() === 'admin' ||
        role.id === 'role-admin')
    );
  }

  protected roleName(role: Role): string {
    const localized = this.language() === 'ar' ? role.nameI18n?.ar : role.nameI18n?.en;
    return localized?.trim() || role.name;
  }

  protected roleDescription(role: Role): string | null {
    const localized = this.language() === 'ar' ? role.descriptionI18n?.ar : role.descriptionI18n?.en;
    return localized?.trim() || role.description || null;
  }

  protected holderCountText(roleId: string): string {
    const count = this.holderCounts()[roleId];
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

  protected openCreate(): void {
    if (!this.canCreate()) return;
    this.roleModal()?.openCreate();
  }

  protected openRole(role: Role): void {
    this.roleModal()?.openEdit(role);
  }

  protected actionsFor(role: Role): ActionItem[] {
    this.i18n();
    const t = (key: string) => this.transloco.translate(key);

    const editDisabled = role.isSystem || !this.canUpdate();
    const editReason = role.isSystem
      ? t('roles.reason.system')
      : !this.canUpdate()
        ? t('roles.reason.tenantWide')
        : undefined;

    const assignDisabled = role.isSystem || !this.isOwner();
    const assignReason = role.isSystem
      ? t('roles.reason.system')
      : !this.isOwner()
        ? t('roles.reason.ownerOnly')
        : undefined;

    const duplicateDisabled =
      role.isSystem || role.permissionMode === 'BRANCH' || !this.canCreate() || this.duplicating();
    const duplicateReason = role.isSystem
      ? t('roles.reason.system')
      : role.permissionMode === 'BRANCH'
        ? t('roles.reason.noDuplicateBranch')
        : !this.canCreate()
          ? t('roles.reason.tenantWide')
          : undefined;

    const deleteDisabled = role.isSystem || !this.canDelete() || this.deleting();
    const deleteReason = role.isSystem
      ? t('roles.reason.system')
      : !this.canDelete()
        ? t('roles.reason.tenantWide')
        : undefined;

    const items: ActionItem[] = [
      {
        id: 'open',
        title: t('roles.actions.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
      {
        id: 'edit',
        title: t('roles.actions.edit'),
        icon: 'tablerEdit',
        tile: editDisabled ? 'bg-icon-gray' : 'bg-icon-orange',
        disabled: editDisabled,
        reason: editReason,
      },
      {
        id: 'assign',
        title: t('roles.actions.assign'),
        icon: 'tablerAdjustmentsHorizontal',
        tile: assignDisabled ? 'bg-icon-gray' : 'bg-icon-violet',
        disabled: assignDisabled,
        reason: assignReason,
      },
    ];

    if (role.permissionMode === 'GLOBAL') {
      const workspaceDisabled = role.isSystem || !this.canUpdate();
      const workspaceReason = role.isSystem
        ? t('roles.reason.system')
        : !this.canUpdate()
          ? t('roles.reason.tenantWide')
          : undefined;
      items.push({
        id: 'workspace',
        title: t('roles.actions.workspace'),
        icon: 'tablerListCheck',
        tile: workspaceDisabled ? 'bg-icon-gray' : 'bg-icon-teal',
        disabled: workspaceDisabled,
        reason: workspaceReason,
      });
    }

    items.push(
      {
        id: 'view',
        title: t('roles.actions.view'),
        icon: 'tablerEye',
        tile: 'bg-icon-navy',
      },
      {
        id: 'duplicate',
        title: t('roles.actions.duplicate'),
        icon: 'tablerCopy',
        tile: duplicateDisabled ? 'bg-icon-gray' : 'bg-icon-green',
        disabled: duplicateDisabled,
        reason: duplicateReason,
      },
      {
        id: 'delete',
        title: t('roles.actions.delete'),
        icon: 'tablerTrash',
        tile: deleteDisabled ? 'bg-icon-gray' : 'bg-icon-red',
        danger: true,
        disabled: deleteDisabled,
        reason: deleteReason,
      },
    );

    return items;
  }

  protected onRowAction(role: Role, selection: ActionSelection): void {
    switch (selection.id) {
      case 'open':
      case 'edit':
        this.openRole(role);
        break;
      case 'assign':
        void this.openAssignPermissions(role);
        break;
      case 'workspace':
        this.openGlobalPermissions(role, false);
        break;
      case 'view':
        this.viewPermissions(role);
        break;
      case 'duplicate':
        void this.duplicateRole(role);
        break;
      case 'delete':
        void this.requestDelete(role);
        break;
    }
  }

  protected onRoleCreated(created: RoleDetail): void {
    void this.load();
    if (this.isOwner()) {
      this.pendingModeRole.set(created);
      this.modeChoiceModal().open();
      return;
    }
    this.globalPermissionsModal().open(created.id, { roleName: this.roleName(created) });
  }

  protected onRoleSaved(): void {
    void this.load();
  }

  protected onRoleDeletedRemotely(): void {
    void this.load();
  }

  protected onPermissionsSaved(): void {
    void this.load();
  }

  protected onRolePermissionsRequested(role: Role): void {
    if (role.isSystem) {
      this.viewPermissions(role);
      return;
    }
    if (role.permissionMode === 'BRANCH') {
      if (this.isOwner()) {
        this.assignWizard().open(role.id);
      } else {
        this.openGlobalPermissions(role, true);
      }
      return;
    }
    this.openGlobalPermissions(role, !this.canUpdate());
  }

  protected chooseCreateMode(mode: 'BRANCH' | 'GLOBAL'): void {
    const role = this.pendingModeRole();
    this.modeChoiceModal().close();
    if (!role) return;
    this.pendingModeRole.set(null);
    if (mode === 'BRANCH') {
      this.assignWizard().open(role.id);
      return;
    }
    this.globalPermissionsModal().open(role.id, { roleName: this.roleName(role) });
  }

  protected closeModeChoice(): void {
    this.pendingModeRole.set(null);
    this.modeChoiceModal().close();
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

  private openDeleteConfirm(): Promise<boolean> {
    this.deleteConfirmResolver?.(false);
    this.deleteDialog().open();
    return new Promise<boolean>((resolve) => {
      this.deleteConfirmResolver = resolve;
    });
  }

  protected async requestDelete(role: Role): Promise<void> {
    if (role.isSystem || !this.canDelete() || this.deleting()) return;
    this.pendingDeleteRole.set(role);
    const confirmed = await this.openDeleteConfirm();
    if (!confirmed) {
      this.pendingDeleteRole.set(null);
      return;
    }

    this.deleting.set(true);
    try {
      try {
        await deleteRole(role.id, newIdempotencyKey());
      } catch (error) {
        const cascade = isCascadeRequired(error);
        if (!cascade) throw error;
        const cascadeConfirmed = await this.cascadeConfirm.confirm(cascade.addons);
        if (!cascadeConfirmed) return;
        await (
          deleteRole as (
            id: string,
            key: string,
            opts?: { confirmAddonCascade?: boolean },
          ) => Promise<void>
        )(role.id, newIdempotencyKey(), { confirmAddonCascade: true });
      }
      this.notify.success(this.transloco.translate('roles.toast.deleted'));
      if (this.roleModal()?.editingId() === role.id) {
        this.roleModal()?.closeImmediate();
      }
      await this.load();
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'ROLE_IN_USE') {
        const count = await this.resolveHolderCountForBlocker(role.id, error);
        const message = this.transloco.translate('roles.delete.inUse', { n: count });
        await this.blockersDialog().open({
          title: this.transloco.translate('roles.delete.title', { name: this.roleName(role) }),
          blockers: [message],
          links: {
            [message]: {
              label: this.transloco.translate('roles.delete.viewUsers'),
              route: ['/workspace/staff/users'],
            },
          },
        });
        return;
      }

      this.notify.error(translateError(error, this.transloco));
      if (code === 'ROLE_NOT_FOUND' || (error instanceof ApiError && error.status === 404)) {
        if (this.roleModal()?.editingId() === role.id) {
          this.roleModal()?.closeImmediate();
        }
        await this.load();
      }
    } finally {
      this.deleting.set(false);
      this.pendingDeleteRole.set(null);
    }
  }

  private async openAssignPermissions(role: Role): Promise<void> {
    if (role.isSystem || !this.isOwner()) return;
    if (role.permissionMode === 'GLOBAL' && role.permissionCount > 0) {
      this.pendingConvertRole.set(role);
      const confirmed = await this.convertDialog().open();
      this.pendingConvertRole.set(null);
      if (!confirmed) return;
    }
    this.assignWizard().open(role.id);
  }

  private openGlobalPermissions(role: Role, readonlyMode: boolean): void {
    this.globalPermissionsModal().open(role.id, {
      readonly: readonlyMode,
      roleName: this.roleName(role),
    });
  }

  private viewPermissions(role: Role): void {
    if (role.permissionMode === 'BRANCH' && this.isOwner()) {
      this.assignWizard().open(role.id, { readonly: true });
      return;
    }
    this.openGlobalPermissions(role, true);
  }

  private async duplicateRole(role: Role): Promise<void> {
    if (role.isSystem || role.permissionMode === 'BRANCH' || !this.canCreate() || this.duplicating()) return;
    this.duplicating.set(true);
    try {
      const [detail, existingNames] = await Promise.all([getRole(role.id), this.fetchAllRoleNames()]);
      const suffix = this.transloco.translate('roles.copySuffix');
      const created = await this.createUniqueCopy(detail, suffix, existingNames);
      this.notify.success(this.transloco.translate('roles.toast.duplicated'));
      await this.load();
      this.roleModal()?.openEdit(created);
    } catch (error) {
      this.notify.error(translateError(error, this.transloco));
    } finally {
      this.duplicating.set(false);
    }
  }

  private async createUniqueCopy(
    source: RoleDetail,
    suffix: string,
    existingNames: Set<string>,
  ): Promise<RoleDetail> {
    const taken = new Set(existingNames);
    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = uniqueCopyName(source.name, suffix, taken);
      taken.add(candidate);
      const payload: Parameters<typeof createRole>[0] = {
        name: candidate,
        permissionIds: [...source.permissionIds],
      };
      if (source.description?.trim()) {
        payload.description = source.description.trim();
      }
      try {
        return await createRole(payload, newIdempotencyKey());
      } catch (error) {
        if (errorCodeOf(error) === 'ROLE_NAME_TAKEN') {
          continue;
        }
        throw error;
      }
    }
    throw new ApiError(409, 'ROLE_NAME_TAKEN');
  }

  private async fetchAllRoleNames(): Promise<Set<string>> {
    const names = new Set<string>();
    let page = 1;
    while (page <= 20) {
      const res = await listRoles({ page, limit: 100 });
      for (const item of res.data) {
        names.add(item.name);
      }
      if (!res.meta.hasNext || res.data.length === 0) break;
      page++;
    }
    return names;
  }

  private async loadHolderCounts(items: Role[]): Promise<void> {
    const seq = ++this.holdersSeq;
    const results = await Promise.allSettled(
      items.map(async (role) => [role.id, await roleHolderCount(role.id)] as const),
    );
    if (seq !== this.holdersSeq) return;
    const next: Record<string, number | null> = {};
    for (let i = 0; i < items.length; i++) {
      const result = results[i];
      next[items[i].id] = result.status === 'fulfilled' ? result.value[1] : null;
    }
    this.holderCounts.set(next);
  }

  private async resolveHolderCountForBlocker(roleId: string, error: unknown): Promise<number> {
    if (error instanceof ApiError && error.details) {
      const rawCount = error.details['count'] ?? error.details['holders'];
      if (typeof rawCount === 'number') return rawCount;
    }
    const cached = this.holderCounts()[roleId];
    if (typeof cached === 'number') return cached;
    try {
      return await roleHolderCount(roleId);
    } catch {
      return 0;
    }
  }

  private async handleDeepLink(openId: string | null, isNew: boolean): Promise<void> {
    if (!this.session.me()) {
      await this.session.load().catch(() => undefined);
    }
    if (isNew) {
      this.openCreate();
      return;
    }
    if (!openId) return;
    const existing = this.roles().find((role) => role.id === openId);
    if (existing) {
      this.openRole(existing);
      return;
    }
    try {
      const role = await getRole(openId);
      this.openRole(role);
    } catch (error) {
      this.notify.error(translateError(error, this.transloco));
    }
  }
}

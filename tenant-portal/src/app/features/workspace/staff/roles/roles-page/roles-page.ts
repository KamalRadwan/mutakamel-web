import { Component, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
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
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import {
  ActionItem,
  ActionSelection,
  ActionsMenu,
} from '../../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../../shared/ui/button/button';
import {
  ApiError,
  errorCodeOf,
  staffErrorMessage,
  newIdempotencyKey,
  listAllPages,
} from '../../shared/staff.api';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { RouteError } from '../../../../../shared/ui/route-error/route-error';
import { SeatCascadeConfirm } from '../../../seats/cascade-confirm/cascade-confirm';
import { isCascadeRequired, seatErrorMessage } from '../../../seats/seat-errors';
import { SeatImpact } from '../../../seats/seat-impact/seat-impact';
import { SeatChange } from '../../../seats/seats.model';
import { BlockersDialog } from '../../shared/blockers-dialog/blockers-dialog';
import { AssignPermissionsWizard } from '../assign-wizard/assign-wizard';
import { GlobalPermissionsModal } from '../global-permissions-modal/global-permissions-modal';
import { StaffSession } from '../../shared/staff-session';
import { StaffList } from '../../shared/staff-list/staff-list';
import { Role, RoleDetail, STAFF_LIMITS } from '../../shared/staff.model';
import { RolesApi, type CreateRoleBody } from '../roles.api';
import { RoleModal } from '../role-modal/role-modal';

const DEFAULT_PAGE_SIZE = 20;

function uniqueCopyName(
  baseName: string,
  suffix: string,
  existingNames: ReadonlySet<string>,
): string {
  for (let index = 1; ; index++) {
    const tail = ` ${suffix}${index === 1 ? '' : ` ${index}`}`;
    const maxBase = STAFF_LIMITS.roleName - Array.from(tail).length;
    const candidate = `${Array.from(baseName).slice(0, maxBase).join('').trimEnd()}${tail}`;
    if (!existingNames.has(candidate)) return candidate;
  }
}

@Component({
  selector: 'app-roles-page',
  imports: [
    TranslocoPipe,
    NgIcon,
    ActionsMenu,
    Button,
    RoleModal,
    StaffList,
    AssignPermissionsWizard,
    GlobalPermissionsModal,
    BlockersDialog,
    ConfirmDialog,
    Modal,
    RouteError,
    SeatImpact,
  ],
  providers: [
    provideTranslocoScope(
      'staff',
      'settings',
      { scope: 'staff-roles', alias: 'roles' },
      { scope: 'seats', alias: 'seats' },
    ),
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
  host: { class: 'flex flex-1 shrink-0 flex-col' },
})
export class RolesPage {
  private readonly route = inject(ActivatedRoute);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly session = inject(StaffSession);
  private readonly api = inject(RolesApi);
  private readonly roleModal = viewChild(RoleModal);
  private readonly readScope = computed(() =>
    this.session.can('roles.role.read') ? this.session.scopeRevision() : null,
  );
  private readonly refreshes = signal(0);

  private readonly globalPermissionsModal = viewChild.required(GlobalPermissionsModal);
  private readonly assignWizard = viewChild.required(AssignPermissionsWizard);
  private readonly blockersDialog = viewChild.required(BlockersDialog);
  private readonly deleteDialog = viewChild.required<Modal>('deleteDialog');
  private readonly convertDialog = viewChild.required<ConfirmDialog>('convertDialog');
  private readonly modeChoiceModal = viewChild.required<Modal>('modeChoiceModal');

  private readonly cascadeConfirm = inject(SeatCascadeConfirm);
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
  protected readonly forbidden = signal(false);
  private loadSeq = 0;
  private loadedScope: string | null = null;
  private deepLinkHandled = '';
  protected readonly canCreate = computed(
    () => Boolean(this.readScope()) && this.session.isTenantWide('roles.role.create'),
  );

  protected readonly pendingDeleteRole = signal<Role | null>(null);
  protected readonly pendingConvertRole = signal<Role | null>(null);
  protected readonly pendingModeRole = signal<RoleDetail | null>(null);
  protected readonly deleting = signal(false);
  protected readonly duplicating = signal(false);
  protected readonly isOwner = computed(() => this.session.isOwner());
  protected readonly canUpdate = computed(() => this.session.isTenantWide('roles.role.update'));
  protected readonly canDelete = computed(() => this.session.isTenantWide('roles.role.delete'));
  protected readonly deleteSeatChanges = computed<SeatChange[] | null>(() => {
    const role = this.pendingDeleteRole();
    return role ? [{ kind: 'DELETE_ROLE', roleId: role.id }] : null;
  });
  private deleteConfirmResolver: ((confirmed: boolean) => void) | null = null;
  private deleteAction: { id: string; key: string; confirmAddonCascade: boolean } | null = null;
  private duplicateAction: { id: string; body: CreateRoleBody; key: string } | null = null;

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

  constructor() {
    if (!this.session.me()) {
      void this.session.load().catch(() => undefined);
    }

    effect(() => {
      this.readScope();
      this.refreshes();
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
      const scope = this.readScope();
      const allowCreate = this.canCreate();
      if (!modal || !params || !scope) {
        this.deepLinkHandled = '';
        return;
      }
      const openId = params.get('open');
      const isNew = params.get('new') === '1';
      if ((isNew && !allowCreate) || (!openId && !isNew)) {
        this.deepLinkHandled = '';
        return;
      }
      const key = JSON.stringify([scope, openId, isNew]);
      if (key === this.deepLinkHandled) return;
      this.deepLinkHandled = key;
      untracked(() => void this.handleDeepLink(openId, isNew, key));
    });
  }

  protected async load(): Promise<void> {
    const seq = ++this.loadSeq;
    const scope = this.readScope();
    if (scope !== this.loadedScope) {
      if (this.loadedScope) {
        this.roleModal()?.closeImmediate();
        this.globalPermissionsModal().closeImmediate();
        this.assignWizard().closeImmediately();
        this.closeModeChoice();
        this.deleteAction = null;
        this.duplicateAction = null;
      }
      this.loadedScope = scope;
      this.roles.set([]);
      this.total.set(0);
    }
    if (!scope) {
      this.loading.set(false);
      this.loadError.set(false);
      this.forbidden.set(this.session.state() === 'ready');
      return;
    }
    this.loading.set(true);
    this.loadError.set(false);
    this.forbidden.set(false);

    const typeFilter = this.filterValues()['type'];
    const isSystem = typeFilter === 'system' ? true : typeFilter === 'custom' ? false : undefined;
    const sortBy = this.sort() === 'newest' ? 'createdAt' : 'name';
    const sortDir = this.sort() === 'newest' ? 'DESC' : 'ASC';

    try {
      const res = await this.api.list({
        page: this.page(),
        limit: this.pageSize(),
        search: this.search().trim() || undefined,
        sortBy,
        sortDir,
        ...(isSystem !== undefined ? { isSystem } : {}),
      });
      if (seq !== this.loadSeq || scope !== this.readScope()) return;
      this.roles.set(res.data);
      this.total.set(res.meta.total);
    } catch (error) {
      if (seq !== this.loadSeq || scope !== this.readScope()) return;
      if (error instanceof ApiError && error.status === 403) this.forbidden.set(true);
      else this.loadError.set(true);
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
    const localized =
      this.language() === 'ar' ? role.descriptionI18n?.ar : role.descriptionI18n?.en;
    return localized?.trim() || role.description || null;
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
    if (this.loadedScope && this.readScope() === this.loadedScope)
      this.roleModal()?.openDetails(role);
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

    const assignDisabled = role.isSystem || !this.session.canUpdateBranchPermissions();
    const assignReason = role.isSystem
      ? t('roles.reason.system')
      : !this.isOwner()
        ? t('roles.reason.ownerOnly')
        : assignDisabled
          ? t('roles.reason.branchPermissions')
          : undefined;

    const duplicateDisabled =
      role.permissionMode === 'BRANCH' || !this.canCreate() || this.duplicating();
    const duplicateReason =
      role.permissionMode === 'BRANCH'
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
      const workspaceDisabled =
        role.isSystem || !this.canUpdate() || !this.session.canReadRolePermissions();
      const workspaceReason = role.isSystem
        ? t('roles.reason.system')
        : workspaceDisabled
          ? t('roles.reason.rolePermissions')
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

    const canView =
      role.permissionMode === 'BRANCH'
        ? this.session.canReadBranchPermissions()
        : this.session.canReadRolePermissions();
    items.push(
      {
        id: 'view',
        title: t('roles.actions.view'),
        icon: 'tablerEye',
        tile: canView ? 'bg-icon-navy' : 'bg-icon-gray',
        disabled: !canView,
        reason: canView ? undefined : t('roles.reason.rolePermissions'),
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

    return items.filter(
      (item) =>
        (item.id !== 'assign' || this.session.canReadBranchPermissions()) &&
        (item.id !== 'view' ||
          role.permissionMode !== 'BRANCH' ||
          this.session.canReadBranchPermissions()),
    );
  }

  protected onRowAction(role: Role, selection: ActionSelection): void {
    if (!this.actionsFor(role).some((item) => item.id === selection.id && !item.disabled)) return;
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
    this.search.set('');
    this.filterValues.set({ type: null });
    this.sort.set('newest');
    this.page.set(1);
    this.refreshes.update((value) => value + 1);
    if (this.session.isOwner()) {
      this.pendingModeRole.set(created);
      this.modeChoiceModal().open();
      return;
    }
    if (this.canUpdate() && this.session.canReadRolePermissions()) {
      this.globalPermissionsModal().open(created.id, { roleName: this.roleName(created) });
    }
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
      if (this.session.canUpdateBranchPermissions()) {
        this.assignWizard().open(role.id);
      } else {
        this.viewPermissions(role);
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
      if (this.session.canUpdateBranchPermissions()) this.assignWizard().open(role.id);
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
    if (!confirmed && !this.deleting()) this.deleteDialog().close();
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
    if (!this.deleteAction || this.deleteAction.id !== role.id) {
      this.deleteAction = { id: role.id, key: newIdempotencyKey(), confirmAddonCascade: false };
    }
    this.pendingDeleteRole.set(role);
    const confirmed = await this.openDeleteConfirm();
    if (!confirmed) {
      this.pendingDeleteRole.set(null);
      return;
    }

    this.deleting.set(true);
    try {
      try {
        await this.api.delete(role.id, this.deleteAction.key, {
          confirmAddonCascade: this.deleteAction.confirmAddonCascade,
        });
      } catch (error) {
        const cascade = isCascadeRequired(error);
        if (!cascade || this.deleteAction.confirmAddonCascade) throw error;
        const cascadeConfirmed = await this.cascadeConfirm.confirm(cascade.addons);
        if (!cascadeConfirmed) return;
        this.deleteAction = { id: role.id, key: newIdempotencyKey(), confirmAddonCascade: true };
        await this.api.delete(role.id, this.deleteAction.key, { confirmAddonCascade: true });
      }
      this.deleteAction = null;
      this.notify.success(this.transloco.translate('roles.toast.deleted'));
      if (this.roleModal()?.editingId() === role.id) {
        this.roleModal()?.closeImmediate();
      }
      await this.load();
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'ROLE_IN_USE') {
        const message = this.transloco.translate('roles.delete.inUseNoCount');
        this.deleteDialog().close();
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

      this.notifyWriteError(error);
      if (code === 'ROLE_NOT_FOUND' || (error instanceof ApiError && error.status === 404)) {
        if (this.roleModal()?.editingId() === role.id) {
          this.roleModal()?.closeImmediate();
        }
        await this.load();
      }
    } finally {
      this.deleteDialog().close();
      this.deleting.set(false);
      this.pendingDeleteRole.set(null);
    }
  }

  private async openAssignPermissions(role: Role): Promise<void> {
    if (role.isSystem || !this.session.canUpdateBranchPermissions()) return;
    if (role.permissionMode === 'GLOBAL' && role.permissionCount > 0) {
      this.pendingConvertRole.set(role);
      const confirmed = await this.convertDialog().open();
      this.pendingConvertRole.set(null);
      if (!confirmed) return;
    }
    if (this.session.canUpdateBranchPermissions()) this.assignWizard().open(role.id);
  }

  private openGlobalPermissions(role: Role, readonlyMode: boolean): void {
    this.globalPermissionsModal().open(role.id, {
      readonly: readonlyMode,
      roleName: this.roleName(role),
    });
  }

  private viewPermissions(role: Role): void {
    if (role.permissionMode === 'BRANCH') {
      if (this.session.canReadBranchPermissions())
        this.assignWizard().open(role.id, { readonly: true });
      return;
    }
    this.openGlobalPermissions(role, true);
  }

  private async duplicateRole(role: Role): Promise<void> {
    if (role.permissionMode === 'BRANCH' || !this.canCreate() || this.duplicating()) return;
    this.duplicating.set(true);
    try {
      if (!this.duplicateAction || this.duplicateAction.id !== role.id) {
        const [detail, existingNames] = await Promise.all([
          this.api.get(role.id),
          this.fetchAllRoleNames(),
        ]);
        const body: CreateRoleBody = {
          name: uniqueCopyName(
            detail.name,
            this.transloco.translate('roles.copySuffix'),
            existingNames,
          ),
          permissionIds: [...detail.permissionIds],
          ...(detail.description ? { description: detail.description } : {}),
        };
        this.duplicateAction = { id: role.id, body, key: newIdempotencyKey() };
      }
      const action = this.duplicateAction;
      const created = await this.api.create(action.body, action.key);
      this.duplicateAction = null;
      this.notify.success(this.transloco.translate('roles.toast.duplicated'));
      await this.load();
      this.roleModal()?.openDetails(created);
    } catch (error) {
      if (errorCodeOf(error) === 'ROLE_NAME_TAKEN') this.duplicateAction = null;
      this.notifyWriteError(error);
    } finally {
      this.duplicating.set(false);
    }
  }

  private async fetchAllRoleNames(): Promise<Set<string>> {
    const roles = await listAllPages((query) => this.api.list(query), { limit: 100 });
    return new Set(roles.map((role) => role.name));
  }

  protected onBranchModeConflict(id: string): void {
    void this.load();
    if (this.session.canUpdateBranchPermissions()) this.assignWizard().open(id);
  }

  private notifyWriteError(error: unknown): void {
    const message =
      seatErrorMessage(this.transloco, error) ??
      staffErrorMessage(error, 'roles', this.transloco, 'write');
    const code = errorCodeOf(error);
    if (code === 'GW.IDEM.IN_FLIGHT') this.notify.info(message);
    else if (code === 'GW.IDEM.MISMATCH') this.notify.warning(message);
    else this.notify.error(message);
  }

  private async handleDeepLink(openId: string | null, isNew: boolean, key: string): Promise<void> {
    if (isNew) {
      this.openCreate();
      return;
    }
    if (!openId) return;
    const scope = this.readScope();
    const existing =
      scope === this.loadedScope ? this.roles().find((role) => role.id === openId) : undefined;
    if (existing) {
      this.openRole(existing);
      return;
    }

    try {
      const role = await this.api.get(openId);
      if (key === this.deepLinkHandled && scope === this.readScope()) this.openRole(role);
    } catch (error) {
      if (key === this.deepLinkHandled && scope === this.readScope()) {
        this.notify.error(staffErrorMessage(error, 'roles', this.transloco));
      }
    }
  }
}

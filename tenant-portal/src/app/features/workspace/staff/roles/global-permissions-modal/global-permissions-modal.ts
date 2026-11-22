import { Component, computed, inject, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle, tablerCloudOff, tablerListCheck, tablerLock, tablerRefresh } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Modal } from '../../../../../shared/ui/modal/modal';
import {
  ApiError,
  errorCodeOf,
  errorMessage,
  getRole,
  listPermissions,
  newIdempotencyKey,
  setRolePermissions,
} from '../../shared/staff.api';
import { SeatCascadeConfirm } from '../../../seats/cascade-confirm/cascade-confirm';
import { isCascadeRequired, seatErrorMessage } from '../../../seats/seat-errors';
import { SeatImpact } from '../../../seats/seat-impact/seat-impact';
import { SeatChange } from '../../../seats/seats.model';
import { StaffSession } from '../../shared/staff-session';
import { Permission, RoleDetail, STAFF_LIMITS } from '../../shared/staff.model';
import { PermissionTree } from '../permission-tree/permission-tree';
import { TreeEntry, fromPermissions } from '../permission-tree/permission-tree.model';

function sameIdSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  if (setA.size !== b.length) return false;
  for (const id of b) {
    if (!setA.has(id)) return false;
  }
  return true;
}

function resolveKey(transloco: TranslocoService, key: string, params?: Record<string, unknown>): string | null {
  const value = transloco.translate(key, params);
  return value && value !== key ? value : null;
}

function translateError(error: unknown, transloco: TranslocoService): string {
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

@Component({
  selector: 'app-global-permissions-modal',
  imports: [TranslocoPipe, NgIcon, Button, ConfirmDialog, Modal, PermissionTree, SeatImpact],
  providers: [
    provideTranslocoScope('settings', 'staff', { scope: 'seats', alias: 'seats' }),
    provideIcons({ tablerListCheck, tablerLock, tablerAlertTriangle, tablerCloudOff, tablerRefresh }),
  ],
  templateUrl: './global-permissions-modal.html',
})
export class GlobalPermissionsModal {
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  protected readonly session = inject(StaffSession);
  private readonly cascadeConfirm = inject(SeatCascadeConfirm);

  private readonly modal = viewChild.required(Modal);
  private readonly discardDialog = viewChild.required(ConfirmDialog);

  readonly saved = output<RoleDetail>();
  readonly branchModeConflict = output<void>();

  protected readonly maxPermissions = STAFF_LIMITS.rolePermissions;
  protected readonly skeletonRows = [1, 2, 3, 4, 5];

  protected readonly role = signal<RoleDetail | null>(null);
  protected readonly entries = signal<TreeEntry[]>([]);
  protected readonly initialSelected = signal<string[]>([]);
  protected readonly selected = signal<string[]>([]);
  protected readonly seatBlocked = signal(false);
  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly saving = signal(false);
  protected readonly listChangedError = signal(false);

  private readonly forceReadonly = signal(false);
  private readonly fallbackRoleName = signal('');
  private currentRoleId: string | null = null;
  private loadSeq = 0;
  private allowClose = false;
  private confirmingDiscard = false;
  private lastFingerprint: string | null = null;
  private lastIdempotencyKey: string | null = null;

  protected readonly roleDisplayName = computed(() => {
    const current = this.role();
    if (!current) return this.fallbackRoleName();
    const localized = this.language() === 'ar' ? current.nameI18n?.ar : current.nameI18n?.en;
    return localized?.trim() || current.name;
  });

  protected readonly isBranchRole = computed(() => this.role()?.permissionMode === 'BRANCH');

  protected readonly disabledPermissionIds = computed<readonly string[]>(() => {
    const me = this.session.me();
    if (!me || me.isTenantOwner) return [];
    const disabled: string[] = [];
    for (const entry of this.entries()) {
      if (!me.permissionScopes[entry.key]?.tenantWide) {
        disabled.push(entry.id);
      }
    }
    return disabled;
  });

  protected readonly isReadonly = computed(() => {
    const current = this.role();
    return this.forceReadonly() || Boolean(current?.isSystem) || current?.permissionMode === 'BRANCH';
  });

  protected readonly dirty = computed(() => {
    if (this.isReadonly() || this.loading() || this.loadFailed()) return false;
    return !sameIdSet(this.initialSelected(), this.selected());
  });

  protected readonly countText = computed(() => {
    this.i18n();
    return this.transloco.translate('roles.global.count', { n: this.selected().length });
  });

  protected readonly seatChanges = computed<SeatChange[] | null>(() => {
    const current = this.role();
    if (!current || this.isReadonly() || !this.dirty()) return null;
    return [{ kind: 'SET_ROLE_PERMISSIONS', roleId: current.id, permissionIds: this.selected() }];
  });

  open(roleId: string, options?: { readonly?: boolean; roleName?: string }): void {
    this.allowClose = false;
    this.currentRoleId = roleId;
    this.forceReadonly.set(Boolean(options?.readonly));
    this.fallbackRoleName.set(options?.roleName ?? '');
    this.listChangedError.set(false);
    this.seatBlocked.set(false);
    this.clearIdempotency();
    this.modal().open();
    void this.loadData(roleId);
  }

  closeImmediate(): void {
    this.allowClose = true;
    this.modal().close();
  }

  protected reloadData(): void {
    if (!this.currentRoleId || this.loading() || this.saving()) return;
    this.listChangedError.set(false);
    void this.loadData(this.currentRoleId);
  }

  protected undo(): void {
    if (this.saving()) return;
    this.selected.set([...this.initialSelected()]);
    this.seatBlocked.set(false);
    this.listChangedError.set(false);
    this.clearIdempotency();
  }

  protected async save(confirmAddonCascade = false): Promise<void> {
    const current = this.role();
    if (!current || this.isReadonly() || this.saving() || this.loading() || !this.dirty() || this.seatBlocked()) {
      return;
    }
    if (this.selected().length > this.maxPermissions) {
      this.notify.error(this.transloco.translate('roles.errors.TENANT_ROLE_PERMISSION_LIMIT_EXCEEDED'));
      return;
    }

    const permissionIds = [...this.selected()];
    const key = confirmAddonCascade
      ? newIdempotencyKey()
      : this.idempotencyKeyFor(current.id, permissionIds);
    this.saving.set(true);

    try {
      const updated = confirmAddonCascade
        ? await (
            setRolePermissions as (
              id: string,
              perms: string[],
              idemKey: string,
              opts?: { confirmAddonCascade?: boolean },
            ) => Promise<RoleDetail>
          )(current.id, permissionIds, key, { confirmAddonCascade: true })
        : await setRolePermissions(current.id, permissionIds, key);
      this.clearIdempotency();
      this.notify.success(this.transloco.translate('roles.global.saved'));
      this.closeImmediate();
      this.saved.emit(updated);
    } catch (error) {
      const cascade = isCascadeRequired(error);
      if (cascade && !confirmAddonCascade) {
        this.saving.set(false);
        const confirmed = await this.cascadeConfirm.confirm(cascade.addons);
        if (confirmed) {
          await this.save(true);
        }
        return;
      }
      const seatMsg = seatErrorMessage(this.transloco, error);
      if (seatMsg) {
        this.notify.error(seatMsg);
        return;
      }
      const code = errorCodeOf(error);
      if (code === 'TENANT_ROLE_PERMISSION_LIMIT_EXCEEDED') {
        this.notify.error(this.transloco.translate('roles.errors.TENANT_ROLE_PERMISSION_LIMIT_EXCEEDED'));
        return;
      }
      if (code === 'PERMISSION_UNKNOWN') {
        this.listChangedError.set(true);
        this.notify.error(this.transloco.translate('roles.global.listChanged'));
        return;
      }
      if (code === 'ROLE_BRANCH_MODE_REQUIRED') {
        this.notify.error(this.transloco.translate('roles.errors.ROLE_BRANCH_MODE_REQUIRED'));
        this.closeImmediate();
        this.branchModeConflict.emit();
        return;
      }
      if (code === 'ROLE_PERMISSION_GRANT_DENIED') {
        this.notify.error(this.transloco.translate('roles.global.grantDenied'));
        return;
      }
      this.notify.error(translateError(error, this.transloco));
    } finally {
      this.saving.set(false);
    }
  }

  protected async requestClose(): Promise<void> {
    if (this.saving()) return;
    if (this.dirty() && !(await this.confirmDiscard())) return;
    this.closeImmediate();
  }

  protected onModalClosed(): void {
    if (!this.allowClose && this.saving()) {
      this.modal().open();
      return;
    }
    if (!this.allowClose && this.dirty()) {
      this.modal().open();
      void this.confirmDiscardAndClose();
      return;
    }
    this.allowClose = false;
    this.loadSeq++;
    this.currentRoleId = null;
    this.role.set(null);
    this.entries.set([]);
    this.initialSelected.set([]);
    this.selected.set([]);
    this.seatBlocked.set(false);
    this.loading.set(false);
    this.loadFailed.set(false);
    this.listChangedError.set(false);
    this.clearIdempotency();
  }

  private async loadData(roleId: string): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    this.seatBlocked.set(false);

    try {
      if (!this.session.me()) {
        await this.session.load().catch(() => undefined);
      }
      const [roleDetail, permissions] = await Promise.all([getRole(roleId), this.fetchAllPermissions()]);
      if (seq !== this.loadSeq) return;
      this.role.set(roleDetail);
      this.entries.set(fromPermissions(permissions));
      this.initialSelected.set([...roleDetail.permissionIds]);
      this.selected.set([...roleDetail.permissionIds]);
      this.listChangedError.set(false);
    } catch {
      if (seq !== this.loadSeq) return;
      this.loadFailed.set(true);
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private async fetchAllPermissions(): Promise<Permission[]> {
    const all: Permission[] = [];
    let page = 1;
    while (page <= 50) {
      const res = await listPermissions({ page, limit: 100, sortBy: 'group', sortDir: 'ASC' });
      all.push(...res.data);
      if (!res.meta.hasNext || res.data.length === 0) break;
      page++;
    }
    return all;
  }

  private idempotencyKeyFor(roleId: string, permissionIds: string[]): string {
    const fingerprint = `${roleId}:${JSON.stringify([...permissionIds].sort())}`;
    if (fingerprint !== this.lastFingerprint || !this.lastIdempotencyKey) {
      this.lastFingerprint = fingerprint;
      this.lastIdempotencyKey = newIdempotencyKey();
    }
    return this.lastIdempotencyKey;
  }

  private clearIdempotency(): void {
    this.lastFingerprint = null;
    this.lastIdempotencyKey = null;
  }

  private async confirmDiscardAndClose(): Promise<void> {
    if (await this.confirmDiscard()) {
      this.closeImmediate();
    }
  }

  private async confirmDiscard(): Promise<boolean> {
    if (this.confirmingDiscard) return false;
    this.confirmingDiscard = true;
    try {
      return await this.discardDialog().open();
    } finally {
      this.confirmingDiscard = false;
    }
  }
}

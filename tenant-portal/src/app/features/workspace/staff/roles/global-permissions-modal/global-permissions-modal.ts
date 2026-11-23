import { Component, computed, inject, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerCloudOff,
  tablerListCheck,
  tablerLock,
  tablerRefresh,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Modal } from '../../../../../shared/ui/modal/modal';
import {
  ApiError,
  errorCodeOf,
  staffErrorMessage,
  listAllPages,
  newIdempotencyKey,
} from '../../shared/staff.api';
import { RolesApi } from '../roles.api';
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

@Component({
  selector: 'app-global-permissions-modal',
  imports: [TranslocoPipe, NgIcon, Button, ConfirmDialog, Modal, PermissionTree, SeatImpact],
  providers: [
    provideTranslocoScope(
      'settings',
      'staff',
      { scope: 'staff-roles', alias: 'roles' },
      { scope: 'seats', alias: 'seats' },
    ),
    provideIcons({
      tablerListCheck,
      tablerLock,
      tablerAlertTriangle,
      tablerCloudOff,
      tablerRefresh,
    }),
  ],
  templateUrl: './global-permissions-modal.html',
})
export class GlobalPermissionsModal {
  private readonly notify = inject(Notify);
  private readonly api = inject(RolesApi);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  protected readonly session = inject(StaffSession);
  private readonly cascadeConfirm = inject(SeatCascadeConfirm);

  private readonly modal = viewChild.required(Modal);
  private readonly discardDialog = viewChild.required(ConfirmDialog);

  readonly saved = output<RoleDetail>();
  readonly branchModeConflict = output<string>();
  readonly missing = output<void>();

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
  private lastCascadeConfirmed = false;

  protected readonly roleDisplayName = computed(() => {
    const current = this.role();
    if (!current) return this.fallbackRoleName();
    const localized = this.language() === 'ar' ? current.nameI18n?.ar : current.nameI18n?.en;
    return localized?.trim() || current.name;
  });

  protected readonly isBranchRole = computed(() => this.role()?.permissionMode === 'BRANCH');

  protected readonly disabledPermissionIds = computed<readonly string[]>(() => {
    return this.entries()
      .filter((entry) => !this.session.isTenantWide(entry.key))
      .map((entry) => entry.id);
  });

  protected readonly exceedsAuthority = computed(() => {
    const permittedIds = new Set(
      this.entries()
        .filter((entry) => this.session.isTenantWide(entry.key))
        .map((entry) => entry.id),
    );
    return this.selected().some((id) => !permittedIds.has(id));
  });

  protected readonly isReadonly = computed(() => {
    const current = this.role();
    return (
      this.forceReadonly() ||
      Boolean(current?.isSystem) ||
      current?.permissionMode === 'BRANCH' ||
      !this.session.canReadRolePermissions() ||
      !this.session.isTenantWide('roles.role.update')
    );
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
    if (!this.session.canReadRolePermissions()) return;
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
    this.clearIdempotency();
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
    if (
      !current ||
      this.isReadonly() ||
      this.saving() ||
      this.loading() ||
      !this.dirty() ||
      this.seatBlocked()
    ) {
      return;
    }
    if (this.selected().length > this.maxPermissions) {
      this.notify.error(
        this.transloco.translate('roles.errors.TENANT_ROLE_PERMISSION_LIMIT_EXCEEDED'),
      );
      return;
    }

    const permissionIds = [...this.selected()];
    const permittedIds = new Set(
      this.entries()
        .filter((entry) => this.session.isTenantWide(entry.key))
        .map((entry) => entry.id),
    );
    if (permissionIds.some((id) => !permittedIds.has(id))) return;
    let key = this.idempotencyKeyFor(current.id, permissionIds);
    if (confirmAddonCascade) {
      key = newIdempotencyKey();
      this.lastIdempotencyKey = key;
      this.lastCascadeConfirmed = true;
    }
    const cascadeConfirmed = this.lastCascadeConfirmed;
    this.saving.set(true);

    try {
      const updated = await this.api.setPermissions(current.id, permissionIds, key, {
        confirmAddonCascade: cascadeConfirmed,
      });
      this.clearIdempotency();
      this.notify.success(this.transloco.translate('roles.global.saved'));
      this.closeImmediate();
      this.saved.emit(updated);
    } catch (error) {
      const cascade = isCascadeRequired(error);
      if (cascade && !cascadeConfirmed) {
        const confirmed = await this.cascadeConfirm.confirm(cascade.addons);
        if (confirmed) {
          this.saving.set(false);
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
        this.notify.error(
          this.transloco.translate('roles.errors.TENANT_ROLE_PERMISSION_LIMIT_EXCEEDED'),
        );
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
        this.branchModeConflict.emit(current.id);
        return;
      }
      const message = staffErrorMessage(error, 'roles', this.transloco, 'write');
      if (code === 'GW.IDEM.IN_FLIGHT') this.notify.info(message);
      else if (code === 'GW.IDEM.MISMATCH') this.notify.warning(message);
      else this.notify.error(message);
      if (code === 'ROLE_NOT_FOUND' || (error instanceof ApiError && error.status === 404)) {
        this.closeImmediate();
        this.missing.emit();
      }
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
      if (!this.session.canReadRolePermissions()) return;
      const [roleDetail, permissions] = await Promise.all([
        this.api.get(roleId),
        this.fetchAllPermissions(),
      ]);
      if (seq !== this.loadSeq || !this.session.canReadRolePermissions()) return;
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
    return listAllPages(
      (query) => {
        if ((query.page ?? 1) > 10) throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
        return this.api.listPermissions(query);
      },
      { limit: 100, sortBy: 'group', sortDir: 'ASC' },
    );
  }

  private idempotencyKeyFor(roleId: string, permissionIds: string[]): string {
    const fingerprint = `${roleId}:${JSON.stringify(permissionIds)}`;
    if (fingerprint !== this.lastFingerprint || !this.lastIdempotencyKey) {
      this.lastFingerprint = fingerprint;
      this.lastCascadeConfirmed = false;
      this.lastIdempotencyKey = newIdempotencyKey();
    }
    return this.lastIdempotencyKey;
  }

  private clearIdempotency(): void {
    this.lastFingerprint = null;
    this.lastIdempotencyKey = null;
    this.lastCascadeConfirmed = false;
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

import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle, tablerListCheck, tablerLock } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { ApiError, errorCodeOf } from '../../../shared/trade-api';
import type { ReasonKind } from '../../../shared/trade-foundation.model';
import { REASON_CODE_PATTERN, REASON_NAME_MAX, type KnownReasonKind } from '../../../shared/reasons/reason-kinds';
import {
  type AdminReasonCode,
  type CreateReasonInput,
  type UpdateReasonPatch,
  createReason,
  deleteReason,
  listReasonsAdmin,
  updateReason,
} from '../../../shared/reasons/reasons-admin.api';
import { isKnownReasonKind, optionalTradeContext, reasonErrorText } from '../reason-errors';
import { SettingsMutationKeys } from '../../settings-mutation-keys';
import { translationEvents } from '../../../../../core/i18n/translation-events';

type ReasonField = 'code' | 'nameAr' | 'nameEn' | 'sortOrder';

interface ReasonFieldError {
  key: string;
  params?: Record<string, number>;
}

interface ReasonFormValue {
  code: string;
  nameAr: string;
  nameEn: string;
  sortOrder: string;
  requiresNote: boolean;
  isActive: boolean;
}

const SORT_ORDER_MIN = 0;
const SORT_ORDER_MAX = 1_000_000;

function createEmptyForm(defaultOrder: number): ReasonFormValue {
  return {
    code: '',
    nameAr: '',
    nameEn: '',
    sortOrder: String(defaultOrder),
    requiresNote: false,
    isActive: true,
  };
}

function reasonToForm(reason: AdminReasonCode): ReasonFormValue {
  return {
    code: reason.code,
    nameAr: reason.localizedNames.ar ?? '',
    nameEn: reason.localizedNames.en ?? '',
    sortOrder: String(reason.sortOrder),
    requiresNote: reason.requiresNote,
    isActive: reason.isActive,
  };
}

function mapValidationFieldErrors(details: Record<string, string[]> | undefined): Partial<Record<ReasonField, ReasonFieldError>> {
  if (!details) return {};
  const mapped: Partial<Record<ReasonField, ReasonFieldError>> = {};
  const fieldHint = details['field'];

  if ('code' in details || (Array.isArray(fieldHint) && fieldHint.includes('code'))) {
    mapped.code = { key: 'treasons.validation.reasonCode' };
  }
  if ('localizedNames.ar' in details) {
    mapped.nameAr = { key: 'treasons.validation.required' };
  }
  if ('localizedNames.en' in details) {
    mapped.nameEn = { key: 'treasons.validation.required' };
  }
  if ('localizedNames' in details) {
    if (!mapped.nameAr) mapped.nameAr = { key: 'treasons.validation.required' };
    if (!mapped.nameEn) mapped.nameEn = { key: 'treasons.validation.required' };
  }
  if ('sortOrder' in details) {
    mapped.sortOrder = {
      key: 'treasons.validation.range',
      params: { min: SORT_ORDER_MIN, max: SORT_ORDER_MAX },
    };
  }
  return mapped;
}

@Component({
  selector: 'app-trade-reason-modal',
  imports: [NgIcon, TranslocoPipe, Button, ConfirmDialog, Field, Modal, Switch],
  providers: [
    provideTranslocoScope(
      { scope: 'trade-shared', alias: 'tradeShared' },
      'settings',
      { scope: 'trade-settings', alias: 'tset' },
      { scope: 'trade-settings-reasons', alias: 'treasons' },
    ),
    provideIcons({ tablerListCheck, tablerLock, tablerAlertTriangle }),
  ],
  templateUrl: './reason-modal.html',
})
export class ReasonModal {
  private static nextId = 0;
  protected readonly uid = `trade-reason-modal-${++ReasonModal.nextId}`;

  private readonly notify = inject(Notify);
  private readonly tenantScope = inject(TenantScopeState);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly modal = viewChild.required<Modal>('reasonModal');
  private readonly conflictModal = viewChild.required<Modal>('conflictModal');
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');
  private readonly deleteDialog = viewChild.required<ConfirmDialog>('deleteDialog');

  readonly canManage = input(true);
  readonly saved = output<AdminReasonCode>();
  readonly reloaded = output<AdminReasonCode>();
  readonly deleted = output<AdminReasonCode>();

  protected readonly nameMax = REASON_NAME_MAX;
  protected readonly mode = signal<'create' | 'edit'>('create');
  protected readonly kind = signal<ReasonKind>('DOCUMENT_CANCEL');
  protected readonly baseReason = signal<AdminReasonCode | null>(null);
  protected readonly form = signal<ReasonFormValue>(createEmptyForm(10));
  protected readonly saving = signal(false);
  protected readonly deleting = signal(false);
  protected readonly conflictBusy = signal(false);
  private readonly touched = signal<Partial<Record<ReasonField, boolean>>>({});
  private readonly revealAllErrors = signal(false);
  private readonly serverFieldErrors = signal<Partial<Record<ReasonField, ReasonFieldError>>>({});
  private readonly pendingConflictPatch = signal<UpdateReasonPatch | null>(null);
  private readonly pendingConflictDelete = signal(false);
  private readonly conflictFromRow = signal(false);

  private defaultOrder = 10;
  private allowClose = false;
  private confirmingDiscard = false;
  private readonly mutationKeys = new SettingsMutationKeys();

  protected readonly isInventoryKind = computed(() => this.kind().startsWith('INVENTORY_'));
  protected readonly isSystemRow = computed(() => this.mode() === 'edit' && Boolean(this.baseReason()?.isSystem));
  protected readonly kindLabel = computed(() => {
    this.i18n();
    const k = this.kind();
    const key = `tset.kinds.${k}`;
    const translated = this.transloco.translate(key);
    return translated !== key ? translated : k;
  });

  protected readonly validationErrors = computed<
    Partial<Record<ReasonField, { key: string; params?: Record<string, number> }>>
  >(() => {
    const value = this.form();
    const errors: Partial<Record<ReasonField, { key: string; params?: Record<string, number> }>> = {};

    if (this.mode() === 'create') {
      const code = value.code.trim().toUpperCase();
      if (!code) {
        errors.code = { key: 'required' };
      } else if (!REASON_CODE_PATTERN.test(code)) {
        errors.code = { key: 'reasonCode' };
      }
    }

    const nameAr = value.nameAr.trim();
    if (!nameAr) {
      errors.nameAr = { key: 'required' };
    } else if (nameAr.length > REASON_NAME_MAX) {
      errors.nameAr = { key: 'maxLength', params: { max: REASON_NAME_MAX } };
    }

    const nameEn = value.nameEn.trim();
    if (!nameEn) {
      errors.nameEn = { key: 'required' };
    } else if (nameEn.length > REASON_NAME_MAX) {
      errors.nameEn = { key: 'maxLength', params: { max: REASON_NAME_MAX } };
    }

    const orderRaw = value.sortOrder.trim();
    if (!orderRaw) {
      errors.sortOrder = { key: 'required' };
    } else if (!/^\d+$/.test(orderRaw)) {
      errors.sortOrder = { key: 'range', params: { min: SORT_ORDER_MIN, max: SORT_ORDER_MAX } };
    } else {
      const parsed = Number(orderRaw);
      if (!Number.isInteger(parsed) || parsed < SORT_ORDER_MIN || parsed > SORT_ORDER_MAX) {
        errors.sortOrder = { key: 'range', params: { min: SORT_ORDER_MIN, max: SORT_ORDER_MAX } };
      }
    }

    return errors;
  });

  protected readonly isValid = computed(() => Object.keys(this.validationErrors()).length === 0);

  protected readonly editPatch = computed<UpdateReasonPatch>(() => {
    const base = this.baseReason();
    if (this.mode() !== 'edit' || !base) return {};
    const value = this.form();
    const patch: UpdateReasonPatch = {};

    const nameAr = value.nameAr.trim();
    const nameEn = value.nameEn.trim();
    const baseAr = (base.localizedNames['ar'] ?? '').trim();
    const baseEn = (base.localizedNames['en'] ?? '').trim();
    if (nameAr !== baseAr || nameEn !== baseEn) {
      patch.localizedNames = { en: nameEn, ar: nameAr };
    }

    if (value.requiresNote !== base.requiresNote) {
      patch.requiresNote = value.requiresNote;
    }

    const orderRaw = value.sortOrder.trim();
    const orderNum = /^\d+$/.test(orderRaw) ? Number(orderRaw) : NaN;
    if (Number.isInteger(orderNum) && orderNum !== base.sortOrder) {
      patch.sortOrder = orderNum;
    }

    if (!base.isSystem && value.isActive !== base.isActive) {
      patch.isActive = value.isActive;
    }

    return patch;
  });

  protected readonly dirty = computed(() => {
    const value = this.form();
    const orderRaw = value.sortOrder.trim();
    if (this.mode() === 'edit') {
      const base = this.baseReason();
      if (!base) return false;
      const orderChanged = !/^\d+$/.test(orderRaw) || Number(orderRaw) !== base.sortOrder;
      return (
        value.nameAr.trim() !== (base.localizedNames['ar'] ?? '').trim() ||
        value.nameEn.trim() !== (base.localizedNames['en'] ?? '').trim() ||
        value.requiresNote !== base.requiresNote ||
        orderChanged ||
        (!base.isSystem && value.isActive !== base.isActive)
      );
    }
    const orderChanged = !/^\d+$/.test(orderRaw) || Number(orderRaw) !== this.defaultOrder;
    return Boolean(
      value.code.trim() ||
        value.nameAr.trim() ||
        value.nameEn.trim() ||
        value.requiresNote ||
        !value.isActive ||
        orderChanged,
    );
  });

  openCreate(kind: KnownReasonKind, nextOrder: number): void {
    this.mode.set('create');
    this.kind.set(kind);
    this.baseReason.set(null);
    this.defaultOrder = nextOrder;
    this.form.set(createEmptyForm(nextOrder));
    this.mutationKeys.clearAll();
    this.clearPendingConflict();
    this.resetValidation();
    this.allowClose = false;
    this.modal().open();
  }

  openEdit(reason: AdminReasonCode): void {
    this.mode.set('edit');
    this.kind.set(reason.kind);
    this.baseReason.set(reason);
    this.form.set(reasonToForm(reason));
    this.mutationKeys.clearAll();
    this.clearPendingConflict();
    this.resetValidation();
    this.allowClose = false;
    this.modal().open();
  }

  openConflict(reason: AdminReasonCode, patch: UpdateReasonPatch): void {
    this.baseReason.set(reason);
    this.pendingConflictPatch.set(patch);
    this.pendingConflictDelete.set(false);
    this.conflictFromRow.set(true);
    this.conflictModal().open();
  }

  async confirmDelete(reason: AdminReasonCode, fromModal = false): Promise<void> {
    if (!this.canManage() || reason.isSystem || this.deleting() || this.saving()) return;
    const confirmed = await this.deleteDialog().open();
    if (!confirmed) return;

    this.deleting.set(true);
    try {
      const operation = `delete:${reason.id}`;
      const removed = await deleteReason(
        reason.id,
        reason.version,
        this.mutationKeys.for(operation, { version: reason.version }),
      );
      this.mutationKeys.clear(operation);
      if (fromModal) {
        this.allowClose = true;
        this.modal().close();
      }
      this.deleted.emit(removed);
      this.notify.success(this.transloco.translate('treasons.toasts.deleted'));
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.baseReason.set(reason);
        this.pendingConflictPatch.set(null);
        this.pendingConflictDelete.set(true);
        this.conflictFromRow.set(!fromModal);
        this.conflictModal().open();
        return;
      }
      if (code === 'TRADE.REASON.NOT_FOUND') {
        this.notify.error(this.transloco.translate('tset.errors.TRADE_REASON_NOT_FOUND'));
        this.deleted.emit(reason);
        if (fromModal) {
          this.allowClose = true;
          this.modal().close();
        }
        return;
      }
      this.showErrorToast(error);
    } finally {
      this.deleting.set(false);
    }
  }

  protected requestDelete(): void {
    const base = this.baseReason();
    if (!base || base.isSystem || !this.canManage() || this.saving() || this.deleting()) return;
    void this.confirmDelete(base, true);
  }

  protected undo(): void {
    if (this.saving() || this.deleting()) return;
    const base = this.baseReason();
    if (this.mode() === 'edit' && base) {
      this.form.set(reasonToForm(base));
    } else {
      this.form.set(createEmptyForm(this.defaultOrder));
    }
    this.mutationKeys.clearAll();
    this.resetValidation();
  }

  protected requestClose(): void {
    if (this.saving() || this.deleting()) return;
    if (!this.canManage() || !this.dirty()) {
      this.allowClose = true;
      this.modal().close();
      return;
    }
    void this.confirmModalClose();
  }

  protected onModalClosed(): void {
    if (this.saving() || this.deleting()) {
      this.modal().open();
      return;
    }
    if (!this.allowClose && this.canManage() && this.dirty()) {
      this.modal().open();
      void this.confirmModalClose();
      return;
    }
    this.allowClose = false;
  }

  protected errorText(field: ReasonField): string | null {
    this.i18n();
    const serverErr = this.serverFieldErrors()[field];
    if (serverErr) {
      return this.transloco.translate(serverErr.key, serverErr.params);
    }
    const err = this.validationErrors()[field];
    if (!err) return null;
    if (!this.revealAllErrors() && !this.touched()[field]) return null;
    return this.transloco.translate(`treasons.validation.${err.key}`, err.params);
  }

  protected onCodeInput(event: Event): void {
    if (!this.canManage() || this.mode() === 'edit') return;
    const target = event.target as HTMLInputElement;
    const upper = target.value.toUpperCase();
    if (target.value !== upper) {
      target.value = upper;
    }
    this.form.update((current) => ({ ...current, code: upper }));
    this.clearServerFieldError('code');
  }

  protected onFieldInput(field: 'nameAr' | 'nameEn' | 'sortOrder', event: Event): void {
    if (!this.canManage()) return;
    const value = (event.target as HTMLInputElement).value;
    this.form.update((current) => ({ ...current, [field]: value }));
    this.clearServerFieldError(field);
  }

  protected setRequiresNote(checked: boolean): void {
    if (!this.canManage()) return;
    this.form.update((current) => ({ ...current, requiresNote: checked }));
  }

  protected setActive(checked: boolean): void {
    if (!this.canManage() || this.isSystemRow()) return;
    this.form.update((current) => ({ ...current, isActive: checked }));
  }

  protected markTouched(field: ReasonField): void {
    this.touched.update((current) => (current[field] ? current : { ...current, [field]: true }));
  }

  protected async save(): Promise<void> {
    if (!this.canManage() || this.saving() || this.deleting() || !this.dirty()) return;

    this.revealAllErrors.set(true);
    if (!this.isValid()) return;

    this.saving.set(true);
    try {
      if (this.mode() === 'create') {
        const currentKind = this.kind();
        if (!isKnownReasonKind(currentKind)) {
          throw new ApiError(422, 'TRADE.REASON.KIND_INVALID', { field: ['kind'] });
        }
        const value = this.form();
        const payload: CreateReasonInput = {
          kind: currentKind,
          code: value.code.trim().toUpperCase(),
          localizedNames: {
            en: value.nameEn.trim(),
            ar: value.nameAr.trim(),
          },
          requiresNote: value.requiresNote,
          sortOrder: Number(value.sortOrder.trim()),
          isActive: value.isActive,
        };
        const created = await createReason(payload, this.mutationKeys.for('create', payload));
        this.mutationKeys.clear('create');
        this.saved.emit(created);
        this.notify.success(this.transloco.translate('treasons.toasts.created'));
        this.allowClose = true;
        this.modal().close();
        return;
      }

      const base = this.baseReason();
      const patch = this.editPatch();
      if (!base || Object.keys(patch).length === 0) return;

      const operation = `update:${base.id}`;
      const updated = await updateReason(
        base.id,
        base.version,
        patch,
        this.mutationKeys.for(operation, { version: base.version, patch }),
      );
      this.mutationKeys.clear(operation);
      this.baseReason.set(updated);
      this.form.set(reasonToForm(updated));
      this.resetValidation();
      this.saved.emit(updated);
      this.notify.success(this.transloco.translate('treasons.toasts.updated'));
      this.allowClose = true;
      this.modal().close();
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'TRADE.REASON.CODE_TAKEN') {
        this.serverFieldErrors.set({ code: { key: 'tset.errors.TRADE_REASON_CODE_TAKEN' } });
        return;
      }
      if (code === 'TRADE.VALIDATION_FAILED' && error instanceof ApiError) {
        const mapped = mapValidationFieldErrors(error.details);
        if (Object.keys(mapped).length > 0) {
          this.serverFieldErrors.set(mapped);
          return;
        }
      }
      if (code === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.pendingConflictPatch.set(null);
        this.pendingConflictDelete.set(false);
        this.conflictFromRow.set(false);
        this.conflictModal().open();
        return;
      }
      this.showErrorToast(error);
    } finally {
      this.saving.set(false);
    }
  }

  protected onConflictClosed(): void {
    if (!this.conflictBusy()) {
      this.clearPendingConflict();
    }
  }

  protected async reloadLatest(): Promise<void> {
    const base = this.baseReason();
    if (!base || this.conflictBusy()) return;
    const fromRow = this.conflictFromRow();
    this.conflictBusy.set(true);
    try {
      const kindFilter = isKnownReasonKind(base.kind) ? base.kind : undefined;
      const list = await listReasonsAdmin(kindFilter, true, optionalTradeContext(this.tenantScope));
      const fresh = list.find((item) => item.id === base.id);
      this.conflictModal().close();
      this.clearPendingConflict();
      if (!fresh) {
        this.notify.error(this.transloco.translate('tset.errors.TRADE_REASON_NOT_FOUND'));
        this.deleted.emit(base);
        if (!fromRow) {
          this.allowClose = true;
          this.modal().close();
        }
        return;
      }
      this.baseReason.set(fresh);
      if (!fromRow) {
        this.form.set(reasonToForm(fresh));
        this.resetValidation();
      }
      this.reloaded.emit(fresh);
    } catch (error) {
      this.showErrorToast(error);
    } finally {
      this.conflictBusy.set(false);
    }
  }

  protected async saveMineOverStale(): Promise<void> {
    const base = this.baseReason();
    const rowPatch = this.pendingConflictPatch();
    const isDelete = this.pendingConflictDelete();
    const fromRow = this.conflictFromRow();
    const patch = rowPatch ?? this.editPatch();
    if (!base || this.conflictBusy() || (!isDelete && Object.keys(patch).length === 0)) return;

    this.conflictBusy.set(true);
    try {
      const kindFilter = isKnownReasonKind(base.kind) ? base.kind : undefined;
      const list = await listReasonsAdmin(kindFilter, true, optionalTradeContext(this.tenantScope));
      const fresh = list.find((item) => item.id === base.id);
      if (!fresh) {
        this.conflictModal().close();
        this.clearPendingConflict();
        this.notify.error(this.transloco.translate('tset.errors.TRADE_REASON_NOT_FOUND'));
        this.deleted.emit(base);
        if (!fromRow) {
          this.allowClose = true;
          this.modal().close();
        }
        return;
      }

      if (isDelete) {
        const operation = `delete:${fresh.id}`;
        const removed = await deleteReason(
          fresh.id,
          fresh.version,
          this.mutationKeys.for(operation, { version: fresh.version }),
        );
        this.mutationKeys.clear(operation);
        this.conflictModal().close();
        this.clearPendingConflict();
        if (!fromRow) {
          this.allowClose = true;
          this.modal().close();
        }
        this.deleted.emit(removed);
        this.notify.success(this.transloco.translate('treasons.toasts.deleted'));
        return;
      }

      const operation = `update:${fresh.id}`;
      const updated = await updateReason(
        fresh.id,
        fresh.version,
        patch,
        this.mutationKeys.for(operation, { version: fresh.version, patch }),
      );
      this.mutationKeys.clear(operation);
      this.conflictModal().close();
      this.clearPendingConflict();
      this.baseReason.set(updated);
      this.saved.emit(updated);
      if (rowPatch) {
        this.notify.success(
          this.transloco.translate(updated.isActive ? 'treasons.toasts.activated' : 'treasons.toasts.deactivated'),
        );
      } else {
        this.form.set(reasonToForm(updated));
        this.resetValidation();
        this.notify.success(this.transloco.translate('treasons.toasts.updated'));
        this.allowClose = true;
        this.modal().close();
      }
    } catch (error) {
      this.showErrorToast(error);
    } finally {
      this.conflictBusy.set(false);
    }
  }

  private clearPendingConflict(): void {
    this.pendingConflictPatch.set(null);
    this.pendingConflictDelete.set(false);
    this.conflictFromRow.set(false);
  }

  private clearServerFieldError(field: ReasonField): void {
    this.serverFieldErrors.update((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  private resetValidation(): void {
    this.touched.set({});
    this.revealAllErrors.set(false);
    this.serverFieldErrors.set({});
  }

  private async confirmModalClose(): Promise<void> {
    if (this.confirmingDiscard) return;
    this.confirmingDiscard = true;
    try {
      if (await this.discardDialog().open()) {
        this.allowClose = true;
        this.modal().close();
      }
    } finally {
      this.confirmingDiscard = false;
    }
  }

  private showErrorToast(error: unknown): void {
    this.notify.error(reasonErrorText(error, this.transloco));
  }
}

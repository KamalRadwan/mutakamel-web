import { Component, DestroyRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle, tablerLock, tablerRuler2 } from '@ng-icons/tabler-icons';
import { ApiError as CoreApiError } from '../../../../../core/api/api-errors';
import { Notify } from '../../../../../core/notify/notify';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { ApiError, errorCodeOf, errorKey, newIdempotencyKey, type TradeContext } from '../../../shared/trade-api';
import type { Uom, UomStatus } from '../../../shared/trade-foundation.model';
import { createUom, getUom, uomReferences, updateUom } from '../units.api';
import {
  CreateUomBody,
  UOM_CODE_PATTERN,
  UOM_LIMITS,
  UpdateUomBody,
  parseUomRefGroupsFromDetails,
  type UomReferenceGroup,
  type UomReferences,
} from '../units.model';

type UnitField = 'code' | 'displayName' | 'nameEn' | 'nameAr';

interface UnitFormValue {
  code: string;
  displayName: string;
  nameEn: string;
  nameAr: string;
  active: boolean;
}

function createEmptyForm(): UnitFormValue {
  return {
    code: '',
    displayName: '',
    nameEn: '',
    nameAr: '',
    active: true,
  };
}

function uomToForm(unit: Uom): UnitFormValue {
  return {
    code: unit.code,
    displayName: unit.displayName,
    nameEn: unit.localizedNames['en'] ?? '',
    nameAr: unit.localizedNames['ar'] ?? '',
    active: unit.status === 'ACTIVE',
  };
}

function isForbiddenError(error: unknown): boolean {
  return (error instanceof ApiError || error instanceof CoreApiError) && error.status === 403;
}

function optionalTradeContext(tenantScope: TenantScopeState): TradeContext {
  const selection = tenantScope.selection?.();
  if (!selection?.companyId) return {};
  return selection.branchId
    ? { companyId: selection.companyId, branchId: selection.branchId }
    : { companyId: selection.companyId };
}

function mapValidationFieldErrors(details: Record<string, string[]> | undefined): Partial<Record<UnitField, string>> {
  if (!details) return {};
  const mapped: Partial<Record<UnitField, string>> = {};

  for (const [field, messages] of Object.entries(details)) {
    const text = messages.join(' ').toLowerCase();
    if (field === 'code') {
      mapped.code =
        text.includes('match') || text.includes('pattern') || text.includes('shorter') || text.includes('longer')
          ? 'tradeUnits.modal.codePattern'
          : 'tradeShared.errors.TRADE_VALIDATION_FAILED';
    } else if (field === 'displayName') {
      mapped.displayName =
        text.includes('empty') || text.includes('required')
          ? 'tradeShared.common.required'
          : 'tradeShared.errors.TRADE_VALIDATION_FAILED';
    } else if (field === 'localizedNames.en' || field === 'localizedNames') {
      mapped.nameEn =
        text.includes('empty') || text.includes('required')
          ? 'tradeShared.common.required'
          : 'tradeShared.errors.TRADE_VALIDATION_FAILED';
    } else if (field === 'localizedNames.ar') {
      mapped.nameAr =
        text.includes('empty') || text.includes('required')
          ? 'tradeShared.common.required'
          : 'tradeShared.errors.TRADE_VALIDATION_FAILED';
    }
  }

  return mapped;
}

@Component({
  selector: 'app-unit-modal',
  imports: [NgIcon, TranslocoPipe, Button, ConfirmDialog, Field, Modal, Switch],
  providers: [provideIcons({ tablerRuler2, tablerLock, tablerAlertTriangle })],
  templateUrl: './unit-modal.html',
})
export class UnitModal {
  private static nextId = 0;
  protected readonly uid = `unit-modal-${++UnitModal.nextId}`;

  private readonly notify = inject(Notify);
  private readonly tenantScope = inject(TenantScopeState);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly modal = viewChild.required<Modal>('unitModal');
  private readonly conflictModal = viewChild.required<Modal>('conflictModal');
  private readonly inUseModal = viewChild.required<Modal>('inUseModal');
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');
  private readonly retireDialog = viewChild.required<ConfirmDialog>('retireDialog');

  readonly canManage = input(true);
  readonly saved = output<{ unit: Uom; isNew: boolean }>();
  readonly reloaded = output<Uom>();
  readonly forbidden = output<void>();

  protected readonly limits = UOM_LIMITS;
  protected readonly inUseReasonKeys = [
    'tradeUnits.inUse.reason1',
    'tradeUnits.inUse.reason2',
    'tradeUnits.inUse.reason3',
    'tradeUnits.inUse.reason4',
    'tradeUnits.inUse.reason5',
    'tradeUnits.inUse.reason6',
    'tradeUnits.inUse.reason7',
  ] as const;

  protected readonly mode = signal<'create' | 'edit'>('create');
  protected readonly baseUnit = signal<Uom | null>(null);
  protected readonly form = signal<UnitFormValue>(createEmptyForm());
  protected readonly saving = signal(false);
  protected readonly conflictBusy = signal(false);
  protected readonly inUseGroups = signal<readonly UomReferenceGroup[]>([]);
  private readonly touched = signal<Partial<Record<UnitField, boolean>>>({});
  private readonly revealAllErrors = signal(false);
  private readonly serverFieldErrors = signal<Partial<Record<UnitField, string>>>({});
  private readonly pendingRowConflict = signal<{ unit: Uom; targetStatus: UomStatus } | null>(null);

  private destroyed = false;
  private allowClose = false;
  private confirmingDiscard = false;
  private pendingIdempotency: { signature: string; key: string } | null = null;

  protected readonly validationErrors = computed<Partial<Record<UnitField, string>>>(() => {
    const value = this.form();
    const errors: Partial<Record<UnitField, string>> = {};

    if (this.mode() === 'create') {
      const code = value.code.trim();
      if (!code) {
        errors.code = 'tradeShared.common.required';
      } else if (!UOM_CODE_PATTERN.test(code)) {
        errors.code = 'tradeUnits.modal.codePattern';
      }
    }

    const displayName = value.displayName.trim();
    if (!displayName) {
      errors.displayName = 'tradeShared.common.required';
    } else if (displayName.length > UOM_LIMITS.nameMax) {
      errors.displayName = 'tradeShared.errors.TRADE_VALIDATION_FAILED';
    }

    const nameEn = value.nameEn.trim();
    if (!nameEn) {
      errors.nameEn = 'tradeShared.common.required';
    } else if (nameEn.length > UOM_LIMITS.nameMax) {
      errors.nameEn = 'tradeShared.errors.TRADE_VALIDATION_FAILED';
    }

    const nameAr = value.nameAr.trim();
    if (!nameAr) {
      errors.nameAr = 'tradeShared.common.required';
    } else if (nameAr.length > UOM_LIMITS.nameMax) {
      errors.nameAr = 'tradeShared.errors.TRADE_VALIDATION_FAILED';
    }

    return errors;
  });

  protected readonly isValid = computed(() => Object.keys(this.validationErrors()).length === 0);

  protected readonly editPatch = computed<UpdateUomBody>(() => {
    const base = this.baseUnit();
    if (this.mode() !== 'edit' || !base) return {};
    const value = this.form();
    const patch: UpdateUomBody = {};

    const displayName = value.displayName.trim();
    if (displayName !== base.displayName) {
      patch.displayName = displayName;
    }

    const en = value.nameEn.trim();
    const ar = value.nameAr.trim();
    const baseEn = base.localizedNames['en'] ?? '';
    const baseAr = base.localizedNames['ar'] ?? '';
    if (en !== baseEn || ar !== baseAr) {
      patch.localizedNames = { ...base.localizedNames, en, ar };
    }

    const nextStatus: UomStatus = value.active ? 'ACTIVE' : 'RETIRED';
    if (nextStatus !== base.status) {
      patch.status = nextStatus;
    }

    return patch;
  });

  protected readonly dirty = computed(() => {
    if (this.mode() === 'edit') {
      return Object.keys(this.editPatch()).length > 0;
    }
    const value = this.form();
    return Boolean(
      value.code.trim() || value.displayName.trim() || value.nameEn.trim() || value.nameAr.trim(),
    );
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
    });
  }

  openCreate(): void {
    this.mode.set('create');
    this.baseUnit.set(null);
    this.form.set(createEmptyForm());
    this.pendingIdempotency = null;
    this.pendingRowConflict.set(null);
    this.resetValidation();
    this.allowClose = false;
    this.modal().open();
  }

  openEdit(unit: Uom): void {
    this.mode.set('edit');
    this.baseUnit.set(unit);
    this.form.set(uomToForm(unit));
    this.pendingIdempotency = null;
    this.pendingRowConflict.set(null);
    this.resetValidation();
    this.allowClose = false;
    this.modal().open();
  }

  openInUseWarning(groups: readonly UomReferenceGroup[] = []): void {
    this.inUseGroups.set(groups.filter((group) => group.count > 0));
    this.inUseModal().open();
  }

  openConflictFromRow(unit: Uom, targetStatus: UomStatus): void {
    this.baseUnit.set(unit);
    this.pendingRowConflict.set({ unit, targetStatus });
    this.conflictModal().open();
  }

  protected refGroupLabel(group: UomReferenceGroup): string {
    this.i18n();
    const prefix = group.count === 1 ? 'tradeUnits.retire.groupOne' : 'tradeUnits.retire.group';
    return this.transloco.translate(`${prefix}.${group.key}`);
  }

  protected errorText(field: UnitField): string | null {
    this.i18n();
    const serverKey = this.serverFieldErrors()[field];
    if (serverKey) {
      return this.transloco.translate(serverKey);
    }
    const key = this.validationErrors()[field];
    if (!key) return null;
    if (!this.revealAllErrors() && !this.touched()[field]) return null;
    return this.transloco.translate(key);
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

  protected onFieldInput(field: 'displayName' | 'nameEn' | 'nameAr', event: Event): void {
    if (!this.canManage()) return;
    const value = (event.target as HTMLInputElement).value;
    this.form.update((current) => ({ ...current, [field]: value }));
    this.clearServerFieldError(field);
  }

  protected setActive(checked: boolean): void {
    if (!this.canManage() || this.mode() !== 'edit') return;
    this.form.update((current) => ({ ...current, active: checked }));
  }

  protected markTouched(field: UnitField): void {
    this.touched.update((current) => (current[field] ? current : { ...current, [field]: true }));
  }

  protected undo(): void {
    if (this.saving()) return;
    const base = this.baseUnit();
    this.form.set(this.mode() === 'edit' && base ? uomToForm(base) : createEmptyForm());
    this.pendingIdempotency = null;
    this.resetValidation();
  }

  protected requestClose(): void {
    if (this.saving()) return;
    if (!this.canManage() || !this.dirty()) {
      this.allowClose = true;
      this.modal().close();
      return;
    }
    void this.confirmModalClose();
  }

  protected onModalClosed(): void {
    if (this.saving()) {
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

  protected async save(): Promise<void> {
    if (!this.canManage() || this.saving() || !this.dirty()) return;

    this.revealAllErrors.set(true);
    if (!this.isValid()) return;

    if (this.mode() === 'edit') {
      const base = this.baseUnit();
      const patch = this.editPatch();
      if (!base || Object.keys(patch).length === 0) return;

      if (base.status === 'ACTIVE' && patch.status === 'RETIRED') {
        this.saving.set(true);
        let refs: UomReferences;
        try {
          refs = await uomReferences(base.id, optionalTradeContext(this.tenantScope));
        } catch (error) {
          if (isForbiddenError(error)) {
            this.pendingIdempotency = null;
            this.allowClose = true;
            this.modal().close();
            this.forbidden.emit();
            return;
          }
          this.notify.error(this.transloco.translate(errorKey(error)));
          return;
        } finally {
          this.saving.set(false);
        }
        if (this.destroyed) return;
        if (refs.blocking) {
          this.form.update((current) => ({ ...current, active: true }));
          this.pendingIdempotency = null;
          this.openInUseWarning(refs.groups);
          return;
        }

        const confirmed = await this.retireDialog().open();
        if (!confirmed || this.destroyed) return;
      }

      const key = this.idempotencyKeyFor({ mode: 'edit', id: base.id, version: base.version, body: patch });
      this.saving.set(true);
      try {
        const updated = await updateUom(base.id, patch, base.version, key);
        this.pendingIdempotency = null;
        this.baseUnit.set(updated);
        this.form.set(uomToForm(updated));
        this.resetValidation();
        this.saved.emit({ unit: updated, isNew: false });
        this.notify.success(this.transloco.translate('tradeUnits.toast.saved'));
        this.allowClose = true;
        this.modal().close();
      } catch (error) {
        this.handleSaveError(error);
      } finally {
        this.saving.set(false);
      }
      return;
    }

    const value = this.form();
    const body: CreateUomBody = {
      code: value.code.trim().toUpperCase(),
      displayName: value.displayName.trim(),
      localizedNames: {
        en: value.nameEn.trim(),
        ar: value.nameAr.trim(),
      },
    };
    const key = this.idempotencyKeyFor({ mode: 'create', body });
    this.saving.set(true);
    try {
      const created = await createUom(body, key);
      this.pendingIdempotency = null;
      this.saved.emit({ unit: created, isNew: true });
      this.notify.success(this.transloco.translate('tradeUnits.toast.created'));
      this.allowClose = true;
      this.modal().close();
    } catch (error) {
      this.handleSaveError(error);
    } finally {
      this.saving.set(false);
    }
  }

  protected onConflictClosed(): void {
    if (this.conflictBusy()) {
      this.conflictModal().open();
      return;
    }
    this.pendingRowConflict.set(null);
  }

  protected async reloadLatest(): Promise<void> {
    const base = this.baseUnit();
    if (!base || this.conflictBusy()) return;
    const fromRow = this.pendingRowConflict() !== null;
    this.conflictBusy.set(true);
    try {
      const fresh = await getUom(base.id, optionalTradeContext(this.tenantScope));
      this.conflictModal().close();
      this.pendingRowConflict.set(null);
      this.pendingIdempotency = null;
      this.baseUnit.set(fresh);
      if (!fromRow) {
        this.form.set(uomToForm(fresh));
        this.resetValidation();
      }
      this.reloaded.emit(fresh);
    } catch (error) {
      if (isForbiddenError(error)) {
        this.conflictModal().close();
        this.pendingRowConflict.set(null);
        this.pendingIdempotency = null;
        if (!fromRow) {
          this.allowClose = true;
          this.modal().close();
        }
        this.forbidden.emit();
        return;
      }
      this.notify.error(this.transloco.translate(errorKey(error)));
    } finally {
      this.conflictBusy.set(false);
    }
  }

  protected async keepMyChanges(): Promise<void> {
    const base = this.baseUnit();
    if (!base || this.conflictBusy()) return;
    const rowConflict = this.pendingRowConflict();
    this.conflictBusy.set(true);
    try {
      const fresh = await getUom(base.id, optionalTradeContext(this.tenantScope));
      this.conflictModal().close();
      this.pendingRowConflict.set(null);
      this.pendingIdempotency = null;
      this.baseUnit.set(fresh);
      this.reloaded.emit(fresh);
      if (rowConflict) {
        this.mode.set('edit');
        this.form.set({
          ...uomToForm(fresh),
          active: rowConflict.targetStatus === 'ACTIVE',
        });
        this.resetValidation();
        this.allowClose = false;
        this.modal().open();
      }
    } catch (error) {
      if (isForbiddenError(error)) {
        this.conflictModal().close();
        this.pendingRowConflict.set(null);
        this.pendingIdempotency = null;
        if (!rowConflict) {
          this.allowClose = true;
          this.modal().close();
        }
        this.forbidden.emit();
        return;
      }
      this.notify.error(this.transloco.translate(errorKey(error)));
    } finally {
      this.conflictBusy.set(false);
    }
  }

  protected closeInUse(): void {
    this.inUseModal().close();
  }

  private handleSaveError(error: unknown): void {
    if (isForbiddenError(error)) {
      this.pendingIdempotency = null;
      this.allowClose = true;
      this.modal().close();
      this.forbidden.emit();
      return;
    }
    const code = errorCodeOf(error);
    if (code === 'GW.IDEM.MISMATCH' || code === 'TRADE.IDEMPOTENCY.MISMATCH') {
      this.pendingIdempotency = null;
    }
    if (code === 'TRADE.CATALOG.UOM_CODE_TAKEN') {
      this.serverFieldErrors.set({ code: 'tradeUnits.modal.codeTaken' });
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
      this.pendingRowConflict.set(null);
      this.conflictModal().open();
      return;
    }
    if (code === 'TRADE.CATALOG.UOM_RETIRE_REFERENCED') {
      const details = error instanceof ApiError ? error.details : undefined;
      this.form.update((current) => ({ ...current, active: true }));
      this.pendingIdempotency = null;
      this.openInUseWarning(parseUomRefGroupsFromDetails(details));
      return;
    }
    this.notify.error(this.transloco.translate(errorKey(error)));
  }

  private idempotencyKeyFor(payload: unknown): string {
    const signature = JSON.stringify(payload);
    if (this.pendingIdempotency?.signature === signature) {
      return this.pendingIdempotency.key;
    }
    const key = newIdempotencyKey();
    this.pendingIdempotency = { signature, key };
    return key;
  }

  private clearServerFieldError(field: UnitField): void {
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
}

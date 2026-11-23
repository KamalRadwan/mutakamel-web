import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerListCheck, tablerLock } from '@ng-icons/tabler-icons';
import { ApiError, fieldErrorsOf, isRetryableWriteError, isValidationError } from '../../../../../core/api/api-errors';
import { ConflictDialog } from '../../../../../shared/ui/conflict-dialog/conflict-dialog';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Segmented, SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { errorCodeOf, newIdempotencyKey } from '../../shared/settings-api';
import { reasonsError } from '../reasons-error';
import { beginReasonEdit, createReason, listReasons, updateReason } from '../reasons.api';
import {
  CreateReasonInput,
  REASON_ACTIVITY_TYPES,
  REASON_CODE_PATTERN,
  REASON_LIMITS,
  REASON_POLARITIES,
  Reason,
  ReasonActivityType,
  ReasonKind,
  ReasonPolarity,
  UpdateReasonPatch,
} from '../reasons.model';

type ReasonField = 'code' | 'nameAr' | 'nameEn' | 'definitionAr' | 'definitionEn' | 'polarity' | 'activityType' | 'sortOrder';

interface ReasonFormValue {
  code: string;
  nameAr: string;
  nameEn: string;
  definitionAr: string;
  definitionEn: string;
  polarity: ReasonPolarity | null;
  activityType: ReasonActivityType | '';
  sortOrder: string;
  isActive: boolean;
}

const POLARITY_DOTS: Record<ReasonPolarity, string> = {
  POSITIVE: 'bg-success',
  NEUTRAL: 'bg-status-none',
  NEGATIVE: 'bg-danger',
};

const KIND_TAB_KEY: Record<ReasonKind, string> = {
  LOSS: 'loss',
  WIN: 'win',
  DISQUALIFICATION: 'disqualification',
  ACTIVITY_OUTCOME: 'activityOutcome',
  CONTACT_ROLE: 'contactRole',
};

function createEmptyForm(defaultOrder: number): ReasonFormValue {
  return {
    code: '',
    nameAr: '',
    nameEn: '',
    definitionAr: '',
    definitionEn: '',
    polarity: null,
    activityType: '',
    sortOrder: String(defaultOrder),
    isActive: true,
  };
}

function reasonToForm(reason: Reason): ReasonFormValue {
  return {
    code: reason.code,
    nameAr: reason.nameAr,
    nameEn: reason.nameEn,
    definitionAr: reason.definitionAr ?? '',
    definitionEn: reason.definitionEn ?? '',
    polarity: reason.polarity,
    activityType: reason.activityType ?? '',
    sortOrder: String(reason.sortOrder),
    isActive: reason.isActive,
  };
}

@Component({
  selector: 'app-reason-modal',
  imports: [NgIcon, TranslocoPipe, Button, ConfirmDialog, ConflictDialog, Dropdown, Field, Modal, Segmented, Switch],
  providers: [
    provideTranslocoScope('settings', { scope: 'settings-reasons', alias: 'reasons' }),
    provideIcons({ tablerListCheck, tablerLock }),
  ],
  templateUrl: './reason-modal.html',
})
export class ReasonModal {
  private static nextId = 0;
  protected readonly uid = `reason-modal-${++ReasonModal.nextId}`;

  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly modal = viewChild.required(Modal);
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');

  readonly canManage = input(false);
  readonly readOnly = output<void>();
  readonly saved = output<Reason>();
  readonly reloaded = output<Reason>();
  readonly refresh = output<void>();
  private readonly forcedReadOnly = signal(false);
  protected readonly canEdit = computed(() => this.canManage() && !this.forcedReadOnly());

  protected readonly limits = REASON_LIMITS;
  protected readonly mode = signal<'create' | 'edit'>('create');
  protected readonly kind = signal<ReasonKind>('LOSS');
  protected readonly baseReason = signal<Reason | null>(null);
  protected readonly form = signal<ReasonFormValue>(createEmptyForm(10));
  protected readonly saving = signal(false);
  protected readonly conflictBusy = signal(false);
  protected readonly conflictOpen = signal(false);
  private readonly touched = signal<Partial<Record<ReasonField, boolean>>>({});
  private readonly revealAllErrors = signal(false);
  private readonly serverCodeError = signal<string | null>(null);
  private readonly serverErrors = signal<Record<string, string[]>>({});
  private readonly pendingConflictPatch = signal<UpdateReasonPatch | null>(null);

  private defaultOrder = 10;
  private allowClose = false;
  private confirmingDiscard = false;
  private pendingCreateKey: { key: string; bodyJson: string } | null = null;

  protected readonly isActivityOutcome = computed(() => this.kind() === 'ACTIVITY_OUTCOME');
  protected readonly kindTabKey = computed(() => KIND_TAB_KEY[this.kind()]);

  protected readonly polarityOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return REASON_POLARITIES.map((value) => ({
      value,
      label: this.transloco.translate(`reasons.polarities.${value}`),
      dot: POLARITY_DOTS[value],
      disabled: !this.canEdit() || this.saving(),
    }));
  });

  protected readonly activityTypeOptions = computed<DropdownOption<ReasonActivityType | ''>[]>(() => {
    this.i18n();
    return [
      { value: '', label: this.transloco.translate('reasons.allTypes') },
      ...REASON_ACTIVITY_TYPES.map((value) => ({
        value,
        label: this.transloco.translate(`reasons.activityTypes.${value}`),
      })),
    ];
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
      if (this.isActivityOutcome() && !value.polarity) {
        errors.polarity = { key: 'required' };
      }
    }

    const nameAr = value.nameAr.trim();
    if (!nameAr) errors.nameAr = { key: 'required' };
    else if (nameAr.length > REASON_LIMITS.nameMax) {
      errors.nameAr = { key: 'maxLength', params: { max: REASON_LIMITS.nameMax } };
    }

    const nameEn = value.nameEn.trim();
    if (!nameEn) errors.nameEn = { key: 'required' };
    else if (nameEn.length > REASON_LIMITS.nameMax) {
      errors.nameEn = { key: 'maxLength', params: { max: REASON_LIMITS.nameMax } };
    }

    if (value.definitionAr.trim().length > REASON_LIMITS.defMax) {
      errors.definitionAr = { key: 'maxLength', params: { max: REASON_LIMITS.defMax } };
    }
    if (value.definitionEn.trim().length > REASON_LIMITS.defMax) {
      errors.definitionEn = { key: 'maxLength', params: { max: REASON_LIMITS.defMax } };
    }

    const orderRaw = value.sortOrder.trim();
    if (!orderRaw) {
      errors.sortOrder = { key: 'required' };
    } else if (!/^\d+$/.test(orderRaw)) {
      errors.sortOrder = {
        key: 'range',
        params: { min: REASON_LIMITS.sortOrderMin, max: REASON_LIMITS.sortOrderMax },
      };
    } else {
      const parsed = Number(orderRaw);
      if (!Number.isInteger(parsed) || parsed < REASON_LIMITS.sortOrderMin || parsed > REASON_LIMITS.sortOrderMax) {
        errors.sortOrder = {
          key: 'range',
          params: { min: REASON_LIMITS.sortOrderMin, max: REASON_LIMITS.sortOrderMax },
        };
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
    if (nameAr !== base.nameAr) patch.nameAr = nameAr;

    const nameEn = value.nameEn.trim();
    if (nameEn !== base.nameEn) patch.nameEn = nameEn;

    const defAr = value.definitionAr.trim() || null;
    if (defAr !== base.definitionAr) patch.definitionAr = defAr;

    const defEn = value.definitionEn.trim() || null;
    if (defEn !== base.definitionEn) patch.definitionEn = defEn;

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
    if (this.mode() === 'edit') {
      const base = this.baseReason();
      if (!base) return false;
      const value = this.form();
      const orderRaw = value.sortOrder.trim();
      const orderChanged = !/^\d+$/.test(orderRaw) || Number(orderRaw) !== base.sortOrder;
      return (
        value.nameAr.trim() !== base.nameAr ||
        value.nameEn.trim() !== base.nameEn ||
        (value.definitionAr.trim() || null) !== base.definitionAr ||
        (value.definitionEn.trim() || null) !== base.definitionEn ||
        orderChanged ||
        (!base.isSystem && value.isActive !== base.isActive)
      );
    }
    const value = this.form();
    const orderRaw = value.sortOrder.trim();
    const orderChanged = !/^\d+$/.test(orderRaw) || Number(orderRaw) !== this.defaultOrder;
    return Boolean(
      value.code.trim() ||
        value.nameAr.trim() ||
        value.nameEn.trim() ||
        value.definitionAr.trim() ||
        value.definitionEn.trim() ||
        value.polarity !== null ||
        value.activityType !== '' ||
        orderChanged,
    );
  });

  openCreate(kind: ReasonKind, nextOrder: number): void {
    if (!this.canEdit()) return;
    this.mode.set('create');
    this.kind.set(kind);
    this.baseReason.set(null);
    this.defaultOrder = nextOrder;
    this.form.set(createEmptyForm(nextOrder));
    this.pendingCreateKey = null;
    this.pendingConflictPatch.set(null);
    this.resetValidation();
    this.allowClose = false;
    this.modal().open();
  }

  openEdit(reason: Reason): void {
    beginReasonEdit(reason.id);
    this.mode.set('edit');
    this.kind.set(reason.reasonKind);
    this.baseReason.set(reason);
    this.form.set(reasonToForm(reason));
    this.pendingCreateKey = null;
    this.pendingConflictPatch.set(null);
    this.resetValidation();
    this.allowClose = false;
    this.modal().open();
  }

  openConflict(reason: Reason, patch: UpdateReasonPatch): void {
    this.baseReason.set(reason);
    this.pendingConflictPatch.set(patch);
    this.conflictOpen.set(true);
  }

  protected undo(): void {
    if (this.saving() || this.conflictBusy()) return;
    const base = this.baseReason();
    if (this.mode() === 'edit' && base) {
      this.form.set(reasonToForm(base));
    } else {
      this.form.set(createEmptyForm(this.defaultOrder));
    }
    this.pendingCreateKey = null;
    this.resetValidation();
  }

  protected requestClose(): void {
    if (this.saving() || this.conflictBusy()) return;
    if (!this.dirty()) {
      this.allowClose = true;
      this.modal().close();
      return;
    }
    void this.confirmModalClose();
  }

  protected onModalClosed(): void {
    if (!this.allowClose && this.dirty()) {
      this.modal().open();
      void this.confirmModalClose();
      return;
    }
    this.allowClose = false;
  }

  protected errorText(field: ReasonField): string | null {
    this.i18n();
    if (field === 'code' && this.serverCodeError()) {
      return this.serverCodeError();
    }
    const messages = this.serverErrors()[field];
    if (messages?.length) return messages.join(' ');
    const err = this.validationErrors()[field];
    if (!err) return null;
    if (!this.revealAllErrors() && !this.touched()[field]) return null;
    return this.transloco.translate(`reasons.validation.${err.key}`, err.params);
  }

  protected onCodeInput(event: Event): void {
    if (!this.canEdit() || this.mode() === 'edit') return;
    const target = event.target as HTMLInputElement;
    const upper = target.value.toUpperCase();
    if (target.value !== upper) target.value = upper;
    this.form.update((current) => ({ ...current, code: upper }));
    this.serverCodeError.set(null);
    this.clearServerError('code');
  }

  protected onFieldInput(
    field: 'nameAr' | 'nameEn' | 'definitionAr' | 'definitionEn' | 'sortOrder',
    event: Event,
  ): void {
    if (!this.canEdit()) return;
    const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.form.update((current) => ({ ...current, [field]: value }));
    this.clearServerError(field);
  }

  protected setPolarity(value: string | null): void {
    if (!this.canEdit() || this.mode() !== 'create') return;
    if (value !== 'POSITIVE' && value !== 'NEUTRAL' && value !== 'NEGATIVE') return;
    this.form.update((current) => ({ ...current, polarity: value }));
    this.markTouched('polarity');
    this.clearServerError('polarity');
  }

  protected setActivityType(value: ReasonActivityType | ''): void {
    if (!this.canEdit() || this.mode() !== 'create') return;
    this.form.update((current) => ({ ...current, activityType: value }));
    this.clearServerError('activityType');
  }

  protected setActive(checked: boolean): void {
    if (!this.canEdit() || this.baseReason()?.isSystem) return;
    this.form.update((current) => ({ ...current, isActive: checked }));
  }

  protected markTouched(field: ReasonField): void {
    this.touched.update((current) => (current[field] ? current : { ...current, [field]: true }));
  }

  protected async save(): Promise<void> {
    if (!this.canEdit() || this.saving() || this.conflictBusy()) return;
    if (!this.dirty()) return;

    this.revealAllErrors.set(true);
    if (!this.isValid()) return;

    this.saving.set(true);
    try {
      if (this.mode() === 'create') {
        const value = this.form();
        const payload: CreateReasonInput = {
          reasonKind: this.kind(),
          code: value.code.trim().toUpperCase(),
          nameAr: value.nameAr.trim(),
          nameEn: value.nameEn.trim(),
          ...(value.definitionAr.trim() ? { definitionAr: value.definitionAr.trim() } : {}),
          ...(value.definitionEn.trim() ? { definitionEn: value.definitionEn.trim() } : {}),
          ...(this.isActivityOutcome() && value.polarity ? { polarity: value.polarity } : {}),
          ...(this.isActivityOutcome() && value.activityType ? { activityType: value.activityType } : {}),
          sortOrder: Number(value.sortOrder.trim()),
        };
        const bodyJson = JSON.stringify(payload);
        if (!this.pendingCreateKey || this.pendingCreateKey.bodyJson !== bodyJson) {
          this.pendingCreateKey = { key: newIdempotencyKey(), bodyJson };
        }
        const created = await createReason(payload, this.pendingCreateKey.key);
        this.pendingCreateKey = null;
        this.saved.emit(created);
        this.notify.success(this.transloco.translate('reasons.toasts.reasonCreated'));
        this.allowClose = true;
        this.modal().close();
        return;
      }

      const base = this.baseReason();
      const patch = this.editPatch();
      if (!base || Object.keys(patch).length === 0) return;

      const updated = await updateReason(base.id, base.revision, patch);
      this.baseReason.set(updated);
      this.form.set(reasonToForm(updated));
      this.resetValidation();
      this.saved.emit(updated);
      this.notify.success(this.transloco.translate('reasons.toasts.reasonUpdated'));
      this.allowClose = true;
      this.modal().close();
    } catch (error) {
      const code = errorCodeOf(error);
      if (!isRetryableWriteError(error) && !(error instanceof ApiError && error.status === 401)) {
        this.pendingCreateKey = null;
      }
      if (code === 'CRM_REASON_CODE_TAKEN') {
        this.serverCodeError.set(this.transloco.translate('reasons.errors.CRM_REASON_CODE_TAKEN'));
        return;
      }
      if (code === 'CRM_REASON_REVISION_STALE' || code === 'CRM_DASHBOARD_REVISION_MISMATCH') {
        this.pendingConflictPatch.set(null);
        this.conflictOpen.set(true);
        return;
      }
      if (isValidationError(error)) {
        this.serverErrors.set(fieldErrorsOf(error));
        if (Object.keys(this.serverErrors()).some((field) => field in this.form())) return;
      }
      this.showWriteError(error);
      if (code === 'CRM_REASON_NOT_FOUND') this.refresh.emit();
    } finally {
      this.saving.set(false);
    }
  }

  protected async reloadLatest(): Promise<void> {
    const base = this.baseReason();
    if (!base || this.conflictBusy()) return;
    const fromRowAction = this.pendingConflictPatch() !== null;
    this.conflictBusy.set(true);
    try {
      const { items: list } = await listReasons({ kind: base.reasonKind });
      const fresh = list.find((item) => item.id === base.id);
      this.conflictOpen.set(false);
      this.pendingConflictPatch.set(null);
      if (!fresh) {
        this.notify.error(this.transloco.translate('reasons.errors.CRM_REASON_NOT_FOUND'));
        this.refresh.emit();
        if (!fromRowAction) {
          this.allowClose = true;
          this.modal().close();
        }
        return;
      }
      this.baseReason.set(fresh);
      if (!fromRowAction) {
        this.form.set(reasonToForm(fresh));
        this.resetValidation();
      }
      this.reloaded.emit(fresh);
    } catch (error) {
      this.showWriteError(error);
    } finally {
      this.conflictBusy.set(false);
    }
  }

  protected async saveMineOverStale(): Promise<void> {
    if (!this.canEdit()) return;
    const base = this.baseReason();
    const rowPatch = this.pendingConflictPatch();
    const patch = rowPatch ?? this.editPatch();
    if (!base || Object.keys(patch).length === 0 || this.conflictBusy()) return;
    this.conflictBusy.set(true);
    try {
      const { items: list } = await listReasons({ kind: base.reasonKind });
      const fresh = list.find((item) => item.id === base.id);
      if (!fresh) {
        this.conflictOpen.set(false);
        this.pendingConflictPatch.set(null);
        this.notify.error(this.transloco.translate('reasons.errors.CRM_REASON_NOT_FOUND'));
        this.refresh.emit();
        if (!rowPatch) {
          this.allowClose = true;
          this.modal().close();
        }
        return;
      }
      const updated = await updateReason(fresh.id, fresh.revision, patch);
      this.conflictOpen.set(false);
      this.pendingConflictPatch.set(null);
      this.baseReason.set(updated);
      this.saved.emit(updated);
      if (rowPatch) {
        this.notify.success(
          this.transloco.translate(updated.isActive ? 'reasons.toasts.reasonActivated' : 'reasons.toasts.reasonDeactivated'),
        );
      } else {
        this.form.set(reasonToForm(updated));
        this.resetValidation();
        this.notify.success(this.transloco.translate('reasons.toasts.reasonUpdated'));
        this.allowClose = true;
        this.modal().close();
      }
    } catch (error) {
      this.showWriteError(error);
      if (errorCodeOf(error) === 'CRM_REASON_REVISION_STALE' || errorCodeOf(error) === 'CRM_DASHBOARD_REVISION_MISMATCH') {
        this.conflictOpen.set(true);
      }
    } finally {
      this.conflictBusy.set(false);
    }
  }

  private resetValidation(): void {
    this.touched.set({});
    this.revealAllErrors.set(false);
    this.serverCodeError.set(null);
    this.serverErrors.set({});
  }

  private clearServerError(field: ReasonField): void {
    this.serverErrors.update((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
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

  showWriteError(error: unknown): void {
    const state = reasonsError(this.transloco, error);
    if (state.readOnly) {
      this.forcedReadOnly.set(true);
      this.readOnly.emit();
    }
    let message = state.message;
    if (error instanceof ApiError && error.status === 401) {
      message = this.transloco.translate('settings.errors.notSaved');
    }
    if (error instanceof ApiError && error.status === 429) {
      const retryAfter = error.details?.['retryAfterSeconds'];
      const seconds = Array.isArray(retryAfter) ? retryAfter[0] : retryAfter;
      message = this.transloco.translate(seconds == null ? 'settings.errors.rateLimited' : 'settings.errors.rateLimitedIn', { seconds });
    }
    this.notify.error(message, state.correlationId ? this.transloco.translate('settings.common.correlationId', { id: state.correlationId }) : '');
  }
}

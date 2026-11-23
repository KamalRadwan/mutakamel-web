import {
  Component,
  Injector,
  computed,
  inject,
  input,
  output,
  runInInjectionContext,
  signal,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerListNumbers, tablerLock } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Checkbox } from '../../../../../shared/ui/checkbox/checkbox';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { fieldErrorsOf, isValidationError } from '../../../../../core/api/api-errors';
import { crmSettingsError, errorCodeOf } from '../../shared/settings-api';
import { tenantWide } from '../../shared/settings-access';
import { beginLeadStageEdit, createLeadStage, updateLeadStage } from '../lead-stages.api';
import {
  CUSTOM_LEAD_STAGE_FLAGS,
  LEAD_STAGE_CATEGORIES,
  LEAD_STAGE_NAME_MAX,
  LeadStage,
  LeadStageCategory,
  LeadStageFlag,
  UpdateLeadStagePatch,
  isProtectedStage,
  stageErrorMessage,
  stageErrorTranslator,
  stageNameIn,
} from '../lead-stages.model';

@Component({
  selector: 'app-lead-stage-modal',
  imports: [NgIcon, TranslocoPipe, Button, Checkbox, ConfirmDialog, Dropdown, Field, Modal, Switch],
  providers: [provideIcons({ tablerListNumbers, tablerLock })],
  templateUrl: './lead-stage-modal.html',
})
export class LeadStageModal {
  private static nextId = 0;
  protected readonly uid = `lead-stage-modal-${++LeadStageModal.nextId}`;

  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly translateError = stageErrorTranslator(this.transloco);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required(Modal);
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');

  private readonly injector = inject(Injector);
  private readonly forcedReadOnly = signal(false);
  readonly canManage = input(false);
  readonly saved = output<LeadStage>();
  readonly deleted = output<LeadStage>();
  readonly inUse = output<LeadStage>();
  readonly readOnly = output<void>();
  protected readonly serverErrors = signal<Record<string, string[]>>({});

  protected readonly maxNameLength = LEAD_STAGE_NAME_MAX;
  protected readonly mode = signal<'create' | 'edit'>('create');
  protected readonly stage = signal<LeadStage | null>(null);
  protected readonly nameAr = signal('');
  protected readonly nameEn = signal('');
  protected readonly flag = signal<LeadStageFlag>('CONTACTED');
  protected readonly category = signal<LeadStageCategory>('IN_PROGRESS');
  protected readonly isDefault = signal(false);
  protected readonly isActive = signal(true);
  protected readonly touched = signal<{ nameAr?: boolean; nameEn?: boolean }>({});
  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);

  private allowClose = false;
  private confirmingDiscard = false;

  protected readonly isProtected = computed(() => {
    const current = this.stage();
    return this.mode() === 'edit' && current !== null && isProtectedStage(current);
  });

  protected readonly isReadOnly = computed(
    () =>
      !this.canManage() ||
      this.forcedReadOnly() ||
      this.isProtected() ||
      !runInInjectionContext(this.injector, () => tenantWide('crm.lead_stages.manage')),
  );
  protected readonly isDefaultStage = computed(
    () => this.mode() === 'edit' && Boolean(this.stage()?.isDefault),
  );

  protected readonly modalTitle = computed(() => {
    this.i18n();
    const current = this.stage();
    if (this.mode() === 'edit' && current) {
      return stageNameIn(current, this.language());
    }
    return this.transloco.translate('leadStages.modal.createTitle');
  });

  protected readonly dirty = computed(() => {
    const ar = this.nameAr().trim();
    const en = this.nameEn().trim();
    if (this.mode() === 'create') {
      return (
        ar.length > 0 ||
        en.length > 0 ||
        this.flag() !== 'CONTACTED' ||
        this.category() !== 'IN_PROGRESS' ||
        this.isDefault()
      );
    }
    const current = this.stage();
    if (!current || this.isReadOnly()) return false;
    return (
      ar !== current.nameAr ||
      en !== current.nameEn ||
      this.flag() !== current.flag ||
      this.category() !== current.category ||
      this.isActive() !== current.isActive
    );
  });

  protected readonly nameArError = computed(() => this.nameError('nameAr', this.nameAr()));
  protected readonly nameEnError = computed(() => this.nameError('nameEn', this.nameEn()));

  protected readonly flagOptions = computed<DropdownOption<LeadStageFlag>[]>(() => {
    this.i18n();
    return CUSTOM_LEAD_STAGE_FLAGS.map((value) => ({
      value,
      label: this.transloco.translate(`leadStages.flags.${value}`),
    }));
  });

  protected readonly categoryOptions = computed<DropdownOption<LeadStageCategory>[]>(() => {
    this.i18n();
    return LEAD_STAGE_CATEGORIES.map((value) => ({
      value,
      label: this.transloco.translate(`leadStages.categories.${value}`),
    }));
  });

  protected readonly selectedFlagLabel = computed(() => {
    this.i18n();
    return this.transloco.translate(`leadStages.flags.${this.flag()}`);
  });

  protected readonly selectedCategoryLabel = computed(() => {
    this.i18n();
    return this.transloco.translate(`leadStages.categories.${this.category()}`);
  });

  openCreate(): void {
    beginLeadStageEdit(null);
    this.mode.set('create');
    this.stage.set(null);
    this.resetFieldsForCreate();
    this.allowClose = false;
    this.modal().open();
  }

  openEdit(stage: LeadStage): void {
    beginLeadStageEdit(stage.id);
    this.mode.set('edit');
    this.stage.set(stage);
    this.resetFieldsFromStage(stage);
    this.allowClose = false;
    this.modal().open();
  }

  close(): void {
    this.allowClose = true;
    this.modal().close();
  }

  protected undo(): void {
    const current = this.stage();
    if (current) {
      this.resetFieldsFromStage(current);
    }
  }

  protected markTouched(field: 'nameAr' | 'nameEn'): void {
    this.touched.update((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }

  protected onNameInput(field: 'nameAr' | 'nameEn', event: Event): void {
    this.clearFieldError(field);
    const value = (event.target as HTMLInputElement).value;
    if (field === 'nameAr') this.nameAr.set(value);
    else this.nameEn.set(value);
  }

  protected onFlagChange(value: LeadStageFlag): void {
    if (this.isReadOnly()) return;
    this.flag.set(value);
    this.clearFieldError('flag');
  }

  protected onCategoryChange(value: LeadStageCategory): void {
    if (this.isReadOnly()) return;
    this.category.set(value);
    this.clearFieldError('category');
  }

  protected async save(): Promise<void> {
    if (this.saving() || this.isReadOnly()) return;
    this.serverErrors.set({});
    this.submitted.set(true);
    if (this.nameArError() || this.nameEnError()) return;

    const trimmedAr = this.nameAr().trim();
    const trimmedEn = this.nameEn().trim();

    this.saving.set(true);
    try {
      if (this.mode() === 'create') {
        const created = await createLeadStage({
          nameAr: trimmedAr,
          nameEn: trimmedEn,
          flag: this.flag(),
          category: this.category(),
          isDefault: this.isDefault(),
        });
        this.notify.success(this.transloco.translate('leadStages.toasts.created'));
        this.saved.emit(created);
        this.close();
        return;
      }

      const current = this.stage();
      if (!current) return;
      const patch = this.buildUpdatePatch(current, trimmedAr, trimmedEn);
      if (Object.keys(patch).length === 0) return;

      const updated = await updateLeadStage(current.id, patch);
      this.notify.success(this.transloco.translate('leadStages.toasts.updated'));
      this.saved.emit(updated);
      this.close();
    } catch (error) {
      if (isValidationError(error)) {
        const fields = fieldErrorsOf(error);
        this.serverErrors.set(fields);
        if (
          !Object.keys(fields).length ||
          Object.keys(fields).some(
            (key) =>
              !['nameAr', 'nameEn', 'flag', 'category', 'isDefault', 'isActive'].includes(key),
          )
        )
          this.showErrorToast(error);
        return;
      }
      if (errorCodeOf(error) === 'LEAD_STAGE_IN_USE') {
        const current = this.stage();
        if (current) this.inUse.emit(current);
        return;
      }
      this.showErrorToast(error);
      if (errorCodeOf(error) === 'LEAD_STAGE_NOT_FOUND') {
        const current = this.stage();
        if (current) this.saved.emit(current);
        this.close();
      }
    } finally {
      this.saving.set(false);
    }
  }

  protected requestDelete(): void {
    const current = this.stage();
    if (!current || this.saving() || this.isReadOnly() || current.isDefault) return;
    this.deleted.emit(current);
  }

  protected requestClose(): void {
    if (this.saving()) return;
    if (this.dirty() && !this.isReadOnly()) {
      void this.confirmDiscardAndClose();
      return;
    }
    this.close();
  }

  protected onModalClosed(): void {
    if (!this.allowClose && this.dirty() && !this.isReadOnly()) {
      this.modal().open();
      void this.confirmDiscardAndClose();
      return;
    }
    this.allowClose = false;
  }

  private async confirmDiscardAndClose(): Promise<void> {
    if (this.confirmingDiscard) return;
    this.confirmingDiscard = true;
    try {
      if (await this.discardDialog().open()) {
        this.close();
      }
    } finally {
      this.confirmingDiscard = false;
    }
  }

  private resetFieldsForCreate(): void {
    this.serverErrors.set({});
    this.nameAr.set('');
    this.nameEn.set('');
    this.flag.set('CONTACTED');
    this.category.set('IN_PROGRESS');
    this.isDefault.set(false);
    this.isActive.set(true);
    this.touched.set({});
    this.submitted.set(false);
  }

  private resetFieldsFromStage(stage: LeadStage): void {
    this.serverErrors.set({});
    this.nameAr.set(stage.nameAr);
    this.nameEn.set(stage.nameEn);
    this.flag.set(stage.flag);
    this.category.set(stage.category);
    this.isDefault.set(stage.isDefault);
    this.isActive.set(stage.isActive);
    this.touched.set({});
    this.submitted.set(false);
  }

  private buildUpdatePatch(
    current: LeadStage,
    trimmedAr: string,
    trimmedEn: string,
  ): UpdateLeadStagePatch {
    const patch: UpdateLeadStagePatch = {};
    if (trimmedAr !== current.nameAr) patch.nameAr = trimmedAr;
    if (trimmedEn !== current.nameEn) patch.nameEn = trimmedEn;
    if (this.flag() !== current.flag) patch.flag = this.flag();
    if (this.category() !== current.category) patch.category = this.category();
    if (this.isActive() !== current.isActive) patch.isActive = this.isActive();
    return patch;
  }

  private nameError(field: 'nameAr' | 'nameEn', raw: string): string | null {
    this.i18n();
    const show = this.submitted() || Boolean(this.touched()[field]);
    if (!show) return null;
    const serverMessage = this.fieldError(field);
    if (serverMessage) return serverMessage;
    const trimmed = raw.trim();
    if (!trimmed) {
      return this.transloco.translate('leadStages.validation.required');
    }
    if (Array.from(trimmed).length > this.maxNameLength) {
      return this.transloco.translate('leadStages.validation.maxLength', {
        max: this.maxNameLength,
      });
    }
    return null;
  }

  private showErrorToast(error: unknown): void {
    if (crmSettingsError(this.translateError, error, 'leadStages').readOnly) {
      this.forcedReadOnly.set(true);
      this.readOnly.emit();
    }
    this.notify.error(stageErrorMessage(error, this.translateError));
  }

  protected fieldError(field: string): string | null {
    return this.serverErrors()[field]?.join(' ') || null;
  }

  protected clearFieldError(field: string): void {
    this.serverErrors.update((errors) => {
      const next = { ...errors };
      delete next[field];
      return next;
    });
  }
}

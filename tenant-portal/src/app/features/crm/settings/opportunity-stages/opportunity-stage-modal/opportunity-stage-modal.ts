import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerLayoutRows, tablerLock } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { errorCodeOf } from '../../shared/settings-api';
import { ApiError, fieldErrorsOf, isValidationError } from '../../../../../core/api/api-errors';
import { opportunityStageError } from '../opportunity-stage-errors';
import { beginOpportunityStageEdit, createOpportunityStage, updateOpportunityStage } from '../opportunity-stages.api';
import {
  OPPORTUNITY_STAGE_FLAGS,
  OpportunityStage,
  OpportunityStageFlag,
  StageCategory,
  StageUsagePipeline,
  UpdateOpportunityStageInput,
  allowedCategories,
} from '../opportunity-stages.model';

const MAX_NAME_LENGTH = 80;
const DEFAULT_FLAG: OpportunityStageFlag = 'DISCOVERY';
const DEFAULT_CATEGORY: StageCategory = 'IN_PROGRESS';

@Component({
  selector: 'app-opportunity-stage-modal',
  imports: [NgIcon, TranslocoPipe, Button, ConfirmDialog, Dropdown, Field, Modal, Switch],
  providers: [provideIcons({ tablerLayoutRows, tablerLock })],
  templateUrl: './opportunity-stage-modal.html',
})
export class OpportunityStageModal {
  private static nextId = 0;
  protected readonly uid = `opportunity-stage-modal-${++OpportunityStageModal.nextId}`;
  protected readonly maxNameLength = MAX_NAME_LENGTH;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly notify = inject(Notify);

  private readonly modal = viewChild.required(Modal);
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');

  readonly canManage = input(false);
  readonly stages = input<readonly OpportunityStage[]>([]);
  readonly usageKnown = input(false);
  readonly readOnlyRequired = output<void>();
  readonly saved = output<OpportunityStage>();
  readonly failed = output<{ stage: OpportunityStage; error: unknown }>();
  readonly deleteRequested = output<OpportunityStage>();

  protected readonly stage = signal<OpportunityStage | null>(null);
  protected readonly usedPipelines = signal<StageUsagePipeline[]>([]);
  protected readonly nameAr = signal('');
  protected readonly nameEn = signal('');
  protected readonly flag = signal<OpportunityStageFlag>(DEFAULT_FLAG);
  protected readonly category = signal<StageCategory>(DEFAULT_CATEGORY);
  protected readonly isActive = signal(true);
  protected readonly touched = signal<{ nameAr?: boolean; nameEn?: boolean }>({});
  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);
  protected readonly serverErrors = signal<Record<string, string[]>>({});

  private allowClose = false;
  private confirmingDiscard = false;

  protected readonly isEdit = computed(() => this.stage() !== null);
  protected readonly isSystem = computed(() => this.stage()?.isSystem ?? false);
  protected readonly isUsed = computed(() => this.usedPipelines().length > 0);
  protected readonly meaningLocked = computed(
    () => !this.canManage() || (this.isEdit() && (this.isSystem() || this.isUsed())),
  );
  protected readonly allowedCats = computed(() => allowedCategories(this.flag()));
  protected readonly categoryLocked = computed(() => !this.canManage() || this.allowedCats().length === 1);
  protected readonly activeLocked = computed(() => !this.canManage() || this.isSystem() || this.isUsed());

  protected readonly nameArCount = computed(() => [...this.nameAr().trim()].length);
  protected readonly nameEnCount = computed(() => [...this.nameEn().trim()].length);

  protected readonly usedInNames = computed(() => {
    const lang = this.language();
    const sep = lang === 'ar' ? '، ' : ', ';
    return this.usedPipelines()
      .map((pipeline) => (lang === 'ar' ? pipeline.nameAr : pipeline.nameEn))
      .join(sep);
  });

  protected readonly meaningHint = computed(() => {
    this.i18n();
    if (this.isSystem()) return this.transloco.translate('opportunityStages.modal.meaningSystemHint');
    if (this.isUsed()) return this.transloco.translate('opportunityStages.modal.meaningUsedHint');
    return this.transloco.translate('opportunityStages.modal.meaningHint');
  });

  protected readonly activeHintKey = computed(() => {
    if (this.isSystem()) return 'opportunityStages.modal.activeSystemHint';
    if (this.isUsed()) return 'opportunityStages.modal.activeUsedHint';
    return 'opportunityStages.modal.activeHint';
  });

  protected readonly flagOptions = computed<DropdownOption<OpportunityStageFlag>[]>(() => {
    this.i18n();
    return OPPORTUNITY_STAGE_FLAGS.map((value) => ({
      value,
      label: this.transloco.translate(`opportunityStages.flags.${value}`),
    }));
  });

  protected readonly categoryOptions = computed<DropdownOption<StageCategory>[]>(() => {
    this.i18n();
    return this.allowedCats().map((value) => ({
      value,
      label: this.transloco.translate(`opportunityStages.categories.${value}`),
    }));
  });

  protected readonly dirty = computed(() => {
    const base = this.stage();
    if (base) {
      return (
        this.nameAr().trim() !== base.nameAr ||
        this.nameEn().trim() !== base.nameEn ||
        this.flag() !== base.flag ||
        this.category() !== base.category ||
        this.isActive() !== base.isActive
      );
    }
    return (
      this.nameAr().trim().length > 0 ||
      this.nameEn().trim().length > 0 ||
      this.flag() !== DEFAULT_FLAG ||
      this.category() !== DEFAULT_CATEGORY
    );
  });

  openCreate(): void {
    beginOpportunityStageEdit(null);
    this.serverErrors.set({});
    this.stage.set(null);
    this.usedPipelines.set([]);
    this.nameAr.set('');
    this.nameEn.set('');
    this.flag.set(DEFAULT_FLAG);
    this.category.set(DEFAULT_CATEGORY);
    this.isActive.set(true);
    this.touched.set({});
    this.submitted.set(false);
    this.saving.set(false);
    this.allowClose = false;
    this.modal().open();
  }

  openEdit(stage: OpportunityStage, pipelines: StageUsagePipeline[]): void {
    beginOpportunityStageEdit(stage.id);
    this.serverErrors.set({});
    this.stage.set(stage);
    this.usedPipelines.set(pipelines);
    this.nameAr.set(stage.nameAr);
    this.nameEn.set(stage.nameEn);
    this.flag.set(stage.flag);
    this.category.set(stage.category);
    this.isActive.set(stage.isActive);
    this.touched.set({});
    this.submitted.set(false);
    this.saving.set(false);
    this.allowClose = false;
    this.modal().open();
  }

  refreshUsage(pipelines: StageUsagePipeline[]): void {
    const b = this.stage();
    this.usedPipelines.set(pipelines);
    if (b) {
      this.flag.set(b.flag);
      this.category.set(b.category);
      this.isActive.set(b.isActive);
    }
  }

  close(): void {
    this.allowClose = true;
    this.modal().close();
  }

  protected errorOf(field: 'nameAr' | 'nameEn' | 'flag' | 'category' | 'isActive'): string | null {
    this.i18n();
    const serverError = this.serverErrors()[field]?.join(' ');
    if (serverError) return serverError;
    if (field !== 'nameAr' && field !== 'nameEn') return null;
    if (!this.submitted() && !this.touched()[field]) return null;
    const raw = field === 'nameAr' ? this.nameAr() : this.nameEn();
    const trimmed = raw.trim();
    if (!trimmed) {
      return this.transloco.translate('opportunityStages.validation.required');
    }
    if ([...trimmed].length > MAX_NAME_LENGTH) {
      return this.transloco.translate('opportunityStages.validation.maxLength', { max: MAX_NAME_LENGTH });
    }
    return null;
  }

  protected duplicateName(field: 'nameAr' | 'nameEn'): string | null {
    this.i18n();
    const value = this[field]().trim();
    return value && this.stages().some((stage) => stage.id !== this.stage()?.id && stage[field].trim() === value)
      ? this.transloco.translate('opportunityStages.validation.duplicateName')
      : null;
  }

  protected onNameInput(field: 'nameAr' | 'nameEn', event: Event): void {
    this.serverErrors.update((errors) => ({ ...errors, [field]: [] }));
    const value = (event.target as HTMLInputElement).value;
    if (field === 'nameAr') this.nameAr.set(value);
    else this.nameEn.set(value);
  }

  protected markTouched(field: 'nameAr' | 'nameEn'): void {
    this.touched.update((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }

  protected setFlag(nextFlag: OpportunityStageFlag): void {
    if (this.meaningLocked() || this.saving()) return;
    this.flag.set(nextFlag);
    this.serverErrors.update((errors) => ({ ...errors, flag: [], category: [] }));
    const allowed = allowedCategories(nextFlag);
    if (!allowed.includes(this.category())) {
      this.category.set(allowed[0]);
    }
  }

  protected setCategory(nextCategory: StageCategory): void {
    if (this.categoryLocked() || this.saving()) return;
    if (this.allowedCats().includes(nextCategory)) {
      this.category.set(nextCategory);
      this.serverErrors.update((errors) => ({ ...errors, category: [] }));
    }
  }

  protected undo(): void {
    const base = this.stage();
    if (!base || this.saving()) return;
    this.serverErrors.set({});
    this.nameAr.set(base.nameAr);
    this.nameEn.set(base.nameEn);
    this.flag.set(base.flag);
    this.category.set(base.category);
    this.isActive.set(base.isActive);
    this.touched.set({});
    this.submitted.set(false);
  }

  protected async save(): Promise<void> {
    if (!this.canManage() || this.saving()) return;
    this.submitted.set(true);

    const trimmedAr = this.nameAr().trim();
    const trimmedEn = this.nameEn().trim();
    if (
      !trimmedAr ||
      !trimmedEn ||
      [...trimmedAr].length > MAX_NAME_LENGTH ||
      [...trimmedEn].length > MAX_NAME_LENGTH
    ) {
      return;
    }

    const base = this.stage();
    this.serverErrors.set({});
    this.saving.set(true);
    try {
      let result: OpportunityStage;
      if (!base) {
        result = await createOpportunityStage({
          nameAr: trimmedAr,
          nameEn: trimmedEn,
          flag: this.flag(),
          category: this.category(),
        });
      } else {
        const patch: UpdateOpportunityStageInput = {};
        if (trimmedAr !== base.nameAr) patch.nameAr = trimmedAr;
        if (trimmedEn !== base.nameEn) patch.nameEn = trimmedEn;
        if (this.flag() !== base.flag) patch.flag = this.flag();
        if (this.category() !== base.category) patch.category = this.category();
        if (this.isActive() !== base.isActive) patch.isActive = this.isActive();

        if (Object.keys(patch).length === 0) return;
        result = await updateOpportunityStage(base.id, patch);
      }

      this.allowClose = true;
      this.modal().close();
      this.saved.emit(result);
    } catch (error) {
      if (isValidationError(error)) {
        this.serverErrors.set(fieldErrorsOf(error));
        if (Object.keys(this.serverErrors()).some((key) => !['nameAr', 'nameEn', 'flag', 'category', 'isActive'].includes(key))) {
          this.showErrorToast(error);
        }
        return;
      }
      const code = errorCodeOf(error);
      if (code !== 'OPPORTUNITY_STAGE_IN_USE' && !(error instanceof ApiError && error.status === 404)) {
        this.showErrorToast(error);
      }
      if (base) {
        this.failed.emit({ stage: base, error });
      }
    } finally {
      this.saving.set(false);
    }
  }

  protected requestDelete(): void {
    const base = this.stage();
    if (!base || !this.canManage() || this.isSystem() || this.isUsed() || this.saving()) return;
    this.allowClose = true;
    this.modal().close();
    this.deleteRequested.emit(base);
  }

  protected requestClose(): void {
    if (this.saving()) return;
    if (!this.canManage() || !this.dirty()) {
      this.close();
      return;
    }
    void this.confirmDiscard();
  }

  protected onModalClosed(): void {
    if (!this.allowClose && this.canManage() && this.dirty()) {
      this.modal().open();
      void this.confirmDiscard();
      return;
    }
    this.allowClose = false;
  }

  private async confirmDiscard(): Promise<void> {
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

  private showErrorToast(error: unknown): void {
    const state = opportunityStageError(this.transloco, error);
    if (state.readOnly) this.readOnlyRequired.emit();
    this.notify.error(state.message);
  }
}

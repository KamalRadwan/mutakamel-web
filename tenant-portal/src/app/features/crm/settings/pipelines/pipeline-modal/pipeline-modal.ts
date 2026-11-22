import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowDown,
  tablerArrowUp,
  tablerHierarchy2,
  tablerPlus,
  tablerTrash,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Segmented, SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { OpportunityStage, OpportunityStageFlag, StageCategory } from '../../opportunity-stages/opportunity-stages.model';
import { errorCodeOf } from '../../shared/settings-api';
import { createPipeline, updatePipeline } from '../pipelines.api';
import {
  PIPELINE_CODE_MAX,
  PIPELINE_CODE_PATTERN,
  PIPELINE_DESCRIPTION_MAX,
  PIPELINE_NAME_MAX,
  PIPELINE_STAGE_MAX_COUNT,
  Pipeline,
  UpdatePipelineInput,
  nameIn,
} from '../pipelines.model';

type ModalMode = 'create' | 'edit';
type StageSetupMode = 'standard' | 'choose';
type FieldName = 'code' | 'nameAr' | 'nameEn' | 'description';

const CATEGORY_BADGE: Record<StageCategory, string> = {
  OPEN: 'bg-brand-soft text-on-brand-soft',
  IN_PROGRESS: 'bg-neutral-soft text-on-neutral-soft',
  POSITIVE: 'bg-success-soft text-on-success-soft',
  NEGATIVE: 'bg-danger-soft text-on-danger-soft',
};

const CANONICAL_FLAG_ORDER: Record<string, number> = {
  NEW: 0,
  QUALIFICATION: 1,
  PROPOSAL: 2,
  NEGOTIATION: 3,
  WON: 4,
  LOST: 5,
};

const REQUIRED_FLAGS = new Set<OpportunityStageFlag>(['NEW', 'WON', 'LOST']);

@Component({
  selector: 'app-pipeline-modal',
  imports: [NgIcon, TranslocoPipe, Button, ConfirmDialog, Dropdown, Field, Modal, Segmented, Switch],
  providers: [provideIcons({ tablerHierarchy2, tablerArrowUp, tablerArrowDown, tablerTrash, tablerPlus })],
  templateUrl: './pipeline-modal.html',
})
export class PipelineModal {
  private static nextId = 0;
  protected readonly uid = `pipeline-modal-${++PipelineModal.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly notify = inject(Notify);
  protected readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required(Modal);
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');

  readonly canManage = input(true);
  readonly saved = output<Pipeline>();
  readonly deleteRequested = output<Pipeline>();

  protected readonly codeMax = PIPELINE_CODE_MAX;
  protected readonly nameMax = PIPELINE_NAME_MAX;
  protected readonly descriptionMax = PIPELINE_DESCRIPTION_MAX;

  protected readonly mode = signal<ModalMode>('create');
  protected readonly editing = signal<Pipeline | null>(null);
  protected readonly catalogue = signal<OpportunityStage[]>([]);

  protected readonly code = signal('');
  protected readonly nameAr = signal('');
  protected readonly nameEn = signal('');
  protected readonly description = signal('');
  protected readonly isDefault = signal(false);
  protected readonly isActive = signal(true);
  protected readonly stageMode = signal<StageSetupMode>('standard');
  protected readonly chosenStages = signal<OpportunityStage[]>([]);
  protected readonly selectedStageToAdd = signal('');

  private readonly touched = signal<Partial<Record<FieldName, boolean>>>({});
  private readonly revealErrors = signal(false);
  private readonly codeTakenError = signal(false);
  protected readonly saving = signal(false);

  private allowClose = false;
  private confirmingDiscard = false;

  protected readonly modalTitle = computed(() => {
    this.i18n();
    if (this.mode() === 'create') return this.transloco.translate('pipelines.modal.createTitle');
    return this.transloco.translate(this.canManage() ? 'pipelines.modal.editTitle' : 'pipelines.modal.viewTitle');
  });

  protected readonly standardStages = computed<OpportunityStage[]>(() => {
    const system = this.catalogue().filter((stage) => stage.isSystem && stage.isActive);
    return system.slice().sort((a, b) => (CANONICAL_FLAG_ORDER[a.flag] ?? 99) - (CANONICAL_FLAG_ORDER[b.flag] ?? 99));
  });

  protected readonly stageModeOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return [
      { value: 'standard', label: this.transloco.translate('pipelines.modal.standardStages') },
      { value: 'choose', label: this.transloco.translate('pipelines.modal.chooseStages') },
    ];
  });

  protected readonly chosenRequiredFlags = computed<Set<OpportunityStageFlag>>(() => {
    const flags = new Set<OpportunityStageFlag>();
    for (const stage of this.chosenStages()) {
      if (REQUIRED_FLAGS.has(stage.flag)) flags.add(stage.flag);
    }
    return flags;
  });

  protected readonly addStageOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const lang = this.language();
    const chosenIds = new Set(this.chosenStages().map((item) => item.id));
    const usedFlags = this.chosenRequiredFlags();
    const available = this.catalogue()
      .filter((stage) => stage.isActive && !chosenIds.has(stage.id))
      .map((stage) => {
        const base = nameIn(stage, lang);
        const flagLabel = this.transloco.translate(`pipelines.flags.${stage.flag}`);
        if (usedFlags.has(stage.flag)) {
          return {
            value: stage.id,
            label: `${base} (${this.transloco.translate('pipelines.detail.alreadyHasFlag', { flag: flagLabel })})`,
            disabled: true,
          };
        }
        return {
          value: stage.id,
          label: `${base} (${flagLabel})`,
          disabled: false,
        };
      });
    return [{ value: '', label: this.transloco.translate('pipelines.modal.addStagePlaceholder') }, ...available];
  });

  protected readonly stageProblems = computed<string[]>(() => {
    this.i18n();
    if (this.mode() !== 'create' || this.stageMode() !== 'choose') return [];
    const stages = this.chosenStages();
    const problems: string[] = [];

    let newCount = 0;
    let wonCount = 0;
    let lostCount = 0;
    for (const stage of stages) {
      if (stage.flag === 'NEW') newCount++;
      else if (stage.flag === 'WON') wonCount++;
      else if (stage.flag === 'LOST') lostCount++;
    }

    if (newCount === 0) problems.push(this.transloco.translate('pipelines.modal.stageProblems.missingNew'));
    else if (newCount > 1) problems.push(this.transloco.translate('pipelines.modal.stageProblems.duplicateNew'));

    if (wonCount === 0) problems.push(this.transloco.translate('pipelines.modal.stageProblems.missingWon'));
    else if (wonCount > 1) problems.push(this.transloco.translate('pipelines.modal.stageProblems.duplicateWon'));

    if (lostCount === 0) problems.push(this.transloco.translate('pipelines.modal.stageProblems.missingLost'));
    else if (lostCount > 1) problems.push(this.transloco.translate('pipelines.modal.stageProblems.duplicateLost'));

    if (stages.length > 0 && stages[0].flag !== 'NEW') {
      problems.push(this.transloco.translate('pipelines.modal.stageProblems.newNotFirst'));
    }
    if (stages.length > PIPELINE_STAGE_MAX_COUNT) {
      problems.push(this.transloco.translate('pipelines.modal.stageProblems.tooManyStages'));
    }
    return problems;
  });

  protected readonly dirty = computed(() => {
    if (this.mode() === 'create') {
      return (
        this.code().trim().length > 0 ||
        this.nameAr().trim().length > 0 ||
        this.nameEn().trim().length > 0 ||
        this.description().trim().length > 0 ||
        this.isDefault() ||
        this.stageMode() !== 'standard'
      );
    }
    const base = this.editing();
    if (!base) return false;
    const nextDesc = this.description().trim() || null;
    return (
      this.nameAr().trim() !== base.nameAr ||
      this.nameEn().trim() !== base.nameEn ||
      nextDesc !== base.description ||
      this.isActive() !== base.isActive
    );
  });

  protected readonly fieldErrors = computed<Partial<Record<FieldName, string>>>(() => {
    this.i18n();
    const errors: Partial<Record<FieldName, string>> = {};

    if (this.mode() === 'create') {
      const code = this.code().trim().toUpperCase();
      if (!code) errors.code = this.transloco.translate('pipelines.modal.validation.codeRequired');
      else if (code.length > PIPELINE_CODE_MAX) errors.code = this.transloco.translate('pipelines.modal.validation.codeMax');
      else if (!PIPELINE_CODE_PATTERN.test(code)) errors.code = this.transloco.translate('pipelines.modal.validation.codePattern');
      else if (this.codeTakenError()) errors.code = this.transloco.translate('pipelines.errors.PIPELINE_CODE_TAKEN');
    }

    const nameAr = this.nameAr().trim();
    if (!nameAr) errors.nameAr = this.transloco.translate('pipelines.modal.validation.nameArRequired');
    else if (nameAr.length > PIPELINE_NAME_MAX) errors.nameAr = this.transloco.translate('pipelines.modal.validation.nameMax');

    const nameEn = this.nameEn().trim();
    if (!nameEn) errors.nameEn = this.transloco.translate('pipelines.modal.validation.nameEnRequired');
    else if (nameEn.length > PIPELINE_NAME_MAX) errors.nameEn = this.transloco.translate('pipelines.modal.validation.nameMax');

    if (this.description().trim().length > PIPELINE_DESCRIPTION_MAX) {
      errors.description = this.transloco.translate('pipelines.modal.validation.descriptionMax');
    }

    return errors;
  });

  openCreate(catalogueStages: OpportunityStage[]): void {
    this.catalogue.set(catalogueStages);
    this.mode.set('create');
    this.editing.set(null);
    this.code.set('');
    this.nameAr.set('');
    this.nameEn.set('');
    this.description.set('');
    this.isDefault.set(false);
    this.isActive.set(true);
    this.stageMode.set('standard');
    this.chosenStages.set(this.standardStages());
    this.selectedStageToAdd.set('');
    this.resetValidation();
    this.allowClose = false;
    this.modal().open();
  }

  openEdit(pipeline: Pipeline): void {
    this.mode.set('edit');
    this.editing.set(pipeline);
    this.populateFromPipeline(pipeline);
    this.resetValidation();
    this.allowClose = false;
    this.modal().open();
  }

  protected errorOf(field: FieldName): string | null {
    if (field === 'code' && this.codeTakenError()) {
      return this.fieldErrors().code ?? null;
    }
    if (!this.revealErrors() && !this.touched()[field]) return null;
    return this.fieldErrors()[field] ?? null;
  }

  protected markTouched(field: FieldName): void {
    this.touched.update((current) => (current[field] ? current : { ...current, [field]: true }));
  }

  protected onCodeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const upper = input.value.toUpperCase();
    if (input.value !== upper) {
      input.value = upper;
      if (start !== null && end !== null) input.setSelectionRange(start, end);
    }
    this.code.set(upper);
    this.codeTakenError.set(false);
  }

  protected onTextInput(field: 'nameAr' | 'nameEn' | 'description', event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    if (field === 'nameAr') this.nameAr.set(value);
    else if (field === 'nameEn') this.nameEn.set(value);
    else this.description.set(value);
  }

  protected onStageModeChange(value: string | null): void {
    if (value !== 'standard' && value !== 'choose') return;
    this.stageMode.set(value);
    if (value === 'choose' && this.chosenStages().length === 0) {
      this.chosenStages.set(this.standardStages());
    }
  }

  protected addChosenStage(): void {
    const id = this.selectedStageToAdd();
    if (!id) return;
    const stage = this.catalogue().find((item) => item.id === id && item.isActive);
    if (!stage) return;
    if (this.chosenStages().some((item) => item.id === id)) return;
    if (this.chosenRequiredFlags().has(stage.flag)) return;
    this.chosenStages.update((list) => [...list, stage]);
    this.selectedStageToAdd.set('');
  }

  protected moveChosenStage(index: number, delta: -1 | 1): void {
    const target = index + delta;
    const list = this.chosenStages();
    if (target < 0 || target >= list.length) return;
    const next = list.slice();
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    this.chosenStages.set(next);
  }

  protected removeChosenStage(id: string): void {
    this.chosenStages.update((list) => list.filter((item) => item.id !== id));
  }

  protected undoEdit(): void {
    const pipeline = this.editing();
    if (!pipeline) return;
    this.populateFromPipeline(pipeline);
    this.resetValidation();
  }

  protected stageName(stage: OpportunityStage): string {
    return nameIn(stage, this.language());
  }

  protected showMeaningChip(stage: OpportunityStage): boolean {
    return (
      this.stageName(stage).trim().toLowerCase() !==
      this.transloco.translate(`pipelines.flags.${stage.flag}`).trim().toLowerCase()
    );
  }

  protected categoryClass(category: StageCategory): string {
    return CATEGORY_BADGE[category];
  }

  protected async save(): Promise<void> {
    if (this.saving() || !this.canManage()) return;
    this.revealErrors.set(true);

    if (Object.keys(this.fieldErrors()).length > 0) return;
    if (this.mode() === 'create' && this.stageMode() === 'choose' && this.stageProblems().length > 0) return;

    this.saving.set(true);
    try {
      if (this.mode() === 'create') {
        const trimmedDesc = this.description().trim();
        const created = await createPipeline({
          code: this.code().trim().toUpperCase(),
          nameAr: this.nameAr().trim(),
          nameEn: this.nameEn().trim(),
          description: trimmedDesc.length > 0 ? trimmedDesc : undefined,
          isDefault: this.isDefault(),
          stageIds:
            this.stageMode() === 'choose' ? this.chosenStages().map((stage) => stage.id) : undefined,
        });
        this.notify.success(this.transloco.translate('pipelines.toasts.created'));
        this.allowClose = true;
        this.modal().close();
        this.saved.emit(created);
        return;
      }

      const base = this.editing();
      if (!base) return;
      const changes: UpdatePipelineInput = {};
      const trimmedAr = this.nameAr().trim();
      const trimmedEn = this.nameEn().trim();
      const trimmedDesc = this.description().trim();
      const nextDesc = trimmedDesc.length > 0 ? trimmedDesc : null;

      if (trimmedAr !== base.nameAr) changes.nameAr = trimmedAr;
      if (trimmedEn !== base.nameEn) changes.nameEn = trimmedEn;
      if (nextDesc !== base.description) changes.description = nextDesc;
      if (this.isActive() !== base.isActive) changes.isActive = this.isActive();

      if (Object.keys(changes).length === 0) return;

      const updated = await updatePipeline(base.id, changes);
      this.notify.success(this.transloco.translate('pipelines.toasts.updated'));
      this.allowClose = true;
      this.modal().close();
      this.saved.emit(updated);
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'PIPELINE_CODE_TAKEN') {
        this.codeTakenError.set(true);
        return;
      }
      this.showErrorToast(code);
    } finally {
      this.saving.set(false);
    }
  }

  protected async requestCancel(): Promise<void> {
    if (this.saving()) return;
    if (this.canManage() && this.dirty()) {
      if (!(await this.confirmDiscard())) return;
    }
    this.allowClose = true;
    this.modal().close();
  }

  protected requestDelete(): void {
    const base = this.editing();
    if (!base || base.isDefault || this.saving() || !this.canManage()) return;
    this.allowClose = true;
    this.modal().close();
    this.deleteRequested.emit(base);
  }

  protected onModalClosed(): void {
    if (!this.allowClose && this.canManage() && this.dirty()) {
      this.modal().open();
      void this.confirmDiscardAndClose();
      return;
    }
    this.allowClose = false;
  }

  private async confirmDiscardAndClose(): Promise<void> {
    if (await this.confirmDiscard()) {
      this.allowClose = true;
      this.modal().close();
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

  private populateFromPipeline(pipeline: Pipeline): void {
    this.code.set(pipeline.code);
    this.nameAr.set(pipeline.nameAr);
    this.nameEn.set(pipeline.nameEn);
    this.description.set(pipeline.description ?? '');
    this.isDefault.set(pipeline.isDefault);
    this.isActive.set(pipeline.isActive);
  }

  private resetValidation(): void {
    this.touched.set({});
    this.revealErrors.set(false);
    this.codeTakenError.set(false);
  }

  private showErrorToast(code: string | null): void {
    if (code) {
      const key = `pipelines.errors.${code}`;
      const translated = this.transloco.translate(key);
      if (translated !== key) {
        this.notify.error(translated);
        return;
      }
      const sharedKey = `settings.errors.${code}`;
      const shared = this.transloco.translate(sharedKey);
      if (shared !== sharedKey) {
        this.notify.error(shared);
        return;
      }
    }
    this.notify.error(this.transloco.translate('settings.errors.generic'));
  }
}

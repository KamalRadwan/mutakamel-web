import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerArrowsExchange } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Button } from '../../../../../shared/ui/button/button';
import { Dropdown, type DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { reasonDefinitionIn, reasonNameIn } from '../../../settings/reasons/reasons.model';
import type { OpportunityReason } from '../../opportunities.model';
import { listReasons } from '../../opportunities.api';
import {
  OPPORTUNITY_LIMITS,
  type PipelineStageView,
  type PipelineView,
  nameIn,
  stageLabel,
} from '../../opportunities.model';
import {
  OpportunityMoves,
  type TransferDialogError,
  type TransferDialogRequest,
  type TransferDialogResult,
} from '../opportunity-moves';

function defaultStageForPipeline(pipeline: PipelineView | null): string {
  if (!pipeline) return '';
  const active = pipeline.stages
    .filter((stage) => stage.isActive)
    .slice()
    .sort((a, b) => a.rank - b.rank);
  const newStage = active.find((stage) => stage.flag === 'NEW');
  return newStage?.id ?? active[0]?.id ?? '';
}

/** Modal dialog for moving an opportunity to another pipeline and choosing its target stage. */
@Component({
  selector: 'app-opportunity-pipeline-move-dialog',
  imports: [TranslocoPipe, Button, Dropdown, Field, Modal],
  providers: [
    provideTranslocoScope('opportunities', { scope: 'opportunity-moves', alias: 'oppMoves' }),
    provideIcons({ tablerArrowsExchange }),
  ],
  templateUrl: './pipeline-move-dialog.html',
})
export class PipelineMoveDialog {
  private static nextId = 0;
  private readonly uid = `opp-transfer-${++PipelineMoveDialog.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly language = inject(LanguageState).current;
  private readonly transloco = inject(TranslocoService);
  private readonly moves = inject(OpportunityMoves, { optional: true });
  private readonly i18n = translationEvents(this.transloco);

  private readonly modal = viewChild.required(Modal);

  readonly request = input<TransferDialogRequest | null>(null);
  readonly serverError = input<TransferDialogError | null>(null);
  readonly submitting = input<boolean | null>(null);
  readonly done = output<TransferDialogResult | null>();

  protected readonly pipelineId = `${this.uid}-pipeline`;
  protected readonly stageId = `${this.uid}-stage`;
  protected readonly reasonId = `${this.uid}-reason`;
  protected readonly noteId = `${this.uid}-note`;
  protected readonly maxNoteLength = OPPORTUNITY_LIMITS.reason;

  protected readonly selectedPipelineId = signal('');
  protected readonly selectedStageId = signal('');
  protected readonly reasons = signal<OpportunityReason[]>([]);
  protected readonly reasonsLoading = signal(false);
  protected readonly reasonsHidden = signal(false);
  protected readonly selectedReasonId = signal('');
  protected readonly note = signal('');
  protected readonly localSubmitting = signal(false);
  protected readonly serverRequiredReason = signal(false);

  private readonly localPipelineErrorKey = signal<string | null>(null);
  private readonly localStageErrorKey = signal<string | null>(null);
  private readonly localReasonErrorKey = signal<string | null>(null);
  private readonly localNoteErrorKey = signal<string | null>(null);
  private readonly dismissedServerError = signal<TransferDialogError | null>(null);

  private loadSeq = 0;
  private closingFromRequest = false;
  private closingFromAction = false;

  private readonly effectiveServerError = computed<TransferDialogError | null>(
    () => this.serverError() ?? this.moves?.transferError() ?? null,
  );

  private readonly activeServerError = computed<TransferDialogError | null>(() => {
    const err = this.effectiveServerError();
    if (!err || err === this.dismissedServerError()) return null;
    return err;
  });

  protected readonly isSubmitting = computed(
    () => this.submitting() ?? this.moves?.transferSubmitting() ?? this.localSubmitting(),
  );

  /** Opportunity title isolated (FSI/PDI, same as dir="auto"): ui-modal renders the subtitle as plain text. */
  protected readonly dialogSubtitle = computed(() => {
    const title = this.request()?.row.title;
    return title ? `⁨${title}⁩` : '';
  });

  protected readonly availablePipelines = computed<PipelineView[]>(() => {
    const req = this.request();
    if (!req) return [];
    return req.pipelines.filter((pipeline) => pipeline.isActive && pipeline.id !== req.row.pipelineId);
  });

  protected readonly selectedPipeline = computed<PipelineView | null>(() => {
    const id = this.selectedPipelineId();
    return this.availablePipelines().find((pipeline) => pipeline.id === id) ?? null;
  });

  protected readonly availableStages = computed<PipelineStageView[]>(() => {
    const pipeline = this.selectedPipeline();
    if (!pipeline) return [];
    return pipeline.stages
      .filter((stage) => stage.isActive)
      .slice()
      .sort((a, b) => a.rank - b.rank);
  });

  protected readonly selectedStage = computed<PipelineStageView | null>(() => {
    const id = this.selectedStageId();
    return this.availableStages().find((stage) => stage.id === id) ?? null;
  });

  protected readonly terminalKind = computed<'WON' | 'LOST' | null>(() => {
    const flag = this.selectedStage()?.flag;
    return flag === 'WON' || flag === 'LOST' ? flag : null;
  });

  protected readonly pipelineOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const list = this.availablePipelines();
    if (list.length === 0) {
      return [{ value: '', label: this.transloco.translate('oppMoves.transfer.noPipelines'), disabled: true }];
    }
    const lang = this.language();
    return list.map((pipeline) => ({
      value: pipeline.id,
      label: nameIn(pipeline, lang),
    }));
  });

  protected readonly stageOptions = computed<DropdownOption<string>[]>(() => {
    const list = this.availableStages();
    if (list.length === 0) {
      return [{ value: '', label: '—', disabled: true }];
    }
    const lang = this.language();
    return list.map((stage) => ({
      value: stage.id,
      label: stageLabel(stage, lang),
    }));
  });

  protected readonly reasonOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const lang = this.language();
    return [
      { value: '', label: this.transloco.translate('oppMoves.close.noReason') },
      ...this.reasons().map((reason) => {
        const definition = reasonDefinitionIn(reason, lang)?.trim();
        return {
          value: reason.id,
          label: reasonNameIn(reason, lang),
          ...(definition ? { title: definition } : {}),
        };
      }),
    ];
  });

  protected readonly selectedReasonDefinition = computed<string | null>(() => {
    const id = this.selectedReasonId();
    if (!id) return null;
    const found = this.reasons().find((reason) => reason.id === id);
    return found ? reasonDefinitionIn(found, this.language())?.trim() || null : null;
  });

  protected readonly reasonLabelKey = computed(() => {
    if (this.terminalKind() !== 'WON') return 'oppMoves.close.lossReason';
    return this.serverRequiredReason() ? 'oppMoves.close.winReason' : 'oppMoves.close.winReasonOptional';
  });

  protected readonly reasonRequired = computed(
    () => this.terminalKind() === 'WON' && this.serverRequiredReason(),
  );

  protected readonly noteRequired = computed(
    () => this.terminalKind() === 'LOST' && this.reasonsHidden(),
  );

  protected readonly noteHintKey = computed(() => {
    const kind = this.terminalKind();
    if (kind === 'LOST') {
      return this.reasonsHidden() ? 'oppMoves.close.noteHintLostRequired' : 'oppMoves.close.noteHintLost';
    }
    if (kind === 'WON') {
      return 'oppMoves.close.noteHintWon';
    }
    return 'oppMoves.transfer.noteHint';
  });

  protected readonly pipelineError = computed<string | null>(() => {
    this.i18n();
    const server = this.activeServerError();
    if (server?.field === 'pipeline') return server.message;
    const key = this.localPipelineErrorKey();
    return key ? this.transloco.translate(key) : null;
  });

  protected readonly stageError = computed<string | null>(() => {
    this.i18n();
    const server = this.activeServerError();
    if (server?.field === 'stage') return server.message;
    const key = this.localStageErrorKey();
    return key ? this.transloco.translate(key) : null;
  });

  protected readonly reasonError = computed<string | null>(() => {
    this.i18n();
    const server = this.activeServerError();
    if (server?.field === 'reason' && !this.reasonsHidden()) return server.message;
    const key = this.localReasonErrorKey();
    return key ? this.transloco.translate(key) : null;
  });

  protected readonly noteError = computed<string | null>(() => {
    this.i18n();
    const server = this.activeServerError();
    if (server && (server.field === 'note' || (server.field === 'reason' && this.reasonsHidden()))) {
      return server.message;
    }
    const key = this.localNoteErrorKey();
    return key ? this.transloco.translate(key) : null;
  });

  protected readonly pipelineDescribedBy = computed(
    () => `${this.pipelineId}-hint${this.pipelineError() ? ` ${this.pipelineId}-error` : ''}`,
  );

  protected readonly stageDescribedBy = computed(
    () => `${this.stageId}-hint${this.stageError() ? ` ${this.stageId}-error` : ''}`,
  );

  protected readonly reasonDescribedBy = computed(
    () => `${this.reasonId}-hint${this.reasonError() ? ` ${this.reasonId}-error` : ''}`,
  );

  protected readonly noteDescribedBy = computed(
    () => `${this.noteId}-hint${this.noteError() ? ` ${this.noteId}-error` : ''}`,
  );

  constructor() {
    effect(() => {
      const req = this.request();
      untracked(() => {
        if (!req) {
          this.loadSeq += 1;
          this.reasonsLoading.set(false);
          this.localSubmitting.set(false);
          this.closingFromRequest = true;
          try {
            this.modal().close();
          } finally {
            this.closingFromRequest = false;
          }
          return;
        }

        const firstPipeline =
          req.pipelines.find((pipeline) => pipeline.isActive && pipeline.id !== req.row.pipelineId) ?? null;
        const firstStageId = defaultStageForPipeline(firstPipeline);

        this.selectedPipelineId.set(firstPipeline?.id ?? '');
        this.selectedStageId.set(firstStageId);
        this.selectedReasonId.set('');
        this.note.set('');
        this.localSubmitting.set(false);
        this.serverRequiredReason.set(false);
        this.localPipelineErrorKey.set(null);
        this.localStageErrorKey.set(null);
        this.localReasonErrorKey.set(null);
        this.localNoteErrorKey.set(null);
        this.dismissedServerError.set(null);
        this.syncStageReasons(firstPipeline?.stages.find((s) => s.id === firstStageId) ?? null);

        this.modal().open();
        afterNextRender(() => this.focusControl(this.pipelineId), { injector: this.injector });
      });
    });

    effect(() => {
      const err = this.effectiveServerError();
      if (!err) return;
      untracked(() => {
        this.localSubmitting.set(false);
        this.dismissedServerError.set(null);
        this.localPipelineErrorKey.set(null);
        this.localStageErrorKey.set(null);
        this.localReasonErrorKey.set(null);
        this.localNoteErrorKey.set(null);
        if (this.terminalKind() === 'WON' && err.field === 'reason') {
          this.serverRequiredReason.set(true);
          if (this.reasonsHidden()) {
            // The server requires a win reason the hidden list did not offer: load and show the reason field.
            const stageId = this.selectedStageId();
            void this.loadReasons('WON', true).then(() => {
              if (this.selectedStageId() === stageId) this.focusControl(this.reasonId);
            });
            return;
          }
        }
        switch (err.field) {
          case 'pipeline':
            this.focusControl(this.pipelineId);
            break;
          case 'stage':
            this.focusControl(this.stageId);
            break;
          case 'reason':
            this.focusControl(this.reasonsHidden() ? this.noteId : this.reasonId);
            break;
          case 'note':
            this.focusControl(this.noteId);
            break;
        }
      });
    });

    this.destroyRef.onDestroy(() => {
      this.loadSeq += 1;
    });
  }

  protected onPipelineChange(pipelineId: string): void {
    this.selectedPipelineId.set(pipelineId);
    const pipeline = this.availablePipelines().find((item) => item.id === pipelineId) ?? null;
    const nextStageId = defaultStageForPipeline(pipeline);
    this.selectedStageId.set(nextStageId);
    this.selectedReasonId.set('');
    this.serverRequiredReason.set(false);
    this.localPipelineErrorKey.set(null);
    this.localStageErrorKey.set(null);
    this.localReasonErrorKey.set(null);
    this.localNoteErrorKey.set(null);
    this.dismissServerError();
    this.syncStageReasons(pipeline?.stages.find((stage) => stage.id === nextStageId) ?? null);
  }

  protected onStageChange(stageId: string): void {
    this.selectedStageId.set(stageId);
    this.selectedReasonId.set('');
    this.serverRequiredReason.set(false);
    this.localStageErrorKey.set(null);
    this.localReasonErrorKey.set(null);
    this.localNoteErrorKey.set(null);
    this.dismissServerError();
    const stage = this.availableStages().find((item) => item.id === stageId) ?? null;
    this.syncStageReasons(stage);
  }

  protected onReasonChange(reasonId: string): void {
    this.selectedReasonId.set(reasonId);
    this.localReasonErrorKey.set(null);
    this.dismissServerError();
  }

  protected onNoteInput(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.note.set(value);
    this.localNoteErrorKey.set(null);
    if (value.trim()) {
      this.localReasonErrorKey.set(null);
    }
    this.dismissServerError();
  }

  protected submit(): void {
    const req = this.request();
    if (!req || this.isSubmitting() || this.reasonsLoading()) return;

    this.localPipelineErrorKey.set(null);
    this.localStageErrorKey.set(null);
    this.localReasonErrorKey.set(null);
    this.localNoteErrorKey.set(null);

    const pipelineId = this.selectedPipelineId();
    if (!pipelineId) {
      this.localPipelineErrorKey.set('oppMoves.transfer.pipelineRequired');
      this.focusControl(this.pipelineId);
      return;
    }

    const stageId = this.selectedStageId();
    if (!stageId) {
      this.localStageErrorKey.set('oppMoves.transfer.stageRequired');
      this.focusControl(this.stageId);
      return;
    }

    const rawNote = this.note();
    const trimmedNote = rawNote.trim();
    if (rawNote.length > this.maxNoteLength) {
      this.localNoteErrorKey.set('oppMoves.close.noteTooLong');
      this.focusControl(this.noteId);
      return;
    }

    const kind = this.terminalKind();
    const reasonId = kind && !this.reasonsHidden() ? this.selectedReasonId().trim() : '';

    if (kind === 'LOST' && !reasonId && !trimmedNote) {
      if (this.reasonsHidden()) {
        this.localNoteErrorKey.set('oppMoves.close.noteRequired');
        this.focusControl(this.noteId);
      } else {
        this.localReasonErrorKey.set('oppMoves.close.reasonOrNoteRequired');
        this.focusControl(this.reasonId);
      }
      return;
    }

    if (kind === 'WON' && this.serverRequiredReason() && !this.reasonsHidden() && !reasonId) {
      this.localReasonErrorKey.set('oppMoves.close.winReasonRequired');
      this.focusControl(this.reasonId);
      return;
    }

    const payload: TransferDialogResult = {
      pipelineId,
      stageId,
      ...(kind === 'LOST'
        ? reasonId
          ? { lostReasonId: reasonId, ...(trimmedNote ? { reason: trimmedNote } : {}) }
          : { lostReason: trimmedNote }
        : kind === 'WON'
          ? {
              ...(reasonId ? { winReasonId: reasonId } : {}),
              ...(trimmedNote ? { reason: trimmedNote } : {}),
            }
          : trimmedNote
            ? { reason: trimmedNote }
            : {}),
    };

    this.dismissServerError();
    this.localSubmitting.set(true);
    this.done.emit(payload);
  }

  protected cancel(): void {
    if (this.isSubmitting()) return;
    this.closingFromAction = true;
    try {
      this.modal().close();
    } finally {
      this.closingFromAction = false;
    }
    this.done.emit(null);
  }

  protected onModalClosed(): void {
    if (this.closingFromRequest || this.closingFromAction) return;
    if (this.request()) {
      this.done.emit(null);
    }
  }

  private syncStageReasons(stage: PipelineStageView | null): void {
    if (stage?.flag === 'WON' || stage?.flag === 'LOST') {
      void this.loadReasons(stage.flag);
      return;
    }
    this.loadSeq += 1;
    this.reasons.set([]);
    this.reasonsLoading.set(false);
    this.reasonsHidden.set(false);
  }

  /** `keepVisible` shows the reason field even when no active reason exists (server-required win reason). */
  private async loadReasons(kind: 'WON' | 'LOST', keepVisible = false): Promise<void> {
    const seq = ++this.loadSeq;
    this.reasons.set([]);
    this.reasonsLoading.set(true);
    this.reasonsHidden.set(false);
    try {
      // The route returns active reasons only, already ordered by sortOrder, code.
      const { items: active } = await listReasons({ kind: kind === 'WON' ? 'WIN' : 'LOSS' });
      if (seq !== this.loadSeq) return;
      this.reasons.set(active);
      this.reasonsHidden.set(!keepVisible && active.length === 0);
    } catch {
      if (seq !== this.loadSeq) return;
      this.reasons.set([]);
      this.reasonsHidden.set(!keepVisible);
    } finally {
      if (seq === this.loadSeq) {
        this.reasonsLoading.set(false);
      }
    }
  }

  private dismissServerError(): void {
    const err = this.effectiveServerError();
    if (err) {
      this.dismissedServerError.set(err);
    }
  }

  private focusControl(id: string): void {
    const el = this.host.nativeElement.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    el?.focus();
  }
}

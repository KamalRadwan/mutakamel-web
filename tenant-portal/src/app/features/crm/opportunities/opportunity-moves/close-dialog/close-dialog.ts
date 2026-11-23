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
import { tablerThumbDown, tablerTrophy } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Button } from '../../../../../shared/ui/button/button';
import { Dropdown, type DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { reasonDefinitionIn, reasonNameIn } from '../../../settings/reasons/reasons.model';
import type { OpportunityReason } from '../../opportunities.model';
import { OPPORTUNITY_LIMITS, stageLabel } from '../../opportunities.model';
import {
  type CloseDialogError,
  type CloseDialogRequest,
  type CloseDialogResult,
  OpportunityMoves,
} from '../opportunity-moves';

/** Modal dialog for closing an opportunity as WON or LOST with governed reason and note mapping. */
@Component({
  selector: 'app-opportunity-close-dialog',
  imports: [TranslocoPipe, Button, Dropdown, Field, Modal],
  providers: [
    provideTranslocoScope('opportunities', { scope: 'opportunity-moves', alias: 'oppMoves' }),
    provideIcons({ tablerThumbDown, tablerTrophy }),
  ],
  templateUrl: './close-dialog.html',
})
export class CloseDialog {
  private static nextId = 0;
  private readonly uid = `opp-close-${++CloseDialog.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly language = inject(LanguageState).current;
  private readonly transloco = inject(TranslocoService);
  private readonly moves = inject(OpportunityMoves, { optional: true });
  private readonly i18n = translationEvents(this.transloco);

  private readonly modal = viewChild.required(Modal);

  readonly request = input<CloseDialogRequest | null>(null);
  readonly serverError = input<CloseDialogError | null>(null);
  readonly submitting = input<boolean | null>(null);
  readonly done = output<CloseDialogResult | null>();

  protected readonly reasonId = `${this.uid}-reason`;
  protected readonly noteId = `${this.uid}-note`;
  protected readonly maxNoteLength = OPPORTUNITY_LIMITS.reason;

  protected readonly reasons = signal<OpportunityReason[]>([]);
  protected readonly reasonsLoading = signal(false);
  protected readonly reasonsHidden = signal(false);
  protected readonly selectedReasonId = signal('');
  protected readonly note = signal('');
  protected readonly localSubmitting = signal(false);
  protected readonly serverRequiredReason = signal(false);
  private readonly localReasonErrorKey = signal<string | null>(null);
  private readonly localNoteErrorKey = signal<string | null>(null);
  private readonly dismissedServerError = signal<CloseDialogError | null>(null);

  private loadSeq = 0;
  private closingFromRequest = false;
  private closingFromAction = false;

  private readonly effectiveServerError = computed<CloseDialogError | null>(
    () => this.serverError() ?? this.moves?.closeError() ?? null,
  );

  private readonly activeServerError = computed<CloseDialogError | null>(() => {
    const err = this.effectiveServerError();
    if (!err || err === this.dismissedServerError()) return null;
    return err;
  });

  protected readonly isSubmitting = computed(
    () => this.submitting() ?? this.moves?.closeSubmitting() ?? this.localSubmitting(),
  );

  protected readonly isWon = computed(() => this.request()?.kind === 'WON');

  protected readonly dialogTitle = computed(() => {
    this.i18n();
    return this.transloco.translate(this.isWon() ? 'oppMoves.close.wonTitle' : 'oppMoves.close.lostTitle');
  });

  protected readonly submitLabel = computed(() => {
    this.i18n();
    return this.transloco.translate(this.isWon() ? 'oppMoves.close.wonSubmit' : 'oppMoves.close.lostSubmit');
  });

  protected readonly stageName = computed(() => {
    const stage = this.request()?.stage;
    return stage ? stageLabel(stage, this.language()) : '';
  });

  /** Opportunity title isolated (FSI/PDI, same as dir="auto") so a mixed-script title cannot reorder the arrow and stage. */
  protected readonly dialogSubtitle = computed(() => {
    const title = this.request()?.title;
    if (!title) return '';
    const arrow = this.language() === 'ar' ? '←' : '→';
    return `⁨${title}⁩ ${arrow} ${this.stageName()}`;
  });

  protected readonly reasonLabelKey = computed(() => {
    if (!this.isWon()) return 'oppMoves.close.lossReason';
    return this.serverRequiredReason() ? 'oppMoves.close.winReason' : 'oppMoves.close.winReasonOptional';
  });

  protected readonly reasonRequired = computed(() => this.isWon() && this.serverRequiredReason());
  protected readonly noteRequired = computed(() => !this.isWon() && this.reasonsHidden());

  protected readonly noteHintKey = computed(() => {
    if (this.isWon()) return 'oppMoves.close.noteHintWon';
    return this.reasonsHidden() ? 'oppMoves.close.noteHintLostRequired' : 'oppMoves.close.noteHintLost';
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

  protected readonly reasonError = computed<string | null>(() => {
    this.i18n();
    const server = this.activeServerError();
    if (server?.field === 'reason' && !this.reasonsHidden()) {
      return server.message;
    }
    const localKey = this.localReasonErrorKey();
    return localKey ? this.transloco.translate(localKey) : null;
  });

  protected readonly noteError = computed<string | null>(() => {
    this.i18n();
    const server = this.activeServerError();
    if (server && (server.field === 'note' || (server.field === 'reason' && this.reasonsHidden()))) {
      return server.message;
    }
    const localKey = this.localNoteErrorKey();
    return localKey ? this.transloco.translate(localKey) : null;
  });

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

        this.selectedReasonId.set('');
        this.note.set('');
        this.reasons.set([]);
        this.reasonsHidden.set(false);
        this.localSubmitting.set(false);
        this.serverRequiredReason.set(false);
        this.localReasonErrorKey.set(null);
        this.localNoteErrorKey.set(null);
        this.dismissedServerError.set(null);

        this.modal().open();
        void this.loadReasons(req.kind);
        afterNextRender(() => this.focusInitialControl(), { injector: this.injector });
      });
    });

    effect(() => {
      const err = this.effectiveServerError();
      if (!err) return;
      untracked(() => {
        this.localSubmitting.set(false);
        this.dismissedServerError.set(null);
        this.localReasonErrorKey.set(null);
        this.localNoteErrorKey.set(null);
        const req = this.request();
        if (req?.kind === 'WON' && err.field === 'reason') {
          this.serverRequiredReason.set(true);
          if (this.reasonsHidden()) {
            // The server requires a win reason the hidden list did not offer: load and show the reason field.
            void this.loadReasons(req.kind, true).then(() => {
              if (this.request() === req) this.focusControl(this.reasonId);
            });
            return;
          }
        }
        this.focusControl(err.field === 'reason' && !this.reasonsHidden() ? this.reasonId : this.noteId);
      });
    });

    this.destroyRef.onDestroy(() => {
      this.loadSeq += 1;
    });
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

    this.localReasonErrorKey.set(null);
    this.localNoteErrorKey.set(null);

    const reasonId = this.reasonsHidden() ? '' : this.selectedReasonId().trim();
    const rawNote = this.note();
    const trimmedNote = rawNote.trim();

    if (rawNote.length > this.maxNoteLength) {
      this.localNoteErrorKey.set('oppMoves.close.noteTooLong');
      this.focusControl(this.noteId);
      return;
    }

    if (req.kind === 'LOST' && !reasonId && !trimmedNote) {
      if (this.reasonsHidden()) {
        this.localNoteErrorKey.set('oppMoves.close.noteRequired');
        this.focusControl(this.noteId);
      } else {
        this.localReasonErrorKey.set('oppMoves.close.reasonOrNoteRequired');
        this.focusControl(this.reasonId);
      }
      return;
    }

    if (req.kind === 'WON' && this.serverRequiredReason() && !this.reasonsHidden() && !reasonId) {
      this.localReasonErrorKey.set('oppMoves.close.winReasonRequired');
      this.focusControl(this.reasonId);
      return;
    }

    const payload: CloseDialogResult =
      req.kind === 'LOST'
        ? reasonId
          ? { lostReasonId: reasonId, ...(trimmedNote ? { reason: trimmedNote } : {}) }
          : { lostReason: trimmedNote }
        : {
            ...(reasonId ? { winReasonId: reasonId } : {}),
            ...(trimmedNote ? { reason: trimmedNote } : {}),
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

  /** Wave A uses free-text reasons until the governed list ships. */
  private async loadReasons(_kind: 'WON' | 'LOST', _keepVisible = false): Promise<void> {
    this.reasons.set([]);
    this.reasonsLoading.set(false);
    this.reasonsHidden.set(true);
  }

  private dismissServerError(): void {
    const err = this.effectiveServerError();
    if (err) {
      this.dismissedServerError.set(err);
    }
  }

  private focusInitialControl(): void {
    if (!this.request()) return;
    this.focusControl(!this.reasonsHidden() && !this.reasonsLoading() ? this.reasonId : this.noteId);
  }

  private focusControl(id: string): void {
    const el = this.host.nativeElement.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    el?.focus();
  }
}

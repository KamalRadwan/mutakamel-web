import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerUpload } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Button } from '../../../../../shared/ui/button/button';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { TemplatesApi } from '../../templates.api';
import { TemplatePageService } from '../template-page.service';
import { TextSegment, ValidationActions, splitIsolatedTokens } from './validation-actions';

const NOTE_MAX_LENGTH = 500;
const TOKEN_NUM = '\u0000NUM\u0000';

@Component({
  selector: 'app-tpl-publish-modal',
  imports: [NgIcon, TranslocoPipe, Button, Field, Modal],
  providers: [
    provideTranslocoScope('templates', { scope: 'templates-validation', alias: 'tplValidation' }),
    provideIcons({ tablerUpload }),
  ],
  templateUrl: './publish-modal.html',
})
export class PublishModal {
  private static nextId = 0;
  protected readonly uid = `tpl-publish-modal-${++PublishModal.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly templatesApi = inject(TemplatesApi);
  protected readonly language = inject(LanguageState).current;
  protected readonly service = inject(TemplatePageService);
  protected readonly actions = inject(ValidationActions);

  private readonly modal = viewChild.required<Modal>('modal');

  protected readonly changeNote = signal('');
  protected readonly changeNoteError = signal<string | null>(null);
  private readonly fetchedRunWarnings = signal<number | null>(null);

  private warningFetchSeq = 0;

  protected readonly nextVersionNumber = computed(
    () => (this.service.definition()?.currentPublishedVersion?.versionNumber ?? 0) + 1,
  );

  protected readonly modalTitle = computed(() => {
    this.i18n();
    this.language();
    return this.transloco.translate('tplValidation.publish.title', {
      n: `\u2066${this.nextVersionNumber()}\u2069`,
    });
  });

  protected readonly draftRevision = computed(
    () => this.service.draft()?.revision ?? this.service.definition()?.currentDraft.revision ?? 0,
  );

  protected readonly warningCount = computed(() => {
    const draft = this.service.draft();
    const run = this.actions.lastRun();
    if (run && draft && run.draftRevision === draft.revision) {
      // Same rule as draft.validation.warningCount: WARNING plus INFO issues.
      return run.issues.filter((issue) => issue.severity !== 'ERROR').length;
    }
    return this.fetchedRunWarnings() ?? draft?.validation.warningCount ?? 0;
  });

  protected readonly currentPublishedVersionNumber = computed(
    () => this.service.definition()?.currentPublishedVersion?.versionNumber ?? null,
  );

  protected readonly revisionSegments = computed<TextSegment[]>(() => {
    this.i18n();
    this.language();
    const rev = String(this.draftRevision());
    const text = this.transloco.translate('tplValidation.publish.revision', { n: TOKEN_NUM });
    return splitIsolatedTokens(text, { NUM: { text: rev, isolate: 'ltr' } });
  });

  protected readonly checkSegments = computed<TextSegment[]>(() => {
    this.i18n();
    this.language();
    const count = this.warningCount();
    if (count === 0) {
      return [{ text: this.transloco.translate('tplValidation.publish.passed'), isolate: 'none' }];
    }
    if (count === 1) {
      const text = this.transloco.translate('tplValidation.publish.passedWarningOne', { n: TOKEN_NUM });
      return splitIsolatedTokens(text, { NUM: { text: '1', isolate: 'ltr' } });
    }
    const text = this.transloco.translate('tplValidation.publish.passedWarnings', { n: TOKEN_NUM });
    return splitIsolatedTokens(text, { NUM: { text: String(count), isolate: 'ltr' } });
  });

  protected readonly currentVersionSegments = computed<TextSegment[] | null>(() => {
    this.i18n();
    this.language();
    const ver = this.currentPublishedVersionNumber();
    if (ver === null) return null;
    const text = this.transloco.translate('tplValidation.publish.version', { n: TOKEN_NUM });
    return splitIsolatedTokens(text, { NUM: { text: String(ver), isolate: 'ltr' } });
  });

  open(): void {
    const seq = ++this.warningFetchSeq;
    this.changeNote.set('');
    this.changeNoteError.set(null);
    this.fetchedRunWarnings.set(null);
    this.actions.resetPublishIntent();
    this.modal().open();

    const def = this.service.definition();
    const draft = this.service.draft();
    const runId = draft?.validation.lastValidationRunId;
    const lastRun = this.actions.lastRun();
    if (def && draft && runId && (!lastRun || lastRun.validationRunId !== runId)) {
      void this.templatesApi
        .getValidationRun(def.templateId, runId)
        .then((run) => {
          if (seq !== this.warningFetchSeq) return;
          const currentDef = this.service.definition();
          const currentDraft = this.service.draft();
          if (
            currentDef?.templateId !== def.templateId ||
            !currentDraft ||
            currentDraft.revision !== draft.revision
          ) {
            return;
          }
          if (
            run.templateId === def.templateId &&
            run.validationRunId === runId &&
            run.draftRevision === currentDraft.revision &&
            Array.isArray(run.issues)
          ) {
            this.fetchedRunWarnings.set(run.issues.filter((issue) => issue.severity !== 'ERROR').length);
          }
        })
        .catch(() => {
          // Summary warning count from draft.validation remains displayed when run fetch fails.
        });
    }
  }

  close(): void {
    if (this.actions.publishing()) return;
    this.modal().close();
  }

  protected onClosed(): void {
    this.warningFetchSeq++;
    this.changeNote.set('');
    this.changeNoteError.set(null);
    this.fetchedRunWarnings.set(null);
    this.actions.resetPublishIntent();
  }

  protected onNoteInput(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.changeNote.set(value);
    if (this.changeNoteError() && value.length <= NOTE_MAX_LENGTH) {
      this.changeNoteError.set(null);
    }
  }

  protected async submit(): Promise<void> {
    if (this.actions.publishing()) return;
    const note = this.changeNote();
    if (note.length > NOTE_MAX_LENGTH) {
      this.changeNoteError.set(this.transloco.translate('tplValidation.publish.noteTooLong'));
      return;
    }

    const result = await this.actions.publish({ changeNote: note.trim() || null });
    if (result !== null || this.actions.lastPublishClosedModal()) {
      this.modal().close();
    }
  }
}

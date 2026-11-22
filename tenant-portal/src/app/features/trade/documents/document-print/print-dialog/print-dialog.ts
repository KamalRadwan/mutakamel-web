import { DOCUMENT } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerCloudOff,
  tablerLoader2,
  tablerLock,
  tablerPrinter,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Dropdown, type DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { ApiError, errorCodeOf } from '../../../shared/trade-api';
import { KIND_CONFIG } from '../../shared/document-kinds';
import { DocumentRequestKeys } from '../../shared/document-request-keys';
import type { DocumentKind, PrintLocale, PrintTemplateOption } from '../../shared/document.model';
import { getRenderJob, listPrintTemplates, renderPdf, type RenderPdfBody } from '../../shared/documents.api';
import {
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_POLL_TIMEOUT_MS,
  PrintAbortError,
  PrintTimeoutError,
  runPrint,
} from '../print-job';
import { translationEvents } from '../../../../../core/i18n/translation-events';

export type PrintSource = { revisionId: string } | { sourceVersion: number };

type PrintPhase = 'idle' | 'running' | 'failed' | 'unavailable' | 'timeout';
// Every 503 the backend PDF services return is temporary, so each one gets the inline Retry state.
const RETRYABLE_PDF_CODES = new Set([
  'TRADE.BUSINESS_DOCUMENT.PDF_BUNDLE_UNAVAILABLE',
  'TRADE.BUSINESS_DOCUMENT.PDF_ARTIFACT_UNAVAILABLE',
]);
export const isRenderUnavailable = (code: string | null | undefined): boolean =>
  typeof code === 'string' && (code.endsWith('.PDF_RENDER_UNAVAILABLE') || RETRYABLE_PDF_CODES.has(code));
type TemplateErrorKey =
  | 'tdp.chooseTemplate'
  | 'td.errors.noDefaultAssignment'
  | 'td.errors.TRADE.BUSINESS_DOCUMENT.PDF_TEMPLATE_INCOMPATIBLE';

type ChoiceItem =
  | { id: 'default'; kind: 'default' }
  | { id: 'built-in'; kind: 'built-in' }
  | { id: string; kind: 'template'; template: PrintTemplateOption };

@Component({
  selector: 'app-print-dialog',
  imports: [NgIcon, TranslocoPipe, Button, Dropdown, Field, Modal],
  providers: [
    provideTranslocoScope(
      { scope: 'trade-shared', alias: 'tradeShared' },
      { scope: 'trade-documents', alias: 'td' },
      { scope: 'trade-documents-print', alias: 'tdp' },
    ),
    provideIcons({
      tablerCloudOff,
      tablerLoader2,
      tablerLock,
      tablerPrinter,
    }),
  ],
  templateUrl: './print-dialog.html',
})
export class PrintDialog {
  private static nextId = 0;

  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly modal = viewChild(Modal);
  private readonly choiceButtons = viewChildren<ElementRef<HTMLButtonElement>>('choiceBtn');

  readonly open = model<boolean>(false);
  readonly kind = input.required<DocumentKind>();
  readonly documentId = input.required<string>();
  readonly documentNumber = input<string | null>(null);
  readonly source = input.required<PrintSource>();

  protected readonly uid = `trade-print-dialog-${++PrintDialog.nextId}`;

  protected readonly templates = signal<PrintTemplateOption[]>([]);
  protected readonly templatesLoading = signal(false);
  protected readonly selectedChoice = signal<string | null>(null);
  private readonly customLocale = signal<PrintLocale | null>(null);
  protected readonly templateErrorKey = signal<TemplateErrorKey | null>(null);
  protected readonly phase = signal<PrintPhase>('idle');
  protected readonly attempt = signal(1);

  private dialogShown = false;
  private loadSeq = 0;
  private abortController: AbortController | null = null;
  /** x-idempotency-key of render-pdf: reused when the same print is retried, reset after a completed print. */
  private readonly renderKeys = new DocumentRequestKeys();

  protected readonly uiPrintLocale = computed<PrintLocale>(() =>
    this.language() === 'ar' ? 'ar-EG' : 'en-US',
  );

  protected readonly editableLocale = computed<PrintLocale>(
    () => this.customLocale() ?? this.uiPrintLocale(),
  );

  protected readonly modalTitle = computed(() => {
    this.i18n();
    const lang = this.language();
    const kindKey = KIND_CONFIG[this.kind()].titleKey;
    const rawKind = this.transloco.translate(kindKey);
    const kindLabel = lang === 'en' ? rawKind.toLowerCase() : rawKind;
    const base = this.transloco.translate('tdp.title', { kind: kindLabel });
    const num = this.documentNumber()?.trim();
    return num ? `${base} — \u2066${num}\u2069` : base;
  });

  protected readonly choices = computed<ChoiceItem[]>(() => {
    // The default assignment is always first: without templateVersionId the backend uses it for every kind.
    const list: ChoiceItem[] = [{ id: 'default', kind: 'default' }];
    if (this.kind() === 'quotation') {
      list.push({ id: 'built-in', kind: 'built-in' });
    }
    for (const template of this.templates()) {
      list.push({
        id: `template:${template.versionId}`,
        kind: 'template',
        template,
      });
    }
    return list;
  });

  protected readonly selectedTemplate = computed<PrintTemplateOption | null>(() => {
    const id = this.selectedChoice();
    if (!id) return null;
    const match = this.choices().find((item) => item.id === id);
    return match?.kind === 'template' ? match.template : null;
  });

  protected readonly languageReadonly = computed(() => this.selectedTemplate() !== null);

  protected readonly readonlyLanguageLabel = computed(() => {
    this.i18n();
    const tpl = this.selectedTemplate();
    return tpl ? this.transloco.translate(`tdp.lang.${tpl.locale}`) : '';
  });

  protected readonly languageOptions = computed<DropdownOption<PrintLocale>[]>(() => {
    this.i18n();
    return [
      { value: 'en-US', label: this.transloco.translate('tdp.lang.en-US') },
      { value: 'ar-EG', label: this.transloco.translate('tdp.lang.ar-EG') },
    ];
  });

  protected readonly running = computed(() => this.phase() === 'running');

  protected readonly canPrint = computed(
    () =>
      !this.templatesLoading() &&
      !this.running() &&
      this.selectedChoice() !== null,
  );

  protected readonly printButtonLabelKey = computed(() => {
    if (this.running()) return 'tdp.printing';
    if (this.phase() === 'failed' || this.phase() === 'unavailable') return 'tdp.tryAgain';
    return 'tdp.print';
  });

  constructor() {
    effect(() => {
      const isOpen = this.open();
      const modal = this.modal();
      if (!modal) return;
      if (isOpen && !this.dialogShown) {
        this.dialogShown = true;
        untracked(() => this.handleOpen(modal));
      } else if (!isOpen && this.dialogShown) {
        this.dialogShown = false;
        untracked(() => {
          this.cleanupOnClose();
          modal.close();
        });
      }
    });

    this.destroyRef.onDestroy(() => this.cleanupOnClose());
  }

  protected isChoiceTabStop(id: string): boolean {
    const items = this.choices();
    const current = this.selectedChoice();
    if (current && items.some((item) => item.id === current)) {
      return current === id;
    }
    return items[0]?.id === id;
  }

  protected selectChoice(id: string): void {
    if (this.running()) return;
    this.selectedChoice.set(id);
    this.templateErrorKey.set(null);
    if (this.phase() === 'failed' || this.phase() === 'unavailable' || this.phase() === 'timeout') {
      this.phase.set('idle');
    }
  }

  protected onChoiceKeydown(event: KeyboardEvent, index: number): void {
    if (this.running()) return;
    const items = this.choices();
    if (items.length === 0) return;

    const rtl = this.isRtl();
    const nextHorizontal = rtl ? 'ArrowLeft' : 'ArrowRight';
    const prevHorizontal = rtl ? 'ArrowRight' : 'ArrowLeft';

    let targetIndex = -1;
    switch (event.key) {
      case 'ArrowDown':
      case nextHorizontal:
        targetIndex = (index + 1) % items.length;
        break;
      case 'ArrowUp':
      case prevHorizontal:
        targetIndex = (index - 1 + items.length) % items.length;
        break;
      case 'Home':
        targetIndex = 0;
        break;
      case 'End':
        targetIndex = items.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    this.selectChoice(items[targetIndex].id);
    this.choiceButtons()[targetIndex]?.nativeElement.focus();
  }

  protected onLocaleChange(locale: PrintLocale): void {
    if (this.running()) return;
    this.customLocale.set(locale);
    if (this.phase() === 'failed' || this.phase() === 'unavailable' || this.phase() === 'timeout') {
      this.phase.set('idle');
    }
  }

  protected async print(): Promise<void> {
    if (!this.canPrint()) return;

    const kind = this.kind();
    const docId = this.documentId();
    const src = this.source();
    const choiceId = this.selectedChoice();

    const body: RenderPdfBody = {
      purpose: KIND_CONFIG[kind].printPurpose,
      ...('revisionId' in src ? { revisionId: src.revisionId } : { sourceVersion: src.sourceVersion }),
    };

    if (choiceId === 'default') {
      body.locale = this.editableLocale();
    } else if (choiceId === 'built-in') {
      body.templateChoice = 'BUILT_IN';
      body.locale = this.editableLocale();
    } else {
      const tpl = this.selectedTemplate();
      if (!tpl) {
        this.templateErrorKey.set('tdp.chooseTemplate');
        return;
      }
      body.templateVersionId = tpl.versionId;
      body.locale = tpl.locale;
    }

    this.abortActiveJob();
    const controller = new AbortController();
    this.abortController = controller;

    this.templateErrorKey.set(null);
    this.attempt.set(1);
    this.phase.set('running');

    const renderKey = this.renderKeys.for('renderPdf', { kind, docId, body });

    try {
      const result = await runPrint(
        () => renderPdf(kind, docId, body, renderKey),
        (jobId) => getRenderJob(kind, docId, jobId),
        {
          intervalMs: DEFAULT_POLL_INTERVAL_MS,
          timeoutMs: DEFAULT_POLL_TIMEOUT_MS,
          signal: controller.signal,
          onUpdate: (job) => {
            if (!controller.signal.aborted) {
              this.attempt.set(Math.max(1, job.attemptCount));
            }
          },
        },
      );

      if (controller.signal.aborted) return;

      if (result.status === 'COMPLETED') {
        this.renderKeys.reset();
        // Always re-read the job just before opening because the signed URL lives 300 s.
        const fresh = await getRenderJob(kind, docId, result.renderJobId);
        if (controller.signal.aborted) return;

        // Phase 5: open `/api/tenant/trade/v1/${KIND_CONFIG[kind].segment}/${docId}/render-jobs/${fresh.renderJobId}/artifact` for all kinds (API v2 F1); trade-app serves all four, the SO/PO/PQ gateway rows are pending.
        const url = fresh.artifact?.downloadUrl ?? result.artifact?.downloadUrl;
        if (!url) {
          this.notify.error(this.transloco.translate('tdp.failed'));
          this.phase.set('failed');
          return;
        }

        const win = this.document.defaultView ?? window;
        win.open(url, '_blank', 'noopener');
        this.notify.success(this.transloco.translate('tdp.ready'));
        this.requestClose();
        return;
      }

      const failureCode = result.failure?.code;
      if (isRenderUnavailable(failureCode)) {
        this.phase.set('unavailable');
        return;
      }
      const failureMsg = failureCode ? this.translateDocumentError(failureCode) : null;
      this.notify.error(failureMsg ?? this.transloco.translate('tdp.failed'));
      this.phase.set('failed');
    } catch (error: unknown) {
      if (error instanceof PrintAbortError || controller.signal.aborted) {
        return;
      }
      if (error instanceof PrintTimeoutError) {
        this.phase.set('timeout');
        return;
      }
      this.handleStartOrPollError(error);
    } finally {
      if (this.abortController === controller) {
        this.abortController = null;
      }
    }
  }

  protected requestClose(): void {
    this.modal()?.close();
  }

  protected onModalClosed(): void {
    this.dialogShown = false;
    this.cleanupOnClose();
    if (this.open()) {
      this.open.set(false);
    }
  }

  private handleOpen(modal: Modal): void {
    this.abortActiveJob();
    this.loadSeq++;
    this.templates.set([]);
    this.templatesLoading.set(true);
    this.selectedChoice.set(null);
    this.customLocale.set(null);
    this.templateErrorKey.set(null);
    this.phase.set('idle');
    this.attempt.set(1);

    modal.open();
    void this.loadTemplates();
  }

  private async loadTemplates(): Promise<void> {
    const seq = ++this.loadSeq;
    const kind = this.kind();

    this.templatesLoading.set(true);

    try {
      const list = await listPrintTemplates(kind);
      if (seq !== this.loadSeq) return;
      this.templates.set(list);
    } catch (error: unknown) {
      if (seq !== this.loadSeq) return;
      // The default assignment still prints, so a failed list only drops the specific templates.
      this.templates.set([]);
      if (!(error instanceof ApiError && error.status === 403)) {
        this.notify.error(this.resolveGenericErrorMessage(error));
      }
    } finally {
      if (seq === this.loadSeq) {
        this.selectedChoice.set('default');
        this.templatesLoading.set(false);
      }
    }
  }

  private handleStartOrPollError(error: unknown): void {
    const code = errorCodeOf(error);

    // 503 PDF_RENDER_UNAVAILABLE / PDF_BUNDLE_UNAVAILABLE / PDF_ARTIFACT_UNAVAILABLE: inline state with Retry, not a toast.
    if (error instanceof ApiError && error.status === 503 && isRenderUnavailable(code)) {
      this.phase.set('unavailable');
      return;
    }

    if (
      error instanceof ApiError &&
      error.status === 409 &&
      code &&
      (code === 'TRADE.BUSINESS_DOCUMENT.PDF_SOURCE_NOT_ELIGIBLE' ||
        code === 'TRADE.QUOTE.PDF_REVISION_NOT_ELIGIBLE' ||
        code.endsWith('PDF_SOURCE_NOT_ELIGIBLE') ||
        code.endsWith('PDF_REVISION_NOT_ELIGIBLE'))
    ) {
      this.notify.error(this.transloco.translate('tdp.notEligible'));
      this.phase.set('failed');
      return;
    }

    if (
      error instanceof ApiError &&
      error.status === 422 &&
      code &&
      (code === 'TRADE.BUSINESS_DOCUMENT.PDF_TEMPLATE_INCOMPATIBLE' ||
        code.endsWith('PDF_TEMPLATE_INCOMPATIBLE'))
    ) {
      const reasons = error.details?.['reason'];
      if (reasons?.includes('no_eligible_default_assignment')) {
        this.templateErrorKey.set('td.errors.noDefaultAssignment');
      } else {
        this.templateErrorKey.set('td.errors.TRADE.BUSINESS_DOCUMENT.PDF_TEMPLATE_INCOMPATIBLE');
      }
      this.phase.set('idle');
      return;
    }

    this.notify.error(this.resolveGenericErrorMessage(error));
    this.phase.set('failed');
  }

  private translateDocumentError(code: string): string | null {
    const key = `td.errors.${code}`;
    const translated = this.transloco.translate(key);
    return translated && translated !== key ? translated : null;
  }

  private resolveGenericErrorMessage(error: unknown): string {
    const code = errorCodeOf(error);
    if (code) {
      const direct = this.translateDocumentError(code);
      if (direct) return direct;
    }
    if (!(error instanceof ApiError)) {
      return this.transloco.translate('td.errors.network');
    }
    return this.transloco.translate('td.errors.generic');
  }

  private isRtl(): boolean {
    const el = this.host.nativeElement;
    const dirAttr = el.closest('[dir]')?.getAttribute('dir')?.toLowerCase();
    if (dirAttr === 'rtl' || dirAttr === 'ltr') {
      return dirAttr === 'rtl';
    }
    return getComputedStyle(el).direction === 'rtl';
  }

  private abortActiveJob(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private cleanupOnClose(): void {
    this.abortActiveJob();
    this.loadSeq++;
    this.phase.set('idle');
  }
}

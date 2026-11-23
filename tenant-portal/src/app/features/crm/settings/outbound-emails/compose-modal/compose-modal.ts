import { Component, ElementRef, computed, effect, inject, untracked, output, signal, viewChild, viewChildren } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCheck, tablerChevronDown, tablerMailForward, tablerSearch } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Segmented, SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import { ApiError, newIdempotencyKey } from '../../shared/settings-api';
import { anyGrant } from '../../shared/settings-access';
import { SourceLookup, searchSourceRecords } from '../source-lookup';
import { emailOptions, emailPreview, sendEmail } from '../outbound-emails.api';
import {
  CrmSourceRecord,
  EmailOptionsResponse,
  EmailPreviewResponse,
  EmailRecipientOption,
  EmailSourceType,
  SendEmailRequest,
  emailErrorState,
  resolveEmailErrorMessage,
  wrapEmailHtml,
  keepEmailKey,
} from '../outbound-emails.model';

type ComposeStep = 1 | 2 | 3;
type PreviewFormat = 'html' | 'text';

function recipientKey({ reference }: EmailRecipientOption): string {
  return `${reference.kind}:${reference.partyId ?? ''}:${reference.contactId ?? ''}`;
}

@Component({
  selector: 'app-compose-modal',
  imports: [ TranslocoPipe, NgIcon, Button, Dropdown, Field, Modal, Segmented],
  providers: [provideIcons({ tablerMailForward, tablerCheck, tablerChevronDown, tablerSearch })],
  templateUrl: './compose-modal.html',
  host: {
    '(document:click)': 'closeRecordMenuIfOutside($event)',
  },
})
export class ComposeModal {
  private static nextId = 0;
  protected readonly uid = `compose-email-${++ComposeModal.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly notify = inject(Notify);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly modal = viewChild.required(Modal);
  private readonly recordPicker = viewChild<ElementRef<HTMLElement>>('recordPicker');
  private readonly recordTrigger = viewChild<ElementRef<HTMLButtonElement>>('recordTrigger');
  private readonly recordOptionButtons = viewChildren<ElementRef<HTMLButtonElement>>('recordOption');
  private readonly recipientRadios = viewChildren<ElementRef<HTMLButtonElement>>('recipientRadio');

  readonly sent = output<string>();
  readonly refreshLog = output<void>();
  readonly becameReadOnly = output<void>();
  protected readonly readOnly = signal(!anyGrant('crm.email.send'));
  protected readonly sources = new SourceLookup();
  private readonly opened = signal(false);
  protected readonly modalError = signal<string | null>(null);
  protected readonly branchOptions = computed(() => (this.sources.types().includes(this.sourceType())
    ? this.sources.branchesFor(this.sourceType()) : this.sources.availableBranches())
    .map((branch) => ({ value: branch.id, label: branch.name })));

  protected readonly step = signal<ComposeStep>(1);
  protected readonly sourceType = signal<EmailSourceType>('LEAD');
  protected readonly records = signal<CrmSourceRecord[]>([]);
  protected readonly loadingRecords = signal(false);
  protected readonly selectedRecordId = signal<string>('');
  protected readonly recordMenuOpen = signal(false);
  protected readonly recordQuery = signal('');

  protected readonly loadingOptions = signal(false);
  protected readonly options = signal<EmailOptionsResponse | null>(null);
  protected readonly selectedRecipientKey = signal('');
  protected readonly selectedTemplateId = signal('');

  protected readonly loadingPreview = signal(false);
  protected readonly preview = signal<EmailPreviewResponse | null>(null);
  protected readonly previewFormat = signal<PreviewFormat>('html');
  protected readonly sending = signal(false);

  protected readonly busy = computed(() => this.loadingOptions() || this.loadingPreview() || this.sending());

  protected readonly steps = computed(() => {
    this.i18n();
    return [
      { num: 1 as ComposeStep, label: this.transloco.translate('outboundEmails.compose.steps.record') },
      { num: 2 as ComposeStep, label: this.transloco.translate('outboundEmails.compose.steps.recipientTemplate') },
      { num: 3 as ComposeStep, label: this.transloco.translate('outboundEmails.compose.steps.previewSend') },
    ];
  });

  protected readonly sourceTypeOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return this.sources.types().map((type) => ({
      value: type,
      label: this.transloco.translate(`outboundEmails.sourceTypes.${type}`),
    }));
  });

  protected readonly filteredRecords = computed(() => {
    const type = this.sourceType();
    const query = this.recordQuery().trim().toLowerCase();
    return this.records().filter((record) => {
      if (record.type !== type) return false;
      return !query || record.name.toLowerCase().includes(query);
    });
  });

  protected readonly selectedRecord = computed(
    () => this.records().find((record) => record.id === this.selectedRecordId()) ?? null,
  );

  protected readonly templateDropdownOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const list = this.options()?.templates ?? [];
    return [{ value: '', label: this.transloco.translate('outboundEmails.compose.assignedTemplate') }, ...list.map((tpl) => ({
      value: tpl.templateVersionId,
      label: `${tpl.name} · ${this.transloco.translate('outboundEmails.table.version', { version: tpl.versionNumber })}`,
    }))];
  });

  protected readonly selectedRecipient = computed(() => {
    const list = this.options()?.recipients ?? [];
    const key = this.selectedRecipientKey();
    return list.find((item) => recipientKey(item) === key) ?? null;
  });

  protected readonly canProceedToPreview = computed(
    () => !this.readOnly() && Boolean(this.selectedRecipient()) &&
      !this.options()?.availability.includes('NO_COMPATIBLE_TEMPLATE'),
  );

  protected readonly previewFormatOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return [
      { value: 'html', label: this.transloco.translate('outboundEmails.detail.format.html') },
      { value: 'text', label: this.transloco.translate('outboundEmails.detail.format.text') },
    ];
  });

  protected readonly safeHtml = computed<SafeHtml | null>(() => {
    const prev = this.preview();
    if (!prev) return null;
    return this.sanitizer.bypassSecurityTrustHtml(wrapEmailHtml(prev.bodyHtml));
  });

  private recordsLoadSeq = 0;
  private sendKey = '';
  private sendFingerprint = '';
  private previewLocale: 'ar' | 'en' = 'en';

  constructor() {
    effect(() => {
      if (!this.opened()) return;
      this.sources.branchId();
      const types = this.sources.types();
      if (types.length && !types.includes(this.sourceType())) this.sourceType.set(types[0]);
      this.selectedRecordId.set('');
      this.records.set([]);
      this.recordMenuOpen.set(false);
      this.options.set(null);
      this.preview.set(null);
      this.step.set(1);
      untracked(() => void this.loadRecords());
    });
  }

  open(): void {
    if (this.readOnly()) return;
    this.step.set(1);
    this.sourceType.set('LEAD');
    this.recordMenuOpen.set(false);
    this.recordQuery.set('');
    this.options.set(null);
    this.selectedRecipientKey.set('');
    this.selectedTemplateId.set('');
    this.preview.set(null);
    this.previewFormat.set('html');
    this.sending.set(false);
    this.sendKey = '';
    this.sendFingerprint = '';
    this.modalError.set(null);
    this.selectedRecordId.set('');
    this.records.set([]);
    this.previewLocale = this.language();
    this.modal().open();
    this.opened.set(true);
    void this.sources.loadBranches().catch((error) => this.handleError(error));
  }

  close(): void {
    if (this.busy()) return;
    this.modal().close();
  }

  protected onSourceTypeChange(value: string | null): void {
    if (value !== 'LEAD' && value !== 'CUSTOMER_PROFILE' && value !== 'OPPORTUNITY') return;
    this.sourceType.set(value);
    this.recordMenuOpen.set(false);
    this.recordQuery.set('');
    this.selectedRecordId.set('');
    this.records.set([]);
    void this.loadRecords();
  }

  protected onBranchChange(value: string | null): void {
    this.sources.branchId.set(value);
    this.selectedRecordId.set('');
    this.records.set([]);
    this.recordMenuOpen.set(false);
    this.options.set(null);
    this.preview.set(null);
  }

  protected toggleRecordMenu(): void {
    if (this.loadingRecords() || !this.sources.branchId() || !this.sources.types().includes(this.sourceType())) return;
    this.recordMenuOpen.update((open) => !open);
  }

  protected onRecordQueryInput(event: Event): void {
    this.recordQuery.set((event.target as HTMLInputElement).value);
    void this.loadRecords();
  }

  protected selectRecord(record: CrmSourceRecord): void {
    this.selectedRecordId.set(record.id);
    this.recordMenuOpen.set(false);
  }

  protected closeRecordMenuIfOutside(event: Event): void {
    if (!this.recordMenuOpen()) return;
    const pickerEl = this.recordPicker()?.nativeElement;
    if (pickerEl && !pickerEl.contains(event.target as Node)) {
      this.recordMenuOpen.set(false);
    }
  }

  protected onRecordPickerEscape(event: Event): void {
    if (!this.recordMenuOpen()) return;
    event.preventDefault();
    event.stopPropagation();
    this.recordMenuOpen.set(false);
    this.recordTrigger()?.nativeElement.focus();
  }

  protected onRecordMenuKeydown(event: KeyboardEvent): void {
    const options = this.recordOptionButtons().map((ref) => ref.nativeElement);
    if (!options.length) return;
    const target = event.target as HTMLElement | null;
    const currentIdx = target ? options.indexOf(target as HTMLButtonElement) : -1;

    if (currentIdx < 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        options[0].focus();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        options[options.length - 1].focus();
      }
      return;
    }

    let nextIdx = -1;
    if (event.key === 'ArrowDown') nextIdx = (currentIdx + 1) % options.length;
    else if (event.key === 'ArrowUp') nextIdx = (currentIdx - 1 + options.length) % options.length;
    else if (event.key === 'Home') nextIdx = 0;
    else if (event.key === 'End') nextIdx = options.length - 1;
    else return;

    event.preventDefault();
    options[nextIdx].focus();
  }

  protected onRecipientKeydown(event: KeyboardEvent): void {
    const recipients = this.options()?.recipients ?? [];
    const radios = this.recipientRadios().map((ref) => ref.nativeElement);
    if (!recipients.length || !radios.length) return;

    const target = event.target as HTMLElement | null;
    const focusedIdx = target ? radios.indexOf(target as HTMLButtonElement) : -1;
    const currentIdx =
      focusedIdx >= 0
        ? focusedIdx
        : Math.max(0, recipients.findIndex((item) => recipientKey(item) === this.selectedRecipientKey()));
    const rtl = this.language() === 'ar';
    const nextHoriz = rtl ? 'ArrowLeft' : 'ArrowRight';
    const prevHoriz = rtl ? 'ArrowRight' : 'ArrowLeft';

    let nextIdx = -1;
    if (event.key === 'ArrowDown' || event.key === nextHoriz) nextIdx = (currentIdx + 1) % recipients.length;
    else if (event.key === 'ArrowUp' || event.key === prevHoriz) nextIdx = (currentIdx - 1 + recipients.length) % recipients.length;
    else if (event.key === 'Home') nextIdx = 0;
    else if (event.key === 'End') nextIdx = recipients.length - 1;
    else return;

    event.preventDefault();
    this.selectRecipient(recipients[nextIdx]);
    radios[nextIdx]?.focus();
  }

  protected recipientKeyOf(recipient: EmailRecipientOption): string {
    return recipientKey(recipient);
  }

  protected selectRecipient(recipient: EmailRecipientOption): void {
    this.selectedRecipientKey.set(recipientKey(recipient));
  }

  protected setPreviewFormat(value: string | null): void {
    if (value === 'html' || value === 'text') {
      this.previewFormat.set(value);
    }
  }

  protected async nextFromRecord(): Promise<void> {
    if (this.busy() || this.readOnly()) return;
    const recordId = this.selectedRecordId();
    if (!recordId || !this.sources.branchId() || !this.sources.types().includes(this.sourceType())) return;

    this.recordMenuOpen.set(false);
    this.loadingOptions.set(true);
    this.options.set(null);
    this.modalError.set(null);

    try {
      const response = await emailOptions({
        sourceType: this.sourceType(),
        sourceId: recordId,
        locale: this.language(),
      });
      this.options.set(response);
      this.selectedRecipientKey.set(response.recipients[0] ? recipientKey(response.recipients[0]) : '');
      this.selectedTemplateId.set('');
      this.step.set(2);
    } catch (error) {
      this.handleError(error);
    } finally {
      this.loadingOptions.set(false);
    }
  }

  protected async nextFromOptions(): Promise<void> {
    if (this.busy() || !this.canProceedToPreview()) return;
    const recipient = this.selectedRecipient();
    const templateVersionId = this.selectedTemplateId();
    if (!recipient) return;

    const locale = this.language();
    const body: SendEmailRequest = {
      sourceType: this.sourceType(),
      sourceId: this.selectedRecordId(),
      locale,
      recipient: { ...recipient.reference },
      ...(templateVersionId ? { templateVersionId } : {}),
    };

    this.loadingPreview.set(true);
    this.modalError.set(null);
    try {
      const result = await emailPreview(body);
      this.preview.set(result);
      this.previewFormat.set('html');
      this.previewLocale = locale;
      const fingerprint = JSON.stringify(body);
      if (fingerprint !== this.sendFingerprint || !this.sendKey) {
        this.sendFingerprint = fingerprint;
        this.sendKey = newIdempotencyKey();
      }
      this.step.set(3);
    } catch (error) {
      this.handleError(error);
    } finally {
      this.loadingPreview.set(false);
    }
  }

  protected async send(): Promise<void> {
    if (this.busy() || this.readOnly()) return;
    const recipient = this.selectedRecipient();
    const templateVersionId = this.selectedTemplateId();
    if (!recipient) return;

    const body: SendEmailRequest = {
      sourceType: this.sourceType(), sourceId: this.selectedRecordId(), locale: this.previewLocale,
      recipient: { ...recipient.reference }, ...(templateVersionId ? { templateVersionId } : {}),
    };
    const fingerprint = JSON.stringify(body);
    if (!this.sendKey || this.sendFingerprint !== fingerprint) {
      this.sendKey = newIdempotencyKey();
      this.sendFingerprint = fingerprint;
    }

    this.sending.set(true);
    this.modalError.set(null);
    try {
      const result = await sendEmail(
        body,
        this.sendKey,
      );
      this.notify.success(this.transloco.translate('outboundEmails.toasts.queued'));
      this.modal().close();
      this.sent.emit(result.outboundEmailId);
    } catch (error) {
      if (!keepEmailKey(error)) this.sendKey = '';
      if (error instanceof ApiError && error.code === 'CRM.EMAIL.IDEMPOTENCY_MISMATCH') {
        this.notify.warning(resolveEmailErrorMessage(this.transloco, error));
        this.refreshLog.emit();
      } else {
        this.handleError(error);
      }
    } finally {
      this.sending.set(false);
    }
  }

  protected goBack(): void {
    if (this.busy()) return;
    const current = this.step();
    if (current === 3) {
      this.step.set(2);
    } else if (current === 2) {
      this.step.set(1);
    }
  }

  protected onClosed(): void {
    this.opened.set(false);
    this.recordsLoadSeq++;
    this.recordMenuOpen.set(false);
    this.loadingOptions.set(false);
    this.loadingPreview.set(false);
    this.sending.set(false);
  }

  private async loadRecords(): Promise<void> {
    const seq = ++this.recordsLoadSeq;
    const branch = this.sources.branchId();
    if (!branch || !this.sources.types().includes(this.sourceType())) {
      this.loadingRecords.set(false);
      return;
    }
    this.loadingRecords.set(true);
    try {
      const items = await searchSourceRecords(this.sourceType(), branch, this.recordQuery(), 1);
      if (seq !== this.recordsLoadSeq) return;
      this.records.set(items);
    } catch (error) {
      if (seq === this.recordsLoadSeq) {
        this.handleError(error);
      }
    } finally {
      if (seq === this.recordsLoadSeq) {
        this.loadingRecords.set(false);
      }
    }
  }

  private handleError(error: unknown): void {
    const state = emailErrorState(this.transloco, error);
    if (state.readOnly) {
      this.readOnly.set(true);
      this.becameReadOnly.emit();
    }
    const message = resolveEmailErrorMessage(this.transloco, error, true);
    if (error instanceof ApiError && (error.status === 422 || error.status === 429)) {
      this.modalError.set(message);
    } else {
      this.notify.error(message);
    }
  }
}

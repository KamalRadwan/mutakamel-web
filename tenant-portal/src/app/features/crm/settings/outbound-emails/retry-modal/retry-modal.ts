import { Component, ElementRef, computed, inject, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerRefresh } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { ApiError, newIdempotencyKey } from '../../shared/settings-api';
import { retryEmail } from '../outbound-emails.api';
import { EmailDetail, RETRY_REASON_MAX, resolveEmailErrorMessage } from '../outbound-emails.model';

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

@Component({
  selector: 'app-retry-modal',
  imports: [TranslocoPipe, Button, Field, Modal],
  providers: [provideIcons({ tablerRefresh })],
  templateUrl: './retry-modal.html',
})
export class RetryModal {
  private static nextId = 0;
  protected readonly uid = `retry-email-${++RetryModal.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly notify = inject(Notify);
  private readonly modal = viewChild.required(Modal);
  private readonly reasonInput = viewChild<ElementRef<HTMLTextAreaElement>>('reasonInput');

  readonly retried = output<string>();
  readonly openExisting = output<string>();

  protected readonly target = signal<EmailDetail | null>(null);
  /** Retry needs retained content, so the subject is always in the detail. */
  protected readonly subject = computed(() => {
    const content = this.target()?.content;
    return content?.state === 'AVAILABLE' ? content.subject : '';
  });
  protected readonly reason = signal('');
  protected readonly touched = signal(false);
  protected readonly submitted = signal(false);
  protected readonly submitting = signal(false);
  protected readonly existingRetryId = signal<string | null>(null);
  protected readonly maxLength = RETRY_REASON_MAX;

  private retryKey = '';
  private lastTrimmedReason = '';

  protected readonly reasonCount = computed(() => this.reason().trim().length);

  protected readonly reasonError = computed<string | null>(() => {
    this.i18n();
    if (!this.touched() && !this.submitted()) return null;
    const trimmed = this.reason().trim();
    if (!trimmed) return this.transloco.translate('outboundEmails.retry.validationRequired');
    if (trimmed.length > RETRY_REASON_MAX) return this.transloco.translate('outboundEmails.retry.validationMax');
    if (CONTROL_CHARS.test(trimmed)) return this.transloco.translate('outboundEmails.retry.validationControl');
    return null;
  });

  open(email: EmailDetail): void {
    this.target.set(email);
    this.reason.set('');
    this.touched.set(false);
    this.submitted.set(false);
    this.submitting.set(false);
    this.existingRetryId.set(null);
    this.retryKey = newIdempotencyKey();
    this.lastTrimmedReason = '';
    this.modal().open();
    this.reasonInput()?.nativeElement.focus();
  }

  close(): void {
    if (this.submitting()) return;
    this.modal().close();
  }

  protected onReasonInput(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.reason.set(value);
    const trimmed = value.trim();
    if (trimmed !== this.lastTrimmedReason) {
      this.lastTrimmedReason = trimmed;
      this.retryKey = newIdempotencyKey();
    }
  }

  protected markTouched(): void {
    this.touched.set(true);
  }

  protected async submit(): Promise<void> {
    if (this.submitting()) return;
    this.submitted.set(true);

    const current = this.target();
    const trimmed = this.reason().trim();
    if (!current || !trimmed || trimmed.length > RETRY_REASON_MAX || CONTROL_CHARS.test(trimmed)) {
      return;
    }

    this.submitting.set(true);
    try {
      const result = await retryEmail(current.outboundEmailId, trimmed, this.retryKey);
      this.notify.success(this.transloco.translate('outboundEmails.toasts.retryQueued'));
      this.modal().close();
      this.retried.emit(result.outboundEmailId);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'CRM.EMAIL.RETRY_ALREADY_CREATED') {
        const existingId = error.details?.['existingOutboundEmailId'];
        const resolvedExistingId = typeof existingId === 'string' ? existingId : null;
        this.existingRetryId.set(resolvedExistingId);
        this.retried.emit(resolvedExistingId ?? '');
      }
      this.notify.error(resolveEmailErrorMessage(this.transloco, error));
    } finally {
      this.submitting.set(false);
    }
  }

  protected openExistingRetry(): void {
    const existingId = this.existingRetryId();
    if (!existingId || this.submitting()) return;
    this.modal().close();
    this.openExisting.emit(existingId);
  }

  protected onClosed(): void {
    this.target.set(null);
    this.reason.set('');
    this.touched.set(false);
    this.submitted.set(false);
    this.existingRetryId.set(null);
  }
}

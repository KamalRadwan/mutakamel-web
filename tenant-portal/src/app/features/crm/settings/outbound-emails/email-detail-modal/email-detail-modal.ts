import { Component, ElementRef, computed, inject, input, output, signal, viewChild, viewChildren } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerHistory,
  tablerInfoCircle,
  tablerLink,
  tablerMail,
  tablerRefresh,
  tablerTarget,
  tablerUserPlus,
  tablerUsers,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Segmented, SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import { SettingsNotice } from '../../../../../shared/ui/settings-notice/settings-notice';
import { getEmail } from '../outbound-emails.api';
import {
  EmailDetail,
  EmailFeedbackReasonCode,
  EmailStatus,
  EmailTimelineState,
  SOURCE_LOOK,
  STATUS_BADGE,
  canRetryEmail,
  feedbackReasonKey,
  formatEmailDateTime,
  resolveEmailErrorMessage,
  shortEmailRef,
  wrapEmailHtml,
} from '../outbound-emails.model';

type DetailTab = 'message' | 'details' | 'timeline';
type MessageViewFormat = 'html' | 'text';

const TIMELINE_DOT: Record<EmailTimelineState, string> = {
  QUEUED: 'bg-status-none',
  RETRY_REQUESTED: 'bg-warning',
  DISPATCHING: 'bg-brand',
  SENT: 'bg-success',
  FAILED: 'bg-danger',
  BOUNCED: 'bg-danger',
  COMPLAINED: 'bg-danger',
};

@Component({
  selector: 'app-email-detail-modal',
  imports: [TranslocoPipe, NgIcon, Button, Field, Modal, Segmented, SettingsNotice],
  providers: [
    provideIcons({
      tablerMail,
      tablerRefresh,
      tablerUserPlus,
      tablerUsers,
      tablerTarget,
      tablerAlertTriangle,
      tablerHistory,
      tablerInfoCircle,
      tablerLink,
    }),
  ],
  templateUrl: './email-detail-modal.html',
})
export class EmailDetailModal {
  private static nextId = 0;
  protected readonly uid = `email-detail-${++EmailDetailModal.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly notify = inject(Notify);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly modal = viewChild.required(Modal);
  private readonly tabButtons = viewChildren<ElementRef<HTMLButtonElement>>('tabBtn');

  readonly canManage = input(false);
  readonly retryRequested = output<EmailDetail>();

  protected readonly detail = signal<EmailDetail | null>(null);
  protected readonly loading = signal(false);
  protected readonly activeTab = signal<DetailTab>('message');
  protected readonly bodyFormat = signal<MessageViewFormat>('html');

  protected readonly sourceLook = SOURCE_LOOK;
  protected readonly statusBadge = STATUS_BADGE;
  protected readonly timelineDot = TIMELINE_DOT;

  private loadSeq = 0;
  private emailId: string | null = null;

  async refresh(): Promise<void> {
    if (this.emailId) await this.open(this.emailId);
  }

  protected readonly formatOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return [
      { value: 'html', label: this.transloco.translate('outboundEmails.detail.format.html') },
      { value: 'text', label: this.transloco.translate('outboundEmails.detail.format.text') },
    ];
  });

  protected readonly canRetry = computed(() => {
    const current = this.detail();
    return Boolean(current && this.canManage() && canRetryEmail(current));
  });

  protected readonly sortedTimeline = computed(() => {
    const current = this.detail();
    if (!current) return [];
    return [...current.timeline].sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  });

  protected readonly subtitle = computed(() => {
    const current = this.detail();
    if (!current) return '';
    return `${current.recipient.displayName} · ${current.recipient.maskedAddress}`;
  });

  protected readonly safeHtml = computed<SafeHtml | null>(() => {
    const current = this.detail();
    if (!current || current.content.state !== 'AVAILABLE') return null;
    return this.sanitizer.bypassSecurityTrustHtml(wrapEmailHtml(current.content.html));
  });

  async open(emailId: string): Promise<void> {
    this.emailId = emailId;
    const seq = ++this.loadSeq;
    this.activeTab.set('message');
    this.bodyFormat.set('html');
    this.detail.set(null);
    this.loading.set(true);
    this.modal().open();

    try {
      const loaded = await getEmail(emailId);
      if (seq !== this.loadSeq) return;
      this.detail.set(loaded);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.notify.error(resolveEmailErrorMessage(this.transloco, error));
      this.modal().close();
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  close(): void {
    this.modal().close();
  }

  protected setTab(tab: DetailTab): void {
    this.activeTab.set(tab);
  }

  protected onTabKeydown(event: KeyboardEvent): void {
    const tabs: DetailTab[] = ['message', 'details', 'timeline'];
    const currentIdx = tabs.indexOf(this.activeTab());
    const rtl = this.language() === 'ar';
    const nextKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const prevKey = rtl ? 'ArrowRight' : 'ArrowLeft';

    let nextIdx = -1;
    if (event.key === nextKey) nextIdx = (currentIdx + 1) % tabs.length;
    else if (event.key === prevKey) nextIdx = (currentIdx - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIdx = 0;
    else if (event.key === 'End') nextIdx = tabs.length - 1;
    else return;

    event.preventDefault();
    this.activeTab.set(tabs[nextIdx]);
    this.tabButtons()[nextIdx]?.nativeElement.focus();
  }

  protected setFormat(value: string | null): void {
    if (value === 'html' || value === 'text') {
      this.bodyFormat.set(value);
    }
  }

  protected requestRetry(): void {
    const current = this.detail();
    if (!current || !this.canRetry()) return;
    this.modal().close();
    this.retryRequested.emit(current);
  }

  protected statusClass(status: EmailStatus): string {
    return this.statusBadge[status];
  }

  /** The detail sends no record name: show the record type and a short id. */
  protected readonly recordLabel = computed(() => {
    this.i18n();
    const current = this.detail();
    if (!current) return '';
    const type = this.transloco.translate(`outboundEmails.sourceTypes.${current.sourceType}`);
    return this.transloco.translate('outboundEmails.table.recordRef', { type, ref: shortEmailRef(current.sourceId) });
  });

  /** Known provider kinds get a label; any other kind is shown as the backend sends it. */
  protected readonly providerLabel = computed(() => {
    this.i18n();
    const kind = this.detail()?.provider?.kind;
    if (!kind) return this.transloco.translate('outboundEmails.detail.fields.notAvailable');
    const key = `outboundEmails.providers.${kind}`;
    const label = this.transloco.translate(key);
    return label && label !== key ? label : kind;
  });

  protected feedbackReason(code: string): EmailFeedbackReasonCode {
    return feedbackReasonKey(code);
  }

  protected formatDateTime(iso: string | null | undefined): string {
    return formatEmailDateTime(iso, this.language());
  }

  protected onClosed(): void {
    this.emailId = null;
    this.loadSeq++;
    this.loading.set(false);
  }
}

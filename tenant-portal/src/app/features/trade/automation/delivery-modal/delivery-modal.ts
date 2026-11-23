import {
  Component,
  DestroyRef,
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
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerCheck,
  tablerCopy,
  tablerFileSearch,
  tablerRefresh,
  tablerSend,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { Button } from '../../../../shared/ui/button/button';
import { Modal } from '../../../../shared/ui/modal/modal';
import { TradeReasonPicker, type ReasonPickerValue } from '../../shared/pickers/reason-picker/reason-picker';
import { ApiError, type TradeContext, errorCodeOf } from '../../shared/trade-api';
import { listReasons } from '../../shared/trade-foundation.api';
import type { ReasonCode } from '../../shared/trade-foundation.model';
import { formatDate } from '../../shared/trade-format';
import { AutomationBadge } from '../automation-shared/automation-badge/automation-badge';
import { ConflictDialog } from '../automation-shared/conflict-dialog/conflict-dialog';
import { type PollHandle, pollWhile } from '../automation-shared/poll';
import { ActionKeys } from '../automation-shared/action-keys';
import { isForbiddenError, isIdempotencyMismatch } from '../webhooks-page/webhook-access';
import { getDelivery, getSubscription, retryDelivery } from '../webhooks.api';
import {
  type RetryDeliveryAccepted,
  type SubscriptionStatus,
  type WebhookDeliveryAttempt,
  type WebhookDeliveryDetail,
  canRetryDelivery,
  endpointText,
} from '../webhooks.model';

const POLL_MS = 5000;
const RETRY_REASON_KIND = 'WEBHOOK_DELIVERY_RETRY';

@Component({
  selector: 'app-delivery-modal',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    Modal,
    TradeReasonPicker,
    AutomationBadge,
    ConflictDialog,
  ],
  providers: [
    provideIcons({
      tablerSend,
      tablerCopy,
      tablerCheck,
      tablerRefresh,
      tablerFileSearch,
    }),
  ],
  templateUrl: './delivery-modal.html',
})
export class DeliveryModal {
  private static nextId = 0;

  private readonly destroyRef = inject(DestroyRef);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly notify = inject(Notify);

  private readonly modal = viewChild.required<Modal>('deliveryModal');
  private readonly retryModal = viewChild.required<Modal>('retryModal');
  private readonly conflictDialog = viewChild.required<ConflictDialog>('conflictDialog');
  private readonly reasonPicker = viewChild(TradeReasonPicker);

  protected readonly uid = `webhook-delivery-modal-${++DeliveryModal.nextId}`;

  readonly deliveryId = input.required<string>();
  readonly subscriptionStatus = input<SubscriptionStatus | null>(null);
  readonly ctx = input<TradeContext>({});
  readonly canReplay = input(true);

  readonly closed = output<void>();
  readonly retried = output<RetryDeliveryAccepted>();
  readonly forbidden = output<void>();

  protected readonly detail = signal<WebhookDeliveryDetail | null>(null);
  protected readonly resolvedSubStatus = signal<SubscriptionStatus | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly notFound = signal(false);
  protected readonly retrying = signal(false);
  protected readonly copiedSourceId = signal(false);

  protected readonly reasonValue = signal<ReasonPickerValue>({ reasonCodeId: null, note: '' });
  protected readonly retrySubmitted = signal(false);
  protected readonly retryReasons = signal<ReasonCode[]>([]);
  protected readonly retryReasonsLoaded = signal(false);

  private destroyed = false;
  private readonly keys = new ActionKeys();
  private loadSeq = 0;
  private pollSeq = 0;
  private activePollId = '';
  private stopPollHandle: PollHandle<WebhookDeliveryDetail> | null = null;
  private copyTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly effectiveSubStatus = computed<SubscriptionStatus | null>(
    () => this.resolvedSubStatus() ?? this.subscriptionStatus(),
  );

  protected readonly attempts = computed<readonly WebhookDeliveryAttempt[]>(
    () => this.detail()?.attempts ?? [],
  );

  protected readonly canShowRetry = computed(() => {
    const current = this.detail();
    return this.canReplay() && current !== null && canRetryDelivery(current, this.effectiveSubStatus());
  });

  protected readonly hasRetryReasons = computed(
    () => !this.retryReasonsLoaded() || this.retryReasons().length > 0,
  );

  protected readonly retryConfirmDisabled = computed(() => {
    if (this.retrying()) return true;
    if (this.retryReasonsLoaded() && this.retryReasons().length === 0) return true;
    const picker = this.reasonPicker();
    return picker ? !picker.valid() : !this.reasonValue().reasonCodeId;
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.stopPolling();
      if (this.copyTimer !== null) {
        clearTimeout(this.copyTimer);
        this.copyTimer = null;
      }
    });

    afterNextRender(() => {
      this.modal().open();
    });

    effect(() => {
      const id = this.deliveryId();
      untracked(() => {
        void this.loadDelivery(id);
      });
    });

    effect(() => {
      const current = this.detail();
      const inProgress =
        current !== null &&
        (current.status === 'PENDING' || current.status === 'RETRY_PENDING');
      const nextId = inProgress ? current.id : '';

      if (!inProgress) {
        if (this.activePollId) {
          untracked(() => this.stopPolling());
        }
        return;
      }

      if (nextId === this.activePollId) return;
      untracked(() => this.startPolling(nextId));
    });
  }

  protected eventCode(detail: WebhookDeliveryDetail): string {
    return detail.sourceEventType;
  }

  protected eventLabel(detail: WebhookDeliveryDetail): string {
    this.i18n();
    const key = `webhooks.events.${detail.sourceEventType}`;
    const translated = this.transloco.translate(key);
    return translated !== key ? translated : detail.sourceEventType;
  }

  protected endpointUrl(detail: WebhookDeliveryDetail): string {
    return endpointText(detail.endpoint);
  }

  protected formatSizeKb(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0.0 KB';
    const kb = bytes / 1024;
    return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB`;
  }

  protected formatDateTime(iso: string | null | undefined): string {
    if (!iso) return this.transloco.translate('webhooks.common.none');
    const lang = this.language();
    const datePart = formatDate(iso, lang);
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return datePart;
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${datePart} ${hh}:${mm}`;
  }

  protected attemptRetryClassLabel(attempt: WebhookDeliveryAttempt): string | null {
    this.i18n();
    if (!attempt.retryClass) return null;
    const key = `webhooks.retryClass.${attempt.retryClass}`;
    const translated = this.transloco.translate(key);
    return translated !== key ? translated : attempt.retryClass;
  }

  protected async copySourceEventId(): Promise<void> {
    const current = this.detail();
    const sourceId = current?.sourceEventId ?? '';
    if (!sourceId) return;
    try {
      await navigator.clipboard.writeText(sourceId);
      this.copiedSourceId.set(true);
      this.notify.success(this.transloco.translate('webhooks.toast.copied'));
      if (this.copyTimer !== null) clearTimeout(this.copyTimer);
      this.copyTimer = setTimeout(() => {
        if (!this.destroyed) this.copiedSourceId.set(false);
      }, 2000);
    } catch {
      this.notify.error(this.transloco.translate('webhooks.errors.generic'));
    }
  }

  protected async openRetryModal(): Promise<void> {
    if (!this.canShowRetry() || this.retrying()) return;
    this.reasonValue.set({ reasonCodeId: null, note: '' });
    this.retrySubmitted.set(false);
    this.retryModal().open();
    await this.loadRetryReasons();
  }

  protected closeRetryModal(): void {
    if (this.retrying()) return;
    this.retryModal().close();
  }

  protected async submitRetry(): Promise<void> {
    if (this.retrying()) return;
    this.retrySubmitted.set(true);

    const picker = this.reasonPicker();
    if (picker && !picker.valid()) return;
    const current = this.detail();
    const pickedId = this.reasonValue().reasonCodeId;
    if (!current || !pickedId) return;

    // The backend accepts only a reason code here (never the id).
    const reasonCode = this.retryReasons().find((r) => r.id === pickedId)?.code;
    if (!reasonCode) return;
    const reasonNote = this.reasonValue().note.trim();

    this.retrying.set(true);
    const action = `retry:${current.id}`;
    try {
      const input = { reasonCode, ...(reasonNote ? { reasonNote } : {}) };
      const accepted = await retryDelivery(
        current.id,
        input,
        current.version,
        this.keys.for(action, { input, ifMatch: current.version }),
        this.ctx(),
      );
      this.keys.done(action);
      if (this.destroyed) return;
      this.retryModal().close();
      this.notify.success(
        this.transloco.translate('webhooks.toast.retryScheduled', {
          time: this.formatDateTime(accepted.nextAttemptAt),
        }),
      );
      this.retried.emit(accepted);
      void this.loadDelivery(current.id);
    } catch (error) {
      if (this.destroyed) return;
      const code = errorCodeOf(error);
      if (isIdempotencyMismatch(code)) {
        this.keys.done(action);
      }
      if (isForbiddenError(error)) {
        this.onForbidden();
        return;
      }
      if (
        error instanceof ApiError &&
        error.status === 409 &&
        code === 'TRADE.CONCURRENCY.STALE_VERSION'
      ) {
        this.retryModal().close();
        this.conflictDialog().open();
        return;
      }
      this.notify.error(this.translateError(error));
      if (code === 'TRADE.WEBHOOK.DELIVERY_NOT_RETRYABLE') {
        this.retryModal().close();
        void this.loadDelivery(current.id);
      }
    } finally {
      this.retrying.set(false);
    }
  }

  protected retryLoad(): void {
    void this.loadDelivery(this.deliveryId());
  }

  protected closeModal(): void {
    if (this.retrying()) return;
    this.modal().close();
  }

  protected onModalClosed(): void {
    this.stopPolling();
    this.loadSeq++;
    this.closed.emit();
  }

  protected onConflictReload(): void {
    void this.loadDelivery(this.deliveryId());
  }

  private onForbidden(): void {
    this.stopPolling();
    this.retryModal().close();
    this.forbidden.emit();
    this.modal().close();
  }

  private async loadDelivery(id: string): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    this.notFound.set(false);

    try {
      const loaded = await getDelivery(id, this.ctx());
      if (seq !== this.loadSeq || this.destroyed) return;
      this.detail.set(loaded);
      this.loading.set(false);
      void this.ensureSubscriptionStatus(loaded);
    } catch (error) {
      if (seq !== this.loadSeq || this.destroyed) return;
      this.loading.set(false);
      if (isForbiddenError(error)) {
        this.onForbidden();
        return;
      }
      if (error instanceof ApiError && error.status === 404) {
        this.notFound.set(true);
      } else {
        this.loadFailed.set(true);
      }
    }
  }

  private async ensureSubscriptionStatus(loaded: WebhookDeliveryDetail): Promise<void> {
    if (this.subscriptionStatus() !== null) return;

    try {
      const sub = await getSubscription(loaded.subscriptionId, this.ctx());
      if (!this.destroyed && this.detail()?.id === loaded.id) {
        this.resolvedSubStatus.set(sub.status);
      }
    } catch {
      // Keep fallback null when subscription lookup fails.
    }
  }

  private async loadRetryReasons(): Promise<void> {
    try {
      const reasons = await listReasons(RETRY_REASON_KIND, undefined, this.ctx());
      if (!this.destroyed) {
        this.retryReasons.set(reasons);
        this.retryReasonsLoaded.set(true);
      }
    } catch {
      if (!this.destroyed) {
        this.retryReasons.set([]);
        this.retryReasonsLoaded.set(true);
      }
    }
  }

  private startPolling(id: string): void {
    this.stopPolling();
    const seq = ++this.pollSeq;
    this.activePollId = id;
    const ctx = this.ctx();

    this.stopPollHandle = pollWhile(
      async () => {
        const fresh = await getDelivery(id, ctx);
        if (!this.destroyed && seq === this.pollSeq) {
          this.detail.set(fresh);
        }
        return fresh;
      },
      (fresh) =>
        !this.destroyed &&
        seq === this.pollSeq &&
        fresh.id === id &&
        (fresh.status === 'PENDING' || fresh.status === 'RETRY_PENDING'),
      POLL_MS,
      this.destroyRef,
      undefined,
      (error) => {
        if (!this.destroyed && isForbiddenError(error)) {
          this.onForbidden();
        }
      },
    );
  }

  private stopPolling(): void {
    this.pollSeq++;
    this.activePollId = '';
    const handle = this.stopPollHandle;
    this.stopPollHandle = null;
    handle?.stop();
  }

  private translateError(error: unknown): string {
    if (error instanceof ApiError) {
      const reason = error.details?.['reason']?.[0];
      if (reason) {
        const reasonKey = `webhooks.errors.${error.code}.${reason}`;
        const reasonText = this.transloco.translate(reasonKey);
        if (reasonText !== reasonKey) return reasonText;
      }
      const codeKey = `webhooks.errors.${error.code}`;
      const codeText = this.transloco.translate(codeKey);
      if (codeText !== codeKey) return codeText;

      const shortCode = error.code.split('.').at(-1) ?? error.code;
      const shortKey = `webhooks.errors.${shortCode}`;
      const shortText = this.transloco.translate(shortKey);
      if (shortText !== shortKey) return shortText;

      const autoKey = `automation.errors.${error.code}`;
      const autoText = this.transloco.translate(autoKey);
      if (autoText !== autoKey) return autoText;
    }
    return this.transloco.translate('webhooks.errors.generic');
  }
}

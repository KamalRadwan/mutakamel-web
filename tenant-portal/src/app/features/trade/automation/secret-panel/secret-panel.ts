import {
  Component,
  DestroyRef,
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
  tablerCircleOff,
  tablerEye,
  tablerKey,
  tablerLoader2,
  tablerRefresh,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Field } from '../../../../shared/ui/field/field';
import { Modal } from '../../../../shared/ui/modal/modal';
import { ApiError, errorCodeOf } from '../../shared/trade-api';
import { formatDate } from '../../shared/trade-format';
import { AutomationBadge } from '../automation-shared/automation-badge/automation-badge';
import { pollWhile } from '../automation-shared/poll';
import { RevealSecretModal } from '../reveal-secret-modal/reveal-secret-modal';
import { ActionKeys } from '../automation-shared/action-keys';
import { getSubscription, revokeSecret, rotateSecret } from '../webhooks.api';
import type { SecretStatus, WebhookSubscriptionDetail } from '../webhooks.model';

const POLL_MS = 3000;
const DEFAULT_OVERLAP_HOURS = 30;
const MIN_OVERLAP_HOURS = 30;
const MAX_OVERLAP_HOURS = 168;

@Component({
  selector: 'app-secret-panel',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    ConfirmDialog,
    Field,
    Modal,
    AutomationBadge,
    RevealSecretModal,
  ],
  providers: [
    provideIcons({
      tablerKey,
      tablerEye,
      tablerRefresh,
      tablerCircleOff,
      tablerLoader2,
    }),
  ],
  templateUrl: './secret-panel.html',
  host: { class: 'flex flex-col gap-8 rounded-10 border border-border bg-surface-muted p-10' },
})
export class SecretPanel {
  private static nextId = 0;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly notify = inject(Notify);
  private readonly destroyRef = inject(DestroyRef);

  private readonly rotateModal = viewChild.required<Modal>('rotateModal');
  private readonly revokeDialog = viewChild.required<ConfirmDialog>('revokeDialog');

  protected readonly uid = `webhook-secret-panel-${++SecretPanel.nextId}`;

  readonly subscription = input.required<WebhookSubscriptionDetail>();
  readonly canManage = input(true);

  readonly updated = output<WebhookSubscriptionDetail>();
  readonly conflict = output<void>();

  protected readonly showRevealModal = signal(false);
  protected readonly overlapHoursInput = signal(String(DEFAULT_OVERLAP_HOURS));
  protected readonly rotateSubmitted = signal(false);
  protected readonly rotating = signal(false);
  protected readonly revoking = signal(false);

  private destroyed = false;
  private readonly keys = new ActionKeys();
  private pollSeq = 0;
  private activePollKey = '';
  private stopPollHandle: unknown = null;

  protected readonly secret = computed(() => this.subscription().secret ?? null);
  protected readonly secretOperation = computed(() => this.subscription().secretOperation ?? null);
  protected readonly isPending = computed(() => this.secretOperation()?.status === 'PENDING');

  /** No current secret while a CREATE (or the first secret after a revoke) is with the worker. */
  protected readonly secretStatus = computed<SecretStatus | null>(
    () => this.secret()?.status ?? (this.isPending() ? 'PENDING' : null),
  );

  protected readonly revealMeta = computed(() => {
    const reveal = this.subscription().secretReveal;
    const until = reveal.availableUntil;
    const open = reveal.available && (!until || Date.parse(until) > Date.now());
    return { available: open, until: open ? until : null };
  });
  protected readonly canReveal = computed(
    () => !this.isPending() && this.revealMeta().available && this.secret()?.status === 'ACTIVE',
  );
  // rotate-secret needs an ACTIVE subscription with a current secret; revoke-secret an ACTIVE current secret.
  protected readonly canRotate = computed(
    () =>
      this.canManage() &&
      !this.isPending() &&
      this.subscription().status === 'ACTIVE' &&
      this.secret() !== null,
  );
  protected readonly canRevoke = computed(
    () => this.canManage() && !this.isPending() && this.secret()?.status === 'ACTIVE',
  );

  protected readonly safeErrorText = computed(() => {
    this.i18n();
    const op = this.secretOperation();
    if (!op || op.status !== 'FAILED') return null;
    const code = op.safeErrorCode;
    if (code) {
      const webhookKey = `webhooks.errors.${code}`;
      const webhookMsg = this.transloco.translate(webhookKey);
      if (webhookMsg !== webhookKey) return webhookMsg;

      const autoKey = `automation.errors.${code}`;
      const autoMsg = this.transloco.translate(autoKey);
      if (autoMsg !== autoKey) return autoMsg;

      return code;
    }
    return this.transloco.translate('webhooks.secret.failedFallback');
  });

  protected readonly overlapError = computed<string | null>(() => {
    this.i18n();
    if (!this.rotateSubmitted()) return null;
    const raw = this.overlapHoursInput().trim();
    if (!raw) return this.transloco.translate('webhooks.subscription.validation.required');
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < MIN_OVERLAP_HOURS || parsed > MAX_OVERLAP_HOURS) {
      return this.transloco.translate('webhooks.secret.rotateModal.overlapRange');
    }
    return null;
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.stopPolling();
    });

    effect(() => {
      const sub = this.subscription();
      const pending = this.isPending();
      const opId = sub.secretOperation?.id ?? 'pending';
      const nextKey = pending ? `${sub.id}::${opId}` : '';

      if (!pending) {
        if (this.activePollKey) {
          untracked(() => this.stopPolling());
        }
        return;
      }

      if (nextKey === this.activePollKey) return;
      untracked(() => this.startPolling(sub.id, nextKey));
    });
  }

  openRotateModal(): void {
    if (!this.canRotate() || this.rotating() || this.revoking()) return;
    this.overlapHoursInput.set(String(DEFAULT_OVERLAP_HOURS));
    this.rotateSubmitted.set(false);
    this.rotateModal().open();
  }

  protected openReveal(): void {
    if (!this.canReveal()) return;
    this.showRevealModal.set(true);
  }

  protected onRevealClosed(didConsume: boolean): void {
    this.showRevealModal.set(false);
    if (didConsume) {
      void this.refreshSubscription();
    }
  }

  protected onOverlapInput(event: Event): void {
    this.overlapHoursInput.set((event.target as HTMLInputElement).value);
  }

  protected closeRotateModal(): void {
    if (this.rotating()) return;
    this.rotateModal().close();
  }

  protected async submitRotate(): Promise<void> {
    if (this.rotating() || !this.canRotate()) return;
    this.rotateSubmitted.set(true);
    if (this.overlapError()) return;

    const sub = this.subscription();
    const hours = Number(this.overlapHoursInput().trim());
    this.rotating.set(true);

    try {
      const action = `rotate:${sub.id}`;
      await rotateSecret(sub.id, hours, sub.version, this.keys.for(action, { hours, ifMatch: sub.version }));
      this.keys.done(action);
      if (this.destroyed) return;
      this.rotateModal().close();
      await this.refreshSubscription();
      this.notify.success(this.transloco.translate('webhooks.toast.secretRotated'));
    } catch (error) {
      if (this.destroyed) return;
      const code = errorCodeOf(error);
      if (error instanceof ApiError && error.status === 409 && code === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.rotateModal().close();
        this.conflict.emit();
        return;
      }
      this.notify.error(this.translateError(error));
    } finally {
      this.rotating.set(false);
    }
  }

  protected async requestRevoke(): Promise<void> {
    if (!this.canRevoke() || this.revoking() || this.rotating()) return;
    const confirmed = await this.revokeDialog().open();
    if (!confirmed || this.destroyed) return;

    const sub = this.subscription();
    this.revoking.set(true);
    try {
      const action = `revoke:${sub.id}`;
      await revokeSecret(sub.id, sub.version, this.keys.for(action, { ifMatch: sub.version }));
      this.keys.done(action);
      if (this.destroyed) return;
      await this.refreshSubscription();
      this.notify.success(this.transloco.translate('webhooks.toast.secretRevoked'));
    } catch (error) {
      if (this.destroyed) return;
      const code = errorCodeOf(error);
      if (error instanceof ApiError && error.status === 409 && code === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.conflict.emit();
        return;
      }
      this.notify.error(this.translateError(error));
    } finally {
      this.revoking.set(false);
    }
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

  protected formatTime(iso: string | null | undefined): string {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  private startPolling(subscriptionId: string, key: string): void {
    this.stopPolling();
    const seq = ++this.pollSeq;
    this.activePollKey = key;

    this.stopPollHandle = pollWhile(
      async () => {
        const fresh = await getSubscription(subscriptionId);
        if (!this.destroyed && seq === this.pollSeq) {
          this.updated.emit(fresh);
        }
        return fresh;
      },
      (fresh) =>
        !this.destroyed &&
        seq === this.pollSeq &&
        fresh.id === subscriptionId &&
        fresh.secretOperation?.status === 'PENDING',
      POLL_MS,
      this.destroyRef,
    );
  }

  private stopPolling(): void {
    this.pollSeq++;
    this.activePollKey = '';
    const handle = this.stopPollHandle;
    this.stopPollHandle = null;
    if (typeof handle === 'function') {
      (handle as () => void)();
    }
  }

  private async refreshSubscription(): Promise<void> {
    const id = this.subscription().id;
    try {
      const fresh = await getSubscription(id);
      if (!this.destroyed) {
        this.updated.emit(fresh);
      }
    } catch {
      // Keep existing state if background refresh fails.
    }
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

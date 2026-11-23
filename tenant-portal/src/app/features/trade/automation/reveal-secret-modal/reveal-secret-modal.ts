import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerCheck,
  tablerCopy,
  tablerKey,
  tablerLoader2,
  tablerX,
} from '@ng-icons/tabler-icons';
import { Notify } from '../../../../core/notify/notify';
import { Button } from '../../../../shared/ui/button/button';
import { Checkbox } from '../../../../shared/ui/checkbox/checkbox';
import { Field } from '../../../../shared/ui/field/field';
import { ApiError, type TradeContext } from '../../shared/trade-api';
import { isForbiddenError } from '../webhooks-page/webhook-access';
import { revealSecret } from '../webhooks.api';

/** Reveal reasons after which the secret can never be shown again (rotate for a new one). */
const GONE_REASONS = ['already_revealed', 'reveal_expired'];

@Component({
  selector: 'app-reveal-secret-modal',
  imports: [NgIcon, TranslocoPipe, Button, Checkbox, Field],
  providers: [
    provideIcons({
      tablerKey,
      tablerCopy,
      tablerCheck,
      tablerX,
      tablerLoader2,
      tablerAlertTriangle,
    }),
  ],
  templateUrl: './reveal-secret-modal.html',
})
export class RevealSecretModal {
  private static nextId = 0;

  private readonly transloco = inject(TranslocoService);
  private readonly notify = inject(Notify);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly uid = `reveal-secret-modal-${++RevealSecretModal.nextId}`;
  protected readonly titleId = `${this.uid}-title`;

  readonly subscriptionId = input.required<string>();
  readonly secretReferenceId = input.required<string>();
  readonly ctx = input<TradeContext>({});

  readonly closed = output<boolean>();
  readonly forbidden = output<void>();

  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly secretValue = signal('');
  protected readonly stored = signal(false);
  protected readonly copied = signal(false);

  private readonly revealCalled = signal(false);
  private consumed = false;
  private destroyed = false;
  private copyTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly canClose = computed(() => !this.loading() && (this.stored() || this.failed()));

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.secretValue.set('');
      if (this.copyTimer !== null) {
        clearTimeout(this.copyTimer);
        this.copyTimer = null;
      }
    });

    afterNextRender(() => {
      const el = this.dialog().nativeElement;
      if (!el.open) {
        el.showModal();
      }
      void this.loadOnce();
    });
  }

  protected async copySecret(): Promise<void> {
    const secret = this.secretValue();
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      this.copied.set(true);
      this.notify.success(this.transloco.translate('webhooks.toast.copied'));
      if (this.copyTimer !== null) clearTimeout(this.copyTimer);
      this.copyTimer = setTimeout(() => {
        if (!this.destroyed) this.copied.set(false);
      }, 2000);
    } catch {
      this.notify.error(this.transloco.translate('webhooks.errors.generic'));
    }
  }

  protected attemptClose(): void {
    if (!this.canClose()) return;
    this.forceClose(this.consumed);
  }

  protected onCancel(event: Event): void {
    event.preventDefault();
  }

  protected onEscape(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.canClose()) {
      this.forceClose(this.consumed);
    }
  }

  protected onNativeClose(): void {
    if (!this.canClose() && !this.destroyed) {
      const el = this.dialog().nativeElement;
      if (!el.open) {
        el.showModal();
      }
      return;
    }
    if (!this.destroyed) {
      this.closed.emit(this.consumed);
    }
  }

  private async loadOnce(): Promise<void> {
    if (this.revealCalled()) return;
    this.revealCalled.set(true);
    this.loading.set(true);
    this.failed.set(false);

    try {
      const result = await revealSecret(this.subscriptionId(), this.secretReferenceId(), this.ctx());
      if (this.destroyed) return;
      this.secretValue.set(result.secret);
      this.consumed = true;
      this.loading.set(false);
    } catch (error) {
      if (this.destroyed) return;
      if (isForbiddenError(error)) {
        this.forbidden.emit();
        this.forceClose(false);
        return;
      }
      if (error instanceof ApiError && error.code === 'TRADE.WEBHOOK.SECRET_VERSION_INVALID') {
        const reason = error.details?.['reason']?.[0] ?? '';
        const key = GONE_REASONS.includes(reason)
          ? 'webhooks.reveal.alreadyShown'
          : `webhooks.errors.TRADE.WEBHOOK.SECRET_VERSION_INVALID.${reason}`;
        const translated = this.transloco.translate(key);
        this.notify.error(
          translated !== key
            ? translated
            : this.transloco.translate('webhooks.errors.TRADE.WEBHOOK.SECRET_VERSION_INVALID'),
        );
        this.forceClose(true);
        return;
      }
      this.loading.set(false);
      this.failed.set(true);
      this.notify.error(this.transloco.translate('webhooks.reveal.loadError'));
    }
  }

  private forceClose(didConsume: boolean): void {
    this.secretValue.set('');
    this.consumed = didConsume;
    const el = this.dialog().nativeElement;
    if (el.open) {
      el.close();
    } else {
      this.closed.emit(didConsume);
    }
  }
}

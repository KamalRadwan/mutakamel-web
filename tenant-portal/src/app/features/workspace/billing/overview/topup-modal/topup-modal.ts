import { Component, DestroyRef, computed, inject, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerLoader2, tablerUpload } from '@ng-icons/tabler-icons';
import { ApiError, fieldErrorsOf } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { BillingApi, billingErrorMessage } from '../../billing.api';
import type { PaymentInputCurrencies, PaymentStatus, TopupBody } from '../../billing.model';
import { BillingFailed } from '../../shared/billing-failed/billing-failed';
import { PAYMENT_POLL } from '../../shared/billing-poll';
import { catalogueNames } from '../../shared/catalogue-names';
import { formatUsd } from '../../shared/money';

const TOPUP_AMOUNT_PATTERN = /^(?:[1-9]\d{0,8}(?:\.\d{1,4})?|1000000000(?:\.0{1,4})?)$/;

@Component({
  selector: 'app-topup-modal',
  imports: [NgIcon, TranslocoPipe, Button, Dropdown, Field, Modal, BillingFailed],
  providers: [provideIcons({ tablerUpload, tablerLoader2 })],
  templateUrl: './topup-modal.html',
})
export class TopupModal {
  private static nextId = 0;
  protected readonly uid = `billing-topup-${++TopupModal.nextId}`;
  private readonly api = inject(BillingApi);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly modal = viewChild.required<Modal>('modal');
  readonly completed = output<void>();
  readonly closed = output<void>();

  protected readonly phase = signal<'form' | 'waiting'>('form');
  protected readonly amount = signal('');
  protected readonly currencyCode = signal('USD');
  protected readonly currencies = signal<string[]>([]);
  protected readonly currenciesLoading = signal(false);
  protected readonly currenciesFailed = signal(false);
  protected readonly amountTouched = signal(false);
  protected readonly submitAttempted = signal(false);
  protected readonly submitting = signal(false);
  protected readonly inFlight = signal(false);
  protected readonly checkoutUrl = signal<string | null>(null);
  protected readonly popupBlocked = signal(false);
  private readonly serverAmountError = signal<unknown>(null);
  private readonly serverCurrencyError = signal<unknown>(null);
  protected readonly limits = signal<PaymentInputCurrencies['topUpLimitsUsd']>(undefined);
  protected readonly checking = signal(false);
  protected readonly polling = signal(false);
  protected readonly paymentStatus = signal<PaymentStatus | null>(null);

  protected readonly currencyOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const names = catalogueNames(this.transloco);
    return this.currencies().map((code) => ({ value: code, label: names.currencyLabel(code) }));
  });
  protected readonly limitsHint = computed<string | null>(() => {
    this.i18n();
    const limits = this.limits();
    return limits ? this.transloco.translate('bov.topup.limitsHint', {
      min: `\u2066${formatUsd(limits.min)}\u2069`, max: `\u2066${formatUsd(limits.max)}\u2069`,
    }) : null;
  });
  protected readonly amountError = computed<string | null>(() => {
    this.i18n();
    const server = this.serverAmountError();
    if (server) return billingErrorMessage(server, this.transloco, 'write');
    if (!this.submitAttempted() && !this.amountTouched()) return null;
    const trimmed = this.amount().trim();
    if (!trimmed) return this.transloco.translate('bov.topup.amountRequired');
    return TOPUP_AMOUNT_PATTERN.test(trimmed) ? null : this.transloco.translate('bov.topup.amountInvalid');
  });
  protected readonly currencyError = computed<string | null>(() => {
    this.i18n();
    const error = this.serverCurrencyError();
    return error ? billingErrorMessage(error, this.transloco, 'write') : null;
  });
  protected readonly waitingKey = computed(() => {
    switch (this.paymentStatus()) {
      case 'FAILED': return 'bov.topup.failed';
      case 'EXPIRED': return 'bov.topup.expired';
      case 'REQUIRES_REVIEW': return 'bov.topup.review';
      default: return this.polling() ? 'bov.topup.waiting' : 'bill.poll.stillProcessing';
    }
  });
  protected readonly canCheck = computed(() => !this.polling() &&
    !['SUCCEEDED', 'FAILED', 'EXPIRED', 'REQUIRES_REVIEW'].includes(this.paymentStatus() ?? ''));

  private attempt: { key: string; bodyJson: string } | null = null;
  private paymentId: string | null = null;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private session = 0;
  private destroyed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.stopPolling();
    });
  }

  open(): void {
    this.stopPolling();
    this.phase.set('form');
    this.submitting.set(false);
    this.inFlight.set(false);
    this.popupBlocked.set(false);
    this.checkoutUrl.set(null);
    this.paymentId = null;
    this.paymentStatus.set(null);
    this.amountTouched.set(false);
    this.submitAttempted.set(false);
    this.amount.set('');
    this.currencyCode.set('USD');
    this.clearFieldErrors();
    this.attempt = null;
    this.modal().open();
    void this.loadCurrencies();
  }

  protected onAmountInput(event: Event): void {
    const next = (event.target as HTMLInputElement).value;
    if (next !== this.amount()) {
      this.attempt = null;
      this.inFlight.set(false);
    }
    this.amount.set(next);
    this.clearFieldErrors();
  }

  protected onCurrencyChange(next: string): void {
    if (next !== this.currencyCode()) {
      this.attempt = null;
      this.inFlight.set(false);
    }
    this.currencyCode.set(next);
    this.clearFieldErrors();
  }

  protected async submit(event?: Event): Promise<void> {
    event?.preventDefault();
    if (this.submitting() || this.inFlight() || this.phase() !== 'form' ||
        this.currenciesLoading() || this.currenciesFailed() || !this.currencies().includes(this.currencyCode())) return;
    this.clearFieldErrors();
    this.submitAttempted.set(true);
    if (this.amountError()) return;
    const body: TopupBody = { amount: this.amount().trim(), currencyCode: this.currencyCode() };
    const bodyJson = JSON.stringify(body);
    if (this.attempt?.bodyJson !== bodyJson) this.attempt = { key: newIdempotencyKey(), bodyJson };
    const key = this.attempt!.key;
    const session = this.session;
    this.submitting.set(true);
    try {
      const result = await this.api.topUpWallet(body, key);
      if (this.destroyed || session !== this.session) return;
      this.attempt = null;
      this.notify.connectionRestored();
      this.paymentId = result.paymentId;
      this.checkoutUrl.set(result.checkoutUrl);
      // Passing noopener makes window.open return null even when the tab opens.
      let opened: Window | null = null;
      try { opened = window.open(result.checkoutUrl, '_blank'); } catch { /* A blocked popup keeps the fallback link. */ }
      if (opened && !opened.closed) {
        try { opened.opener = null; } catch { /* Cross-origin opener restrictions. */ }
      } else {
        this.popupBlocked.set(true);
        this.notify.warning(this.transloco.translate('bov.topup.popupBlockedTitle'),
          this.transloco.translate('bov.topup.popupBlockedText'));
      }
      this.phase.set('waiting');
      this.submitting.set(false);
      this.startPolling();
    } catch (error) {
      if (this.destroyed || session !== this.session) return;
      const code = error instanceof ApiError ? error.code : null;
      const displayError = code === 'IDEMPOTENCY_KEY_REUSED' ? new ApiError(409, 'GW.IDEM.MISMATCH')
        : code === 'WALLET_FROZEN' ? new ApiError(409, 'WALLET_NOT_ACTIVE') : error;
      const message = billingErrorMessage(displayError, this.transloco, 'write');
      const fields = fieldErrorsOf(error);
      if (code === 'TOPUP_AMOUNT_OUT_OF_RANGE' || code === 'FX_AMOUNT_ROUNDS_TO_ZERO' || 'amount' in fields) {
        this.serverAmountError.set(error);
      } else if (code === 'FX_RATE_NOT_FOUND' || code === 'PAYMENT_PROVIDER_CURRENCY_UNSUPPORTED' || 'currencyCode' in fields) {
        this.serverCurrencyError.set(error);
        if (code === 'FX_RATE_NOT_FOUND') {
          await this.loadCurrencies();
          this.serverCurrencyError.set(error);
        }
      } else if (code === 'GW.IDEM.IN_FLIGHT') {
        this.inFlight.set(true);
        this.notify.info(message);
      } else if (error instanceof ApiError && error.status === 0) {
        this.notify.connectionLost(message, '');
      } else {
        if (code === 'PAYMENT_INTENT_UNAVAILABLE') this.attempt = null;
        this.notify.error(message);
      }
    } finally {
      if (!this.destroyed && session === this.session) this.submitting.set(false);
    }
  }

  protected async loadCurrencies(): Promise<void> {
    if (this.currenciesLoading()) return;
    this.currenciesLoading.set(true);
    this.currenciesFailed.set(false);
    try {
      const res = await this.api.listPaymentCurrencies();
      if (this.destroyed) return;
      const codes = res.items.map((item) => item.currencyCode);
      this.currencies.set(codes);
      this.limits.set(res.topUpLimitsUsd);
      if (!codes.includes(this.currencyCode())) this.onCurrencyChange(codes.includes('USD') ? 'USD' : codes[0] ?? '');
      this.notify.connectionRestored();
    } catch (error) {
      if (this.destroyed) return;
      this.currenciesFailed.set(true);
      if (error instanceof ApiError && error.status === 0) {
        this.notify.connectionLost(billingErrorMessage(error, this.transloco, 'read'), '');
      }
    } finally {
      if (!this.destroyed) this.currenciesLoading.set(false);
    }
  }

  protected close(): void {
    if (this.submitting()) return;
    this.stopPolling();
    this.modal().close();
  }

  protected onModalClosed(): void {
    if (this.submitting()) { this.modal().open(); return; }
    this.stopPolling();
    this.closed.emit();
  }

  protected async checkNow(): Promise<void> {
    if (!this.canCheck() || this.checking()) return;
    await this.readPayment(this.session);
  }

  private startPolling(): void {
    this.stopPolling();
    const session = this.session;
    this.polling.set(true);
    const schedule = (attempt: number): void => {
      this.pollTimer = setTimeout(async () => {
        const keepPolling = await this.readPayment(session);
        if (session !== this.session || !keepPolling) return;
        if (attempt < PAYMENT_POLL.attempts) schedule(attempt + 1);
        else {
          this.polling.set(false);
          this.notify.info(this.transloco.translate('bill.poll.stillProcessing'));
        }
      }, PAYMENT_POLL.intervalMs);
    };
    schedule(1);
  }

  private async readPayment(session: number): Promise<boolean> {
    if (!this.paymentId || session !== this.session) return false;
    this.checking.set(true);
    try {
      const payment = await this.api.getPayment(this.paymentId);
      if (session !== this.session) return false;
      this.notify.connectionRestored();
      this.paymentStatus.set(payment.status);
      if (payment.status === 'SUCCEEDED') {
        this.stopPolling();
        this.notify.success(this.transloco.translate('bov.topup.succeeded'));
        this.completed.emit();
        this.modal().close();
        return false;
      }
      if (['FAILED', 'EXPIRED', 'REQUIRES_REVIEW'].includes(payment.status)) {
        this.stopPolling();
        const message = this.transloco.translate(this.waitingKey());
        if (payment.status === 'REQUIRES_REVIEW') this.notify.info(message);
        else this.notify.error(message);
        return false;
      }
      return true;
    } catch (error) {
      if (session !== this.session) return false;
      if (error instanceof ApiError && (error.status === 404 || error.code === 'TENANT_OWNER_REQUIRED')) {
        this.stopPolling();
        if (error.status !== 404) this.notify.error(billingErrorMessage(error, this.transloco, 'read'));
        return false;
      }
      if (error instanceof ApiError && error.status === 0) {
        this.notify.connectionLost(billingErrorMessage(error, this.transloco, 'read'), '');
      } else if (!this.polling()) {
        this.notify.error(billingErrorMessage(error, this.transloco, 'read'));
      }
      return true;
    } finally {
      if (!this.destroyed) this.checking.set(false);
    }
  }

  private stopPolling(): void {
    this.session++;
    this.polling.set(false);
    this.checking.set(false);
    if (this.pollTimer !== null) clearTimeout(this.pollTimer);
    this.pollTimer = null;
  }

  private clearFieldErrors(): void {
    this.serverAmountError.set(null);
    this.serverCurrencyError.set(null);
  }
}

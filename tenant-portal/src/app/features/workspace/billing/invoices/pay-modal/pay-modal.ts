import { Component, DestroyRef, computed, inject, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerCreditCard,
  tablerLoader2,
  tablerRefresh,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import {
  ActiveInvoicePaymentIntent,
  InvoicePaymentQuote,
  PaymentInputCurrencies,
  billingErrorMessage,
  BillingApi,
  ApiError,
  newIdempotencyKey,
} from '../../billing.api';
import { catalogueNames } from '../../shared/catalogue-names';
import { formatAmount, formatRate, formatUsd, isZero } from '../../shared/money';
import {
  apiErrorCodeOf,
  formatClockTime,
  formatCountdown,
} from '../invoice-dates';
import { PaymentPoller, PollEvent } from '../payment-poller';

type PayStep = 'loading' | 'attempt' | 'quote' | 'error';

let nextPayModalId = 0;

@Component({
  selector: 'app-pay-modal',
  imports: [NgIcon, TranslocoPipe, Button, Dropdown, Field, Modal],
  providers: [
    PaymentPoller,
    provideTranslocoScope('settings', { scope: 'ws-billing', alias: 'bill' }, { scope: 'ws-billing-invoices', alias: 'binv' }),
    provideIcons({ tablerCreditCard, tablerLoader2, tablerAlertTriangle, tablerRefresh }),
  ],
  templateUrl: './pay-modal.html',
})
export class PayModal {
  private readonly api = inject(BillingApi);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly notify = inject(Notify);
  private readonly language = inject(LanguageState).current;
  protected readonly poller = inject(PaymentPoller);

  private readonly modal = viewChild.required(Modal);

  readonly refresh = output<void>();
  readonly paid = output<void>();
  readonly closed = output<void>();

  protected readonly uid = `pay-modal-${++nextPayModalId}`;
  protected readonly step = signal<PayStep>('loading');
  protected readonly invoiceId = signal('');
  protected readonly invoiceNumber = signal('');
  protected readonly attempt = signal<ActiveInvoicePaymentIntent | null>(null);
  protected readonly popupBlocked = signal(false);
  protected readonly pollTimedOut = signal(false);

  protected readonly currencies = signal<PaymentInputCurrencies | null>(null);
  protected readonly selectedCurrency = signal('USD');
  protected readonly quote = signal<InvoicePaymentQuote | null>(null);
  protected readonly remainingMs = signal(0);
  protected readonly quoting = signal(false);
  protected readonly paying = signal(false);
  protected readonly currencyError = signal<string | null>(null);
  protected readonly intentInFlight = signal(false);
  protected readonly offlinePayment = signal(false);
  protected readonly checking = signal(false);

  protected readonly formatAmount = formatAmount;
  protected readonly formatRate = formatRate;
  protected readonly formatUsd = formatUsd;

  private intentRequest: { quoteId: string; key: string; bodyJson: string } | null = null;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private sessionSeq = 0;

  protected readonly currencyOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const names = catalogueNames(this.transloco);
    const items = this.currencies()?.items;
    if (!items?.length) {
      return [{ value: 'USD', label: names.currencyLabel('USD') }];
    }
    return items.map((item) => ({
      value: item.currencyCode,
      label: names.currencyLabel(item.currencyCode),
    }));
  });

  protected readonly quoteExpired = computed(
    () => this.quote() !== null && this.remainingMs() <= 0,
  );

  protected readonly isWalletOnly = computed(() => {
    const q = this.quote();
    return q !== null && isZero(q.gatewayAmountUsd);
  });

  protected readonly isForeignCurrency = computed(() => {
    const q = this.quote();
    return q !== null && q.providerCurrencyCode !== 'USD';
  });

  protected readonly countdownText = computed(() => formatCountdown(this.remainingMs()));

  protected readonly attemptExpiryText = computed(() => {
    const expiresAt = this.attempt()?.expiresAt ?? null;
    return expiresAt ? formatClockTime(expiresAt, this.language()) : '';
  });

  protected readonly confirmLabel = computed(() => {
    this.i18n();
    const q = this.quote();
    if (!q) return this.transloco.translate('bill.common.pay');
    if (isZero(q.gatewayAmountUsd)) {
      return this.transloco.translate('binv.pay.payFromWallet');
    }
    return this.transloco.translate('binv.pay.payAmount', {
      amount: formatAmount(q.providerAmount, q.providerCurrencyCode),
    });
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.teardown());
  }

  open(invoiceId: string, invoiceNumber = ''): void {
    this.teardown();
    this.invoiceId.set(invoiceId);
    this.invoiceNumber.set(invoiceNumber);
    this.attempt.set(null);
    this.popupBlocked.set(false);
    this.pollTimedOut.set(false);
    this.clearQuote();
    this.selectedCurrency.set('USD');
    this.step.set('loading');
    this.offlinePayment.set(false);
    this.modal().open();
    void this.initializeSession(this.sessionSeq, invoiceId);
  }

  close(): void {
    this.modal().close();
  }

  protected retryOpen(): void {
    const id = this.invoiceId();
    if (!id) return;
    this.teardown();
    this.step.set('loading');
    void this.initializeSession(this.sessionSeq, id);
  }

  protected onCurrencyChange(currencyCode: string): void {
    if (currencyCode === this.selectedCurrency()) return;
    this.currencyError.set(null);
    this.selectedCurrency.set(currencyCode);
    this.clearQuote();
  }

  protected async requestQuote(): Promise<void> {
    const id = this.invoiceId();
    if (!id || this.quoting() || this.paying()) return;

    const seq = this.sessionSeq;
    this.quoting.set(true);
    this.currencyError.set(null);
    try {
      const quote = await this.api.createPaymentQuote(id, this.selectedCurrency());
      if (seq !== this.sessionSeq) return;
      this.setQuote(quote);
    } catch (error) {
      if (seq !== this.sessionSeq) return;
      const code = apiErrorCodeOf(error);
      if (error instanceof ApiError && error.status === 422 && (code?.startsWith('FX_') || code === 'PAYMENT_PROVIDER_CURRENCY_UNSUPPORTED')) {
        this.currencyError.set(billingErrorMessage(error, this.transloco, 'write'));
      } else {
        this.notify.error(billingErrorMessage(error, this.transloco, 'write'));
        if (['INVOICE_NOT_PAYABLE', 'INVOICE_ALREADY_PAID', 'INVOICE_NOT_CANONICAL_USD'].includes(code ?? '')) {
          this.refresh.emit();
          this.close();
        }
      }
    } finally {
      if (seq === this.sessionSeq) {
        this.quoting.set(false);
      }
    }
  }

  protected async confirmPay(): Promise<void> {
    const id = this.invoiceId();
    const q = this.quote();
    if (!id || !q || this.paying() || this.quoting() || this.quoteExpired() || this.intentInFlight()) return;

    const seq = this.sessionSeq;
    const request = this.intentRequest;
    if (!request || request.quoteId !== q.quoteId) return;
    this.paying.set(true);

    try {
      const intent = await this.api.createPaymentIntent(id, q.quoteId, request.key);
      if (seq !== this.sessionSeq) return;

      if (!intent.requiresExternalPayment && intent.status === 'SUCCEEDED') {
        this.notify.success(this.transloco.translate('binv.toast.paid'));
        this.paid.emit();
        this.close();
        return;
      }

      let blocked = false;
      if (intent.checkoutUrl) {
        blocked = !this.openCheckoutTab(intent.checkoutUrl);
        if (blocked) {
          this.notify.warning(
            this.transloco.translate('binv.toast.popupBlockedTitle'),
            this.transloco.translate('binv.toast.popupBlockedText'),
          );
        }
      }

      const activeIntent: ActiveInvoicePaymentIntent = {
        paymentId: intent.paymentId,
        status: intent.status,
        checkoutUrl: intent.checkoutUrl,
        requiresExternalPayment: intent.requiresExternalPayment,
        expiresAt: intent.expiresAt,
        recoveryAction:
          intent.status === 'REQUIRES_REVIEW'
            ? 'RECONCILIATION_REQUIRED'
            : blocked && intent.checkoutUrl
              ? 'CONTINUE_CHECKOUT'
              : 'CHECK_STATUS',
      };
      this.enterAttempt(activeIntent, blocked);
    } catch (error) {
      if (seq !== this.sessionSeq) return;
      const code = apiErrorCodeOf(error);
      if (
        code === 'PAYMENT_QUOTE_STALE' ||
        code === 'FX_QUOTE_EXPIRED' ||
        code === 'FX_QUOTE_ALREADY_CONSUMED'
      ) {
        this.clearQuote();
        this.notify.warning(this.transloco.translate('binv.pay.quoteExpired'));
        this.paying.set(false);
        await this.requestQuote();
      } else if (code === 'PAYMENT_INTENT_ALREADY_ACTIVE') {
        this.notify.warning(billingErrorMessage(error, this.transloco, 'write'));
        this.refresh.emit();
        this.step.set('loading');
        void this.initializeSession(seq, id);
      } else {
        if (code === 'GW.IDEM.IN_FLIGHT') this.intentInFlight.set(true);
        this.notify.error(billingErrorMessage(error, this.transloco, 'write'));
      }
    } finally {
      if (seq === this.sessionSeq) {
        this.paying.set(false);
      }
    }
  }

  protected openCheckoutUrl(): void {
    const current = this.attempt();
    if (!current?.checkoutUrl || this.offlinePayment()) return;

    const opened = this.openCheckoutTab(current.checkoutUrl);
    if (!opened) {
      this.popupBlocked.set(true);
      this.notify.warning(
        this.transloco.translate('binv.toast.popupBlockedTitle'),
        this.transloco.translate('binv.toast.popupBlockedText'),
      );
      return;
    }

    this.popupBlocked.set(false);
    this.attempt.set({ ...current, recoveryAction: 'CHECK_STATUS' });
    if (!this.poller.polling()) {
      this.startPolling(current.paymentId);
    }
  }

  protected async retryPolling(): Promise<void> {
    const current = this.attempt();
    if (!current || current.recoveryAction === 'RECONCILIATION_REQUIRED' || this.checking()) return;
    const seq = this.sessionSeq;
    this.checking.set(true);
    try {
      const active = await this.api.getActivePaymentIntent(this.invoiceId());
      if (seq !== this.sessionSeq) return;
      if (active) {
        const recovered = this.offlinePayment()
          ? { ...active, checkoutUrl: null, recoveryAction: 'CHECK_STATUS' as const }
          : active;
        this.attempt.set(recovered);
        this.pollTimedOut.set(recovered.recoveryAction === 'CHECK_STATUS');
      } else {
        this.refresh.emit();
        this.close();
      }
    } catch (error) {
      if (seq === this.sessionSeq) this.notify.error(billingErrorMessage(error, this.transloco));
    } finally {
      if (seq === this.sessionSeq) this.checking.set(false);
    }
  }

  protected onModalClosed(): void {
    this.teardown();
    this.closed.emit();
  }

  private async initializeSession(seq: number, invoiceId: string): Promise<void> {
    try {
      const [active] = await Promise.all([
        this.api.getActivePaymentIntent(invoiceId),
        this.ensureCurrencies(),
      ]);
      if (seq !== this.sessionSeq) return;

      if (active) {
        this.enterAttempt(active, false);
        return;
      }

      this.attempt.set(null);
      this.popupBlocked.set(false);
      this.pollTimedOut.set(false);
      this.step.set('quote');
    } catch (error) {
      if (seq !== this.sessionSeq) return;
      this.notify.error(billingErrorMessage(error, this.transloco));
      this.step.set('error');
    }
  }

  private async ensureCurrencies(): Promise<void> {
    if (this.currencies()) return;
    try {
      const list = await this.api.listPaymentCurrencies();
      this.currencies.set(list);
      const base =
        list.items.find((item) => item.isBaseCurrency)?.currencyCode ??
        list.walletCurrencyCode ??
        'USD';
      if (!this.quote()) {
        this.selectedCurrency.set(base);
      }
    } catch {
      // Fallback to default USD when currency list cannot be loaded.
    }
  }

  private enterAttempt(intent: ActiveInvoicePaymentIntent, fromPopupBlocked: boolean): void {
    this.clearQuote();
    this.attempt.set(intent);
    this.popupBlocked.set(fromPopupBlocked);
    this.pollTimedOut.set(false);
    this.step.set('attempt');

    if (intent.recoveryAction === 'RECONCILIATION_REQUIRED') {
      this.poller.stop();
      return;
    }
    this.startPolling(intent.paymentId);
  }

  private startPolling(paymentId: string): void {
    const id = this.invoiceId();
    if (!id) return;
    const seq = this.sessionSeq;
    this.pollTimedOut.set(false);
    this.poller.start(id, paymentId, (event) => {
      if (seq !== this.sessionSeq) return;
      this.handlePollEvent(event);
    });
  }

  private handlePollEvent(event: PollEvent): void {
    switch (event.kind) {
      case 'active':
        this.attempt.set(this.offlinePayment() ? { ...event.intent, checkoutUrl: null, recoveryAction: 'CHECK_STATUS' } : event.intent);
        if (event.intent.recoveryAction === 'RECONCILIATION_REQUIRED') {
          this.poller.stop();
        }
        break;
      case 'resolved':
        this.offlinePayment.set(event.payment.provider === 'OFFLINE');
        if (event.payment.provider === 'OFFLINE') {
          this.attempt.update((active) => active ? { ...active, checkoutUrl: null, recoveryAction: 'CHECK_STATUS' } : null);
        }
        switch (event.payment.status) {
          case 'SUCCEEDED':
            this.notify.success(this.transloco.translate('binv.toast.paid'));
            this.paid.emit();
            this.close();
            break;
          case 'FAILED':
            this.notify.error(this.transloco.translate('binv.toast.failed'));
            this.returnToQuote();
            break;
          case 'EXPIRED':
            this.notify.warning(this.transloco.translate('binv.toast.expired'));
            this.returnToQuote();
            break;
          case 'REQUIRES_REVIEW':
            this.attempt.set({
              paymentId: event.payment.paymentId,
              status: 'REQUIRES_REVIEW',
              checkoutUrl: null,
              requiresExternalPayment: false,
              expiresAt: null,
              recoveryAction: 'RECONCILIATION_REQUIRED',
            });
            break;
          default:
            this.pollTimedOut.set(true);
            break;
        }
        break;
      case 'timeout':
        this.pollTimedOut.set(true);
        this.notify.info(this.transloco.translate('bill.poll.stillProcessing'));
        break;
      case 'error':
        this.pollTimedOut.set(true);
        this.notify.error(billingErrorMessage(event.error, this.transloco));
        break;
    }
  }

  private returnToQuote(): void {
    this.poller.stop();
    this.attempt.set(null);
    this.popupBlocked.set(false);
    this.pollTimedOut.set(false);
    this.clearQuote();
    this.step.set('quote');
    void this.ensureCurrencies();
  }

  private setQuote(quote: InvoicePaymentQuote): void {
    this.stopCountdown();
    this.quote.set(quote);
    if (this.intentRequest?.quoteId !== quote.quoteId) {
      this.intentRequest = { quoteId: quote.quoteId, key: newIdempotencyKey(),
        bodyJson: JSON.stringify({ paymentQuoteId: quote.quoteId }) };
      this.intentInFlight.set(false);
    }

    const updateRemaining = () => {
      const left = Date.parse(quote.expiresAt) - Date.now();
      this.remainingMs.set(Math.max(0, left));
      if (left <= 0) {
        this.stopCountdown();
      }
    };

    updateRemaining();
    if (this.remainingMs() > 0) {
      this.countdownTimer = setInterval(updateRemaining, 1_000);
    }
  }

  private clearQuote(): void {
    this.stopCountdown();
    this.quote.set(null);
    this.remainingMs.set(0);
    this.intentRequest = null;
    this.intentInFlight.set(false);
    this.currencyError.set(null);
  }

  private stopCountdown(): void {
    if (this.countdownTimer !== null) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  private openCheckoutTab(url: string): boolean {
    // No `noopener` feature: it makes window.open always return null, which would hide a blocked popup.
    // The opener link is cut after opening instead.
    const popup = window.open(url, '_blank');
    if (!popup || popup.closed) return false;
    try {
      popup.opener = null;
    } catch {
      // Ignore cross-origin opener restriction.
    }
    return true;
  }

  private teardown(): void {
    this.sessionSeq += 1;
    this.paying.set(false);
    this.quoting.set(false);
    this.checking.set(false);
    this.poller.stop();
    this.stopCountdown();
  }
}

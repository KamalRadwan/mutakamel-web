import { Component, DestroyRef, computed, inject, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerLoader2, tablerUpload } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { catalogueNames } from '../../shared/catalogue-names';
import { isGreater } from '../../shared/money';
import { Modal } from '../../../../../shared/ui/modal/modal';
import {
  ApiError,
  Money,
  TopupBody,
  billingErrorMessage,
  getWallet,
  listPaymentCurrencies,
  newIdempotencyKey,
  topUpWallet,
} from '../../billing.api';

const TOPUP_AMOUNT_PATTERN = /^(?:[1-9]\d{0,8}(?:\.\d{1,4})?|1000000000(?:\.0{1,4})?)$/;
const POLL_INTERVAL_MS = 5000;
const MAX_POLLS = 60;

@Component({
  selector: 'app-topup-modal',
  imports: [NgIcon, TranslocoPipe, Button, Dropdown, Field, Modal],
  providers: [provideIcons({ tablerUpload, tablerLoader2 })],
  templateUrl: './topup-modal.html',
})
export class TopupModal {
  private static nextId = 0;
  protected readonly uid = `billing-topup-${++TopupModal.nextId}`;

  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly modal = viewChild.required<Modal>('modal');

  readonly completed = output<void>();
  readonly closed = output<void>();

  protected readonly phase = signal<'form' | 'waiting'>('form');
  protected readonly amount = signal('');
  protected readonly currencyCode = signal('USD');
  protected readonly currencies = signal<string[]>(['USD']);
  protected readonly currenciesLoading = signal(false);
  protected readonly amountTouched = signal(false);
  protected readonly submitAttempted = signal(false);
  protected readonly submitting = signal(false);
  protected readonly checkoutUrl = signal<string | null>(null);
  protected readonly popupBlocked = signal(false);

  protected readonly currencyOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const names = catalogueNames(this.transloco);
    return this.currencies().map((code) => ({ value: code, label: names.currencyLabel(code) }));
  });

  protected readonly amountError = computed<string | null>(() => {
    this.i18n();
    if (!this.submitAttempted() && !this.amountTouched()) return null;
    const trimmed = this.amount().trim();
    if (!trimmed) {
      return this.transloco.translate('bov.topup.amountRequired');
    }
    if (!TOPUP_AMOUNT_PATTERN.test(trimmed)) {
      return this.transloco.translate('bov.topup.amountInvalid');
    }
    return null;
  });

  private currenciesLoaded = false;
  private baselineBalanceUsd: Money | null = null;
  private lastPayloadSignature = '';
  private lastIdempotencyKey = '';
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private pollSession = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.stopPolling();
    });
  }

  open(opts?: { amount?: string; currentBalanceUsd?: Money | null }): void {
    this.stopPolling();
    this.phase.set('form');
    this.submitting.set(false);
    this.popupBlocked.set(false);
    this.checkoutUrl.set(null);
    this.amountTouched.set(false);
    this.submitAttempted.set(false);
    this.amount.set(opts?.amount?.trim() ?? '');
    this.currencyCode.set('USD');
    this.baselineBalanceUsd = opts?.currentBalanceUsd ?? null;
    this.resetIdempotency();
    this.modal().open();
    void this.loadCurrencies();
  }

  protected onAmountInput(event: Event): void {
    this.amount.set((event.target as HTMLInputElement).value);
    this.resetIdempotency();
  }

  protected onCurrencyChange(next: string): void {
    this.currencyCode.set(next);
    this.resetIdempotency();
  }

  protected async submit(event?: Event): Promise<void> {
    event?.preventDefault();
    if (this.submitting() || this.phase() !== 'form') return;

    this.submitAttempted.set(true);
    if (this.amountError()) return;

    const body: TopupBody = {
      amount: this.amount().trim(),
      currencyCode: this.currencyCode(),
    };
    const key = this.idempotencyKeyFor(body);

    this.submitting.set(true);
    try {
      // Always read a fresh baseline: a stale summary could count another debit as a top-up.
      const currentWallet = await getWallet();
      this.baselineBalanceUsd = currentWallet.balanceUsd;

      const result = await topUpWallet(body, key);
      this.checkoutUrl.set(result.checkoutUrl);

      // 'noopener' in the features string makes window.open always return null, so detect the handle instead.
      const opened = window.open(result.checkoutUrl, '_blank');
      if (opened && !opened.closed) {
        try {
          opened.opener = null;
        } catch {
          // Ignore cross-origin opener restriction.
        }
      } else {
        this.popupBlocked.set(true);
        this.notify.warning(
          this.transloco.translate('bov.topup.popupBlockedTitle'),
          this.transloco.translate('bov.topup.popupBlockedText'),
        );
      }

      this.phase.set('waiting');
      this.startPolling();
    } catch (error) {
      this.notify.error(billingErrorMessage(error, this.transloco));
    } finally {
      this.submitting.set(false);
    }
  }

  protected close(): void {
    if (this.submitting()) return;
    this.stopPolling();
    this.modal().close();
  }

  protected onModalClosed(): void {
    if (this.submitting()) {
      this.modal().open();
      return;
    }
    this.stopPolling();
    this.closed.emit();
  }

  private async loadCurrencies(): Promise<void> {
    if (this.currenciesLoaded || this.currenciesLoading()) return;
    this.currenciesLoading.set(true);
    try {
      const res = await listPaymentCurrencies();
      const codes = res.items.map((item) => item.currencyCode);
      if (codes.length > 0) {
        this.currencies.set(codes);
        if (!codes.includes(this.currencyCode())) {
          this.currencyCode.set(codes.includes('USD') ? 'USD' : codes[0]);
        }
      }
      this.currenciesLoaded = true;
    } catch (error) {
      this.notify.error(billingErrorMessage(error, this.transloco));
    } finally {
      this.currenciesLoading.set(false);
    }
  }

  private startPolling(): void {
    this.stopPolling();
    const session = ++this.pollSession;
    const baseline = this.baselineBalanceUsd;

    const scheduleNext = (attempt: number) => {
      if (session !== this.pollSession) return;
      this.pollTimer = setTimeout(() => {
        void runAttempt(attempt);
      }, POLL_INTERVAL_MS);
    };

    const runAttempt = async (attempt: number) => {
      if (session !== this.pollSession) return;
      try {
        const latest = await getWallet();
        if (session !== this.pollSession) return;

        if (baseline !== null && isGreater(latest.balanceUsd, baseline)) {
          this.stopPolling();
          this.notify.success(this.transloco.translate('bov.topup.successToast'));
          this.completed.emit();
          this.close();
          return;
        }
      } catch (error) {
        if (session !== this.pollSession) return;
        if (error instanceof ApiError && error.code === 'TENANT_OWNER_REQUIRED') {
          this.stopPolling();
          this.notify.error(billingErrorMessage(error, this.transloco));
          this.close();
          return;
        }
      }

      if (session !== this.pollSession) return;
      if (attempt >= MAX_POLLS) {
        this.stopPolling();
        this.notify.info(this.transloco.translate('bov.topup.timeoutToast'));
        this.close();
        return;
      }

      scheduleNext(attempt + 1);
    };

    scheduleNext(1);
  }

  private stopPolling(): void {
    this.pollSession++;
    if (this.pollTimer !== null) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private resetIdempotency(): void {
    this.lastPayloadSignature = '';
    this.lastIdempotencyKey = '';
  }

  private idempotencyKeyFor(body: TopupBody): string {
    const signature = JSON.stringify([body.amount, body.currencyCode]);
    if (signature !== this.lastPayloadSignature || !this.lastIdempotencyKey) {
      this.lastPayloadSignature = signature;
      this.lastIdempotencyKey = newIdempotencyKey();
    }
    return this.lastIdempotencyKey;
  }
}

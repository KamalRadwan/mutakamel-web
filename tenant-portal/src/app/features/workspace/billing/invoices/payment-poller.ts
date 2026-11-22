import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import {
  ActiveInvoicePaymentIntent,
  PAYMENT_HOLD_STATUSES,
  PaymentStatusView,
  getActivePaymentIntent,
  getPayment,
} from '../billing.api';

export type PollEvent =
  | { kind: 'active'; intent: ActiveInvoicePaymentIntent }
  | { kind: 'resolved'; payment: PaymentStatusView }
  | { kind: 'timeout' }
  | { kind: 'error'; error: unknown };

const POLL_INTERVAL_MS = 5_000;
const MAX_POLLS = 60;
/** Consecutive failed polls tolerated (with backoff) before the error is reported. */
const MAX_CONSECUTIVE_ERRORS = 3;

@Injectable()
export class PaymentPoller {
  private readonly destroyRef = inject(DestroyRef);

  readonly polling = signal(false);
  readonly attempts = signal(0);

  private timerId: ReturnType<typeof setTimeout> | null = null;
  private runSeq = 0;

  constructor() {
    this.destroyRef.onDestroy(() => this.stop());
  }

  start(invoiceId: string, paymentId: string, onEvent: (event: PollEvent) => void): void {
    this.stop();
    const seq = this.runSeq;
    let currentPaymentId = paymentId;
    let count = 0;
    let errorStreak = 0;

    this.polling.set(true);
    this.attempts.set(0);

    const scheduleNext = (delayMs = POLL_INTERVAL_MS) => {
      if (seq !== this.runSeq) return;
      this.timerId = setTimeout(() => void tick(), delayMs);
    };

    const tick = async () => {
      this.timerId = null;
      if (seq !== this.runSeq) return;

      count += 1;
      this.attempts.set(count);

      try {
        const active = await getActivePaymentIntent(invoiceId);
        if (seq !== this.runSeq) return;
        errorStreak = 0;

        if (active === null || !PAYMENT_HOLD_STATUSES.includes(active.status)) {
          const targetId = active?.paymentId ?? currentPaymentId;
          const payment = await getPayment(targetId);
          if (seq !== this.runSeq) return;
          this.stop();
          onEvent({ kind: 'resolved', payment });
          return;
        }

        currentPaymentId = active.paymentId;
        onEvent({ kind: 'active', intent: active });
        if (seq !== this.runSeq) return;

        if (count >= MAX_POLLS) {
          this.stop();
          onEvent({ kind: 'timeout' });
          return;
        }

        scheduleNext();
      } catch (error) {
        if (seq !== this.runSeq) return;
        errorStreak += 1;
        if (errorStreak < MAX_CONSECUTIVE_ERRORS) {
          scheduleNext(POLL_INTERVAL_MS * 2 ** errorStreak);
          return;
        }
        this.stop();
        onEvent({ kind: 'error', error });
      }
    };

    scheduleNext();
  }

  stop(): void {
    this.runSeq += 1;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.polling.set(false);
  }
}

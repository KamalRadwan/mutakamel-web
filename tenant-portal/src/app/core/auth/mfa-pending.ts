import { Service, Signal, signal } from '@angular/core';
import { DEFAULT_SIGNED_IN_URL } from './auth-session';
import type { MfaStep } from './auth-session.model';

export type MfaPendingOrigin = 'login' | 'invitation';

export interface MfaPendingState {
  step: MfaStep;
  returnUrl: string;
  origin: MfaPendingOrigin;
  receivedAt: number;
}

/**
 * In-memory store for an active MFA login/invitation challenge.
 * Intentionally non-persistent: reloading /verify drops it so the user signs in again.
 */
@Service()
export class MfaPending {
  private readonly _current = signal<MfaPendingState | null>(null);

  readonly current: Signal<MfaPendingState | null> = this._current.asReadonly();

  set(step: MfaStep, opts: { returnUrl?: string; origin: MfaPendingOrigin }): void {
    this._current.set({
      step,
      returnUrl: opts.returnUrl ?? DEFAULT_SIGNED_IN_URL,
      origin: opts.origin,
      receivedAt: Date.now(),
    });
  }

  update(step: MfaStep): void {
    const existing = this._current();
    if (!existing) return;
    this._current.set({
      ...existing,
      step,
      receivedAt: Date.now(),
    });
  }

  clear(): void {
    this._current.set(null);
  }
}

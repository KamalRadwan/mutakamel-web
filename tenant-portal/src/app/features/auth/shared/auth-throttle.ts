import { DestroyRef, type Signal, assertInInjectionContext, computed, inject, signal } from '@angular/core';
import { ApiError } from '../../../core/api/api-errors';

/**
 * Seconds to wait from a 429: details.retryAfterSeconds[0] (AUTH_MFA_THROTTLED, AUTH_LOGIN_THROTTLED),
 * else `fallback` (COMMON.GENERIC.RATE_LIMITED and GW.RATE.LIMIT_EXCEEDED carry only a Retry-After header).
 */
export function retryAfterSeconds(error: unknown, fallback = 60): number {
  if (!(error instanceof ApiError)) return fallback;
  const raw = error.details?.['retryAfterSeconds'];
  const seconds = Number(Array.isArray(raw) ? raw[0] : Number.NaN);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : fallback;
}

export interface ThrottleCountdown {
  start(seconds: number): void;
  remaining: Signal<number>;
  active: Signal<boolean>;
}

/**
 * A countdown signal for a throttle notice: start(seconds), remaining(), active();
 * clears its interval on destroy. Call in an injection context.
 */
export function throttleCountdown(): ThrottleCountdown {
  assertInInjectionContext(throttleCountdown);
  const destroyRef = inject(DestroyRef);
  const remaining = signal(0);
  const active = computed(() => remaining() > 0);
  let timer: ReturnType<typeof setInterval> | null = null;
  let untilMs = 0;

  const stop = () => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };

  const start = (seconds: number) => {
    stop();
    const normalized = Math.max(0, Math.ceil(seconds));
    if (normalized <= 0) {
      remaining.set(0);
      return;
    }
    untilMs = Date.now() + normalized * 1000;
    remaining.set(normalized);
    timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((untilMs - Date.now()) / 1000));
      remaining.set(left);
      if (left <= 0) {
        stop();
      }
    }, 1000);
  };

  destroyRef.onDestroy(stop);

  return {
    start,
    remaining: remaining.asReadonly(),
    active,
  };
}

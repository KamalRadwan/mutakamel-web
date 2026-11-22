import type { DestroyRef } from '@angular/core';
import { ApiError } from '../../shared/trade-api';

export interface PollHandle<T> {
  stop: () => void;
  readonly done: Promise<T | null>;
}

export function pollWhile<T>(
  fn: () => Promise<T>,
  active: (t: T) => boolean,
  ms = 3000,
  destroyRef?: DestroyRef,
  onTick?: (t: T) => void,
  onError?: (err: unknown) => void,
): PollHandle<T> {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight = false;
  let pendingWhileHidden = false;
  let lastResult: T | null = null;

  let resolveDone!: (value: T | null) => void;
  const done = new Promise<T | null>((resolve) => {
    resolveDone = resolve;
  });

  const isHidden = (): boolean =>
    typeof document !== 'undefined' && document.hidden;

  const cleanup = (): void => {
    if (stopped) return;
    stopped = true;
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
    resolveDone(lastResult);
  };

  const scheduleNext = (): void => {
    if (stopped) return;
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      if (stopped) return;
      if (isHidden()) {
        pendingWhileHidden = true;
        return;
      }
      void tick();
    }, ms);
  };

  const tick = async (): Promise<void> => {
    if (stopped || inFlight) return;
    if (isHidden()) {
      pendingWhileHidden = true;
      return;
    }
    inFlight = true;
    pendingWhileHidden = false;
    try {
      const value = await fn();
      if (stopped) return;
      lastResult = value;
      onTick?.(value);
      if (!active(value)) {
        cleanup();
        return;
      }
      scheduleNext();
    } catch (err) {
      if (stopped) return;
      onError?.(err);
      if (err instanceof ApiError && err.status === 404) {
        cleanup();
        return;
      }
      scheduleNext();
    } finally {
      inFlight = false;
    }
  };

  const onVisibilityChange = (): void => {
    if (stopped || isHidden()) return;
    if (pendingWhileHidden) {
      void tick();
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
  }

  destroyRef?.onDestroy(() => {
    cleanup();
  });

  scheduleNext();

  return {
    stop: cleanup,
    done,
  };
}

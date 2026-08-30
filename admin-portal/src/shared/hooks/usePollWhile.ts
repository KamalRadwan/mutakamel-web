import { useEffect, useRef } from "react";

export interface UsePollWhileOptions {
  /** Delay between poll attempts, in milliseconds. */
  intervalMs: number;
  /**
   * When set, polling uses a self-rescheduling `setTimeout` chain capped at
   * this many attempts. When omitted, polling uses a `setInterval` guarded
   * by an in-flight ref so overlapping `task()` invocations never stack;
   * there is no attempt cap and `onAttempt`/`onExhausted`/`shouldContinue`
   * are not used.
   */
  maxAttempts?: number;
  /** Capped mode only: called with the 1-based attempt number before each poll. */
  onAttempt?: (attempt: number) => void;
  /**
   * Capped mode only: called once, right after the last allowed attempt, if
   * `shouldContinue()` still reports true (i.e. the cap was hit while still
   * needed).
   */
  onExhausted?: () => void;
  /**
   * Capped mode only: re-checked immediately after every `task()` call to
   * decide whether to schedule another attempt. Read this from a ref/latest
   * value (not something captured when the effect started) so it reflects
   * what `task()` just produced, without waiting for a re-render. Defaults
   * to always continuing until the attempt cap is hit.
   */
  shouldContinue?: () => boolean;
  /**
   * Extra values that should tear down and restart the underlying timer
   * when they change, on top of `active` transitioning - e.g. a selected id
   * whose change should reset an in-progress polling window. Compared
   * positionally, the same way a `useEffect` dependency array is.
   */
  deps?: readonly unknown[];
}

/**
 * Polls `task` on an interval while `active` is true.
 *
 * `active` is a plain boolean the caller (re)computes every render from its
 * own state - exactly like a `useEffect` dependency - so the underlying
 * timer starts/stops in the same render/commit the caller's own state
 * changes in, rather than one tick later. `shouldContinue` (capped mode
 * only) is a function instead, because that decision has to be made
 * immediately after `task()` resolves, using live state, not a value from
 * whenever the effect last started.
 *
 * The timer is cleared on unmount and whenever `active` becomes false.
 * Interactive surfaces should compose `active` with
 * `!useOperatorRefreshGuard(...).isPaused`; the poller deliberately stays
 * unaware of DOM ownership and product-specific overlay/call signals.
 */
export function usePollWhile(
  active: boolean,
  task: () => void | Promise<unknown>,
  options: UsePollWhileOptions,
): void {
  const {
    intervalMs,
    maxAttempts,
    onAttempt,
    onExhausted,
    shouldContinue,
    deps = [],
  } = options;

  const taskRef = useRef(task);
  const onAttemptRef = useRef(onAttempt);
  const onExhaustedRef = useRef(onExhausted);
  const shouldContinueRef = useRef(shouldContinue);
  const inFlightRef = useRef(false);

  useEffect(() => {
    taskRef.current = task;
    onAttemptRef.current = onAttempt;
    onExhaustedRef.current = onExhausted;
    shouldContinueRef.current = shouldContinue;
  });

  useEffect(() => {
    if (!active) return;

    if (maxAttempts !== undefined) {
      let cancelled = false;
      let timer: number | undefined;
      let attempts = 0;
      const stillNeeded = () => shouldContinueRef.current?.() ?? true;
      const schedule = () => {
        timer = window.setTimeout(async () => {
          if (cancelled) return;
          attempts += 1;
          onAttemptRef.current?.(attempts);
          await taskRef.current();
          if (cancelled) return;
          if (stillNeeded() && attempts < maxAttempts) {
            schedule();
            return;
          }
          if (attempts >= maxAttempts && stillNeeded()) {
            onExhaustedRef.current?.();
          }
        }, intervalMs);
      };
      schedule();
      return () => {
        cancelled = true;
        if (timer !== undefined) window.clearTimeout(timer);
      };
    }

    const timer = window.setInterval(() => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      Promise.resolve(taskRef.current()).finally(() => {
        inFlightRef.current = false;
      });
    }, intervalMs);
    return () => window.clearInterval(timer);
    // `active`/`intervalMs`/`maxAttempts` drive start/stop; `deps` lets each
    // caller opt back in to any extra restart triggers its poll loop needs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, intervalMs, maxAttempts, ...deps]);
}

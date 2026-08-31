"use client";

import { useEffect, useState } from "react";
import type { Language } from "@/i18n/useLanguage";
import { formatNumber } from "@/lib/format/number";

export interface Countdown {
  /** Whole seconds left, floored at 0. */
  secondsRemaining: number;
  /** The deadline has passed, or there is no deadline to count to. */
  hasLapsed: boolean;
}

const TICK_MS = 1_000;

/**
 * Counts down to a server-issued deadline and reports the moment it lapses.
 *
 * Both things this phase freezes — a payment quote and a plan-change preview —
 * are short-lived and are revalidated server-side at the moment they are used.
 * Without a visible countdown the button simply stops working, which is exactly
 * the silently-dead-control failure MASTER-PLAN 6.21 names. The lapse is a
 * rendered outcome, not an absence.
 *
 * Passing `null` reports a lapsed countdown: no deadline means nothing pending.
 */
export function useCountdown(deadline: string | null): Countdown {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deadline) return;
    const expiresAt = new Date(deadline).getTime();
    if (Number.isNaN(expiresAt)) return;
    // Re-read the clock rather than decrementing a counter: a backgrounded tab
    // throttles timers, and a decremented counter would drift into claiming a
    // dead quote is still live. The first read is deferred a microtask so the
    // effect never sets state synchronously and cascades a render.
    queueMicrotask(() => setNow(Date.now()));
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= expiresAt) window.clearInterval(timer);
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [deadline]);

  if (!deadline) return { secondsRemaining: 0, hasLapsed: true };
  const expiresAt = new Date(deadline).getTime();
  if (Number.isNaN(expiresAt)) return { secondsRemaining: 0, hasLapsed: true };
  const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
  return { secondsRemaining: remaining, hasLapsed: remaining === 0 };
}

/**
 * `M:SS`, with the digits chosen by locale rather than by string padding —
 * Arabic uses Western digits through `ar-EG-u-nu-latn`, which only `Intl`
 * knows (docs/design/typography.md).
 */
export function formatCountdown(secondsRemaining: number, lang: Language): string {
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  return `${formatNumber(minutes, lang)}:${formatNumber(seconds, lang, {
    minimumIntegerDigits: 2,
    useGrouping: false,
  })}`;
}

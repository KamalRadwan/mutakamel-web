"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Gaps between the automatic re-checks of a workspace that is still being
 * prepared: four 15-second checks, four 30-second ones, then twelve a minute
 * apart. That is fifteen minutes in all, past the 10-minute provisioning p95
 * target Core's dashboard measures against
 * (`DASHBOARD_PROVISIONING_P95_TARGET_SECONDS`, core-app
 * `src/config/dashboard-targets.config.ts`). Then the checks stop and wait for
 * the user, so a forgotten tab never polls forever.
 */
const RECHECK_DELAYS_MS: readonly number[] = [
  ...Array<number>(4).fill(15_000),
  ...Array<number>(4).fill(30_000),
  ...Array<number>(12).fill(60_000),
];

/**
 * Asks host admission again for a host that does not admit the product yet.
 *
 * `router.refresh()` re-renders the route's server components, so the layout's
 * `TenantHostAdmission` reads the host's status from Core again and the
 * boundary receives the new one in place. Nothing navigates and nothing
 * redirects: once the status is ACTIVE the requested page itself renders.
 * Client state survives a refresh, which is what lets the schedule count.
 *
 * With `automatic`, checks follow `RECHECK_DELAYS_MS`; a hidden tab holds its
 * next check until it is shown again rather than spend one nobody sees.
 * `checkNow` checks at once and, when automatic, starts a fresh bounded run,
 * since someone is evidently waiting.
 */
export function useHostStatusRecheck({ automatic }: { automatic: boolean }) {
  const router = useRouter();
  const [isChecking, startCheck] = useTransition();
  const [checksMade, setChecksMade] = useState(0);

  const refresh = useCallback(() => {
    startCheck(() => router.refresh());
  }, [router]);

  useEffect(() => {
    if (!automatic) return;
    const delay = RECHECK_DELAYS_MS[checksMade];
    if (delay === undefined) return;

    const checkWhenVisible = () => {
      if (document.visibilityState !== "visible") return;
      document.removeEventListener("visibilitychange", checkWhenVisible);
      setChecksMade((count) => count + 1);
      refresh();
    };
    const timer = window.setTimeout(() => {
      document.addEventListener("visibilitychange", checkWhenVisible);
      checkWhenVisible();
    }, delay);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", checkWhenVisible);
    };
  }, [automatic, checksMade, refresh]);

  const checkNow = useCallback(() => {
    setChecksMade(0);
    refresh();
  }, [refresh]);

  return {
    isChecking,
    isAutoChecking: automatic && checksMade < RECHECK_DELAYS_MS.length,
    checkNow,
  };
}

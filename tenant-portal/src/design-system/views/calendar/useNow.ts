"use client";

import { useMemo, useSyncExternalStore } from "react";

const MINUTE_MS = 60_000;

// The clock is external state, so it goes through useSyncExternalStore like
// the network and storage stores do. A minute is the finest step anything on
// the calendar shows — the "now" line, and which day is today.
function subscribe(onTick: () => void): () => void {
  const timer = window.setInterval(onTick, MINUTE_MS);
  return () => window.clearInterval(timer);
}

const currentMinute = () => Math.floor(Date.now() / MINUTE_MS);

// The server's clock and time zone are not the reader's: rendering "today"
// there could mark a different day than the browser does and fail hydration.
// So the server marks nothing, and the client fills it in on its first pass.
const noClockOnServer = () => null;

export function useNow(): Date | null {
  const minute = useSyncExternalStore<number | null>(subscribe, currentMinute, noClockOnServer);
  return useMemo(() => (minute === null ? null : new Date(minute * MINUTE_MS)), [minute]);
}

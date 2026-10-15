"use client";

import { useSyncExternalStore } from "react";

const MINUTE_MS = 60_000;

function subscribe(onTick: () => void): () => void {
  const timer = window.setInterval(onTick, MINUTE_MS);
  return () => window.clearInterval(timer);
}

const currentMinute = () => Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS;

// The server's clock is not the reader's, so the stage-age badges render only
// once the client has one — a server-rendered age would fail hydration.
const noClockOnServer = () => null;

/** Epoch milliseconds, advancing once a minute — the stage age's finest step. */
export function useLeadCardViewClock(): number | null {
  return useSyncExternalStore<number | null>(subscribe, currentMinute, noClockOnServer);
}

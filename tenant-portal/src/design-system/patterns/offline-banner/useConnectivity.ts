"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { TENANT_REALTIME_SHELL_EVENTS } from "@/context/TenantRealtimeProvider";

export type ConnectivityStatus = "online" | "offline" | "draining" | "stopped";

export interface ConnectivityState {
  status: ConnectivityStatus;
  /**
   * The raw `RealtimeApplicationStopReason`, set only while `stopped`.
   *
   * Deliberately unmapped: it is a wire value, and a screen renders it through
   * a label table like every other enum. Inventing a mapping here would make an
   * unrecognised reason disappear silently. `OfflineBanner` is that screen —
   * until 13.5 nothing read this at all, and all five reasons showed one
   * sentence.
   */
  stopReason: string | null;
}

interface RealtimeState {
  draining: boolean;
  stopped: boolean;
  stopReason: string | null;
}

const INITIAL_REALTIME: RealtimeState = {
  draining: false,
  stopped: false,
  stopReason: null,
};

function subscribeToNetwork(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

const isOnline = () => navigator.onLine;

// The server has no network state to report, and the browser's real answer
// arrives on the first client snapshot. Returning `true` matches what the
// server rendered — OfflineBanner renders nothing while online — so there is no
// hydration mismatch. Same shape as useLanguage's getServerSnapshot.
const isOnlineOnServer = () => true;

/**
 * The listener the realtime layer has been dispatching to since it was built.
 *
 * `TenantRealtimeProvider` fires `server-draining`, `permanent-stop`,
 * `resync-required`, `session-ready` and three notification events on `window`
 * — and **nothing anywhere subscribes to the connection ones**. A tenant whose
 * realtime server drains, or whose connection is permanently stopped, sees a
 * portal that looks fine and silently stops updating.
 *
 * `session-ready` is subscribed to as well, though it is not one of the three
 * named in MASTER-PLAN 1.28: it is the only event that says the connection came
 * back, so without it `draining` would be a one-way door and the banner would
 * never clear.
 *
 * **`stopped` is terminal.** The realtime client has given up; coming back
 * online does not restart it. Saying "online" again would be a lie about
 * whether live updates are flowing.
 *
 * `resync-required` is deliberately **not** here. It carried a `resyncCount`
 * that nothing ever read, and it counted every scope — so a screen following
 * that advice would have refetched its whole list every time a *notification*
 * cursor went ambiguous. MASTER-PLAN 13.6 replaced it with `useRealtimeResync`,
 * which reads the scope. This hook answers "what is the connection doing";
 * that one answers "is what I am holding still true".
 */
export function useConnectivity(): ConnectivityState {
  // The browser's own network state goes through useSyncExternalStore rather
  // than a setState in an effect: it is external state React can subscribe to,
  // and the effect version has to write state synchronously on mount to catch
  // a page that loaded offline, which cascades a render.
  const online = useSyncExternalStore(subscribeToNetwork, isOnline, isOnlineOnServer);
  const [realtime, setRealtime] = useState<RealtimeState>(INITIAL_REALTIME);

  useEffect(() => {
    const onDraining = () => setRealtime((current) => ({ ...current, draining: true }));
    const onSessionReady = () => setRealtime((current) => ({ ...current, draining: false }));
    const onPermanentStop = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      setRealtime((current) => ({
        ...current,
        stopped: true,
        stopReason: typeof detail === "string" ? detail : null,
      }));
    };
    window.addEventListener(TENANT_REALTIME_SHELL_EVENTS.serverDraining, onDraining);
    window.addEventListener(TENANT_REALTIME_SHELL_EVENTS.sessionReady, onSessionReady);
    window.addEventListener(TENANT_REALTIME_SHELL_EVENTS.permanentStop, onPermanentStop);

    return () => {
      window.removeEventListener(TENANT_REALTIME_SHELL_EVENTS.serverDraining, onDraining);
      window.removeEventListener(TENANT_REALTIME_SHELL_EVENTS.sessionReady, onSessionReady);
      window.removeEventListener(TENANT_REALTIME_SHELL_EVENTS.permanentStop, onPermanentStop);
    };
  }, []);

  // Precedence, and it is the whole reason this is derived rather than stored:
  // `stopped` outranks everything, so coming back online cannot silently claim
  // that live updates resumed when the client has given up.
  const status: ConnectivityStatus = realtime.stopped
    ? "stopped"
    : !online
      ? "offline"
      : realtime.draining
        ? "draining"
        : "online";

  return { status, stopReason: realtime.stopReason };
}

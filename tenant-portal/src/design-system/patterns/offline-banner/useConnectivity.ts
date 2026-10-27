"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  TENANT_REALTIME_SHELL_EVENTS,
  getTenantRealtimeConnectionSnapshot,
  getServerRealtimeConnectionSnapshot,
  subscribeTenantRealtimeConnection,
} from "@/context/TenantRealtimeProvider";

export type ConnectivityStatus = "online" | "offline" | "draining" | "retrying" | "stopped";

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
  generation: string | null;
  draining: boolean;
  stopped: boolean;
  stopReason: string | null;
}

const INITIAL_REALTIME: RealtimeState = {
  generation: null,
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
 * Coordinator state survives a late banner mount. Application events add the
 * server's drain signal and clear obsolete feedback after session readiness.
 *
 * A network recovery cannot clear a stop. A new auth generation or validated
 * session-ready event can; coordinator snapshots also expose handshake stops
 * that never reach the application event stream.
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
  const connection = useSyncExternalStore(
    subscribeTenantRealtimeConnection,
    getTenantRealtimeConnectionSnapshot,
    getServerRealtimeConnectionSnapshot,
  );
  const [realtime, setRealtime] = useState<RealtimeState>(INITIAL_REALTIME);

  useEffect(() => {
    const currentGeneration = () => getTenantRealtimeConnectionSnapshot()?.generation ?? null;
    const onDraining = () => setRealtime({
      ...INITIAL_REALTIME, generation: currentGeneration(), draining: true,
    });
    const onSessionReady = () => setRealtime({
      ...INITIAL_REALTIME, generation: currentGeneration(),
    });
    const onPermanentStop = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      setRealtime({
        ...INITIAL_REALTIME,
        generation: currentGeneration(),
        stopped: true,
        stopReason: typeof detail === "string" ? detail : null,
      });
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
  const application = realtime.generation === (connection?.generation ?? null)
    ? realtime : INITIAL_REALTIME;
  const blocked = connection?.phase === "blocked";
  const retrying = connection?.phase === "waiting_to_reconnect" ||
    connection?.phase === "connecting" || connection?.phase === "obtaining_credential";
  const status: ConnectivityStatus = blocked || application.stopped
    ? "stopped"
    : !online
      ? "offline"
      : application.draining
        ? "draining"
        : retrying ? "retrying" : "online";

  const stopReason = blocked ? readBlockedReason(connection.blockedReason) : application.stopReason;
  return { status, stopReason };
}

function readBlockedReason(reason: string | null): string | null {
  switch (reason) {
    case "credential_refresh_failed": return "refresh_failed";
    case "server_access_revoked": return "access_revoked";
    case "server_connection_replaced": return "connection_replaced";
    case "server_tenant_unavailable": return "tenant_unavailable";
    case "invalid_server_event": return "invalid_server_event";
    default: return null;
  }
}

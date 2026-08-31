"use client";

import { useEffect, useRef } from "react";
import { TENANT_REALTIME_SHELL_EVENTS } from "@/context/TenantRealtimeProvider";

/**
 * The one mechanism a screen opts into so its list reconciles with the server.
 *
 * `realtime.sync.required.v1` is the server saying "what you are holding is
 * suspect, re-read it". Until MASTER-PLAN 13.6 the **only** consumer was the
 * notification runtime, so every other open list kept showing whatever it had
 * fetched — indefinitely, because the realtime protocol carries no entity
 * change events at all. Notifications and presence are the only live streams;
 * a lead, an opportunity or an invoice changes with nothing sent to say so.
 * That makes the three signals below the entire staleness vocabulary this app
 * has, and a list that ignores them is a list that can be arbitrarily wrong.
 *
 * A screen opts in with one line, in the hook that owns the fetch:
 *
 * ```ts
 * useRealtimeResync(reload);
 * ```
 *
 * `reload` may be any function, sync or async — its identity is read fresh on
 * every call, so a `useCallback` whose dependencies change with the filters
 * does not resubscribe, and a screen never has to stabilise a callback for this
 * hook's benefit.
 */
export function useRealtimeResync(reconcile: () => void | Promise<unknown>): void {
  const latest = useRef(reconcile);

  useEffect(() => {
    latest.current = reconcile;
  });

  useEffect(
    () =>
      subscribeToRealtimeResync(() => {
        // This runs from a window event, so a rejected reconcile has no caller
        // to catch it and would surface as an unhandled rejection. Every screen
        // already renders its own load failure; this only stops a background
        // refetch from reporting one nobody asked for.
        void Promise.resolve(latest.current()).catch(() => undefined);
      }),
    [],
  );
}

type ResyncListener = () => void;

const listeners = new Set<ResyncListener>();

/**
 * `session.ready.v1` arrives once per established connection. The first is the
 * connection this page loaded with and means nothing was missed; every one
 * after it means the socket dropped and came back, and the gap in between is
 * unobservable — the client is told nothing about what changed while it was
 * away.
 *
 * The payload's own `recovered` flag cannot do this job: it is `false` both for
 * a first connect and for a reconnect the server could not restore, which are
 * the two cases that must be told apart.
 */
let establishedConnectionCount = 0;

/**
 * A refetch from a hidden tab is work nobody is looking at, and a portal open
 * in eight tabs would multiply every reconnect by eight. The signal is held
 * instead of dropped: whatever went stale is still stale when the tab returns.
 */
let deferredWhileHidden = false;

let windowListenersAttached = false;

function notify(): void {
  if (document.visibilityState === "hidden") {
    deferredWhileHidden = true;
    return;
  }
  deferredWhileHidden = false;
  for (const listener of [...listeners]) listener();
}

/**
 * The provider dispatches this shell event for `realtime.sync.required.v1` and
 * for the session-ready case it repairs itself, so the scope has to be read
 * rather than assumed.
 *
 * `NOTIFICATIONS` and `PRESENCE` are already owned: the notification runtime
 * reconciles its own cursor cache, and making every open list refetch because a
 * notification cursor went ambiguous would be a self-inflicted request storm.
 * `ALL` is the one that means the data underneath the screen moved.
 */
function readSyncScope(event: Event): string | null {
  const detail = (event as CustomEvent<unknown>).detail;
  if (!detail || typeof detail !== "object") return null;
  const payload = (detail as { payload?: unknown }).payload;
  if (!payload || typeof payload !== "object") return null;
  const scope = (payload as { scope?: unknown }).scope;
  return typeof scope === "string" ? scope : null;
}

function onSyncRequired(event: Event): void {
  if (readSyncScope(event) === "ALL") notify();
}

function onSessionReady(): void {
  establishedConnectionCount += 1;
  if (establishedConnectionCount > 1) notify();
}

// `online` only ever fires after `offline`, so it is a reconnect by definition
// — no first-load case to exclude.
function onOnline(): void {
  notify();
}

function onVisibilityChange(): void {
  if (deferredWhileHidden && document.visibilityState === "visible") notify();
}

/**
 * One set of window listeners for the whole document, not one per screen: a
 * portal with eight open lists would otherwise attach eight copies of the same
 * four handlers and count the same reconnect eight times.
 *
 * They are attached on the first subscriber and **never detached**, which is
 * deliberate and is the one thing in here that must not be "tidied up" into a
 * matching teardown. `establishedConnectionCount` is a property of the page,
 * not of any screen: detaching on the last unsubscribe would reset it on every
 * navigation, and the next genuine reconnect would be counted as a first
 * connection and silently swallowed — which is the exact failure this hook
 * exists to prevent. Four handlers on a document is not a leak.
 */
function subscribeToRealtimeResync(listener: ResyncListener): () => void {
  if (!windowListenersAttached) {
    window.addEventListener(TENANT_REALTIME_SHELL_EVENTS.resyncRequired, onSyncRequired);
    window.addEventListener(TENANT_REALTIME_SHELL_EVENTS.sessionReady, onSessionReady);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibilityChange);
    windowListenersAttached = true;
  }
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

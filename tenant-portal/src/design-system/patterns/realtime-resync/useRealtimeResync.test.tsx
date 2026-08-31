// @vitest-environment jsdom

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TENANT_REALTIME_SHELL_EVENTS } from "@/context/TenantRealtimeProvider";

// The hook holds ONE page-lifetime subscription and a page-lifetime count of
// established connections — deliberately, because resetting that count on every
// navigation would swallow the next real reconnect. So each test needs a fresh
// module instance; sharing one would let the first test's reconnect count
// against the second's baseline.
let useRealtimeResync: typeof import("./useRealtimeResync").useRealtimeResync;

function Screen({ reconcile }: { reconcile: () => void }) {
  useRealtimeResync(reconcile);
  return null;
}

function dispatch(name: string, detail?: unknown): void {
  act(() => {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  });
}

function sessionReady(): void {
  dispatch(TENANT_REALTIME_SHELL_EVENTS.sessionReady, {
    payload: { recovered: false, recoveryComplete: true },
  });
}

function syncRequired(scope: string): void {
  dispatch(TENANT_REALTIME_SHELL_EVENTS.resyncRequired, {
    payload: {
      scope,
      reason: "RECOVERY_INCOMPLETE",
      lastCommittedNotificationCursor: null,
    },
  });
}

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

beforeEach(async () => {
  vi.resetModules();
  ({ useRealtimeResync } = await import("./useRealtimeResync"));
  setVisibility("visible");
});

afterEach(() => {
  cleanup();
});

// MASTER-PLAN 13.6. Every assertion here is about a signal that today reaches
// nothing but the notification cache.
describe("useRealtimeResync", () => {
  it("does not reconcile on mount", () => {
    const reconcile = vi.fn();
    render(<Screen reconcile={reconcile} />);

    expect(reconcile).not.toHaveBeenCalled();
  });

  it("reconciles when the server declares the whole session out of sync", () => {
    const reconcile = vi.fn();
    render(<Screen reconcile={reconcile} />);

    syncRequired("ALL");

    expect(reconcile).toHaveBeenCalledTimes(1);
  });

  // The gate. Notifications and presence repair themselves; making 200 open
  // lists refetch because a notification cursor went ambiguous would be a
  // self-inflicted request storm, and it is exactly what a scope-blind
  // `resyncCount` would have done.
  it.each(["NOTIFICATIONS", "PRESENCE"])(
    "ignores a %s-scoped resync, which owns its own repair",
    (scope) => {
      const reconcile = vi.fn();
      render(<Screen reconcile={reconcile} />);

      syncRequired(scope);

      expect(reconcile).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, {}, { payload: null }, { payload: {} }, "ALL"])(
    "ignores a malformed resync detail %j rather than guessing",
    (detail) => {
      const reconcile = vi.fn();
      render(<Screen reconcile={reconcile} />);

      dispatch(TENANT_REALTIME_SHELL_EVENTS.resyncRequired, detail);

      expect(reconcile).not.toHaveBeenCalled();
    },
  );

  // The connection this page loaded with is not a reconnect. Treating it as
  // one would double every list's first fetch.
  it("treats the first established connection as the baseline", () => {
    const reconcile = vi.fn();
    render(<Screen reconcile={reconcile} />);

    sessionReady();

    expect(reconcile).not.toHaveBeenCalled();
  });

  it("reconciles on every connection established after the first", () => {
    const reconcile = vi.fn();
    render(<Screen reconcile={reconcile} />);

    sessionReady();
    sessionReady();
    sessionReady();

    expect(reconcile).toHaveBeenCalledTimes(2);
  });

  it("reconciles when the browser comes back online", () => {
    const reconcile = vi.fn();
    render(<Screen reconcile={reconcile} />);

    dispatch("online");

    expect(reconcile).toHaveBeenCalledTimes(1);
  });

  it("holds a reconcile that arrives while the tab is hidden, and runs it once on return", () => {
    const reconcile = vi.fn();
    render(<Screen reconcile={reconcile} />);
    setVisibility("hidden");

    syncRequired("ALL");
    dispatch("online");
    syncRequired("ALL");

    expect(reconcile).not.toHaveBeenCalled();

    setVisibility("visible");

    expect(reconcile).toHaveBeenCalledTimes(1);
  });

  it("does not run a held reconcile twice on a second return", () => {
    const reconcile = vi.fn();
    render(<Screen reconcile={reconcile} />);
    setVisibility("hidden");
    syncRequired("ALL");
    setVisibility("visible");
    reconcile.mockClear();

    setVisibility("hidden");
    setVisibility("visible");

    expect(reconcile).not.toHaveBeenCalled();
  });

  it("reconciles every subscribed screen once, from one set of listeners", () => {
    const first = vi.fn();
    const second = vi.fn();
    render(
      <>
        <Screen reconcile={first} />
        <Screen reconcile={second} />
      </>,
    );

    syncRequired("ALL");

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("stops reconciling a screen that unmounted", () => {
    const reconcile = vi.fn();
    const { unmount } = render(<Screen reconcile={reconcile} />);

    unmount();
    syncRequired("ALL");

    expect(reconcile).not.toHaveBeenCalled();
  });

  // The count of established connections belongs to the PAGE, not to a screen.
  // An earlier draft tore the listeners down with the last subscriber, which
  // reset it on every navigation — so the first reconnect after any navigation
  // was counted as a first connection and silently swallowed. That is the exact
  // failure this hook exists to prevent, and it survived only because nothing
  // asserted across an unmount.
  it("still reconciles after a navigation, when the connection actually drops", () => {
    const firstScreen = vi.fn();
    const { unmount } = render(<Screen reconcile={firstScreen} />);
    sessionReady();
    unmount();

    const secondScreen = vi.fn();
    render(<Screen reconcile={secondScreen} />);
    sessionReady();

    expect(firstScreen).not.toHaveBeenCalled();
    expect(secondScreen).toHaveBeenCalledTimes(1);
  });

  // A list hook's `reload` is usually async. There is no caller to catch it
  // here, so a rejection must not become an unhandled one.
  it("swallows a rejected reconcile rather than raising it into the page", async () => {
    const onUnhandled = vi.fn();
    window.addEventListener("unhandledrejection", onUnhandled);
    const reconcile = vi.fn(async () => {
      throw new Error("the list could not be reloaded");
    });
    render(<Screen reconcile={reconcile} />);

    syncRequired("ALL");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(reconcile).toHaveBeenCalledTimes(1);
    expect(onUnhandled).not.toHaveBeenCalled();
    window.removeEventListener("unhandledrejection", onUnhandled);
  });

  // The whole reason the callback is read through a ref: `reload` in a list
  // hook is a useCallback whose identity changes with every filter, sort and
  // page. Resubscribing on each of those would be noise, and calling a stale
  // closure would refetch the previous filter's data.
  it("calls the latest callback, not the one it subscribed with", () => {
    const stale = vi.fn();
    const fresh = vi.fn();
    const { rerender } = render(<Screen reconcile={stale} />);

    rerender(<Screen reconcile={fresh} />);
    syncRequired("ALL");

    expect(stale).not.toHaveBeenCalled();
    expect(fresh).toHaveBeenCalledTimes(1);
  });
});

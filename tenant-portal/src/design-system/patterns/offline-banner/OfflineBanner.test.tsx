// @vitest-environment jsdom

import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TENANT_REALTIME_SHELL_EVENTS } from "@/context/TenantRealtimeProvider";
import { OfflineBanner } from "./OfflineBanner";
import { useConnectivity } from "./useConnectivity";

afterEach(() => {
  cleanup();
  setOnline(true);
});

const labels = {
  offline: "You are offline. Changes cannot be saved right now.",
  draining: "Live updates are moving to another server.",
  stopped: "Live updates have stopped. Reload to restore them.",
  reload: "Reload",
  stopReasons: {
    access_revoked: "Your access changed.",
    connection_replaced: "Another window took over.",
    invalid_server_event: "The app could not read a message.",
    refresh_failed: "The session could not be renewed.",
    tenant_unavailable: "This workspace has no live updates right now.",
  },
};

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", { value, configurable: true });
}

function dispatch(name: string, detail?: unknown) {
  act(() => {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  });
}

describe("useConnectivity", () => {
  it("starts online and stays online with no events", () => {
    const { result } = renderHook(() => useConnectivity());
    expect(result.current.status).toBe("online");
    expect(result.current.stopReason).toBeNull();
  });

  it("reads navigator.onLine on mount", () => {
    setOnline(false);
    const { result } = renderHook(() => useConnectivity());
    expect(result.current.status).toBe("offline");
  });

  it("follows the browser's own offline and online events", () => {
    const { result } = renderHook(() => useConnectivity());
    // The event is only the notification; navigator.onLine is the value the
    // hook reads back, which is exactly how a real browser behaves.
    setOnline(false);
    dispatch("offline");
    expect(result.current.status).toBe("offline");
    setOnline(true);
    dispatch("online");
    expect(result.current.status).toBe("online");
  });

  it("subscribes to server-draining, which had ZERO listeners before", () => {
    const { result } = renderHook(() => useConnectivity());
    dispatch(TENANT_REALTIME_SHELL_EVENTS.serverDraining, { payload: {} });
    expect(result.current.status).toBe("draining");
  });

  it("clears draining once the session reconnects", () => {
    const { result } = renderHook(() => useConnectivity());
    dispatch(TENANT_REALTIME_SHELL_EVENTS.serverDraining, {});
    dispatch(TENANT_REALTIME_SHELL_EVENTS.sessionReady, {});
    expect(result.current.status).toBe("online");
  });

  it("carries the permanent-stop reason unmapped", () => {
    const { result } = renderHook(() => useConnectivity());
    dispatch(TENANT_REALTIME_SHELL_EVENTS.permanentStop, "access_revoked");
    expect(result.current.status).toBe("stopped");
    expect(result.current.stopReason).toBe("access_revoked");
  });

  it("treats stopped as terminal — coming back online does not restart it", () => {
    const { result } = renderHook(() => useConnectivity());
    dispatch(TENANT_REALTIME_SHELL_EVENTS.permanentStop, "tenant_unavailable");
    setOnline(true);
    dispatch("online");
    dispatch(TENANT_REALTIME_SHELL_EVENTS.sessionReady, {});
    expect(result.current.status).toBe("stopped");
  });

  it("outranks offline with stopped, since neither reconnects on its own", () => {
    const { result } = renderHook(() => useConnectivity());
    setOnline(false);
    dispatch("offline");
    dispatch(TENANT_REALTIME_SHELL_EVENTS.permanentStop, "access_revoked");
    expect(result.current.status).toBe("stopped");
  });

  // A resync is not a connection state, so it must not move this hook: a strip
  // that flickers on every reconnect is noise. It belongs to
  // `useRealtimeResync`, which reads the scope this hook never could.
  it("does not react to resync-required at all", () => {
    const { result } = renderHook(() => useConnectivity());

    dispatch(TENANT_REALTIME_SHELL_EVENTS.resyncRequired, {
      payload: { scope: "ALL" },
    });

    expect(result.current.status).toBe("online");
    expect(result.current.stopReason).toBeNull();
  });

  it("removes every listener on unmount", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    renderHook(() => useConnectivity()).unmount();
    const removed = remove.mock.calls.map(([name]) => name);
    expect(removed).toEqual(
      expect.arrayContaining([
        // The network pair is unsubscribed by useSyncExternalStore's own
        // teardown; the three realtime events by the effect's.
        "offline",
        "online",
        TENANT_REALTIME_SHELL_EVENTS.serverDraining,
        TENANT_REALTIME_SHELL_EVENTS.sessionReady,
        TENANT_REALTIME_SHELL_EVENTS.permanentStop,
      ]),
    );
    remove.mockRestore();
  });
});

describe("OfflineBanner", () => {
  it("renders nothing while online", () => {
    const { container } = render(<OfflineBanner status="online" labels={labels} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("says something different for each of the three states", () => {
    const { rerender } = render(<OfflineBanner status="offline" labels={labels} />);
    expect(screen.getByText(labels.offline)).toBeInTheDocument();
    rerender(<OfflineBanner status="draining" labels={labels} />);
    expect(screen.getByText(labels.draining)).toBeInTheDocument();
    rerender(<OfflineBanner status="stopped" labels={labels} />);
    expect(screen.getByText(labels.stopped)).toBeInTheDocument();
  });

  it("offers a reload ONLY for the state that waiting cannot fix", () => {
    const onReload = vi.fn();
    const { rerender } = render(<OfflineBanner status="offline" labels={labels} onReload={onReload} />);
    expect(screen.queryByRole("button", { name: "Reload" })).toBeNull();
    rerender(<OfflineBanner status="stopped" labels={labels} onReload={onReload} />);
    screen.getByRole("button", { name: "Reload" }).click();
    expect(onReload).toHaveBeenCalled();
  });

  it("announces politely — none of the three means a request failed", () => {
    render(<OfflineBanner status="offline" labels={labels} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  // MASTER-PLAN 13.5. `stopReason` was computed by useConnectivity and read by
  // nobody, so all five reasons rendered one sentence — and the two that a
  // reload genuinely fixes were indistinguishable from the one it cannot.
  it.each([
    ["access_revoked", labels.stopReasons.access_revoked],
    ["connection_replaced", labels.stopReasons.connection_replaced],
    ["invalid_server_event", labels.stopReasons.invalid_server_event],
    ["refresh_failed", labels.stopReasons.refresh_failed],
    ["tenant_unavailable", labels.stopReasons.tenant_unavailable],
  ])("names %s as the reason live updates stopped", (stopReason, message) => {
    render(<OfflineBanner status="stopped" stopReason={stopReason} labels={labels} />);

    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.queryByText(labels.stopped)).toBeNull();
  });

  // The gate. `stopReason` comes off a CustomEvent detail with no validation,
  // so anything can arrive — and a wire value must never be shown.
  it.each([null, undefined, "", "ACCESS_REVOKED", "constructor", "__proto__", "toString"])(
    "falls back to the generic sentence for %j",
    (stopReason) => {
      render(<OfflineBanner status="stopped" stopReason={stopReason} labels={labels} />);

      expect(screen.getByText(labels.stopped)).toBeInTheDocument();
    },
  );

  it("ignores a stop reason on a state that is not stopped", () => {
    render(<OfflineBanner status="draining" stopReason="access_revoked" labels={labels} />);

    expect(screen.getByText(labels.draining)).toBeInTheDocument();
    expect(screen.queryByText(labels.stopReasons.access_revoked)).toBeNull();
  });
});

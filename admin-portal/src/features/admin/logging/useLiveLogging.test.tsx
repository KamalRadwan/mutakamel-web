// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { authMock } = vi.hoisted(() => ({
  authMock: {
    user: {
      id: "019f1000-0000-7000-8000-000000000099",
      isSuperAdmin: false,
      permissions: ["admin.logging.read", "admin.logging.critical"],
    } as { id: string; isSuperAdmin: boolean; permissions: string[] } | null,
    isLoading: false,
  },
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => authMock }));

import { LOGGING_BASE_URL } from "./api";
import { TENANT_ID } from "./test-fixtures";
import { useLiveLogging } from "./useLiveLogging";

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  readonly listeners = new Map<string, EventListener[]>();
  readonly close = vi.fn();

  constructor(
    readonly url: string,
    readonly options?: EventSourceInit,
  ) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    const callback =
      typeof listener === "function" ? listener : listener.handleEvent.bind(listener);
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), callback]);
  }

  dispatch(type: string, data?: unknown) {
    const event = data === undefined
      ? new Event(type)
      : new MessageEvent(type, { data: JSON.stringify(data) });
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

describe("useLiveLogging", () => {
  beforeEach(() => {
    authMock.user = {
      id: "019f1000-0000-7000-8000-000000000099",
      isSuperAdmin: false,
      permissions: ["admin.logging.read", "admin.logging.critical"],
    };
    authMock.isLoading = false;
    FakeEventSource.instances = [];
    vi.stubGlobal("EventSource", FakeEventSource);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("fails permission preflight without opening a stream", () => {
    authMock.user = {
      id: "019f1000-0000-7000-8000-000000000099",
      isSuperAdmin: false,
      permissions: ["admin.logging.read"],
    };
    const { result } = renderHook(() => useLiveLogging());

    act(() => expect(result.current.start()).toBe(false));
    expect(result.current.connectionState).toBe("FORBIDDEN");
    expect(FakeEventSource.instances).toHaveLength(0);
  });

  it("opens the exact query, handles ready/log events, and strips private fields", async () => {
    const { result } = renderHook(() => useLiveLogging());
    act(() => {
      result.current.setDraftField("appName", "core-app");
      result.current.setDraftField("tenantId", TENANT_ID);
      result.current.setDraftField("minLevel", "debug");
    });
    act(() => expect(result.current.start()).toBe(true));

    const source = FakeEventSource.instances[0];
    expect(source.url).toBe(
      `${LOGGING_BASE_URL}/live?appName=core-app&tenantId=${TENANT_ID}&minLevel=debug`,
    );
    expect(source.options).toEqual({ withCredentials: true });
    act(() =>
      source.dispatch("ready", { timestamp: "2026-08-12T12:30:00.000Z" }),
    );
    expect(result.current.connectionState).toBe("LIVE");
    act(() =>
      source.dispatch("log", {
        timestamp: "2026-08-12T12:31:00.000Z",
        level: "debug",
        serviceName: "core-app",
        message: "Request complete",
        correlationId: "corr-1",
        tenantId: TENANT_ID,
        userId: "019f1000-0000-7000-8000-000000000077",
        context: { password: "never retain" },
      }),
    );
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(result.current.rows[0]).not.toHaveProperty("context");
    expect(result.current.rows[0]).not.toHaveProperty("userId");
  });

  it("closes and clears the in-memory buffer when the tab is hidden", async () => {
    const { result } = renderHook(() => useLiveLogging());
    act(() => expect(result.current.start()).toBe(true));
    const source = FakeEventSource.instances[0];
    act(() =>
      source.dispatch("log", {
        timestamp: "2026-08-12T12:31:00.000Z",
        level: "warn",
        serviceName: "core-app",
      }),
    );
    await waitFor(() => expect(result.current.rows).toHaveLength(1));

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    act(() => document.dispatchEvent(new Event("visibilitychange")));

    expect(source.close).toHaveBeenCalledOnce();
    expect(result.current.rows).toEqual([]);
    expect(result.current.connectionState).toBe("PAUSED_PRIVACY");
  });

  it("shows a service-level Redis outage until an explicit retry", () => {
    const { result } = renderHook(() => useLiveLogging());
    act(() => expect(result.current.start()).toBe(true));
    const source = FakeEventSource.instances[0];
    act(() =>
      source.dispatch("error", {
        code: "LOGGING_LIVE_REDIS_UNAVAILABLE",
        message: "Redis is required.",
      }),
    );

    expect(result.current.connectionState).toBe("UNAVAILABLE");
    expect(result.current.controlError?.code).toBe(
      "LOGGING_LIVE_REDIS_UNAVAILABLE",
    );
    expect(FakeEventSource.instances).toHaveLength(1);
    act(() => result.current.retryNow());
    expect(FakeEventSource.instances).toHaveLength(2);
  });

  it("reconnects transport failures with bounded backoff", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useLiveLogging());
    act(() => expect(result.current.start()).toBe(true));
    const source = FakeEventSource.instances[0];
    act(() => source.dispatch("error"));

    expect(result.current.connectionState).toBe("RECONNECTING");
    expect(result.current.reconnectAttempt).toBe(1);
    act(() => vi.advanceTimersByTime(999));
    expect(FakeEventSource.instances).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1));
    expect(FakeEventSource.instances).toHaveLength(2);
  });
});

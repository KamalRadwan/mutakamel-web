// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storageKey = "tenant_auth_session_event";

describe("tenant auth event ordering", () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("ignores a delayed storage event when a different latest event is saved", async () => {
    const coordinator = await import("./sessionCoordinator");
    const listener = vi.fn();
    const unsubscribe = coordinator.subscribeToTenantAuthEvents(listener);
    const latest = authEvent("latest-event", 2);
    const delayed = authEvent("delayed-event", 1);
    window.localStorage.setItem(storageKey, JSON.stringify(latest));

    window.dispatchEvent(new StorageEvent("storage", {
      key: storageKey,
      newValue: JSON.stringify(delayed),
    }));
    expect(listener).not.toHaveBeenCalled();

    window.dispatchEvent(new StorageEvent("storage", {
      key: storageKey,
      newValue: JSON.stringify(latest),
    }));
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(latest);
    unsubscribe();
  });

  it("ignores a delayed BroadcastChannel message after a newer event is saved", async () => {
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    const coordinator = await import("./sessionCoordinator");
    const listener = vi.fn();
    const unsubscribe = coordinator.subscribeToTenantAuthEvents(listener);
    const latest = authEvent("latest-event", 2);
    window.localStorage.setItem(storageKey, JSON.stringify(latest));

    FakeBroadcastChannel.instances[0]?.emit(authEvent("delayed-event", 1));
    expect(listener).not.toHaveBeenCalled();

    FakeBroadcastChannel.instances[0]?.emit(latest);
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(latest);
    unsubscribe();
  });

  it("still delivers the current tab event that is itself latest", async () => {
    const coordinator = await import("./sessionCoordinator");
    const listener = vi.fn();
    const unsubscribe = coordinator.subscribeToTenantAuthEvents(listener);

    const latest = coordinator.publishTenantAuthEvent(
      "session-updated",
      "session-a",
      true,
      {
        expiresIn: 600,
        sessionExpiresIn: 1_800,
        authorizationVersion: 1,
        profileVersion: 1,
      },
    );

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(latest);
    unsubscribe();
  });

  it("delivers a current-tab event when persistent storage is unavailable", async () => {
    const prior = authEvent("prior-event", 1);
    window.localStorage.setItem(storageKey, JSON.stringify(prior));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage unavailable", "SecurityError");
    });
    const coordinator = await import("./sessionCoordinator");
    const listener = vi.fn();
    const unsubscribe = coordinator.subscribeToTenantAuthEvents(listener);

    const current = coordinator.publishTenantAuthEvent(
      "session-ended",
      "session-a",
      true,
    );

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(current);
    unsubscribe();
  });
});

function authEvent(eventId: string, issuedAt: number) {
  return {
    realm: "tenant" as const,
    kind: "session-updated" as const,
    eventId,
    sourceId: `cross-tab-${eventId}`,
    issuedAt,
    sessionId: "session-a",
    timing: {
      expiresIn: 600,
      sessionExpiresIn: 1_800,
      authorizationVersion: 1,
      profileVersion: 1,
    },
  };
}

class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = [];

  private listener: ((event: MessageEvent) => void) | null = null;

  constructor(readonly name: string) {
    FakeBroadcastChannel.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void): void {
    if (type === "message") this.listener = listener;
  }

  postMessage(): void {}

  close(): void {}

  emit(data: unknown): void {
    this.listener?.({ data } as MessageEvent);
  }
}

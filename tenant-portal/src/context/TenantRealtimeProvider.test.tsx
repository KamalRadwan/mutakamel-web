// @vitest-environment jsdom

import { StrictMode, type ReactNode } from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import {
  GenerationBoundConnectionCoordinator,
  REALTIME_DEVICE_ID_STORAGE_KEY_V1,
  type ConnectionApplicationEventListener,
  type ConnectionTransport,
  type ConnectionTransportListener,
} from "@mutakamel/realtime-app-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tenantNotificationRuntime } from "@/lib/notifications/tenant-notification-runtime";
import {
  TENANT_REALTIME_SHELL_EVENTS,
  TenantRealtimeBinding,
  createTenantRealtimeCoordinator,
  type TenantRealtimeCoordinator,
} from "./TenantRealtimeProvider";

const generationA = "tenant:session-a:user-a";
const generationB = "tenant:session-b:user-b";

describe("TenantRealtimeBinding", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    tenantNotificationRuntime.clear();
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("keeps one physical connection through the React Strict Mode effect replay", async () => {
    const harness = createHarness();
    const view = render(
      <StrictMode>
        <Binding coordinator={harness.coordinator} generation={generationA} />
      </StrictMode>,
    );

    await waitFor(() => expect(harness.connects).toBe(1));
    expect(harness.transports).toHaveLength(1);
    expect(harness.coordinator.getSnapshot().ownerCount).toBe(1);

    view.unmount();
    await waitFor(() => expect(harness.disposals).toBe(1));
  });

  it("does not reconnect when a cookie refresh retains the same session generation", async () => {
    const harness = createHarness();
    const view = render(
      <Binding coordinator={harness.coordinator} generation={generationA} />,
    );
    await waitFor(() => expect(harness.connects).toBe(1));
    act(() => harness.transports[0].emitServer(
      "notification.created.v1",
      notificationCreatedEvent(),
    ));
    expect(tenantNotificationRuntime.getSnapshot().items).toHaveLength(1);

    view.rerender(
      <Binding coordinator={harness.coordinator} generation={generationA}>
        <span>refreshed</span>
      </Binding>,
    );

    expect(harness.connects).toBe(1);
    expect(harness.disposals).toBe(0);
    expect(harness.coordinator.getSnapshot().generation).toBe(generationA);
    expect(tenantNotificationRuntime.getSnapshot().items).toHaveLength(1);
  });

  it("clears the bound generation and transport immediately on logout", async () => {
    const harness = createHarness();
    const view = render(
      <Binding coordinator={harness.coordinator} generation={generationA} />,
    );
    await waitFor(() => expect(harness.connects).toBe(1));

    view.rerender(
      <Binding coordinator={harness.coordinator} generation={null} />,
    );

    expect(harness.coordinator.getSnapshot().generation).toBeNull();
    expect(harness.coordinator.getSnapshot().ownerCount).toBe(0);
    expect(harness.disposals).toBe(1);
    expect(tenantNotificationRuntime.getSnapshot()).toMatchObject({
      generation: null,
      items: [],
      unreadCount: 0,
    });
  });

  it("replaces the fence and transport when the authenticated account changes", async () => {
    const harness = createHarness();
    const view = render(
      <Binding coordinator={harness.coordinator} generation={generationA} />,
    );
    await waitFor(() => expect(harness.connects).toBe(1));
    act(() => harness.transports[0].emitServer(
      "notification.created.v1",
      notificationCreatedEvent(),
    ));
    expect(tenantNotificationRuntime.getSnapshot().items).toHaveLength(1);

    view.rerender(
      <Binding coordinator={harness.coordinator} generation={generationB} />,
    );

    await waitFor(() => expect(harness.connects).toBe(2));
    expect(harness.disposals).toBe(1);
    expect(harness.coordinator.getSnapshot().generation).toBe(generationB);
    expect(tenantNotificationRuntime.getSnapshot()).toMatchObject({
      generation: generationB,
      items: [],
      unreadCount: 0,
    });
  });

  it("pauses connection work while offline and resumes from the online event", async () => {
    const harness = createHarness();
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    render(
      <Binding coordinator={harness.coordinator} generation={generationA} />,
    );

    expect(harness.coordinator.getSnapshot().phase).toBe("offline");
    expect(harness.connects).toBe(0);

    act(() => window.dispatchEvent(new Event("online")));
    await waitFor(() => expect(harness.connects).toBe(1));
    expect(harness.coordinator.getSnapshot().networkOnline).toBe(true);

    act(() => window.dispatchEvent(new Event("offline")));
    expect(harness.coordinator.getSnapshot().networkOnline).toBe(false);
  });

  it("binds lifecycle and heartbeat but rejects synthetic activity", async () => {
    const harness = createHarness();
    render(
      <Binding coordinator={harness.coordinator} generation={generationA} />,
    );
    await waitFor(() => expect(harness.transports).toHaveLength(1));
    const transport = harness.transports[0];
    vi.useFakeTimers();

    act(() => transport.emitServer("session.ready.v1", readyEvent()));
    expect(eventNames(transport)).toContain("presence.lifecycle.v1");

    act(() => document.dispatchEvent(new Event("pointerdown")));
    expect(eventNames(transport)).not.toContain("presence.activity.v1");

    act(() => vi.advanceTimersByTime(30_000));
    expect(eventNames(transport)).toContain("presence.heartbeat.v1");
    const heartbeatCount = eventNames(transport).filter(
      (name) => name === "presence.heartbeat.v1",
    ).length;

    act(() => transport.emitServer(
      "system.server-draining.v1",
      serverEvent({ retryAfterMs: 5_000 }),
    ));
    act(() => vi.advanceTimersByTime(60_000));
    expect(eventNames(transport).filter(
      (name) => name === "presence.heartbeat.v1",
    )).toHaveLength(heartbeatCount);

    act(() => transport.emitServer("session.ready.v1", readyEvent()));
    act(() => vi.advanceTimersByTime(30_000));
    expect(eventNames(transport).filter(
      (name) => name === "presence.heartbeat.v1",
    )).toHaveLength(heartbeatCount + 1);
  });

  it("publishes validated notification and REST-resync hooks to the portal shell", async () => {
    const harness = createHarness();
    const notificationEvents: unknown[] = [];
    const resyncEvents: unknown[] = [];
    window.addEventListener(
      TENANT_REALTIME_SHELL_EVENTS.notificationCreated,
      (event) => notificationEvents.push((event as CustomEvent).detail),
    );
    window.addEventListener(
      TENANT_REALTIME_SHELL_EVENTS.resyncRequired,
      (event) => resyncEvents.push((event as CustomEvent).detail),
    );
    render(
      <Binding coordinator={harness.coordinator} generation={generationA} />,
    );
    await waitFor(() => expect(harness.transports).toHaveLength(1));
    const transport = harness.transports[0];

    act(() => transport.emitServer(
      "session.ready.v1",
      readyEvent(true),
    ));
    act(() => transport.emitServer(
      "notification.created.v1",
      notificationCreatedEvent(),
    ));
    act(() => transport.emitServer(
      "realtime.sync.required.v1",
      serverEvent({
        scope: "NOTIFICATIONS",
        reason: "NOTIFICATION_CURSOR_AMBIGUOUS",
        lastCommittedNotificationCursor: null,
      }),
    ));

    expect(notificationEvents).toHaveLength(1);
    expect(resyncEvents).toHaveLength(2);
    expect(notificationEvents[0]).toMatchObject({
      payload: { title: "New tenant notification" },
    });
    expect(tenantNotificationRuntime.getSnapshot()).toMatchObject({
      generation: generationA,
      unreadCount: 0,
      lastRealtimeCursor: "notification-cursor-1",
    });
    expect(eventNames(transport)).toContain("notification.received.v1");

    const conflictingReplay = notificationCreatedEvent();
    (conflictingReplay.payload as { notificationId: string }).notificationId =
      validUuid(13);
    act(() => transport.emitServer(
      "notification.created.v1",
      conflictingReplay,
    ));
    expect(eventNames(transport).filter(
      (name) => name === "notification.received.v1",
    )).toHaveLength(1);
    expect(tenantNotificationRuntime.getSnapshot().items).toHaveLength(1);
  });

  it("hydrates the notification cache through bounded REST on the first ready event", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      success: true,
      data: {
        items: [],
        unreadCount: 0,
        nextCursor: null,
        hasNext: false,
      },
    }), { status: 200, headers: { "content-type": "application/json" } }))));
    const harness = createHarness();
    render(
      <Binding coordinator={harness.coordinator} generation={generationA} />,
    );
    await waitFor(() => expect(harness.transports).toHaveLength(1));

    act(() => harness.transports[0].emitServer(
      "session.ready.v1",
      readyEvent(false),
    ));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/tenant/core/v1/notifications?limit=50"),
        expect.objectContaining({ method: "GET", credentials: "include" }),
      ));
    expect(eventNames(harness.transports[0])).not.toContain(
      "realtime.sync.request.v1",
    );
    expect(tenantNotificationRuntime.getSnapshot()).toMatchObject({
      generation: generationA,
      items: [],
      unreadCount: 0,
    });
  });

  it.each([
    ["system.access-revoked.v1", { reason: "ACCESS_REVOKED" }, "access_revoked", 403],
    ["system.tenant-unavailable.v1", { reason: "TENANT_SUSPENDED" }, "tenant_unavailable", 503],
  ] as const)("keeps REST auth after non-terminal revalidation for %s", async (
    eventName,
    payload,
    stopReason,
    revalidationStatus,
  ) => {
    seedSessionState("session-a");
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/tenant/core/v1/auth/me") {
        return jsonResponse({ code: "SESSION_REVALIDATION_RETAINED" }, revalidationStatus);
      }
      return jsonResponse({
        success: true,
        data: { items: [], unreadCount: 0, nextCursor: null, hasNext: false },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const harness = createHarness();
    const stops: unknown[] = [];
    const authEvents: unknown[] = [];
    window.addEventListener(
      TENANT_REALTIME_SHELL_EVENTS.permanentStop,
      (event) => stops.push((event as CustomEvent).detail),
    );
    window.addEventListener(
      "tenant-auth-session-event",
      (event) => authEvents.push((event as CustomEvent).detail),
    );
    render(
      <Binding coordinator={harness.coordinator} generation={generationA} />,
    );
    await waitFor(() => expect(harness.transports).toHaveLength(1));
    act(() => harness.transports[0].emitServer(
      "notification.created.v1",
      notificationCreatedEvent(),
    ));
    expect(tenantNotificationRuntime.getSnapshot().items).toHaveLength(1);

    act(() => harness.transports[0].emitServer(
      eventName,
      serverEvent(payload),
    ));

    expect(stops).toEqual([stopReason]);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/tenant/core/v1/auth/me",
      expect.objectContaining({ credentials: "include" }),
    ));
    expect(authEvents).toEqual([]);
    expect(window.sessionStorage.getItem("tenant_session_meta")).not.toBeNull();
    expect(tenantNotificationRuntime.getSnapshot()).toMatchObject({
      generation: null,
      items: [],
      unreadCount: 0,
    });
    expect(harness.coordinator.getSnapshot().phase).toBe("blocked");
  });

  it("ends REST auth only after a definitive server revalidation", async () => {
    seedSessionState("session-a");
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/api/tenant/core/v1/auth/me") {
        return jsonResponse({ code: "AUTH_SESSION_ENDED" }, 401);
      }
      return jsonResponse({
        success: true,
        data: { items: [], unreadCount: 0, nextCursor: null, hasNext: false },
      });
    }));
    const harness = createHarness();
    const authEvents: unknown[] = [];
    window.addEventListener(
      "tenant-auth-session-event",
      (event) => authEvents.push((event as CustomEvent).detail),
    );
    render(
      <Binding coordinator={harness.coordinator} generation={generationA} />,
    );
    await waitFor(() => expect(harness.transports).toHaveLength(1));

    act(() => harness.transports[0].emitServer(
      "system.access-revoked.v1",
      serverEvent({ reason: "ACCESS_REVOKED" }),
    ));

    await waitFor(() => expect(authEvents).toContainEqual(
      expect.objectContaining({ kind: "session-ended", sessionId: "session-a" }),
    ));
    expect(window.sessionStorage.getItem("tenant_session_meta")).toBeNull();
  });

  it("discards a credential completion from a stale authentication generation", async () => {
    const credentials = new Map<
      string,
      (credential: { generation: string; auth: Record<string, never> }) => void
    >();
    const transportGenerations: string[] = [];
    const coordinator = new GenerationBoundConnectionCoordinator<
      Record<string, never>
    >({
      mode: "on",
      credentialProvider: ({ generation }) =>
        new Promise((resolve) => credentials.set(generation, resolve)),
      transportFactory: ({ generation }) => {
        transportGenerations.push(generation);
        return inertTransport();
      },
    });
    const view = render(
      <Binding coordinator={coordinator} generation={generationA} />,
    );
    await waitFor(() => expect(credentials.has(generationA)).toBe(true));

    view.rerender(
      <Binding coordinator={coordinator} generation={generationB} />,
    );
    await waitFor(() => expect(credentials.has(generationB)).toBe(true));

    await act(async () => {
      credentials.get(generationA)?.({ generation: generationA, auth: {} });
      await Promise.resolve();
    });
    expect(transportGenerations).toEqual([]);

    await act(async () => {
      credentials.get(generationB)?.({ generation: generationB, auth: {} });
      await Promise.resolve();
    });
    expect(transportGenerations).toEqual([generationB]);
  });

  it("fails closed to off when NEXT_PUBLIC_REALTIME_MODE is absent", () => {
    vi.stubEnv("NEXT_PUBLIC_REALTIME_MODE", "");
    const coordinator = fakeCoordinator();
    render(
      <TenantRealtimeBinding coordinator={coordinator} generation={generationA}>
        <span />
      </TenantRealtimeBinding>,
    );
    expect(coordinator.setDeploymentMode).toHaveBeenCalledWith("off");
  });

  // This provider wraps every route, /login included. Building the coordinator
  // before checking the generation gave anyone who merely opened the sign-in
  // form a socket runtime and a device id persisted to localStorage, for a
  // session that does not exist.
  it("builds no coordinator, and no device identity, for a signed-out visitor", () => {
    const written: string[] = [];
    const setItem = window.localStorage.setItem.bind(window.localStorage);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(
      function (key: string, value: string) {
        written.push(key);
        setItem(key, value);
      },
    );

    render(
      <TenantRealtimeBinding generation={null} mode="on">
        <span>signed out</span>
      </TenantRealtimeBinding>,
    );

    expect(written).toEqual([]);
    expect(
      window.localStorage.getItem(REALTIME_DEVICE_ID_STORAGE_KEY_V1),
    ).toBeNull();
  });

  it("creates its browser identity without reading token or session storage", () => {
    const reads: string[] = [];
    const originalGetItem = window.localStorage.getItem.bind(window.localStorage);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (key) {
      reads.push(key);
      return originalGetItem(key);
    });

    const coordinator = createTenantRealtimeCoordinator();
    coordinator.dispose();

    expect(reads).toEqual([REALTIME_DEVICE_ID_STORAGE_KEY_V1]);
    expect(reads).not.toContain("tenant_session_meta");
    expect(reads).not.toContain("access_token");
    expect(reads).not.toContain("refresh_token");
  });
});

function Binding({
  coordinator,
  generation,
  children,
}: {
  coordinator: TenantRealtimeCoordinator;
  generation: string | null;
  children?: ReactNode;
}) {
  return (
    <TenantRealtimeBinding
      coordinator={coordinator}
      generation={generation}
      mode="on"
    >
      {children ?? <span />}
    </TenantRealtimeBinding>
  );
}

function createHarness() {
  const transports: TestTransport[] = [];
  let connects = 0;
  let disposals = 0;
  const coordinator = new GenerationBoundConnectionCoordinator<
    Record<string, never>
  >({
    mode: "on",
    credentialProvider: ({ generation }) => ({ generation, auth: {} }),
    transportFactory: () => {
      const transport = inertTransport({
        onConnect: () => { connects += 1; },
        onDispose: () => { disposals += 1; },
      });
      transports.push(transport);
      return transport;
    },
  });
  return {
    coordinator,
    transports,
    get connects() { return connects; },
    get disposals() { return disposals; },
  };
}

function inertTransport(options: {
  onConnect?: () => void;
  onDispose?: () => void;
} = {}): TestTransport {
  let applicationListener: ConnectionApplicationEventListener | null = null;
  let connectionListener: ConnectionTransportListener | null = null;
  const emitted: Array<{ eventName: string; payload: object }> = [];
  return {
    emitted,
    subscribe(listener) {
      connectionListener = listener;
      return () => { connectionListener = null; };
    },
    subscribeApplicationEvents(listener) {
      applicationListener = listener;
      return () => { applicationListener = null; };
    },
    emitApplicationEvent(eventName, payload, acknowledge) {
      emitted.push({ eventName, payload });
      if (acknowledge) acknowledge(successAcknowledgement(eventName, payload));
    },
    updateAuth() {},
    connect() {
      options.onConnect?.();
      connectionListener?.({ type: "connected", recovered: false });
    },
    dispose() { options.onDispose?.(); },
    emitServer(eventName, payload, argumentCount = 1) {
      applicationListener?.({ eventName, payload, argumentCount });
    },
  };
}

interface TestTransport extends ConnectionTransport<Record<string, never>> {
  readonly emitted: Array<{ eventName: string; payload: object }>;
  emitServer(eventName: string, payload: unknown, argumentCount?: number): void;
}

function successAcknowledgement(eventName: string, payload: object) {
  const requestId = (payload as { requestId?: string }).requestId ?? validUuid(90);
  return {
    contractVersion: 1,
    ok: true,
    requestId,
    serverTime: "2026-08-14T10:00:00.000Z",
    data: eventName === "notification.received.v1"
      ? { accepted: true }
      : eventName === "realtime.sync.request.v1"
        ? { snapshotScheduled: true, restResyncRequired: false }
        : { stateVersion: 2 },
  };
}

function validUuid(suffix: number): string {
  return `019ff4ca-b3c1-73a3-b27e-${suffix.toString().padStart(12, "0")}`;
}

function fakeCoordinator() {
  return {
    getSnapshot: vi.fn(() => ({ generation: null })),
    replaceGeneration: vi.fn(),
    acquire: vi.fn(() => ({ generation: generationA, release: vi.fn() })),
    clearGeneration: vi.fn(),
    setDeploymentMode: vi.fn(),
    setNetworkOnline: vi.fn(),
    subscribeApplicationEvents: vi.fn(() => () => undefined),
    emitApplicationEvent: vi.fn(),
    requestAccessRefresh: vi.fn(() => false),
    stopCurrentGeneration: vi.fn(),
    dispose: vi.fn(),
  } satisfies TenantRealtimeCoordinator;
}

function eventNames(transport: TestTransport): string[] {
  return transport.emitted.map((event) => event.eventName);
}

function serverEvent(payload: object) {
  return {
    contractVersion: 1,
    eventId: validUuid(1),
    occurredAt: "2026-08-14T10:00:00.000Z",
    correlationId: validUuid(2),
    payload,
  };
}

function readyEvent(notificationResyncRequired = false) {
  return {
    ...serverEvent({
      recovered: false,
      recoveryComplete: true,
      capabilities: {
        notifications: { receive: true },
        presence: { publishSelf: true, watchMode: "SELF" },
      },
      grantedCapabilities: ["NOTIFICATIONS", "PRESENCE_SELF"],
      notificationResyncRequired,
      lastNotificationCursorAccepted: !notificationResyncRequired,
    }),
    presenceGeneration: validUuid(3),
    logicalSessionId: validUuid(4),
    sessionStartedAt: "2026-08-14T09:00:00.000Z",
    stateVersion: 1,
  };
}

function notificationCreatedEvent() {
  return serverEvent({
    notificationId: validUuid(10),
    recipientId: validUuid(11),
    deliveryEventId: validUuid(12),
    cursor: "notification-cursor-1",
    type: "tenant.test",
    title: "New tenant notification",
    body: "A validated notification body.",
    priority: "P2_NORMAL",
    entity: null,
    action: null,
    createdAt: "2026-08-14T10:00:00.000Z",
    expiresAt: null,
    silent: false,
    metadata: {},
  });
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function seedSessionState(sessionId: string): void {
  window.sessionStorage.setItem("tenant_session_meta", JSON.stringify({
    savedAt: Date.now(),
    expiresIn: 600,
    sessionExpiresIn: 1_800,
    tokenType: "Bearer",
    sessionId,
    remember: true,
    authorizationVersion: 1,
    profileVersion: 1,
    authEventId: `event-${sessionId}`,
  }));
}

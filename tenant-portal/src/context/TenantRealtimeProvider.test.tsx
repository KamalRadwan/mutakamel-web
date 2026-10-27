// @vitest-environment jsdom

import { StrictMode, type ReactNode } from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import {
  GenerationBoundConnectionCoordinator,
  REALTIME_DEVICE_ID_STORAGE_KEY_V1,
  type ConnectionApplicationEventListener,
  type ConnectionFailureDisposition,
  type ConnectionTransport,
  type ConnectionTransportListener,
} from "@mutakamel/realtime-app-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tenantNotificationRuntime } from "@/lib/notifications/tenant-notification-runtime";
import { coordinateTenantSessionRefresh } from "@/lib/api/axiosClient";
import { OfflineBanner, useConnectivity } from "@/design-system";
import { en } from "@/i18n/dictionaries/en";
import {
  TENANT_REALTIME_SHELL_EVENTS,
  TenantRealtimeBinding,
  createTenantRealtimeCoordinator,
  type TenantRealtimeCoordinator,
} from "./TenantRealtimeProvider";

const generationA = "tenant:session-a:user-a";
const generationB = "tenant:session-b:user-b";

describe("TenantRealtimeBinding", () => {
  it.each([
    ["stop", "classified_permanent"],
    ["refresh_credential", "credential_refresh_failed"],
    ["retry", "reconnect_attempts_exhausted"],
  ] as const)("shows coordinator failure %s while the browser stays online", async (disposition, reason) => {
    let rejectHandshake = true;
    const harness = createHarness(
      () => Promise.reject(new Error("refresh rejected")),
      { disposition, maxAttempts: 0, rejectHandshake: () => rejectHandshake },
    );
    const view = render(<Binding coordinator={harness.coordinator} generation={generationA}><ConnectivityProbe /></Binding>);
    await waitFor(() => expect(harness.coordinator.getSnapshot().blockedReason).toBe(reason));
    expect(navigator.onLine).toBe(true);
    expect(view.getByRole("status")).toHaveTextContent(
      reason === "credential_refresh_failed" ? en.connectivity.stopReasons.refresh_failed : en.connectivity.stopped,
    );
    expect(view.getByRole("button", { name: en.connectivity.reload })).toBeInTheDocument();

    // A replacement auth generation must discard the old stop and its reason.
    rejectHandshake = false;
    view.rerender(<Binding coordinator={harness.coordinator} generation={generationB}><ConnectivityProbe /></Binding>);
    await waitFor(() => expect(harness.coordinator.getSnapshot().phase).toBe("connected"));
    act(() => harness.transports.at(-1)!.emitServer("session.ready.v1", readyEvent()));
    expect(view.queryByRole("status")).toBeNull();
  });

  it("reads an already blocked snapshot when the banner mounts later", async () => {
    const harness = createHarness(undefined, { disposition: "stop", rejectHandshake: () => true });
    const view = render(<Binding coordinator={harness.coordinator} generation={generationA} />);
    await waitFor(() => expect(harness.coordinator.getSnapshot().phase).toBe("blocked"));
    view.rerender(<Binding coordinator={harness.coordinator} generation={generationA}><ConnectivityProbe /></Binding>);
    expect(view.getByRole("status")).toHaveTextContent(en.connectivity.stopped);
  });

  it("shows retrying while the coordinator waits for another attempt", async () => {
    const harness = createHarness(undefined, { disposition: "retry", rejectHandshake: () => true });
    const view = render(<Binding coordinator={harness.coordinator} generation={generationA}><ConnectivityProbe /></Binding>);
    await waitFor(() => expect(harness.coordinator.getSnapshot().phase).toBe("waiting_to_reconnect"));
    expect(view.getByRole("status")).toHaveTextContent(en.connectivity.retrying);
    expect(view.queryByRole("button")).toBeNull();
  });

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("REST unavailable")));
  });

  afterEach(() => {
    tenantNotificationRuntime.clear();
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it.each(["off", "on"] as const)("hydrates over REST with realtime %s and no handshake", async (mode) => {
    const fetcher = vi.fn().mockResolvedValue(notificationPageResponse());
    vi.stubGlobal("fetch", fetcher);
    const harness = createHarness();
    render(<TenantRealtimeBinding coordinator={harness.coordinator} generation={generationA} mode={mode}><span /></TenantRealtimeBinding>);

    await waitFor(() => expect(tenantNotificationRuntime.getSnapshot().loadState).toBe("ready"));
    expect(tenantNotificationRuntime.getSnapshot()).toMatchObject({ generation: generationA, unreadCount: 9 });
    expect(tenantNotificationRuntime.getSnapshot().items).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
    if (mode === "off") expect(harness.connects).toBe(0);
  });

  it("recovers failed hydration on foreground focus without a socket handshake", async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new TypeError("REST unavailable"))
      .mockImplementation(() => Promise.resolve(notificationPageResponse()));
    vi.stubGlobal("fetch", fetcher);
    const harness = createHarness();
    const view = render(<TenantRealtimeBinding coordinator={harness.coordinator} generation={generationA} mode="off"><span /></TenantRealtimeBinding>);
    await waitFor(() => expect(tenantNotificationRuntime.getSnapshot().loadState).toBe("error"));

    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    act(() => window.dispatchEvent(new Event("focus")));
    expect(fetcher).toHaveBeenCalledTimes(1);
    visibility.mockReturnValue("visible");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await waitFor(() => expect(tenantNotificationRuntime.getSnapshot().loadState).toBe("ready"));
    expect(tenantNotificationRuntime.getSnapshot().unreadCount).toBe(9);
    expect(fetcher).toHaveBeenCalledTimes(2);

    view.unmount();
    act(() => window.dispatchEvent(new Event("focus")));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each(["503", "authority"] as const)("recovers a %s resync failure on a quiet healthy socket", async (failure) => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(notificationPageResponse()));
    vi.stubGlobal("fetch", fetcher);
    const harness = createHarness();
    render(<Binding coordinator={harness.coordinator} generation={generationA} />);
    await vi.waitFor(() => {
      expect(tenantNotificationRuntime.getSnapshot().loadState).toBe("ready");
      expect(harness.transports).toHaveLength(1);
    });
    const saved = tenantNotificationRuntime.getSnapshot();
    if (failure === "503") {
      fetcher.mockImplementationOnce(() => Promise.resolve(jsonResponse({ message: "Unavailable" }, 503)));
    } else {
      const first = await notificationPageResponse().json() as { data: Record<string, unknown> };
      fetcher
        .mockImplementationOnce(() => Promise.resolve(jsonResponse({ data: { ...first.data, nextCursor: "next-page", hasNext: true } })))
        .mockImplementationOnce(() => Promise.resolve(jsonResponse({ data: { ...first.data, unreadCount: 8 } })));
    }
    act(() => harness.transports[0].emitServer("session.ready.v1", readyEvent(true)));
    await vi.waitFor(() => expect(tenantNotificationRuntime.getSnapshot().loadState).toBe("error"));
    expect(tenantNotificationRuntime.getSnapshot().items).toBe(saved.items);
    expect(tenantNotificationRuntime.getSnapshot().unreadCount).toBe(9);
    const failedCalls = fetcher.mock.calls.length;

    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });

    expect(tenantNotificationRuntime.getSnapshot().loadState).toBe("ready");
    expect(fetcher).toHaveBeenCalledTimes(failedCalls + 1);
    expect(harness.connects).toBe(1);
  });

  it("bounds automatic retries and recovers on online after exhaustion", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ message: "Unavailable" }, 503)));
    vi.stubGlobal("fetch", fetcher);
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const harness = createHarness();
    render(<TenantRealtimeBinding coordinator={harness.coordinator} generation={generationA} mode="off"><span /></TenantRealtimeBinding>);
    await vi.waitFor(() => expect(tenantNotificationRuntime.getSnapshot().loadState).toBe("error"));
    for (const delay of [1_000, 2_000, 4_000]) {
      await act(async () => { await vi.advanceTimersByTimeAsync(delay); });
    }
    expect(fetcher).toHaveBeenCalledTimes(4);
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(tenantNotificationRuntime.getSnapshot()).toMatchObject({ loadState: "error", items: [] });

    fetcher.mockImplementation(() => Promise.resolve(notificationPageResponse()));
    act(() => window.dispatchEvent(new Event("online")));
    await vi.waitFor(() => expect(tenantNotificationRuntime.getSnapshot().loadState).toBe("ready"));
    expect(fetcher).toHaveBeenCalledTimes(5);
  });

  it("cancels pending recovery when the authentication generation ends", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockRejectedValue(new TypeError("REST unavailable"));
    vi.stubGlobal("fetch", fetcher);
    const harness = createHarness();
    const view = render(<TenantRealtimeBinding coordinator={harness.coordinator} generation={generationA} mode="off"><span /></TenantRealtimeBinding>);
    await vi.waitFor(() => expect(tenantNotificationRuntime.getSnapshot().loadState).toBe("error"));
    view.rerender(<TenantRealtimeBinding coordinator={harness.coordinator} generation={null} mode="off"><span /></TenantRealtimeBinding>);
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(tenantNotificationRuntime.getSnapshot()).toMatchObject({ generation: null, loadState: "idle", items: [] });
  });

  it("does not automatically retry an authoritative permission denial", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ message: "Forbidden" }, 403)));
    vi.stubGlobal("fetch", fetcher);
    const harness = createHarness();
    render(<TenantRealtimeBinding coordinator={harness.coordinator} generation={generationA} mode="off"><span /></TenantRealtimeBinding>);
    await vi.waitFor(() => expect(tenantNotificationRuntime.getSnapshot().loadState).toBe("forbidden"));
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("does not hydrate a notification cache without read authorization", () => {
    const harness = createHarness();
    render(<TenantRealtimeBinding coordinator={harness.coordinator} generation={generationA} mode="off" notificationsAuthorized={false}><span /></TenantRealtimeBinding>);
    expect(fetch).not.toHaveBeenCalled();
    expect(tenantNotificationRuntime.getSnapshot().generation).toBeNull();
  });

  it("loads on a grant and clears notifications on revocation while retaining realtime", async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(notificationPageResponse()));
    vi.stubGlobal("fetch", fetcher);
    const harness = createHarness();
    const binding = (authorized: boolean) => (
      <TenantRealtimeBinding coordinator={harness.coordinator} generation={generationA} mode="on" notificationsAuthorized={authorized}>
        <span />
      </TenantRealtimeBinding>
    );
    const view = render(binding(false));
    await waitFor(() => expect(harness.connects).toBe(1));
    act(() => {
      harness.transports[0].emitServer("session.ready.v1", readyEvent());
      harness.transports[0].emitServer("notification.created.v1", notificationCreatedEvent());
      window.dispatchEvent(new Event("focus"));
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(tenantNotificationRuntime.getSnapshot().items).toHaveLength(0);
    view.rerender(binding(true));
    await waitFor(() => expect(tenantNotificationRuntime.getSnapshot().loadState).toBe("ready"));
    expect(tenantNotificationRuntime.getSnapshot().items).toHaveLength(1);
    const requests = fetcher.mock.calls.length;
    view.rerender(binding(false));
    expect(tenantNotificationRuntime.getSnapshot()).toMatchObject({ generation: null, items: [], unreadCount: 0 });
    act(() => {
      harness.transports[0].emitServer("notification.created.v1", notificationCreatedEvent());
      window.dispatchEvent(new Event("focus"));
    });
    expect(fetcher).toHaveBeenCalledTimes(requests);
    expect(tenantNotificationRuntime.getSnapshot().items).toHaveLength(0);
    expect(harness.coordinator.getSnapshot().generation).toBe(generationA);
    expect(harness.connects).toBe(1);
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
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({
      success: true,
      data: {
        items: [], unreadCount: 0, unreadRevision: 1,
        unreadChangedAt: "2026-08-14T10:00:00.000Z",
        nextCursor: null, hasNext: false,
      },
    })));
    vi.stubGlobal("fetch", fetchMock);
    const harness = createHarness();
    render(
      <Binding coordinator={harness.coordinator} generation={generationA} />,
    );
    await waitFor(() => expect(harness.transports).toHaveLength(1));
    const transport = harness.transports[0];
    vi.useFakeTimers();

    await act(async () => transport.emitServer("session.ready.v1", readyEvent()));
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
    act(() => transport.disconnectFromServer());
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(eventNames(transport).filter(
      (name) => name === "presence.heartbeat.v1",
    )).toHaveLength(heartbeatCount);

    expect(harness.transports).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const freshTransport = harness.transports[1];
    await act(async () => freshTransport.emitServer("session.ready.v1", readyEvent(true)));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    act(() => vi.advanceTimersByTime(30_000));
    expect(eventNames(freshTransport).filter(
      (name) => name === "presence.heartbeat.v1",
    )).toHaveLength(1);
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

  it.each([501, 2_000])("hydrates and reconnects a %i-record inbox through bounded REST", async (total) => {
    let unreadRevision = 1;
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      const params = new URL(url, "http://localhost").searchParams;
      const offset = Number(params.get("cursor") ?? 0);
      return Promise.resolve(jsonResponse({
        success: true,
        data: {
          items: Array.from({ length: Math.min(50, total - offset) }, (_, index) => {
            const suffix = total - offset - index;
            const read = unreadRevision === 2 && offset === 0 && index === 0;
            return {
              id: validUuid(suffix),
              recipientId: validUuid(suffix + total),
              sourceApp: "core-app",
              notificationType: "tenant.test",
              priority: "P2_NORMAL",
              title: `Notification ${suffix}`,
              body: "Validated body",
              actionUrl: null,
              entityType: null,
              entityId: null,
              channels: ["IN_APP"],
              metadata: {},
              createdAt: "2026-08-14T10:00:00.000Z",
              readAt: read ? "2026-08-14T10:05:00.000Z" : null,
              acknowledgedAt: null,
              deliveredAt: null,
              recipientStateVersion: read ? 1 : 0,
            };
          }),
          unreadCount: total - (unreadRevision - 1),
          unreadRevision,
          unreadChangedAt: unreadRevision === 1
            ? "2026-08-14T10:00:00.000Z"
            : "2026-08-14T10:05:00.000Z",
          nextCursor: offset + 50 < total ? String(offset + 50) : null,
          hasNext: offset + 50 < total,
        },
      }));
    }));
    const harness = createHarness();
    render(
      <Binding coordinator={harness.coordinator} generation={generationA} />,
    );
    await waitFor(() => expect(harness.transports).toHaveLength(1));

    act(() => harness.transports[0].emitServer(
      "session.ready.v1",
      readyEvent(false),
    ));

    await waitFor(() => expect(tenantNotificationRuntime.getSnapshot().items).toHaveLength(500));
    expect(fetch).toHaveBeenCalledTimes(10);
    expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/tenant/core/v1/notifications?limit=50"),
        expect.objectContaining({ method: "GET", credentials: "include" }),
    );
    expect(eventNames(harness.transports[0])).not.toContain(
      "realtime.sync.request.v1",
    );
    expect(tenantNotificationRuntime.getSnapshot()).toMatchObject({
      generation: generationA,
      unreadCount: total,
    });
    expect(tenantNotificationRuntime.getUnreadOrderingRevision()).toBe(1);

    unreadRevision = 2;
    act(() => harness.transports[0].emitServer(
      "session.ready.v1",
      readyEvent(true),
    ));

    await waitFor(() => expect(tenantNotificationRuntime.getUnreadOrderingRevision()).toBe(2));
    expect(fetch).toHaveBeenCalledTimes(20);
    expect(tenantNotificationRuntime.getSnapshot().items).toHaveLength(500);
    expect(tenantNotificationRuntime.getSnapshot().unreadCount).toBe(total - 1);
    expect(tenantNotificationRuntime.getSnapshot().items[0]).toMatchObject({
      id: validUuid(total),
      readAt: "2026-08-14T10:05:00.000Z",
      recipientStateVersion: 1,
    });
  });

  it("refreshes an expired socket once alongside REST and reconnects the same auth generation", async () => {
    seedSessionState("session-a");
    vi.spyOn(document, "cookie", "get").mockReturnValue("__Host-mutakamel-tenant-csrf=csrf-proof");
    let completeRefresh!: (response: Response) => void;
    const fetchMock = vi.fn((url: string) => url === "/api/tenant/core/v1/auth/refresh"
      ? new Promise<Response>((resolve) => { completeRefresh = resolve; })
      : Promise.resolve(notificationPageResponse()));
    vi.stubGlobal("fetch", fetchMock);
    const harness = createHarness(() => coordinateTenantSessionRefresh("session-a"));
    const stopped = vi.fn();
    const ready = vi.fn();
    window.addEventListener(TENANT_REALTIME_SHELL_EVENTS.permanentStop, stopped);
    window.addEventListener(TENANT_REALTIME_SHELL_EVENTS.sessionReady, ready);
    try {
      render(<Binding coordinator={harness.coordinator} generation={generationA} />);
      await waitFor(() => expect(harness.transports).toHaveLength(1));
      const oldTransport = harness.transports[0];
      await act(async () => oldTransport.emitServer("session.ready.v1", readyEvent()));

      act(() => oldTransport.emitServer(
        "system.access-revoked.v1", serverEvent({ reason: "TOKEN_EXPIRED" }),
      ));
      await waitFor(() => expect(completeRefresh).toBeTypeOf("function"));
      expect(harness.transports).toHaveLength(1);
      const concurrentRestRefresh = coordinateTenantSessionRefresh("session-a");
      await act(async () => {
        completeRefresh(refreshSessionResponse());
        await concurrentRestRefresh;
      });
      await waitFor(() => expect(harness.transports).toHaveLength(2));
      await act(async () => harness.transports[1].emitServer("session.ready.v1", readyEvent()));

      expect(fetchMock.mock.calls.filter(([url]) => url === "/api/tenant/core/v1/auth/refresh")).toHaveLength(1);
      expect(harness.coordinator.getSnapshot()).toMatchObject({
        generation: generationA, phase: "connected", blockedReason: null,
      });
      expect(ready).toHaveBeenCalledTimes(2);
      expect((ready.mock.calls[1][0] as CustomEvent).detail).toMatchObject({
        logicalSessionId: readyEvent().logicalSessionId,
        presenceGeneration: readyEvent().presenceGeneration,
      });
      expect(tenantNotificationRuntime.getSnapshot().generation).toBe(generationA);
      expect(stopped).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener(TENANT_REALTIME_SHELL_EVENTS.permanentStop, stopped);
      window.removeEventListener(TENANT_REALTIME_SHELL_EVENTS.sessionReady, ready);
    }
  });

  it.each([401, 503])("does not loop when expired-socket REST refresh returns %i", async (status) => {
    seedSessionState("session-a");
    vi.spyOn(document, "cookie", "get").mockReturnValue("__Host-mutakamel-tenant-csrf=csrf-proof");
    const fetchMock = vi.fn((url: string) => Promise.resolve(
      url === "/api/tenant/core/v1/auth/refresh"
        ? jsonResponse({ code: status === 401 ? "INVALID_REFRESH_TOKEN" : "SERVICE_UNAVAILABLE" }, status)
        : notificationPageResponse(),
    ));
    vi.stubGlobal("fetch", fetchMock);
    const harness = createHarness(() => coordinateTenantSessionRefresh("session-a"));
    render(<Binding coordinator={harness.coordinator} generation={generationA} />);
    await waitFor(() => expect(harness.transports).toHaveLength(1));
    const oldTransport = harness.transports[0];
    act(() => oldTransport.emitServer("session.ready.v1", readyEvent()));
    act(() => oldTransport.emitServer(
      "system.access-revoked.v1", serverEvent({ reason: "TOKEN_EXPIRED" }),
    ));
    await waitFor(() => expect(harness.coordinator.getSnapshot()).toMatchObject({
      phase: "blocked", blockedReason: "credential_refresh_failed",
    }));
    act(() => {
      oldTransport.emitServer("system.access-revoked.v1", serverEvent({ reason: "TOKEN_EXPIRED" }));
      window.dispatchEvent(new Event("online"));
    });
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/tenant/core/v1/auth/refresh")).toHaveLength(1);
    expect(harness.transports).toHaveLength(1);
  });

  it.each([
    ["system.access-revoked.v1", { reason: "ACCESS_REVOKED" }, "access_revoked", 403],
    ["system.access-revoked.v1", { reason: "SESSION_INVALIDATED" }, "access_revoked", 403],
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
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/tenant/core/v1/auth/refresh")).toHaveLength(0);
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

function ConnectivityProbe() {
  const connectivity = useConnectivity();
  return <OfflineBanner {...connectivity} labels={en.connectivity} onReload={() => undefined} />;
}

function createHarness(refresh?: () => Promise<void>, options: {
  disposition?: ConnectionFailureDisposition;
  maxAttempts?: number;
  rejectHandshake?: () => boolean;
} = {}) {
  const transports: TestTransport[] = [];
  let connects = 0;
  let disposals = 0;
  const coordinator = new GenerationBoundConnectionCoordinator<
    Record<string, never>
  >({
    mode: "on",
    classifyFailure: options.disposition ? () => options.disposition! : undefined,
    reconnectPolicy: { maxAttempts: options.maxAttempts ?? null },
    credentialProvider: ({ generation, reason }) => reason === "token_refresh" && refresh
      ? refresh().then(() => ({ generation, auth: {} }))
      : { generation, auth: {} },
    transportFactory: () => {
      const transport = inertTransport({
        rejectHandshake: options.rejectHandshake,
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
  rejectHandshake?: () => boolean;
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
      connectionListener?.(options.rejectHandshake?.()
        ? { type: "connect_error", cause: new Error("handshake rejected") }
        : { type: "connected", recovered: false });
    },
    dispose() { options.onDispose?.(); },
    disconnectFromServer() {
      connectionListener?.({ type: "disconnected", reason: "io server disconnect" });
    },
    emitServer(eventName, payload, argumentCount = 1) {
      applicationListener?.({ eventName, payload, argumentCount });
    },
  };
}

interface TestTransport extends ConnectionTransport<Record<string, never>> {
  readonly emitted: Array<{ eventName: string; payload: object }>;
  emitServer(eventName: string, payload: unknown, argumentCount?: number): void;
  disconnectFromServer(): void;
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
    getSnapshot: vi.fn(() => ({
      mode: "on" as const, phase: "idle" as const, generation: null,
      ownerCount: 0, reconnectAttempt: 0, nextReconnectAt: null,
      applicationDeliveryEnabled: true, networkOnline: true, recovered: null,
      lastFailureSource: null, blockedReason: null,
    })),
    subscribe: vi.fn(() => () => undefined),
    replaceGeneration: vi.fn(),
    acquire: vi.fn(() => ({ generation: generationA, release: vi.fn() })),
    clearGeneration: vi.fn(),
    setDeploymentMode: vi.fn(),
    setNetworkOnline: vi.fn(),
    subscribeApplicationEvents: vi.fn(() => () => undefined),
    emitApplicationEvent: vi.fn(),
    requestAccessRefresh: vi.fn(() => false),
    requestServerDrainReconnect: vi.fn(),
    stopCurrentGeneration: vi.fn(),
    dispose: vi.fn(),
  } satisfies TenantRealtimeCoordinator;
}

function eventNames(transport: TestTransport): string[] {
  return transport.emitted.map((event) => event.eventName);
}

function serverEvent<T extends object>(payload: T) {
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

function notificationPageResponse(): Response {
  const item = notificationCreatedEvent().payload;
  return jsonResponse({ success: true, data: {
    items: [{
      id: item.notificationId, recipientId: item.recipientId,
      sourceApp: "core-app", notificationType: item.type, priority: item.priority,
      title: item.title, body: item.body, actionUrl: null,
      entityType: null, entityId: null, channels: ["IN_APP"], metadata: {},
      createdAt: item.createdAt, readAt: null, acknowledgedAt: null, deliveredAt: null,
      recipientStateVersion: 0,
    }],
    unreadCount: 9, unreadRevision: 1, unreadChangedAt: "2026-08-14T10:00:00.000Z",
    nextCursor: null, hasNext: false,
  } });
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

function refreshSessionResponse(): Response {
  return jsonResponse({ data: {
    tokenType: "Bearer", expiresIn: 600, sessionExpiresIn: 1_800,
    session: {
      id: "session-a", clientId: "mutakamel-tenant-web", clientType: "WEB",
      createdAt: "2026-08-14T09:00:00.000Z", lastRefreshAt: null,
      lastUserActivityAt: null, idleExpiresAt: "2026-08-14T10:30:00.000Z",
      absoluteExpiresAt: "2026-08-15T10:00:00.000Z", refreshUseCount: "1",
      accessIssueCount: "2", credentialVersion: 1, authorizationVersion: 1, profileVersion: 1,
    },
  } });
}

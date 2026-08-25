"use client";

import { useEffect, type ReactNode } from "react";
import {
  GenerationBoundConnectionCoordinator,
  RealtimeApplicationClient,
  RuntimeConnectionSingleton,
  classifyRealtimeConnectionFailure,
  createBrowserClientIdentifiers,
  createGenerationBoundRealtimeHandshake,
  createSocketIoTransportFactory,
  parseRealtimeDeploymentMode,
  type ConnectionLease,
  type RealtimeApplicationConnection,
  type RealtimeApplicationStopReason,
  type RealtimeDeploymentMode,
  type RealtimeHandshakeAuthV1,
} from "@mutakamel/realtime-app-client";
import { useTenantAuth } from "@/context/AuthContext";
import {
  clearLocalTenantAuthState,
  getStoredTenantSessionMeta,
  refreshTenantCookieSession,
} from "@/lib/api/axiosClient";
import { publishTenantAuthEvent } from "@/lib/auth/sessionCoordinator";
import {
  resyncTenantNotifications,
  tenantNotificationRuntime,
} from "@/lib/notifications/tenant-notification-runtime";

export interface TenantRealtimeCoordinator extends RealtimeApplicationConnection {
  getSnapshot(): { readonly generation: string | null };
  replaceGeneration(generation: string): void;
  acquire(generation: string): ConnectionLease;
  clearGeneration(expectedGeneration?: string): void;
  setDeploymentMode(mode: RealtimeDeploymentMode): void;
  setNetworkOnline(online: boolean): void;
  dispose(): void;
}

export const TENANT_REALTIME_SHELL_EVENTS = Object.freeze({
  sessionReady: "tenant-realtime:session-ready",
  notificationCreated: "tenant-realtime:notification-created",
  notificationUpdated: "tenant-realtime:notification-updated",
  notificationUnreadCountChanged:
    "tenant-realtime:notification-unread-count-changed",
  resyncRequired: "tenant-realtime:resync-required",
  serverDraining: "tenant-realtime:server-draining",
  permanentStop: "tenant-realtime:permanent-stop",
} as const);

interface TenantRealtimeProviderProps {
  children: ReactNode;
  /** Test seam; production always uses the package-backed runtime singleton. */
  coordinator?: TenantRealtimeCoordinator;
  mode?: RealtimeDeploymentMode;
}

const runtime = new RuntimeConnectionSingleton<TenantRealtimeCoordinator>();

export function TenantRealtimeProvider({
  children,
  coordinator: suppliedCoordinator,
  mode: suppliedMode,
}: TenantRealtimeProviderProps) {
  const { realtimeAuthGeneration } = useTenantAuth();
  return (
    <TenantRealtimeBinding
      generation={realtimeAuthGeneration}
      coordinator={suppliedCoordinator}
      mode={suppliedMode}
    >
      {children}
    </TenantRealtimeBinding>
  );
}

export function TenantRealtimeBinding({
  children,
  generation,
  coordinator: suppliedCoordinator,
  mode: suppliedMode,
}: TenantRealtimeProviderProps & { generation: string | null }) {
  const mode = suppliedMode ?? readDeploymentMode();

  useEffect(() => {
    const coordinator =
      suppliedCoordinator ??
      runtime.getOrCreate(createTenantRealtimeCoordinator);
    coordinator.setDeploymentMode(mode);
    coordinator.setNetworkOnline(navigator.onLine);

    const onOnline = () => coordinator.setNetworkOnline(true);
    const onOffline = () => coordinator.setNetworkOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    let lease: ConnectionLease | null = null;
    let applicationClient: RealtimeApplicationClient | null = null;
    let active = true;
    let notificationCacheInitialized = false;
    let resyncInFlight: Promise<void> | null = null;
    let queuedResyncCursor: string | null | undefined;
    const applicationUnsubscribers: Array<() => void> = [];
    if (generation === null) {
      coordinator.clearGeneration();
      tenantNotificationRuntime.clear();
    } else {
      tenantNotificationRuntime.bindGeneration(generation);
      const boundGeneration = coordinator.getSnapshot().generation;
      if (
        boundGeneration !== null &&
        boundGeneration !== generation
      ) {
        coordinator.replaceGeneration(generation);
      }
      lease = coordinator.acquire(generation);
      applicationClient = new RealtimeApplicationClient({
        connection: coordinator,
        onPermanentStop: handlePermanentStop,
      });
      const requestNotificationResync = (
        lastCommittedCursor: string | null,
      ): void => {
        queuedResyncCursor = lastCommittedCursor;
        if (resyncInFlight !== null) return;
        const run = async (): Promise<void> => {
          while (active && queuedResyncCursor !== undefined) {
            const cursor = queuedResyncCursor;
            queuedResyncCursor = undefined;
            try {
              const applied = await resyncTenantNotifications(
                generation,
                cursor,
              );
              if (!active || !applied) return;
              notificationCacheInitialized = true;
            } catch {
              // Keep the last complete cache and cursor. The next ready/sync
              // signal retries; partial REST results never become visible.
            }
          }
        };
        resyncInFlight = run().finally(() => {
          resyncInFlight = null;
          if (active && queuedResyncCursor !== undefined) {
            requestNotificationResync(queuedResyncCursor);
          }
        });
      };
      applicationUnsubscribers.push(
        applicationClient.subscribe("session.ready.v1", (event) => {
          dispatchShellEvent(TENANT_REALTIME_SHELL_EVENTS.sessionReady, event);
          if (
            event.payload.notificationResyncRequired ||
            !notificationCacheInitialized
          ) {
            dispatchShellEvent(
              TENANT_REALTIME_SHELL_EVENTS.resyncRequired,
              event,
            );
            requestNotificationResync(
              tenantNotificationRuntime.getSnapshot().lastRealtimeCursor,
            );
          }
        }),
        applicationClient.subscribe("notification.created.v1", (event) => {
          const result = tenantNotificationRuntime.applyCreated(
            generation,
            event.payload,
          );
          dispatchShellEvent(
            TENANT_REALTIME_SHELL_EVENTS.notificationCreated,
            event,
          );
          if (result === "applied" || result === "duplicate") {
            if (result === "applied") {
              requestNotificationResync(event.payload.cursor);
            }
            void applicationClient
              ?.acknowledgeNotification({
                notificationId: event.payload.notificationId,
                recipientId: event.payload.recipientId,
                deliveryEventId: event.payload.deliveryEventId,
                cursor: event.payload.cursor,
              })
              .catch(() => {
                requestNotificationResync(event.payload.cursor);
              });
          } else if (result === "conflict") {
            requestNotificationResync(event.payload.cursor);
          }
        }),
        applicationClient.subscribe("notification.updated.v1", (event) => {
          const result = tenantNotificationRuntime.applyUpdated(
            generation,
            event.payload,
          );
          if (
            result === "missing" ||
            result === "gap" ||
            result === "conflict"
          ) {
            requestNotificationResync(
              tenantNotificationRuntime.getSnapshot().lastRealtimeCursor,
            );
          }
          dispatchShellEvent(
            TENANT_REALTIME_SHELL_EVENTS.notificationUpdated,
            event,
          );
        }),
        applicationClient.subscribe(
          "notification.unread-count.changed.v1",
          (event) => {
            const result = tenantNotificationRuntime.applyUnreadCount(
              generation,
              event.payload.unreadCount,
              event.payload.unreadRevision,
              event.payload.changedAt,
            );
            if (result === "gap" || result === "conflict") {
              requestNotificationResync(
                tenantNotificationRuntime.getSnapshot().lastRealtimeCursor,
              );
            }
            dispatchShellEvent(
              TENANT_REALTIME_SHELL_EVENTS.notificationUnreadCountChanged,
              event,
            );
          },
        ),
        applicationClient.subscribe("realtime.sync.required.v1", (event) => {
          dispatchShellEvent(
            TENANT_REALTIME_SHELL_EVENTS.resyncRequired,
            event,
          );
          if (
            event.payload.scope === "NOTIFICATIONS" ||
            event.payload.scope === "ALL"
          ) {
            requestNotificationResync(
              event.payload.lastCommittedNotificationCursor,
            );
          }
        }),
        applicationClient.subscribe("system.server-draining.v1", (event) => {
          dispatchShellEvent(
            TENANT_REALTIME_SHELL_EVENTS.serverDraining,
            event,
          );
        }),
      );
      applicationClient.start();
    }

    const pushLifecycle = () =>
      applicationClient?.updateLifecycle(readBrowserLifecycle());
    const pushBackgroundLifecycle = () =>
      applicationClient?.updateLifecycle({
        appState: "BACKGROUND",
        visibility: "HIDDEN",
        focus: "BLURRED",
      });
    const signalActivity = () => applicationClient?.signalActivity();
    const onVisibilityChange = () => { pushLifecycle(); };
    const onFocus = () => { pushLifecycle(); };
    const onBlur = () => { pushLifecycle(); };
    const onPageShow = () => { pushLifecycle(); };
    const onPageHide = () => { pushBackgroundLifecycle(); };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("pointerdown", signalActivity, { passive: true });
    document.addEventListener("keydown", signalActivity);
    document.addEventListener("touchstart", signalActivity, { passive: true });
    pushLifecycle();

    return () => {
      active = false;
      queuedResyncCursor = undefined;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("pointerdown", signalActivity);
      document.removeEventListener("keydown", signalActivity);
      document.removeEventListener("touchstart", signalActivity);
      for (const unsubscribe of applicationUnsubscribers) unsubscribe();
      applicationClient?.dispose();
      lease?.release();
    };
  }, [generation, mode, suppliedCoordinator]);

  return children;
}

export function createTenantRealtimeCoordinator(): TenantRealtimeCoordinator {
  const identifiers = createBrowserClientIdentifiers({
    crypto: window.crypto,
    storage: {
      getItem: (key) => window.localStorage.getItem(key),
      setItem: (key, value) => window.localStorage.setItem(key, value),
    },
  });
  const metadata = Object.freeze({
    deviceId: identifiers.deviceId,
    clientInstanceId: identifiers.clientInstanceId,
    appVersion: "tenant-portal@0.1.0",
    locale: document.documentElement.lang || undefined,
    timezone: readTimezone(),
  });

  return new GenerationBoundConnectionCoordinator<RealtimeHandshakeAuthV1>({
    mode: readDeploymentMode(),
    credentialProvider: async ({ generation, reason }) => {
      if (reason === "token_refresh") await refreshTenantCookieSession();
      return createGenerationBoundRealtimeHandshake(generation, metadata);
    },
    transportFactory: createSocketIoTransportFactory(),
    classifyFailure: classifyRealtimeConnectionFailure,
  });
}

function readBrowserLifecycle() {
  const visible = document.visibilityState === "visible";
  return {
    appState: visible ? "FOREGROUND" as const : "BACKGROUND" as const,
    visibility: visible ? "VISIBLE" as const : "HIDDEN" as const,
    focus: document.hasFocus() ? "FOCUSED" as const : "BLURRED" as const,
  };
}

function handlePermanentStop(reason: RealtimeApplicationStopReason): void {
  dispatchShellEvent(TENANT_REALTIME_SHELL_EVENTS.permanentStop, reason);
  if (reason !== "access_revoked" && reason !== "tenant_unavailable") return;
  const sessionId = getStoredTenantSessionMeta()?.sessionId;
  tenantNotificationRuntime.clear();
  clearLocalTenantAuthState();
  publishTenantAuthEvent("session-ended", sessionId, true);
}

function dispatchShellEvent(name: string, detail: unknown): void {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function readDeploymentMode(): RealtimeDeploymentMode {
  return parseRealtimeDeploymentMode(process.env.NEXT_PUBLIC_REALTIME_MODE);
}

function readTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

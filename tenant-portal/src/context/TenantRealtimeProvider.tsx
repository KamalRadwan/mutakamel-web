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
  type ConnectionSnapshot,
  type RealtimeApplicationConnection,
  type RealtimeApplicationStopReason,
  type RealtimeDeploymentMode,
  type RealtimeHandshakeAuthV1,
} from "@mutakamel/realtime-app-client";
import { useTenantAuth } from "@/context/AuthContext";
import {
  axiosClient,
  coordinateTenantSessionRefresh,
} from "@/lib/api/axiosClient";
import {
  refreshTenantNotifications,
  tenantNotificationRuntime,
} from "@/lib/notifications/tenant-notification-runtime";
import { uuidCrypto } from "@/lib/uuid";
import { can } from "@/lib/auth/permission-scope";
import { normalizeApiError } from "@/lib/api/errors";

export interface TenantRealtimeCoordinator extends RealtimeApplicationConnection {
  getSnapshot(): ConnectionSnapshot;
  subscribe(listener: () => void): () => void;
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
  connectionChanged: "tenant-realtime:connection-changed",
} as const);

let connectionSnapshot: ConnectionSnapshot | null = null;
export const getTenantRealtimeConnectionSnapshot = () => connectionSnapshot;
export const getServerRealtimeConnectionSnapshot = () => null;
export function subscribeTenantRealtimeConnection(listener: () => void): () => void {
  window.addEventListener(TENANT_REALTIME_SHELL_EVENTS.connectionChanged, listener);
  return () => window.removeEventListener(TENANT_REALTIME_SHELL_EVENTS.connectionChanged, listener);
}

function publishConnectionSnapshot(snapshot: ConnectionSnapshot | null): void {
  connectionSnapshot = snapshot;
  dispatchShellEvent(TENANT_REALTIME_SHELL_EVENTS.connectionChanged, snapshot);
}

interface TenantRealtimeProviderProps {
  children: ReactNode;
  /** Test seam; production always uses the package-backed runtime singleton. */
  coordinator?: TenantRealtimeCoordinator;
  mode?: RealtimeDeploymentMode;
  notificationsAuthorized?: boolean;
}

const runtime = new RuntimeConnectionSingleton<TenantRealtimeCoordinator>();

export function TenantRealtimeProvider({
  children,
  coordinator: suppliedCoordinator,
  mode: suppliedMode,
}: TenantRealtimeProviderProps) {
  const { realtimeAuthGeneration, user } = useTenantAuth();
  return (
    <TenantRealtimeBinding
      generation={realtimeAuthGeneration}
      coordinator={suppliedCoordinator}
      mode={suppliedMode}
      notificationsAuthorized={can(user, "notifications.notification.read")}
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
  notificationsAuthorized = true,
}: TenantRealtimeProviderProps & { generation: string | null }) {
  const mode = suppliedMode ?? readDeploymentMode();

  useEffect(() => {
    // Nothing is built for a signed-out visitor. This provider wraps every
    // route including /login, and creating the coordinator eagerly gave anyone
    // who merely opened the sign-in form a socket runtime and a device id
    // persisted to localStorage. `peek` is what still lets a sign-out clear
    // the coordinator a signed-in session did create.
    if (generation === null) {
      (suppliedCoordinator ?? runtime.peek())?.clearGeneration();
      publishConnectionSnapshot(null);
      tenantNotificationRuntime.clear();
      return;
    }
    const coordinator =
      suppliedCoordinator ??
      runtime.getOrCreate(createTenantRealtimeCoordinator);
    coordinator.setDeploymentMode(mode);
    coordinator.setNetworkOnline(navigator.onLine);

    const onOnline = () => {
      coordinator.setNetworkOnline(true);
      reconcileForeground();
    };
    const onOffline = () => coordinator.setNetworkOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    let active = true;
    let notificationCacheInitialized = false;
    let resyncInFlight: Promise<void> | null = null;
    let queuedResyncCursor: string | null | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let retryAttempt = 0;
    let recoveryPaused = false;
    const applicationUnsubscribers: Array<() => void> = [];
    tenantNotificationRuntime.bindGeneration(notificationsAuthorized ? generation : null);
    const boundGeneration = coordinator.getSnapshot().generation;
    if (
      boundGeneration !== null &&
      boundGeneration !== generation
    ) {
      coordinator.replaceGeneration(generation);
    }
    const publishConnection = () => {
      const snapshot = coordinator.getSnapshot();
      if (!active || snapshot.generation !== generation) return;
      const newlyBlocked = snapshot.phase === "blocked" &&
        (connectionSnapshot?.generation !== generation || connectionSnapshot?.phase !== "blocked");
      publishConnectionSnapshot(snapshot);
      // REST owns session validity; a socket denial alone must not sign out a user.
      if (newlyBlocked && (
        snapshot.blockedReason === "classified_permanent" ||
        snapshot.blockedReason === "credential_refresh_failed" ||
        snapshot.blockedReason === "reconnect_attempts_exhausted"
      )) void revalidateTenantRestSession();
    };
    const unsubscribeConnection = coordinator.subscribe(publishConnection);
    const lease: ConnectionLease = coordinator.acquire(generation);
    publishConnection();
    const applicationClient = new RealtimeApplicationClient({
      connection: coordinator,
      onPermanentStop: handlePermanentStop,
    });
    const requestNotificationResync = (
      lastCommittedCursor: string | null,
      automaticRetry = false,
    ): void => {
      if (!active || !notificationsAuthorized || tenantNotificationRuntime.getSnapshot().generation !== generation) return;
      queuedResyncCursor = lastCommittedCursor;
      if (resyncInFlight !== null) return;
      clearTimeout(retryTimer);
      retryTimer = undefined;
      recoveryPaused = false;
      if (!automaticRetry) retryAttempt = 0;
      const deferRecovery = (cursor: string | null, retryable: boolean) => {
        if (!active || tenantNotificationRuntime.getSnapshot().generation !== generation) return;
        if (queuedResyncCursor === undefined) queuedResyncCursor = cursor;
        recoveryPaused = true;
        // A quiet healthy socket must not strand failed REST reconciliation.
        // Stop after three retries; focus/online and the bell remain usable.
        if (!retryable || retryAttempt >= 3) return;
        const delay = 1_000 * 2 ** retryAttempt++;
        retryTimer = setTimeout(() => {
          retryTimer = undefined;
          requestNotificationResync(queuedResyncCursor === undefined ? cursor : queuedResyncCursor, true);
        }, delay);
      };
      const run = async (): Promise<void> => {
        while (active && queuedResyncCursor !== undefined) {
          const cursor = queuedResyncCursor;
          queuedResyncCursor = undefined;
          try {
            const applied = await refreshTenantNotifications(
              generation,
              cursor,
            );
            if (!active) return;
            if (!applied) {
              deferRecovery(cursor, true);
              return;
            }
            notificationCacheInitialized = true;
            retryAttempt = 0;
          } catch (error: unknown) {
            const { status } = normalizeApiError(error);
            deferRecovery(cursor, status === 0 || status === 408 || status === 429 || status >= 500);
            return;
          }
        }
      };
      resyncInFlight = run().finally(() => {
        resyncInFlight = null;
        if (active && !recoveryPaused && queuedResyncCursor !== undefined) {
          requestNotificationResync(queuedResyncCursor);
        }
      });
    };
    applicationUnsubscribers.push(
      applicationClient.subscribe("session.ready.v1", (event) => {
        dispatchShellEvent(TENANT_REALTIME_SHELL_EVENTS.sessionReady, event);
        if (!notificationsAuthorized) return;
        if (
          event.payload.notificationResyncRequired ||
          (!notificationCacheInitialized && resyncInFlight === null)
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
        if (!active || !notificationsAuthorized) return;
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
            .acknowledgeNotification({
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
        if (!active || !notificationsAuthorized) return;
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
          if (!active || !notificationsAuthorized) return;
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
        if (!notificationsAuthorized && event.payload.scope === "NOTIFICATIONS") return;
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
    // REST hydration must also work when realtime is off or never handshakes.
    requestNotificationResync(tenantNotificationRuntime.getSnapshot().lastRealtimeCursor);
    applicationClient.start();

    function reconcileForeground() {
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      // Repeated browser focus events share the current request.
      if (resyncInFlight !== null) return;
      requestNotificationResync(tenantNotificationRuntime.getSnapshot().lastRealtimeCursor);
    }

    const pushLifecycle = () =>
      applicationClient.updateLifecycle(readBrowserLifecycle());
    const pushBackgroundLifecycle = () =>
      applicationClient.updateLifecycle({
        appState: "BACKGROUND",
        visibility: "HIDDEN",
        focus: "BLURRED",
      });
    const signalActivity = (event: Event) => {
      if (event.isTrusted && document.visibilityState === "visible") {
        applicationClient.signalActivity();
      }
    };
    const onVisibilityChange = () => { pushLifecycle(); reconcileForeground(); };
    const onFocus = () => { pushLifecycle(); reconcileForeground(); };
    const onBlur = () => { pushLifecycle(); };
    const onPageShow = () => { pushLifecycle(); reconcileForeground(); };
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
      clearTimeout(retryTimer);
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
      unsubscribeConnection();
      if (connectionSnapshot?.generation === generation) publishConnectionSnapshot(null);
      applicationClient.dispose();
      lease.release();
    };
  }, [generation, mode, suppliedCoordinator, notificationsAuthorized]);

  return children;
}

export function createTenantRealtimeCoordinator(): TenantRealtimeCoordinator {
  const identifiers = createBrowserClientIdentifiers({
    crypto: uuidCrypto,
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
      if (reason === "token_refresh") {
        const sessionId = readSessionIdFromGeneration(generation);
        if (!sessionId) throw new Error("INVALID_REALTIME_AUTH_GENERATION");
        await coordinateTenantSessionRefresh(sessionId);
      }
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
  tenantNotificationRuntime.clear();
  void revalidateTenantRestSession();
}

async function revalidateTenantRestSession(): Promise<void> {
  try {
    await axiosClient.get("/api/tenant/core/v1/auth/me", {
      cache: "no-store",
    });
  } catch {
    // The REST client owns definitive session termination. Forbidden and
    // transient failures deliberately retain the browser session.
  }
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

function readSessionIdFromGeneration(generation: string): string | null {
  if (!generation.startsWith("tenant:")) return null;
  const separator = generation.indexOf(":", "tenant:".length);
  if (separator < 0) return null;
  const sessionId = generation.slice("tenant:".length, separator);
  return sessionId && sessionId.length <= 128 ? sessionId : null;
}

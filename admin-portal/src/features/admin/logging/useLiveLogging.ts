"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { adminCanAll } from "@/lib/auth/rbac";
import {
  LIVE_HEARTBEAT_STALE_MS,
  appendLiveRow,
  openLoggingEventSource,
  readLiveControlError,
  readLiveLogMessage,
  readLiveTimestamp,
  reconnectDelay,
} from "./live";
import { buildLiveQuery } from "./validation";
import type {
  LiveConnectionState,
  LiveControlError,
  LiveLoggingDraft,
  LiveLoggingQuery,
  LoggingValidationErrors,
  RuntimeLogRow,
} from "./types";

const INITIAL_DRAFT: LiveLoggingDraft = {
  appName: "",
  tenantId: "",
  minLevel: "warn",
};

export function useLiveLogging() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const ownerId = user?.id ?? null;
  const canLive = adminCanAll(user, [
    "admin.logging.read",
    "admin.logging.critical",
  ]);
  const [draft, setDraft] = useState<LiveLoggingDraft>(INITIAL_DRAFT);
  const [validationErrors, setValidationErrors] =
    useState<LoggingValidationErrors>({});
  const [connectionState, setConnectionState] =
    useState<LiveConnectionState>("IDLE");
  const [rows, setRows] = useState<RuntimeLogRow[]>([]);
  const [streamOwnerId, setStreamOwnerId] = useState<string | null>(null);
  const [controlError, setControlError] = useState<LiveControlError | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [lastActivityAt, setLastActivityAt] = useState<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const staleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeQueryRef = useRef<LiveLoggingQuery | null>(null);
  const intendedRef = useRef(false);
  const sequenceRef = useRef(0);
  const attemptRef = useRef(0);

  const closeTransport = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (staleTimerRef.current !== null) {
      clearTimeout(staleTimerRef.current);
      staleTimerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    intendedRef.current = false;
    activeQueryRef.current = null;
    closeTransport();
    setRows([]);
    setStreamOwnerId(null);
    setControlError(null);
    setReconnectAttempt(0);
    setLastActivityAt(null);
    setConnectionState("IDLE");
  }, [closeTransport]);

  const armStaleTimer = useCallback((reconnect: () => void) => {
    if (staleTimerRef.current !== null) clearTimeout(staleTimerRef.current);
    staleTimerRef.current = setTimeout(() => {
      if (!intendedRef.current) return;
      setConnectionState("STALE");
      reconnect();
    }, LIVE_HEARTBEAT_STALE_MS);
  }, []);

  const connectRef = useRef<(query: LiveLoggingQuery, reconnecting: boolean) => void>(
    () => undefined,
  );

  const scheduleReconnect = useCallback(() => {
    if (!intendedRef.current || !activeQueryRef.current) return;
    const attempt = attemptRef.current;
    const delay = reconnectDelay(attempt);
    attemptRef.current += 1;
    setReconnectAttempt(attemptRef.current);
    setConnectionState("RECONNECTING");
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      const query = activeQueryRef.current;
      if (query && intendedRef.current) connectRef.current(query, true);
    }, delay);
  }, []);

  const connect = useCallback(
    (query: LiveLoggingQuery, reconnecting: boolean) => {
      closeTransport();
      if (!intendedRef.current) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        intendedRef.current = false;
        setRows([]);
        setConnectionState("PAUSED_PRIVACY");
        return;
      }
      setConnectionState(reconnecting ? "RECONNECTING" : "CONNECTING");
      setControlError(null);
      let source: EventSource;
      try {
        source = openLoggingEventSource(query);
      } catch {
        setConnectionState("ERROR");
        scheduleReconnect();
        return;
      }
      sourceRef.current = source;

      const markActivity = (event: Event, ready = false) => {
        try {
          const timestamp = readLiveTimestamp(event);
          setLastActivityAt(timestamp);
          if (ready) {
            attemptRef.current = 0;
            setReconnectAttempt(0);
            setConnectionState("LIVE");
          }
          armStaleTimer(scheduleReconnect);
        } catch {
          setConnectionState("ERROR");
        }
      };

      source.addEventListener("ready", (event) => markActivity(event, true));
      source.addEventListener("heartbeat", (event) => markActivity(event));
      source.addEventListener("log", (event) => {
        try {
          sequenceRef.current += 1;
          const row = readLiveLogMessage(event, sequenceRef.current);
          setRows((current) => appendLiveRow(current, row));
          setLastActivityAt(row.timestamp);
          armStaleTimer(scheduleReconnect);
        } catch {
          // Malformed or oversized events are dropped and never rendered.
        }
      });
      source.addEventListener("error", (event) => {
        if (sourceRef.current !== source) return;
        const serviceError = readLiveControlError(event);
        source.close();
        sourceRef.current = null;
        if (serviceError) {
          intendedRef.current = false;
          if (staleTimerRef.current !== null) {
            clearTimeout(staleTimerRef.current);
            staleTimerRef.current = null;
          }
          setControlError(serviceError);
          setConnectionState(
            serviceError.code === "LOGGING_LIVE_REDIS_UNAVAILABLE"
              ? "UNAVAILABLE"
              : "ERROR",
          );
          return;
        }
        scheduleReconnect();
      });
      armStaleTimer(scheduleReconnect);
    },
    [armStaleTimer, closeTransport, scheduleReconnect],
  );
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const start = useCallback(() => {
    if (!canLive || isAuthLoading || !ownerId) {
      setConnectionState("FORBIDDEN");
      return false;
    }
    const built = buildLiveQuery(draft);
    if (!built.query) {
      setValidationErrors(built.errors);
      return false;
    }
    setValidationErrors({});
    setRows([]);
    setStreamOwnerId(ownerId);
    setControlError(null);
    sequenceRef.current = 0;
    attemptRef.current = 0;
    intendedRef.current = true;
    activeQueryRef.current = built.query;
    connect(built.query, false);
    return true;
  }, [canLive, connect, draft, isAuthLoading, ownerId]);

  const retryNow = useCallback(() => {
    const query = activeQueryRef.current;
    if (!query || !canLive || !ownerId) return;
    intendedRef.current = true;
    attemptRef.current = 0;
    connect(query, true);
  }, [canLive, connect, ownerId]);

  const clear = useCallback(() => setRows([]), []);
  const setDraftField = useCallback(
    <K extends keyof LiveLoggingDraft>(field: K, value: LiveLoggingDraft[K]) => {
      setDraft((current) => ({ ...current, [field]: value }));
      setValidationErrors({});
    },
    [],
  );

  useEffect(() => {
    if (isAuthLoading) return;
    let disposed = false;
    if (!canLive || !ownerId) {
      intendedRef.current = false;
      closeTransport();
      queueMicrotask(() => {
        if (disposed) return;
        setRows([]);
        setStreamOwnerId(null);
        setConnectionState("FORBIDDEN");
      });
    } else if (streamOwnerId && streamOwnerId !== ownerId) {
      intendedRef.current = false;
      closeTransport();
      queueMicrotask(() => {
        if (disposed) return;
        setRows([]);
        setStreamOwnerId(null);
        setConnectionState("IDLE");
      });
    }
    return () => {
      disposed = true;
    };
  }, [canLive, closeTransport, isAuthLoading, ownerId, streamOwnerId]);

  useEffect(() => {
    const protectHiddenPage = () => {
      if (document.visibilityState !== "hidden" || !sourceRef.current) return;
      intendedRef.current = false;
      closeTransport();
      setRows([]);
      setConnectionState("PAUSED_PRIVACY");
    };
    const protectPageExit = () => {
      intendedRef.current = false;
      closeTransport();
      setRows([]);
    };
    document.addEventListener("visibilitychange", protectHiddenPage);
    window.addEventListener("pagehide", protectPageExit);
    return () => {
      document.removeEventListener("visibilitychange", protectHiddenPage);
      window.removeEventListener("pagehide", protectPageExit);
      intendedRef.current = false;
      closeTransport();
    };
  }, [closeTransport]);

  const ownsRows = ownerId !== null && streamOwnerId === ownerId && canLive;
  const visibleState: LiveConnectionState = isAuthLoading
    ? "CONNECTING"
    : !canLive
      ? "FORBIDDEN"
      : streamOwnerId !== null && !ownsRows
        ? "IDLE"
        : connectionState;

  return {
    canLive,
    draft,
    validationErrors,
    connectionState: visibleState,
    rows: ownsRows ? rows : [],
    controlError: ownsRows ? controlError : null,
    reconnectAttempt,
    lastActivityAt: ownsRows ? lastActivityAt : null,
    setDraftField,
    start,
    stop,
    retryNow,
    clear,
  };
}

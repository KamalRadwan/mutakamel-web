"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listAdminAuthSessions,
  revokeAdminAuthSession,
  type AuthSessionSummary,
} from "@/lib/auth/sessionApi";
import { clearLocalAuthState } from "@/lib/api/axiosClient";
import { publishAdminAuthEvent } from "@/lib/auth/sessionCoordinator";
import { useAuth } from "@/context/AuthContext";

export function useAuthSessions() {
  const { logoutAll } = useAuth();
  const [sessions, setSessions] = useState<AuthSessionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (markPending = true) => {
    if (markPending) {
      setIsLoading(true);
      setError(null);
    }
    try {
      setSessions(await listAdminAuthSessions());
    } catch {
      setError("AUTH_SESSIONS_LOAD_FAILED");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load(false);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const revoke = useCallback(async (session: AuthSessionSummary): Promise<boolean> => {
    setRevokingId(session.id);
    setError(null);
    try {
      await revokeAdminAuthSession(session.id, session.current);
      if (session.current) {
        clearLocalAuthState();
        publishAdminAuthEvent("session-ended", session.id, true);
        return true;
      }
      setSessions((current) =>
        current.filter((candidate) => candidate.id !== session.id),
      );
      return true;
    } catch {
      setError("AUTH_SESSION_REVOKE_FAILED");
      return false;
    } finally {
      setRevokingId(null);
    }
  }, []);

  const logoutEverywhere = useCallback(async (): Promise<boolean> => {
    setIsLoggingOutAll(true);
    setError(null);
    try {
      await logoutAll();
      return true;
    } catch {
      setError("AUTH_LOGOUT_ALL_FAILED");
      return false;
    } finally {
      setIsLoggingOutAll(false);
    }
  }, [logoutAll]);

  return {
    sessions,
    isLoading,
    revokingId,
    isLoggingOutAll,
    error,
    reload: () => load(true),
    revoke,
    logoutEverywhere,
  };
}

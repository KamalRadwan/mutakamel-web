"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import {
  listTenantAuthSessions,
  revokeTenantAuthSession,
  type TenantAuthSessionSummary,
} from "@/lib/auth/sessionApi";

export type AuthSessionItem = TenantAuthSessionSummary;

export function useAuthenticationManagement() {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<AuthSessionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = useCallback(async (markPending = true) => {
    if (markPending) {
      setIsLoading(true);
      setError(null);
    }
    try {
      setItems(await listTenantAuthSessions());
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

  const revoke = useCallback(async (session: AuthSessionItem): Promise<boolean> => {
    setRevokingId(session.id);
    setError(null);
    try {
      await revokeTenantAuthSession(session);
      if (!session.current) {
        setItems((current) =>
          current.filter((candidate) => candidate.id !== session.id),
        );
      }
      return true;
    } catch {
      setError("AUTH_SESSION_REVOKE_FAILED");
      return false;
    } finally {
      setRevokingId(null);
    }
  }, []);

  return {
    t,
    lang,
    items,
    isLoading,
    error,
    revokingId,
    reload: () => load(true),
    revoke,
  };
}

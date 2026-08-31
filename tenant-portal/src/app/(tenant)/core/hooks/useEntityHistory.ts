"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  AUDIT_READ_PERMISSION,
  fetchEntityHistory,
  type AuditEvent,
} from "../contracts/audit-contract";

const HISTORY_PAGE_SIZE = 10;

/**
 * The per-record audit history embedded on a detail screen (task 7.21).
 *
 * Pages forward by appending, because the surface is a timeline rather than a
 * table: a reader following an incident scrolls back through time, and a page
 * control that replaced the visible rows would break that reading.
 */
export function useEntityHistory(entityType: string, entityId: string | null) {
  const { t, lang } = useI18n();
  const { user } = useTenantAuth();
  const canRead = user?.permissions.includes(AUDIT_READ_PERMISSION) ?? false;

  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const load = useCallback(
    async (nextPage: number, signal?: AbortSignal): Promise<void> => {
      if (!canRead || !entityId) return;
      if (nextPage === 1) setIsLoading(true);
      else setIsLoadingMore(true);
      setError(null);
      try {
        const result = await fetchEntityHistory({
          entityType,
          entityId,
          page: nextPage,
          limit: HISTORY_PAGE_SIZE,
          signal,
        });
        setEvents((current) =>
          nextPage === 1 ? result.items : [...current, ...result.items],
        );
        setPage(result.page);
        setHasNext(result.hasNext);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(normalizeApiError(caught));
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [canRead, entityId, entityType],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(1, controller.signal);
    });
    return () => controller.abort();
  }, [load, reloadToken]);

  return {
    t,
    lang,
    canRead,
    events,
    isLoading: isLoading && canRead && entityId !== null,
    isLoadingMore,
    error,
    hasNext,
    loadMore: () => void load(page + 1),
    reload: () => setReloadToken((token) => token + 1),
  };
}

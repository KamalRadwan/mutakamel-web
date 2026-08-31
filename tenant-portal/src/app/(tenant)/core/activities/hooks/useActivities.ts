"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useRealtimeResync } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { fetchActivities } from "../activities-api";
import {
  ACTIVITY_CANCEL_PERMISSION,
  ACTIVITY_COMPLETE_PERMISSION,
  ACTIVITY_CREATE_PERMISSION,
  ACTIVITY_PAGE_SIZE,
  ACTIVITY_READ_PERMISSION,
  ACTIVITY_UPDATE_PERMISSION,
  type Activity,
  type ActivityFilters,
} from "../activities-contract";

export interface ActivityGrants {
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canComplete: boolean;
  canCancel: boolean;
}

/**
 * The activities list: filters, paging and the rows themselves.
 *
 * Writes live in `useActivityMutations` — they carry `If-Match`, an
 * idempotency key and three distinct failure surfaces, which is a different
 * concern from "which page is showing".
 */
export function useActivities() {
  const { t, lang } = useI18n();
  const { user } = useTenantAuth();
  const permissions = user?.permissions ?? [];
  const grants: ActivityGrants = {
    canRead: permissions.includes(ACTIVITY_READ_PERMISSION),
    canCreate: permissions.includes(ACTIVITY_CREATE_PERMISSION),
    canUpdate: permissions.includes(ACTIVITY_UPDATE_PERMISSION),
    canComplete: permissions.includes(ACTIVITY_COMPLETE_PERMISSION),
    canCancel: permissions.includes(ACTIVITY_CANCEL_PERMISSION),
  };

  const [items, setItems] = useState<Activity[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [serverSearch, setServerSearch] = useState("");
  const [sortDir, setSortDir] = useState<"ASC" | "DESC">("ASC");
  const [filters, setFilters] = useState<ActivityFilters>({});
  const [isLoading, setIsLoading] = useState(true);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(1);
      setServerSearch(search.trim());
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      if (!grants.canRead) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setQueryError(null);
      try {
        const result = await fetchActivities({
          page,
          search: serverSearch,
          sortDir,
          filters,
          signal,
        });
        setItems(result.items);
        setTotal(result.total);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setQueryError(normalizeApiError(error));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [grants.canRead, page, serverSearch, sortDir, filters],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load, reloadToken]);

  const replaceItem = useCallback((next: Activity) => {
    setItems((current) => current.map((item) => (item.id === next.id ? next : item)));
  }, []);

  // MASTER-PLAN 13.6: one line, and this list reconciles with the server on
  // an ALL-scoped resync, a realtime reconnect, and a return from offline.
  const reload = useCallback(() => setReloadToken((token) => token + 1), []);
  useRealtimeResync(reload);

  return {
    t,
    lang,
    grants,
    items,
    pageInfo: { page, limit: ACTIVITY_PAGE_SIZE, total },
    search,
    sortDir,
    filters,
    isLoading: isLoading && grants.canRead,
    queryError,
    setPage,
    setSearch,
    setSortDir: (next: "ASC" | "DESC") => {
      setPage(1);
      setSortDir(next);
    },
    setFilters: (next: ActivityFilters) => {
      setPage(1);
      setFilters(next);
    },
    replaceItem,
    reload,
  };
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useRealtimeResync } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  AUDIT_PAGE_SIZE,
  AUDIT_READ_PERMISSION,
  fetchAuditLedger,
  type AuditEvent,
  type AuditFilters,
  type AuditPage,
} from "../../contracts/audit-contract";

const EMPTY_PAGE: Omit<AuditPage, "items"> = {
  total: 0,
  page: 1,
  limit: AUDIT_PAGE_SIZE,
  totalPages: 0,
  hasNext: false,
  hasPrev: false,
};

/**
 * The tenant audit ledger.
 *
 * The endpoint carries no `search`, so this screen offers none: a search box
 * that silently does nothing is worse than no search box. Every control below
 * maps to a field `TenantAuditQueryDto` actually declares.
 */
export function useAuditLedger() {
  const { t, lang } = useI18n();
  const { user } = useTenantAuth();
  const canRead = user?.permissions.includes(AUDIT_READ_PERMISSION) ?? false;

  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [pager, setPager] = useState(EMPTY_PAGE);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<AuditFilters>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      if (!canRead) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchAuditLedger({ page, filters, signal });
        setEvents(result.items);
        setPager({
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
          hasNext: result.hasNext,
          hasPrev: result.hasPrev,
        });
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(normalizeApiError(caught));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [canRead, page, filters],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load, reloadToken]);

  // MASTER-PLAN 13.6: one line, and this list reconciles with the server on
  // an ALL-scoped resync, a realtime reconnect, and a return from offline.
  const reload = useCallback(() => setReloadToken((token) => token + 1), []);
  useRealtimeResync(reload);

  return {
    t,
    lang,
    canRead,
    events,
    pager,
    filters,
    isLoading: isLoading && canRead,
    error,
    setPage,
    applyFilters: (next: AuditFilters) => {
      setPage(1);
      setFilters(next);
    },
    reload,
  };
}

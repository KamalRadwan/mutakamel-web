import { useState, useCallback, useEffect, useRef } from "react";
import { databaseServersApi } from "../api/database-servers.api";
import { useIdempotency } from "@/shared/hooks/useIdempotency";
import { normalizeApiError } from "@/shared/api/normalized-api-error";
import { useToast } from "@/components/ui/ToastContext";
import { useI18n } from "@/i18n/I18nContext";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { shouldResetDatabaseServerWriteKey } from "../lib/database-server-idempotency";
import {
  DatabaseServerView,
  DatabaseServerQueryDto,
  DatabaseServerStatus,
} from "../types";

const DATABASE_SERVER_SORT_FIELDS = ["name", "host", "currentTenants", "createdAt"] as const;
type DatabaseServerSortField = (typeof DATABASE_SERVER_SORT_FIELDS)[number];

export function useDatabaseServers() {
  const toast = useToast();
  const { lang } = useI18n();
  const copy = (lang === "ar" ? ar : en).databaseServersList;
  const { getIdempotencyKey, resetKey } = useIdempotency();

  const [servers, setServers] = useState<DatabaseServerView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedQueryIdentity, setLoadedQueryIdentity] = useState<string | null>(null);
  const requestGeneration = useRef(0);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const requestAbort = useRef<AbortController | null>(null);
  const queryIdentityRef = useRef("");
  const deleteQueryIdentityRef = useRef<string | null>(null);
  const destroyQueryIdentityRef = useRef<string | null>(null);

  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearchState] = useState("");
  const [statusFilter, setStatusFilter] = useState<DatabaseServerStatus | "ALL">("ALL");
  const [countryFilter, setCountryFilter] = useState<string>("ALL");
  const [deletionFilter, setDeletionFilter] = useState<"CURRENT" | "DELETED">("CURRENT");
  // The endpoint accepts these four sort fields only; anything else is a 400.
  const [sortBy, setSortBy] = useState<DatabaseServerSortField>("createdAt");
  const [sortDir, setSortDir] = useState<"ASC" | "DESC">("DESC");
  const [serverPendingDelete, setServerPendingDelete] = useState<DatabaseServerView | null>(null);
  const [deletingServerId, setDeletingServerId] = useState<string | null>(null);
  const [serverPendingDestroy, setServerPendingDestroy] = useState<DatabaseServerView | null>(null);
  const [destroyingServerId, setDestroyingServerId] = useState<string | null>(null);

  const currentQueryIdentity = JSON.stringify({
    page,
    limit,
    sortBy,
    sortDir,
    search,
    statusFilter,
    countryFilter,
    deletionFilter,
  });
  const visibleServers =
    loadedQueryIdentity === currentQueryIdentity ? servers : [];

  const [meta, setMeta] = useState({
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });

  // Derived metrics logic can stay purely visual based on the list items
  const summaryMetrics = {
    totalServers: meta.total,
    activeServers: visibleServers.filter(s => s.status === "ACTIVE").length,
    drainingServers: visibleServers.filter(s => s.status === "DRAINING").length,
    offlineServers: visibleServers.filter(s => s.status === "OFFLINE").length,

  };

  // `search` already arrives debounced from FilterBar (see useFilterBar);
  // resetting the page here keeps pagination in sync with a new search term.
  const changeSort = useCallback((nextSortBy: string, nextSortDir: "ASC" | "DESC") => {
    const field = DATABASE_SERVER_SORT_FIELDS.find((allowed) => allowed === nextSortBy);
    if (!field) return;
    setSortBy(field);
    setSortDir(nextSortDir);
    setPage(1);
  }, []);

  const setSearch = useCallback((value: string) => {
    setSearchState(value);
    setPage(1);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [statusFilter, countryFilter, deletionFilter]);

  useEffect(() => {
    queryIdentityRef.current = currentQueryIdentity;
    requestGeneration.current += 1;
    requestAbort.current?.abort();
    queueMicrotask(() => {
      setServerPendingDelete(null);
      setServerPendingDestroy(null);
      setLoadedQueryIdentity(null);
    });
  }, [currentQueryIdentity]);

  const fetchServers = useCallback(async () => {
    const requestedQueryIdentity = currentQueryIdentity;
    const generation = ++requestGeneration.current;
    requestAbort.current?.abort();
    const controller = new AbortController();
    requestAbort.current = controller;
    setIsLoading(true);
    setError(null);
    try {
      const query: DatabaseServerQueryDto = {
        page,
        limit,
        sortBy,
        sortDir,
        ...(search ? { search } : {}),
        ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
        ...(countryFilter !== "ALL" ? { countryIsoCode: countryFilter } : {}),
        ...(deletionFilter === "DELETED" ? { deleted: true } : {}),
      };

      const response = await databaseServersApi.list(query, controller.signal);
      if (
        generation !== requestGeneration.current ||
        controller.signal.aborted ||
        queryIdentityRef.current !== requestedQueryIdentity
      ) {
        return;
      }
      setServers(response.data);
      setLoadedQueryIdentity(requestedQueryIdentity);
      if (response.meta) {
        setMeta(response.meta);
      }
    } catch (err) {
      if (
        generation !== requestGeneration.current ||
        controller.signal.aborted ||
        queryIdentityRef.current !== requestedQueryIdentity
      ) {
        return;
      }
      const normalized = normalizeApiError(err);
      setError(normalized.message);
      toast.error(copy.genericErrorTitle, normalized.message);
    } finally {
      if (generation === requestGeneration.current) setIsLoading(false);
    }
  }, [page, limit, search, statusFilter, countryFilter, deletionFilter, toast, currentQueryIdentity, copy.genericErrorTitle, refreshNonce]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchServers();
    return () => requestAbort.current?.abort();
  }, [fetchServers]);

  /**
   * FE-OPS-002. A mutation used to finish with `await fetchServers()`, calling
   * the closure it captured when the dialog opened. If the operator changed a
   * filter while the write was in flight, that stale closure aborted the newer
   * request and then discarded its own response on the identity check - so the
   * list was left empty, not loading, and nothing re-issued it.
   *
   * Bumping the nonce re-runs the effect instead, which always reads the
   * current query. The entry guards on each mutation are unchanged: a delete
   * still refuses to start if the query moved before it was confirmed.
   */
  const requestRefresh = useCallback(() => {
    setRefreshNonce((value) => value + 1);
  }, []);

  const openSoftDelete = (server: DatabaseServerView) => {
    if (
      deletionFilter !== "CURRENT" ||
      loadedQueryIdentity !== currentQueryIdentity ||
      !visibleServers.some((item) => item.id === server.id) ||
      server.deletedAt !== null
    ) return;
    setServerPendingDestroy(null);
    deleteQueryIdentityRef.current = currentQueryIdentity;
    setServerPendingDelete(server);
  };

  const closeSoftDelete = () => {
    if (!deletingServerId) setServerPendingDelete(null);
  };

  const openDestroy = (server: DatabaseServerView) => {
    if (
      deletionFilter !== "DELETED" ||
      loadedQueryIdentity !== currentQueryIdentity ||
      !visibleServers.some((item) => item.id === server.id) ||
      server.deletedAt === null
    ) return;
    setServerPendingDelete(null);
    destroyQueryIdentityRef.current = currentQueryIdentity;
    setServerPendingDestroy(server);
  };

  const closeDestroy = () => {
    if (!destroyingServerId) setServerPendingDestroy(null);
  };

  const confirmSoftDelete = async () => {
    const server = serverPendingDelete;
    if (
      !server ||
      deletingServerId ||
      deleteQueryIdentityRef.current !== queryIdentityRef.current ||
      deletionFilter !== "CURRENT" ||
      !visibleServers.some((item) => item.id === server.id)
    ) return;

    setDeletingServerId(server.id);
    try {
      const key = getIdempotencyKey({ action: "delete", databaseServerId: server.id });
      await databaseServersApi.delete(server.id, key);
      toast.success(copy.serverDeletedTitle, copy.serverDeletedDescription(server.name));
      resetKey();
      setServerPendingDelete(null);
      requestRefresh();
    } catch (err) {
      const normalized = normalizeApiError(err);
      if (shouldResetDatabaseServerWriteKey(normalized)) {
        resetKey();
      }
      toast.error(copy.deleteFailedTitle, normalized.message);
      requestRefresh();
      throw normalized;
    } finally {
      setDeletingServerId(null);
    }
  };

  const confirmDestroy = async () => {
    const server = serverPendingDestroy;
    if (
      !server ||
      destroyingServerId ||
      destroyQueryIdentityRef.current !== queryIdentityRef.current ||
      deletionFilter !== "DELETED" ||
      server.deletedAt === null ||
      !visibleServers.some((item) => item.id === server.id)
    ) return;

    setDestroyingServerId(server.id);
    try {
      const key = getIdempotencyKey({
        action: "destroy",
        databaseServerId: server.id,
      });
      await databaseServersApi.destroy(server.id, key);
      toast.success(copy.serverDestroyedTitle, copy.serverDestroyedDescription(server.name));
      resetKey();
      setServerPendingDestroy(null);
      requestRefresh();
    } catch (err) {
      const normalized = normalizeApiError(err);
      if (shouldResetDatabaseServerWriteKey(normalized)) {
        resetKey();
      }
      toast.error(copy.destroyFailedTitle, normalized.message);
      requestRefresh();
    } finally {
      setDestroyingServerId(null);
    }
  };

  return {
    servers: visibleServers,
    isLoading,
    error,
    page,
    setPage,
    sortBy,
    sortDir,
    changeSort,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    countryFilter,
    setCountryFilter,
    deletionFilter,
    setDeletionFilter,
    meta,
    summaryMetrics,
    fetchServers,
    serverPendingDelete,
    deletingServerId,
    openSoftDelete,
    closeSoftDelete,
    confirmSoftDelete,
    serverPendingDestroy,
    destroyingServerId,
    openDestroy,
    closeDestroy,
    confirmDestroy,
  };
}

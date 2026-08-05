import { useState, useCallback, useEffect } from "react";
import { databaseServersApi } from "../api/database-servers.api";
import { useIdempotency } from "@/shared/hooks/useIdempotency";
import { normalizeApiError } from "@/shared/api/normalized-api-error";
import { useToast } from "@/components/ui/ToastContext";
import { useI18n } from "@/i18n/I18nContext";
import { shouldResetDatabaseServerWriteKey } from "../lib/database-server-idempotency";
import {
  DatabaseServerView,
  CreateDatabaseServerDto,
  CheckDatabaseServerConnectivityDto,
  DatabaseServerQueryDto,
  DatabaseServerStatus,
} from "../types";

export function useDatabaseServers() {
  const toast = useToast();
  const { lang } = useI18n();
  const { getIdempotencyKey, resetKey } = useIdempotency();

  const [servers, setServers] = useState<DatabaseServerView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DatabaseServerStatus | "ALL">("ALL");
  const [countryFilter, setCountryFilter] = useState<string>("ALL");
  const [deletionFilter, setDeletionFilter] = useState<"CURRENT" | "DELETED">("CURRENT");
  const [serverPendingDelete, setServerPendingDelete] = useState<DatabaseServerView | null>(null);
  const [deletingServerId, setDeletingServerId] = useState<string | null>(null);
  const [serverPendingDestroy, setServerPendingDestroy] = useState<DatabaseServerView | null>(null);
  const [destroyingServerId, setDestroyingServerId] = useState<string | null>(null);

  const [meta, setMeta] = useState({
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });

  // Derived metrics logic can stay purely visual based on the list items
  const summaryMetrics = {
    totalServers: meta.total,
    activeServers: servers.filter(s => s.status === "ACTIVE").length,
    drainingServers: servers.filter(s => s.status === "DRAINING").length,
    offlineServers: servers.filter(s => s.status === "OFFLINE").length,

  };

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [statusFilter, countryFilter, deletionFilter]);

  const fetchServers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query: DatabaseServerQueryDto = {
        page,
        limit,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
        ...(countryFilter !== "ALL" ? { countryIsoCode: countryFilter } : {}),
        ...(deletionFilter === "DELETED" ? { deleted: true } : {}),
      };

      const response = await databaseServersApi.list(query);
      setServers(response.data);
      if (response.meta) {
        setMeta(response.meta);
      }
    } catch (err) {
      const normalized = normalizeApiError(err);
      setError(normalized.message);
      toast.error("Error", normalized.message);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, debouncedSearch, statusFilter, countryFilter, deletionFilter, toast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchServers();
  }, [fetchServers]);

  const createServer = async (dto: CreateDatabaseServerDto) => {
    try {
      const key = getIdempotencyKey(dto);
      const server = await databaseServersApi.create(dto, key);
      toast.success("Success", "Database Server created in DRAFT state.");
      resetKey();
      fetchServers();
      return server;
    } catch (err) {
      const normalized = normalizeApiError(err);
      if (shouldResetDatabaseServerWriteKey(normalized)) {
        resetKey();
      }
      toast.error("Error", normalized.message);
      throw normalized;
    }
  };

  const checkConnectivity = async (dto: CheckDatabaseServerConnectivityDto) => {
    try {
      const key = getIdempotencyKey(dto);
      const result = await databaseServersApi.checkConnectivity(dto, key);
      resetKey();
      return result;
    } catch (err) {
      const normalized = normalizeApiError(err);
      throw normalized;
    }
  };

  const openSoftDelete = (server: DatabaseServerView) => {
    setServerPendingDestroy(null);
    setServerPendingDelete(server);
  };

  const closeSoftDelete = () => {
    if (!deletingServerId) setServerPendingDelete(null);
  };

  const openDestroy = (server: DatabaseServerView) => {
    setServerPendingDelete(null);
    setServerPendingDestroy(server);
  };

  const closeDestroy = () => {
    if (!destroyingServerId) setServerPendingDestroy(null);
  };

  const confirmSoftDelete = async () => {
    const server = serverPendingDelete;
    if (!server || deletingServerId) return;

    setDeletingServerId(server.id);
    try {
      const key = getIdempotencyKey({ action: "delete", databaseServerId: server.id });
      await databaseServersApi.delete(server.id, key);
      toast.success(
        lang === "ar" ? "تم حذف الخادم" : "Server deleted",
        lang === "ar"
          ? `تم حذف ${server.name} حذفًا منطقيًا.`
          : `${server.name} was soft deleted.`,
      );
      resetKey();
      setServerPendingDelete(null);
      await fetchServers();
    } catch (err) {
      const normalized = normalizeApiError(err);
      if (shouldResetDatabaseServerWriteKey(normalized)) {
        resetKey();
      }
      toast.error(lang === "ar" ? "فشل الحذف" : "Delete failed", normalized.message);
      throw normalized;
    } finally {
      setDeletingServerId(null);
    }
  };

  const confirmDestroy = async () => {
    const server = serverPendingDestroy;
    if (!server || destroyingServerId) return;

    setDestroyingServerId(server.id);
    try {
      const key = getIdempotencyKey({
        action: "destroy",
        databaseServerId: server.id,
      });
      await databaseServersApi.destroy(server.id, key);
      toast.success(
        lang === "ar" ? "تم إتلاف الخادم" : "Server destroyed",
        lang === "ar"
          ? `تم حذف ${server.name} وجميع سجلاته التابعة المسموح بحذفها نهائيًا.`
          : `${server.name} and its eligible dependent records were permanently removed.`,
      );
      resetKey();
      setServerPendingDestroy(null);
      await fetchServers();
    } catch (err) {
      const normalized = normalizeApiError(err);
      if (shouldResetDatabaseServerWriteKey(normalized)) {
        resetKey();
      }
      toast.error(
        lang === "ar" ? "فشل الإتلاف" : "Destroy failed",
        normalized.message,
      );
    } finally {
      setDestroyingServerId(null);
    }
  };

  return {
    servers,
    isLoading,
    error,
    page,
    setPage,
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
    createServer,
    checkConnectivity,
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

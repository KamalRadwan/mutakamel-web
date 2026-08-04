/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { listStorageServers, createStorageServer } from "../api/storageServersApi";
import type { StorageServerView, StorageServerList, StorageServerStatus, CreateStorageServerDto } from "@/types/storage-server";
import { adminCan, adminCanAll, ADMIN_RBAC_CRITICAL } from "@/lib/auth/rbac";

export function useStorageServers() {
  const { user } = useAuth();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");

  const [servers, setServers] = useState<StorageServerView[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await listStorageServers({
        page,
        limit,
        search,
        status,
        sortBy: "createdAt",
        sortDir: "DESC",
      });
      setServers(res.items);
      setTotalItems(res.total);
    } catch (err: any) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [user, page, limit, search, status]);

  useEffect(() => {
    queueMicrotask(() => fetchData());
  }, [fetchData]);

  const canRead = user ? adminCan(user, "admin.storage_servers.read") : false;

  // Create requires base create + critical
  const canCreate = user
    ? adminCanAll(user, ADMIN_RBAC_CRITICAL.STORAGE_SERVERS_CREATE)
    : false;

  const handleCreate = useCallback(
    async (dto: CreateStorageServerDto) => {
      if (!canCreate) throw new Error("Missing permissions to create storage server");
      const newServer = await createStorageServer(dto);
      await fetchData();
      return newServer;
    },
    [canCreate, fetchData]
  );

  return {
    servers,
    totalItems,
    isLoading,
    error,
    page,
    setPage,
    limit,
    setLimit,
    search,
    setSearch,
    status,
    setStatus,
    canRead,
    canCreate,
    handleCreate,
    refresh: fetchData,
  };
}

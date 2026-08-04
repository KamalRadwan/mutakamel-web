 
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  getStorageServer,
  updateStorageServer,
  activateStorageServer,
  offlineStorageServer,
  deleteStorageServer,
} from "../api/storageServersApi";
import type { StorageServerView, UpdateStorageServerDto } from "@/types/storage-server";
import { adminCan, adminCanAll, ADMIN_RBAC_CRITICAL } from "@/lib/auth/rbac";

export function useStorageServerDetail(id: string | null) {
  const { user } = useAuth();

  const [server, setServer] = useState<StorageServerView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchServer = useCallback(async () => {
    if (!user || !id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getStorageServer(id);
      setServer(data);
    } catch (err: any) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [user, id]);

  useEffect(() => {
    queueMicrotask(() => fetchServer());
  }, [fetchServer]);

  // RBAC checks
  const canRead = user ? adminCan(user, "admin.storage_servers.read") : false;

  const canUpdate = user
    ? adminCanAll(user, ADMIN_RBAC_CRITICAL.STORAGE_SERVERS_UPDATE)
    : false;

  const canDelete = user
    ? adminCanAll(user, ADMIN_RBAC_CRITICAL.STORAGE_SERVERS_DELETE)
    : false;

  const handleUpdate = useCallback(
    async (dto: UpdateStorageServerDto) => {
      if (!canUpdate || !id) throw new Error("Missing permissions or ID");
      const updated = await updateStorageServer(id, dto);
      setServer(updated);
      return updated;
    },
    [id, canUpdate]
  );

  const handleActivate = useCallback(async () => {
    if (!canUpdate || !id) throw new Error("Missing permissions or ID");
    try {
      const updated = await activateStorageServer(id);
      setServer(updated);
      return updated;
    } catch (err: any) {
      // Refresh the server state to capture lastConnectionTestErrorCode from the backend
      await fetchServer();
      throw err;
    }
  }, [id, canUpdate, fetchServer]);

  const handleOffline = useCallback(async () => {
    if (!canUpdate || !id) throw new Error("Missing permissions or ID");
    const updated = await offlineStorageServer(id);
    setServer(updated);
    return updated;
  }, [id, canUpdate]);

  const handleDelete = useCallback(async () => {
    if (!canDelete || !id) throw new Error("Missing permissions or ID");
    await deleteStorageServer(id);
  }, [id, canDelete]);

  const handleMakePlatformDefault = useCallback(async () => {
    if (!canUpdate || !id) throw new Error("Missing permissions or ID");
    const updated = await updateStorageServer(id, { isPlatformDefault: true });
    setServer(updated);
    return updated;
  }, [id, canUpdate]);

  return {
    server,
    isLoading,
    error,
    canRead,
    canUpdate,
    canDelete,
    handleUpdate,
    handleActivate,
    handleOffline,
    handleDelete,
    handleMakePlatformDefault,
    refresh: fetchServer,
  };
}

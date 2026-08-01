import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  getStorageServer,
  updateStorageServer,
  activateStorageServer,
  drainStorageServer,
  offlineStorageServer,
  deleteStorageServer,
  requestVerification,
  setRoutingProfile,
  getStorageServerHistory,
} from "../api/storageServersApi";
import type { StorageServer, UpdateStorageServerDto, SetStorageRoutingProfileDto } from "../types";
import { adminCan, adminCanAll } from "@/lib/auth/rbac";
import { ADMIN_RBAC_CRITICAL } from "@/lib/auth/rbac";

export function useStorageServerDetail(id: string | null) {
  const { user } = useAuth();

  const [server, setServer] = useState<StorageServer | null>(null);
  const [history, setHistory] = useState<any[]>([]);
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

  const fetchHistory = useCallback(async () => {
    if (!user || !id) return;
    try {
      const data = await getStorageServerHistory(id);
      setHistory(data);
    } catch (err: any) {
      // non-fatal
    }
  }, [user, id]);

  useEffect(() => {
    fetchServer();
    fetchHistory();
  }, [fetchServer, fetchHistory]);

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
      fetchHistory();
      return updated;
    },
    [id, canUpdate, fetchHistory]
  );

  const handleActivate = useCallback(async () => {
    if (!canUpdate || !id) throw new Error("Missing permissions or ID");
    const updated = await activateStorageServer(id);
    setServer(updated);
    fetchHistory();
    return updated;
  }, [id, canUpdate, fetchHistory]);

  const handleDrain = useCallback(async () => {
    if (!canUpdate || !id) throw new Error("Missing permissions or ID");
    const updated = await drainStorageServer(id);
    setServer(updated);
    fetchHistory();
    return updated;
  }, [id, canUpdate, fetchHistory]);

  const handleOffline = useCallback(async () => {
    if (!canUpdate || !id) throw new Error("Missing permissions or ID");
    const updated = await offlineStorageServer(id);
    setServer(updated);
    fetchHistory();
    return updated;
  }, [id, canUpdate, fetchHistory]);

  const handleDelete = useCallback(async () => {
    if (!canDelete || !id) throw new Error("Missing permissions or ID");
    await deleteStorageServer(id);
    fetchHistory();
  }, [id, canDelete, fetchHistory]);

  const handleVerify = useCallback(async () => {
    if (!canUpdate || !id) throw new Error("Missing permissions or ID");
    await requestVerification(id);
    fetchHistory();
  }, [id, canUpdate, fetchHistory]);

  const handleSetRouting = useCallback(async (dto: SetStorageRoutingProfileDto) => {
    if (!canUpdate || !id) throw new Error("Missing permissions or ID");
    await setRoutingProfile(id, dto);
    fetchServer();
    fetchHistory();
  }, [id, canUpdate, fetchServer, fetchHistory]);

  return {
    server,
    history,
    isLoading,
    error,
    canRead,
    canUpdate,
    canDelete,
    handleUpdate,
    handleActivate,
    handleDrain,
    handleOffline,
    handleDelete,
    handleVerify,
    handleSetRouting,
    refresh: fetchServer,
  };
}

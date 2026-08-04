"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { backupApi } from "../api";
import type {
  BackupDatabaseConfig,
  BackupPolicy,
  UpsertBackupDatabaseOverrideDto,
  UpsertBackupPolicyDto,
} from "../types";
import { useAuth } from "@/context/AuthContext";
import { adminCan, adminCanAll, ADMIN_RBAC_CRITICAL } from "@/lib/auth/rbac";
import { useBackupServerOptions } from "./useBackupServerOptions";
import { useIdempotency } from "@/shared/hooks/useIdempotency";
import { normalizeApiError, type NormalizedApiError } from "@/shared/api/normalized-api-error";
import { useToast } from "@/components/ui/ToastContext";
import { useI18n } from "@/i18n/I18nContext";
import {
  isCurrentBackupServerRequest,
  ownsSelectedBackupServerState,
} from "./backup-server-request-guard";

export function useBackupPolicies() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const toast = useToast();
  const canReadServers = adminCan(user, "admin.database_servers.read");
  const canManage = adminCanAll(user, ADMIN_RBAC_CRITICAL.BACKUPS_POLICY_MANAGE);
  const serverContext = useBackupServerOptions(canReadServers);
  const { getIdempotencyKey, resetKey } = useIdempotency();
  const [policy, setPolicy] = useState<BackupPolicy | null>(null);
  const [databases, setDatabases] = useState<BackupDatabaseConfig[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [loadedServerId, setLoadedServerId] = useState<string | null>(null);
  const selectedServerIdRef = useRef(serverContext.selectedServerId);
  const requestGenerationRef = useRef(0);
  selectedServerIdRef.current = serverContext.selectedServerId;

  const refresh = useCallback(async () => {
    const serverId = serverContext.selectedServerId;
    const requestGeneration = ++requestGenerationRef.current;
    if (!serverId) {
      setPolicy(null);
      setDatabases([]);
      setLoadedServerId(null);
      setIsLoadingData(false);
      return;
    }
    const isCurrentRequest = () =>
      isCurrentBackupServerRequest({
        requestServerId: serverId,
        selectedServerId: selectedServerIdRef.current,
        requestGeneration,
        currentGeneration: requestGenerationRef.current,
      });

    setIsLoadingData(true);
    setError(null);
    setPolicy(null);
    setDatabases([]);
    setLoadedServerId(null);
    try {
      const [nextPolicy, nextDatabases] = await Promise.all([
        backupApi.getPolicy(serverId),
        backupApi.listDatabaseConfigs(serverId),
      ]);
      if (!isCurrentRequest()) return;
      if (nextPolicy.databaseServerId !== serverId) {
        throw new Error("Backup policy response did not match the selected database server.");
      }
      setPolicy(nextPolicy);
      setDatabases(nextDatabases);
      setLoadedServerId(serverId);
    } catch (caught) {
      if (!isCurrentRequest()) return;
      setError(normalizeApiError(caught));
      setPolicy(null);
      setDatabases([]);
      setLoadedServerId(null);
    } finally {
      if (isCurrentRequest()) setIsLoadingData(false);
    }
  }, [serverContext.selectedServerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const savePolicy = async (data: UpsertBackupPolicyDto) => {
    const serverId = serverContext.selectedServerId;
    if (
      activeAction ||
      !ownsSelectedBackupServerState(serverId, loadedServerId) ||
      policy?.databaseServerId !== serverId
    ) return;
    setActiveAction("policy");
    setError(null);
    try {
      const key = getIdempotencyKey({ action: "backup-policy", databaseServerId: serverId, data });
      const saved = await backupApi.upsertPolicy(serverId, data, key);
      if (saved.databaseServerId !== serverId) {
        throw new Error("Saved backup policy did not match the requested database server.");
      }
      resetKey();
      if (selectedServerIdRef.current === serverId) {
        setPolicy(saved);
        await refresh();
        toast.success(lang === "ar" ? "تم حفظ سياسة النسخ" : "Backup policy saved");
      }
      return saved;
    } catch (caught) {
      const normalized = normalizeApiError(caught);
      if (selectedServerIdRef.current === serverId) {
        setError(normalized);
        toast.error(lang === "ar" ? "فشل حفظ السياسة" : "Policy save failed", normalized.message);
      }
      throw normalized;
    } finally {
      setActiveAction(null);
    }
  };

  const saveOverride = async (tenantId: string, data: UpsertBackupDatabaseOverrideDto) => {
    const serverId = serverContext.selectedServerId;
    if (activeAction || !ownsSelectedBackupServerState(serverId, loadedServerId)) return;
    setActiveAction(`override:${tenantId}`);
    setError(null);
    try {
      const key = getIdempotencyKey({ action: "backup-database-override", databaseServerId: serverId, tenantId, data });
      await backupApi.upsertDatabaseOverride(serverId, tenantId, data, key);
      resetKey();
      if (selectedServerIdRef.current === serverId) {
        await refresh();
        toast.success(lang === "ar" ? "تم حفظ استثناء قاعدة البيانات" : "Database override saved");
      }
    } catch (caught) {
      const normalized = normalizeApiError(caught);
      if (selectedServerIdRef.current === serverId) {
        setError(normalized);
        toast.error(lang === "ar" ? "فشل حفظ الاستثناء" : "Override save failed", normalized.message);
      }
      throw normalized;
    } finally {
      setActiveAction(null);
    }
  };

  const resetOverride = async (tenantId: string) => {
    const serverId = serverContext.selectedServerId;
    if (activeAction || !ownsSelectedBackupServerState(serverId, loadedServerId)) return;
    setActiveAction(`reset:${tenantId}`);
    setError(null);
    try {
      const key = getIdempotencyKey({ action: "delete-backup-database-override", databaseServerId: serverId, tenantId });
      await backupApi.deleteDatabaseOverride(serverId, tenantId, key);
      resetKey();
      if (selectedServerIdRef.current === serverId) {
        await refresh();
        toast.success(lang === "ar" ? "تمت استعادة القيم الافتراضية" : "Policy defaults restored");
      }
    } catch (caught) {
      const normalized = normalizeApiError(caught);
      if (selectedServerIdRef.current === serverId) {
        setError(normalized);
        toast.error(lang === "ar" ? "فشل حذف الاستثناء" : "Override reset failed", normalized.message);
      }
      throw normalized;
    } finally {
      setActiveAction(null);
    }
  };

  const ownsSelectedServerState = ownsSelectedBackupServerState(
    serverContext.selectedServerId,
    loadedServerId,
  );

  return {
    ...serverContext,
    canReadServers,
    canManage,
    policy: ownsSelectedServerState ? policy : null,
    databases: ownsSelectedServerState ? databases : [],
    loadedServerId,
    ownsSelectedServerState,
    isLoadingData:
      isLoadingData ||
      (serverContext.selectedServerId.length > 0 &&
        !ownsSelectedServerState &&
        error === null &&
        serverContext.error === null),
    error: error ?? serverContext.error,
    activeAction,
    refresh,
    savePolicy,
    saveOverride,
    resetOverride,
  };
}

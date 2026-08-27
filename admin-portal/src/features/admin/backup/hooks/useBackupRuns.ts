"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { backupApi, backupDatabaseAccessApi } from "../api";
import type {
  BackupDatabaseServerOption,
  BackupRun,
  BackupRunStatus,
  StartBackupRunDto,
} from "../types";
import { useAuth } from "@/context/AuthContext";
import { adminCan, adminCanAll, ADMIN_RBAC_CRITICAL } from "@/lib/auth/rbac";
import { useIdempotency } from "@/shared/hooks/useIdempotency";
import { usePersistedCommandAttempt } from "@/shared/hooks/usePersistedCommandAttempt";
import {
  normalizeApiError,
  type NormalizedApiError,
} from "@/shared/api/normalized-api-error";
import { useToast } from "@/components/ui/ToastContext";
import { useI18n } from "@/i18n/I18nContext";
import { shouldRetainBackupCommandKey } from "../lib/backup-format";

export function useBackupRuns() {
  const { user } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const searchParams = useSearchParams();
  const canReadServers = adminCan(user, "admin.database_servers.read");
  const canStart = adminCan(user, "admin.backups.manage");
  const canDelete = adminCanAll(user, ADMIN_RBAC_CRITICAL.BACKUPS_DELETE);
  const startCommand = usePersistedCommandAttempt(
    "admin.backup.pending.start-run.v1",
    "/api/admin/worker/v1/backups/runs",
  );
  const deleteCommand = useIdempotency();
  const [servers, setServers] = useState<BackupDatabaseServerOption[]>([]);
  const [runs, setRuns] = useState<BackupRun[]>([]);
  const routeDatabaseServerId = searchParams.get("databaseServerId") ?? "";
  const [databaseServerId, setDatabaseServerId] = useState(routeDatabaseServerId);
  const [status, setStatus] = useState<BackupRunStatus | "">("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [enrichmentWarning, setEnrichmentWarning] =
    useState<NormalizedApiError | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [retryableCommandError, setRetryableCommandError] =
    useState<NormalizedApiError | null>(null);
  const refreshGenerationRef = useRef(0);
  const [prevRouteDb, setPrevRouteDb] = useState(routeDatabaseServerId);
  if (routeDatabaseServerId !== prevRouteDb) {
    setPrevRouteDb(routeDatabaseServerId);
    setDatabaseServerId(routeDatabaseServerId);
  }

  const refresh = useCallback(async () => {
    const refreshGeneration = ++refreshGenerationRef.current;
    setIsLoading(true);
    setError(null);
    setEnrichmentWarning(null);
    const serverEnrichment = canReadServers
      ? backupDatabaseAccessApi.listServers().then(
          (data) => ({ ok: true as const, data }),
          (caught: unknown) => ({
            ok: false as const,
            error: normalizeApiError(caught),
          }),
        )
      : Promise.resolve({
          ok: true as const,
          data: [] as BackupDatabaseServerOption[],
        });

    try {
      const nextRuns = await backupApi.listRuns({
        ...(databaseServerId ? { databaseServerId } : {}),
        ...(status ? { status } : {}),
      });
      if (refreshGeneration !== refreshGenerationRef.current) return;
      setRuns(nextRuns);
    } catch (caught) {
      if (refreshGeneration !== refreshGenerationRef.current) return;
      setError(normalizeApiError(caught));
    } finally {
      if (refreshGeneration === refreshGenerationRef.current) setIsLoading(false);
    }

    const enrichment = await serverEnrichment;
    if (refreshGeneration !== refreshGenerationRef.current) return;
    if (enrichment.ok) {
      setServers(enrichment.data);
    } else {
      setServers([]);
      setEnrichmentWarning(enrichment.error);
    }
  }, [canReadServers, databaseServerId, status]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refresh();
    }, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  const startRun = async (data: StartBackupRunDto) => {
    if (activeAction) return;
    const intent = { action: "start-backup-run", ...data };
    setActiveAction("start");
    setError(null);
    setRetryableCommandError(null);
    try {
      const idempotencyKey = await startCommand.prepare(intent, {
        kind: "DATABASE_SERVER",
        id: data.databaseServerId,
      });
      const run = await backupApi.startRun(data, idempotencyKey);
      startCommand.clear();
      await refresh();
      toast.success(t.backup.runs.startedTitle, run.id);
      return run;
    } catch (caught) {
      const normalized = normalizeApiError(caught);
      if (shouldRetainBackupCommandKey(normalized)) {
        setRetryableCommandError(normalized);
        toast.warning(t.backup.runs.retryableTitle, t.backup.runs.retryableDescription);
      } else {
        startCommand.clear();
        setError(normalized);
        toast.error(t.backup.runs.startFailedTitle, normalized.message);
      }
      throw normalized;
    } finally {
      setActiveAction(null);
    }
  };

  const deleteRun = async (runId: string) => {
    if (activeAction) return;
    setActiveAction(`delete:${runId}`);
    setError(null);
    try {
      const key = deleteCommand.getIdempotencyKey({
        action: "delete-backup-run",
        runId,
      });
      await backupApi.deleteRun(runId, key);
      deleteCommand.resetKey();
      await refresh();
      toast.success(t.backup.runs.deletedTitle);
    } catch (caught) {
      const normalized = normalizeApiError(caught);
      setError(normalized);
      toast.error(t.backup.runs.deleteFailedTitle, normalized.message);
      throw normalized;
    } finally {
      setActiveAction(null);
    }
  };

  return {
    runs,
    servers,
    databaseServerId,
    setDatabaseServerId,
    status,
    setStatus,
    canReadServers,
    canStart,
    canDelete,
    isLoading,
    error,
    enrichmentWarning,
    retryableCommandError,
    pendingCommandAttempt: startCommand.pendingAttempt,
    activeAction,
    refresh,
    startRun,
    deleteRun,
  };
}

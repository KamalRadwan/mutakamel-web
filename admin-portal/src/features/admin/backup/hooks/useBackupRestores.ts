"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { backupApi, backupDatabaseAccessApi } from "../api";
import {
  RestoreRunStatus,
  type BackupArtifact,
  type BackupDatabaseServerOption,
  type PromoteRestoreRunDto,
  type RestoreRun,
  type RestoreRunListQuery,
  type StartRestoreRunDto,
} from "../types";
import { useAuth } from "@/context/AuthContext";
import { adminCan, adminCanAll, ADMIN_RBAC_CRITICAL } from "@/lib/auth/rbac";
import {
  normalizeApiError,
  type NormalizedApiError,
} from "@/shared/api/normalized-api-error";
import { usePersistedCommandAttempt } from "@/shared/hooks/usePersistedCommandAttempt";
import { useToast } from "@/components/ui/ToastContext";
import { useI18n } from "@/i18n/I18nContext";
import { shouldRetainBackupCommandKey } from "../lib/backup-format";

export function useBackupRestores() {
  const { user } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const searchParams = useSearchParams();
  const canReadServers = adminCan(user, "admin.database_servers.read");
  const canRestore = adminCanAll(user, ADMIN_RBAC_CRITICAL.BACKUPS_RESTORE);
  const restoreStartCommand = usePersistedCommandAttempt(
    "admin.backup.pending.start-restore.v1",
    "/api/admin/worker/v1/restores/runs",
  );
  const restorePromotionCommand = usePersistedCommandAttempt(
    "admin.backup.pending.promote-restore.v1",
    "/api/admin/worker/v1/restores/runs/:runId/promote",
  );
  const pendingPromotionAttempt = restorePromotionCommand.pendingAttempt;
  const clearPendingPromotionAttempt = restorePromotionCommand.clear;
  const [servers, setServers] = useState<BackupDatabaseServerOption[]>([]);
  const [artifacts, setArtifacts] = useState<BackupArtifact[]>([]);
  const [restores, setRestores] = useState<RestoreRun[]>([]);
  const [query, setQuery] = useState<RestoreRunListQuery>({});
  const requestedArtifactId = searchParams.get("artifactId") ?? "";
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [enrichmentWarning, setEnrichmentWarning] =
    useState<NormalizedApiError | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [retryableCommandError, setRetryableCommandError] =
    useState<NormalizedApiError | null>(null);
  const refreshGenerationRef = useRef(0);

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
      const [nextRestores, nextArtifacts] = await Promise.all([
        backupApi.listRestores(query),
        backupApi.listArtifacts(),
      ]);
      if (refreshGeneration !== refreshGenerationRef.current) return;
      setRestores(nextRestores);
      setArtifacts(
        nextArtifacts.filter((artifact) => artifact.status === "COMPLETED"),
      );
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
      setEnrichmentWarning(enrichment.error);
    }
  }, [canReadServers, query]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refresh();
    }, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    const acceptedPromotion = pendingPromotionAttempt;
    if (
      acceptedPromotion?.resource.kind === "RESTORE_RUN" &&
      restores.some(
        (restore) =>
          restore.id === acceptedPromotion.resource.id &&
          restore.status === RestoreRunStatus.PROMOTED,
      )
    ) {
      clearPendingPromotionAttempt();
    }
  }, [clearPendingPromotionAttempt, pendingPromotionAttempt, restores]);

  const handleCommandError = (
    normalized: NormalizedApiError,
    clearAttempt: () => void,
  ) => {
    if (shouldRetainBackupCommandKey(normalized)) {
      setRetryableCommandError(normalized);
      toast.warning(t.backup.restores.retryableTitle, t.backup.restores.retryableDescription);
    } else {
      clearAttempt();
      setError(normalized);
      toast.error(t.backup.restores.commandFailedTitle, normalized.message);
    }
  };

  const startRestore = async (data: StartRestoreRunDto) => {
    if (activeAction) return;
    setActiveAction("start");
    setError(null);
    setRetryableCommandError(null);
    try {
      const key = await restoreStartCommand.prepare(
        { action: "start-restore-run", ...data },
        { kind: "BACKUP_ARTIFACT", id: data.artifactId },
      );
      const run = await backupApi.startRestore(data, key);
      restoreStartCommand.clear();
      await refresh();
      toast.success(t.backup.restores.startedTitle, run.id);
      return run;
    } catch (caught) {
      const normalized = normalizeApiError(caught);
      handleCommandError(normalized, restoreStartCommand.clear);
      throw normalized;
    } finally {
      setActiveAction(null);
    }
  };

  const promoteRestore = async (runId: string, data: PromoteRestoreRunDto) => {
    if (activeAction) return;
    setActiveAction(`promote:${runId}`);
    setError(null);
    setRetryableCommandError(null);
    try {
      const key = await restorePromotionCommand.prepare(
        { action: "promote-restore-run", runId, ...data },
        { kind: "RESTORE_RUN", id: runId },
      );
      const run = await backupApi.promoteRestore(runId, data, key);
      restorePromotionCommand.clear();
      await refresh();
      toast.success(t.backup.restores.promotedTitle, run.id);
      return run;
    } catch (caught) {
      const normalized = normalizeApiError(caught);
      handleCommandError(normalized, restorePromotionCommand.clear);
      throw normalized;
    } finally {
      setActiveAction(null);
    }
  };

  return {
    restores,
    artifacts,
    servers,
    requestedArtifactId,
    query,
    setQuery: (tenantId: string, status: RestoreRunStatus | "") =>
      setQuery({
        ...(tenantId ? { tenantId } : {}),
        ...(status ? { status } : {}),
      }),
    canRestore,
    isLoading,
    error,
    enrichmentWarning,
    retryableCommandError,
    pendingStartAttempt: restoreStartCommand.pendingAttempt,
    pendingPromotionAttempt,
    activeAction,
    refresh,
    startRestore,
    promoteRestore,
  };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { backupApi, backupDatabaseAccessApi } from "../api";
import type { BackupDatabaseServerOption, BackupRun, BackupRunStatus, StartBackupRunDto } from "../types";
import { useAuth } from "@/context/AuthContext";
import { adminCan, adminCanAll, ADMIN_RBAC_CRITICAL } from "@/lib/auth/rbac";
import { useIdempotency } from "@/shared/hooks/useIdempotency";
import { normalizeApiError, type NormalizedApiError } from "@/shared/api/normalized-api-error";
import { useToast } from "@/components/ui/ToastContext";
import { useI18n } from "@/i18n/I18nContext";
import { isAmbiguousWriteFailure } from "../lib/backup-format";
import { useBackupNonIdempotentCommandGuard } from "./useBackupNonIdempotentCommandGuard";
import type { BackupNonIdempotentCommandAttempt } from "./non-idempotent-command-guard";

export function useBackupRuns() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const toast = useToast();
  const searchParams = useSearchParams();
  const canReadServers = adminCan(user, "admin.database_servers.read");
  const canStart = adminCan(user, "admin.backups.manage");
  const canDelete = adminCanAll(user, ADMIN_RBAC_CRITICAL.BACKUPS_DELETE);
  const { getIdempotencyKey, resetKey } = useIdempotency();
  const commandGuard = useBackupNonIdempotentCommandGuard();
  const [servers, setServers] = useState<BackupDatabaseServerOption[]>([]);
  const [runs, setRuns] = useState<BackupRun[]>([]);
  const routeDatabaseServerId = searchParams.get("databaseServerId") ?? "";
  const [databaseServerId, setDatabaseServerId] = useState(routeDatabaseServerId);
  const [status, setStatus] = useState<BackupRunStatus | "">("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [enrichmentWarning, setEnrichmentWarning] = useState<NormalizedApiError | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [ambiguousError, setAmbiguousError] = useState<NormalizedApiError | null>(null);
  const [reconciliationRuns, setReconciliationRuns] = useState<BackupRun[]>([]);
  const [reconciliationError, setReconciliationError] = useState<NormalizedApiError | null>(null);
  const [isReconcilingAttempt, setIsReconcilingAttempt] = useState(false);
  const refreshGenerationRef = useRef(0);
  const guardAttemptRef = useRef(commandGuard.attempt);
  const reconciliationGenerationRef = useRef(0);
  guardAttemptRef.current = commandGuard.attempt;

  useEffect(() => {
    setDatabaseServerId(routeDatabaseServerId);
  }, [routeDatabaseServerId]);

  const refresh = useCallback(async () => {
    const refreshGeneration = ++refreshGenerationRef.current;
    setIsLoading(true);
    setError(null);
    setEnrichmentWarning(null);
    const serverEnrichment = canReadServers
      ? backupDatabaseAccessApi.listServers().then(
          (data) => ({ ok: true as const, data }),
          (caught: unknown) => ({ ok: false as const, error: normalizeApiError(caught) }),
        )
      : Promise.resolve({ ok: true as const, data: [] as BackupDatabaseServerOption[] });

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
    void refresh();
  }, [refresh]);

  const reconcileBackupStartAttempt = useCallback(
    async (attempt: BackupNonIdempotentCommandAttempt) => {
      const generation = ++reconciliationGenerationRef.current;
      if (attempt.kind !== "BACKUP_START") {
        setReconciliationRuns([]);
        setReconciliationError(null);
        setIsReconcilingAttempt(false);
        return;
      }

      setIsReconcilingAttempt(true);
      setReconciliationError(null);
      try {
        const authoritativeRuns = await backupApi.listRuns({
          databaseServerId: attempt.targetId,
        });
        if (
          generation !== reconciliationGenerationRef.current ||
          guardAttemptRef.current?.localCommandId !== attempt.localCommandId
        ) return;
        setReconciliationRuns(authoritativeRuns);
      } catch (caught) {
        if (
          generation !== reconciliationGenerationRef.current ||
          guardAttemptRef.current?.localCommandId !== attempt.localCommandId
        ) return;
        setReconciliationError(normalizeApiError(caught));
        setReconciliationRuns([]);
      } finally {
        if (
          generation === reconciliationGenerationRef.current &&
          guardAttemptRef.current?.localCommandId === attempt.localCommandId
        ) {
          setIsReconcilingAttempt(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    const attempt = commandGuard.attempt;
    if (!attempt || attempt.kind !== "BACKUP_START") {
      reconciliationGenerationRef.current += 1;
      setReconciliationRuns([]);
      setReconciliationError(null);
      setIsReconcilingAttempt(false);
      return;
    }
    void reconcileBackupStartAttempt(attempt);
  }, [
    commandGuard.attempt,
    reconcileBackupStartAttempt,
  ]);

  const startRun = async (data: StartBackupRunDto) => {
    if (activeAction || commandGuard.isBlocked) return;
    const attempt = commandGuard.begin("BACKUP_START", data.databaseServerId);
    if (!attempt) return;
    guardAttemptRef.current = attempt;
    setActiveAction("start");
    setError(null);
    setAmbiguousError(null);
    try {
      const run = await backupApi.startRun(data);
      commandGuard.clear(attempt.localCommandId);
      guardAttemptRef.current = null;
      await refresh();
      toast.success(lang === "ar" ? "بدأت عملية النسخ" : "Backup run started", run.id);
      return run;
    } catch (caught) {
      const normalized = normalizeApiError(caught);
      if (isAmbiguousWriteFailure(normalized.httpStatus)) {
        const unknownAttempt = { ...attempt, status: "UNKNOWN" as const };
        guardAttemptRef.current = unknownAttempt;
        commandGuard.markUnknown(attempt.localCommandId);
        setAmbiguousError(normalized);
        await reconcileBackupStartAttempt(unknownAttempt);
        await refresh();
        toast.warning(
          lang === "ar" ? "نتيجة العملية غير مؤكدة" : "Run outcome is unknown",
          lang === "ar" ? "راجع القراءة المرجعية للخادم قبل مسح قفل الأمر." : "Review the authoritative server read before clearing the command lock.",
          0,
        );
      } else {
        commandGuard.clear(attempt.localCommandId);
        guardAttemptRef.current = null;
        setError(normalized);
        toast.error(lang === "ar" ? "فشل بدء النسخ" : "Backup start failed", normalized.message);
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
      const key = getIdempotencyKey({ action: "delete-backup-run", runId });
      await backupApi.deleteRun(runId, key);
      resetKey();
      await refresh();
      toast.success(lang === "ar" ? "تم حذف سجل العملية" : "Backup run deleted");
    } catch (caught) {
      const normalized = normalizeApiError(caught);
      setError(normalized);
      toast.error(lang === "ar" ? "فشل حذف العملية" : "Run delete failed", normalized.message);
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
    activeAction,
    unknownOutcome: commandGuard.attempt,
    ambiguousError,
    reconciliationRuns,
    reconciliationError,
    isReconcilingAttempt,
    commandGuardError: commandGuard.storageError,
    commandGuardBlocked: commandGuard.isBlocked,
    acknowledgeUnknownOutcome: () => {
      const attempt = commandGuard.attempt;
      if (!attempt || attempt.kind !== "BACKUP_START") return;
      if (commandGuard.clear(attempt.localCommandId)) {
        guardAttemptRef.current = null;
        setAmbiguousError(null);
        setReconciliationRuns([]);
        setReconciliationError(null);
      }
    },
    refresh,
    startRun,
    deleteRun,
  };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { backupApi, backupDatabaseAccessApi } from "../api";
import type {
  BackupArtifact,
  BackupDatabaseServerOption,
  PromoteRestoreRunDto,
  RestoreRun,
  RestoreRunListQuery,
  RestoreRunStatus,
  StartRestoreRunDto,
} from "../types";
import { useAuth } from "@/context/AuthContext";
import { adminCan, adminCanAll, ADMIN_RBAC_CRITICAL } from "@/lib/auth/rbac";
import { normalizeApiError, type NormalizedApiError } from "@/shared/api/normalized-api-error";
import { useToast } from "@/components/ui/ToastContext";
import { useI18n } from "@/i18n/I18nContext";
import { isAmbiguousWriteFailure } from "../lib/backup-format";
import { useBackupNonIdempotentCommandGuard } from "./useBackupNonIdempotentCommandGuard";
import type { BackupNonIdempotentCommandAttempt } from "./non-idempotent-command-guard";

export function useBackupRestores() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const toast = useToast();
  const searchParams = useSearchParams();
  const canReadServers = adminCan(user, "admin.database_servers.read");
  const canRestore = adminCanAll(user, ADMIN_RBAC_CRITICAL.BACKUPS_RESTORE);
  const commandGuard = useBackupNonIdempotentCommandGuard();
  const [servers, setServers] = useState<BackupDatabaseServerOption[]>([]);
  const [artifacts, setArtifacts] = useState<BackupArtifact[]>([]);
  const [restores, setRestores] = useState<RestoreRun[]>([]);
  const [query, setQuery] = useState<RestoreRunListQuery>({});
  const requestedArtifactId = searchParams.get("artifactId") ?? "";
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [enrichmentWarning, setEnrichmentWarning] = useState<NormalizedApiError | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [ambiguousError, setAmbiguousError] = useState<NormalizedApiError | null>(null);
  const [reconciliationRestores, setReconciliationRestores] = useState<RestoreRun[]>([]);
  const [reconciliationArtifactFound, setReconciliationArtifactFound] = useState<boolean | null>(null);
  const [reconciliationError, setReconciliationError] = useState<NormalizedApiError | null>(null);
  const [isReconcilingAttempt, setIsReconcilingAttempt] = useState(false);
  const refreshGenerationRef = useRef(0);
  const guardAttemptRef = useRef(commandGuard.attempt);
  const reconciliationGenerationRef = useRef(0);
  guardAttemptRef.current = commandGuard.attempt;

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
      const [nextRestores, nextArtifacts] = await Promise.all([
        backupApi.listRestores(query),
        backupApi.listArtifacts(),
      ]);
      if (refreshGeneration !== refreshGenerationRef.current) return;
      setRestores(nextRestores);
      setArtifacts(nextArtifacts.filter((artifact) => artifact.status === "COMPLETED"));
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
  }, [canReadServers, query]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const reconcileRestoreAttempt = useCallback(
    async (attempt: BackupNonIdempotentCommandAttempt) => {
      const generation = ++reconciliationGenerationRef.current;
      if (
        attempt.kind !== "RESTORE_START" &&
        attempt.kind !== "RESTORE_PROMOTE"
      ) {
        setReconciliationRestores([]);
        setReconciliationArtifactFound(null);
        setReconciliationError(null);
        setIsReconcilingAttempt(false);
        return;
      }

      setIsReconcilingAttempt(true);
      setReconciliationError(null);
      try {
        let authoritativeRestores: RestoreRun[];
        let artifactFound: boolean | null = null;
        if (attempt.kind === "RESTORE_PROMOTE") {
          authoritativeRestores = [await backupApi.getRestore(attempt.targetId)];
        } else {
          const availableArtifacts = await backupApi.listArtifacts();
          const targetArtifact = availableArtifacts.find(
            (artifact) => artifact.id === attempt.targetId,
          );
          artifactFound = Boolean(targetArtifact);
          authoritativeRestores = targetArtifact
            ? await backupApi.listRestores({ tenantId: targetArtifact.tenantId })
            : [];
        }

        if (
          generation !== reconciliationGenerationRef.current ||
          guardAttemptRef.current?.localCommandId !== attempt.localCommandId
        ) return;
        setReconciliationRestores(authoritativeRestores);
        setReconciliationArtifactFound(artifactFound);
      } catch (caught) {
        if (
          generation !== reconciliationGenerationRef.current ||
          guardAttemptRef.current?.localCommandId !== attempt.localCommandId
        ) return;
        setReconciliationError(normalizeApiError(caught));
        setReconciliationRestores([]);
        setReconciliationArtifactFound(null);
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
    if (
      !attempt ||
      (attempt.kind !== "RESTORE_START" &&
        attempt.kind !== "RESTORE_PROMOTE")
    ) {
      reconciliationGenerationRef.current += 1;
      setReconciliationRestores([]);
      setReconciliationArtifactFound(null);
      setReconciliationError(null);
      setIsReconcilingAttempt(false);
      return;
    }
    void reconcileRestoreAttempt(attempt);
  }, [commandGuard.attempt, reconcileRestoreAttempt]);

  const handleNonIdempotentError = async (
    attempt: BackupNonIdempotentCommandAttempt,
    caught: unknown,
  ) => {
    const normalized = normalizeApiError(caught);
    if (isAmbiguousWriteFailure(normalized.httpStatus)) {
      const unknownAttempt = { ...attempt, status: "UNKNOWN" as const };
      guardAttemptRef.current = unknownAttempt;
      commandGuard.markUnknown(attempt.localCommandId);
      setAmbiguousError(normalized);
      await reconcileRestoreAttempt(unknownAttempt);
      await refresh();
      toast.warning(
        lang === "ar" ? "نتيجة أمر الاستعادة غير مؤكدة" : "Restore command outcome is unknown",
        lang === "ar" ? "راجع القراءة المرجعية من Worker قبل مسح قفل الأمر." : "Review the authoritative Worker read before clearing the command lock.",
        0,
      );
    } else {
      commandGuard.clear(attempt.localCommandId);
      guardAttemptRef.current = null;
      setError(normalized);
      toast.error(lang === "ar" ? "فشل أمر الاستعادة" : "Restore command failed", normalized.message);
    }
    throw normalized;
  };

  const startRestore = async (data: StartRestoreRunDto) => {
    if (activeAction || commandGuard.isBlocked) return;
    const attempt = commandGuard.begin("RESTORE_START", data.artifactId);
    if (!attempt) return;
    guardAttemptRef.current = attempt;
    setActiveAction("start");
    setError(null);
    setAmbiguousError(null);
    try {
      const run = await backupApi.startRestore(data);
      commandGuard.clear(attempt.localCommandId);
      guardAttemptRef.current = null;
      await refresh();
      toast.success(lang === "ar" ? "بدأ اختبار الاستعادة" : "Restore test started", run.id);
      return run;
    } catch (caught) {
      return handleNonIdempotentError(attempt, caught);
    } finally {
      setActiveAction(null);
    }
  };

  const promoteRestore = async (runId: string, data: PromoteRestoreRunDto) => {
    if (activeAction || commandGuard.isBlocked) return;
    const attempt = commandGuard.begin("RESTORE_PROMOTE", runId);
    if (!attempt) return;
    guardAttemptRef.current = attempt;
    setActiveAction(`promote:${runId}`);
    setError(null);
    setAmbiguousError(null);
    try {
      const run = await backupApi.promoteRestore(runId, data);
      commandGuard.clear(attempt.localCommandId);
      guardAttemptRef.current = null;
      await refresh();
      toast.success(lang === "ar" ? "تمت ترقية الاستعادة" : "Restore promoted", run.id);
      return run;
    } catch (caught) {
      return handleNonIdempotentError(attempt, caught);
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
    setQuery: (tenantId: string, status: RestoreRunStatus | "") => setQuery({ ...(tenantId ? { tenantId } : {}), ...(status ? { status } : {}) }),
    canRestore,
    isLoading,
    error,
    enrichmentWarning,
    activeAction,
    unknownOutcome: commandGuard.attempt,
    ambiguousError,
    reconciliationRestores,
    reconciliationArtifactFound,
    reconciliationError,
    isReconcilingAttempt,
    commandGuardError: commandGuard.storageError,
    commandGuardBlocked: commandGuard.isBlocked,
    acknowledgeUnknownOutcome: () => {
      const attempt = commandGuard.attempt;
      if (
        !attempt ||
        (attempt.kind !== "RESTORE_START" &&
          attempt.kind !== "RESTORE_PROMOTE")
      ) return;
      if (commandGuard.clear(attempt.localCommandId)) {
        guardAttemptRef.current = null;
        setAmbiguousError(null);
        setReconciliationRestores([]);
        setReconciliationArtifactFound(null);
        setReconciliationError(null);
      }
    },
    refresh,
    startRestore,
    promoteRestore,
  };
}

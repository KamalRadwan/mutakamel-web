"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { backupApi, backupDatabaseAccessApi } from "../api";
import type { BackupArtifact, BackupArtifactListQuery, BackupDatabaseServerOption } from "../types";
import { useAuth } from "@/context/AuthContext";
import { adminCan, adminCanAll, ADMIN_RBAC_CRITICAL } from "@/lib/auth/rbac";
import { useIdempotency } from "@/shared/hooks/useIdempotency";
import { normalizeApiError, type NormalizedApiError } from "@/shared/api/normalized-api-error";
import { useToast } from "@/components/ui/ToastContext";
import { useI18n } from "@/i18n/I18nContext";

export function useBackupArtifacts() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const toast = useToast();
  const searchParams = useSearchParams();
  const canReadServers = adminCan(user, "admin.database_servers.read");
  const canDelete = adminCanAll(user, ADMIN_RBAC_CRITICAL.BACKUPS_DELETE);
  const canRestore = adminCanAll(user, ADMIN_RBAC_CRITICAL.BACKUPS_RESTORE);
  const { getIdempotencyKey, resetKey } = useIdempotency();
  const [servers, setServers] = useState<BackupDatabaseServerOption[]>([]);
  const [artifacts, setArtifacts] = useState<BackupArtifact[]>([]);
  const [query, setQuery] = useState<BackupArtifactListQuery>({
    ...(searchParams.get("runId") ? { runId: searchParams.get("runId")! } : {}),
    ...(searchParams.get("databaseServerId") ? { databaseServerId: searchParams.get("databaseServerId")! } : {}),
    ...(searchParams.get("tenantId") ? { tenantId: searchParams.get("tenantId")! } : {}),
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [enrichmentWarning, setEnrichmentWarning] = useState<NormalizedApiError | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const refreshGenerationRef = useRef(0);

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
      const nextArtifacts = await backupApi.listArtifacts(query);
      if (refreshGeneration !== refreshGenerationRef.current) return;
      setArtifacts(nextArtifacts);
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
    const timer = setTimeout(() => { void refresh(); }, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  const deleteArtifact = async (artifactId: string) => {
    if (activeAction) return;
    setActiveAction(`delete:${artifactId}`);
    setError(null);
    try {
      const key = getIdempotencyKey({ action: "delete-backup-artifact", artifactId });
      await backupApi.deleteArtifact(artifactId, key);
      resetKey();
      await refresh();
      toast.success(lang === "ar" ? "تم حذف النسخة المحفوظة" : "Backup artifact deleted");
    } catch (caught) {
      const normalized = normalizeApiError(caught);
      setError(normalized);
      toast.error(lang === "ar" ? "فشل حذف النسخة" : "Artifact delete failed", normalized.message);
      throw normalized;
    } finally {
      setActiveAction(null);
    }
  };

  return {
    artifacts,
    servers,
    query,
    setQuery,
    canDelete,
    canRestore,
    isLoading,
    error,
    enrichmentWarning,
    activeAction,
    refresh,
    deleteArtifact,
  };
}

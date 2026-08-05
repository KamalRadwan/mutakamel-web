"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { backupDatabaseAccessApi } from "../api";
import type { BackupDatabaseAccessBinding, UpdateBackupRotationPolicyDto } from "../types";
import { useBackupServerOptions } from "./useBackupServerOptions";
import { useAuth } from "@/context/AuthContext";
import { adminCan, adminCanAll, ADMIN_RBAC_CRITICAL } from "@/lib/auth/rbac";
import { useIdempotency } from "@/shared/hooks/useIdempotency";
import { normalizeApiError, type NormalizedApiError } from "@/shared/api/normalized-api-error";
import { useToast } from "@/components/ui/ToastContext";
import { useI18n } from "@/i18n/I18nContext";
import {
  isCurrentBackupServerRequest,
  ownsSelectedBackupServerState,
} from "./backup-server-request-guard";

export function useBackupDatabaseAccess() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const toast = useToast();
  const canRead = adminCan(user, "admin.database_servers.read");
  const canUpdatePolicy = adminCanAll(user, ADMIN_RBAC_CRITICAL.BACKUP_DB_ROTATION_POLICY_UPDATE);
  const canRegenerate = adminCanAll(user, ADMIN_RBAC_CRITICAL.BACKUP_DB_CREDENTIAL_REGENERATE);
  const canReconcile = adminCanAll(user, ADMIN_RBAC_CRITICAL.BACKUP_DB_CREDENTIAL_RECONCILE);
  const serverContext = useBackupServerOptions(canRead);
  const { getIdempotencyKey, resetKey } = useIdempotency();
  const [binding, setBinding] = useState<BackupDatabaseAccessBinding | null>(null);
  const [isLoadingBinding, setIsLoadingBinding] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [activeAction, setActiveAction] = useState<"policy" | "regenerate" | "reconcile" | null>(null);
  const [bindingServerId, setBindingServerId] = useState<string | null>(null);
  const selectedServerIdRef = useRef(serverContext.selectedServerId);
  const requestGenerationRef = useRef(0);
  useEffect(() => {
    selectedServerIdRef.current = serverContext.selectedServerId;
  }, [serverContext.selectedServerId]);

  const refreshBinding = useCallback(async () => {
    const serverId = serverContext.selectedServerId;
    const requestGeneration = ++requestGenerationRef.current;
    if (!canRead || !serverId) {
      setBinding(null);
      setBindingServerId(null);
      setIsLoadingBinding(false);
      return;
    }
    const isCurrentRequest = () =>
      isCurrentBackupServerRequest({
        requestServerId: serverId,
        selectedServerId: selectedServerIdRef.current,
        requestGeneration,
        currentGeneration: requestGenerationRef.current,
      });

    setIsLoadingBinding(true);
    setError(null);
    setBinding(null);
    setBindingServerId(null);
    try {
      const nextBinding = await backupDatabaseAccessApi.getBinding(serverId);
      if (!isCurrentRequest()) return;
      setBinding(nextBinding);
      setBindingServerId(serverId);
    } catch (caught) {
      if (!isCurrentRequest()) return;
      setError(normalizeApiError(caught));
      setBinding(null);
      setBindingServerId(null);
    } finally {
      if (isCurrentRequest()) setIsLoadingBinding(false);
    }
  }, [canRead, serverContext.selectedServerId]);

  useEffect(() => {
    const timer = setTimeout(() => { void refreshBinding(); }, 0);
    return () => clearTimeout(timer);
  }, [refreshBinding]);

  const updatePolicy = async (
    values: Omit<UpdateBackupRotationPolicyDto, "expectedCredentialRevision">,
  ) => {
    const serverId = serverContext.selectedServerId;
    if (
      !binding ||
      activeAction ||
      !ownsSelectedBackupServerState(serverId, bindingServerId)
    ) return;
    const payload: UpdateBackupRotationPolicyDto = {
      ...values,
      expectedCredentialRevision: binding.credentialRevision,
    };
    setActiveAction("policy");
    setError(null);
    try {
      const key = getIdempotencyKey({ action: "backup-rotation-policy", serverId, payload });
      const next = await backupDatabaseAccessApi.updateRotationPolicy(serverId, payload, key);
      resetKey();
      if (selectedServerIdRef.current === serverId) {
        setBinding(next);
        setBindingServerId(serverId);
        toast.success(lang === "ar" ? "تم تحديث سياسة التدوير" : "Rotation policy updated");
      }
      return next;
    } catch (caught) {
      const normalized = normalizeApiError(caught);
      if (selectedServerIdRef.current === serverId) {
        setError(normalized);
        toast.error(lang === "ar" ? "فشل تحديث السياسة" : "Policy update failed", normalized.message);
      }
      throw normalized;
    } finally {
      setActiveAction(null);
    }
  };

  const runCredentialCommand = async (action: "regenerate" | "reconcile", reason: string) => {
    const serverId = serverContext.selectedServerId;
    if (
      !binding ||
      activeAction ||
      !ownsSelectedBackupServerState(serverId, bindingServerId)
    ) return;
    const payload = { expectedCredentialRevision: binding.credentialRevision, reason };
    setActiveAction(action);
    setError(null);
    try {
      const key = getIdempotencyKey({ action: `backup-${action}`, serverId, payload });
      if (action === "regenerate") {
        await backupDatabaseAccessApi.regenerateCredential(serverId, payload, key);
      } else {
        await backupDatabaseAccessApi.reconcileCredential(serverId, payload, key);
      }
      resetKey();
      if (selectedServerIdRef.current === serverId) {
        await refreshBinding();
        toast.success(
          lang === "ar" ? "تم قبول الأمر" : "Command accepted",
          lang === "ar" ? "تم تحديث دليل الاعتماد الآمن." : "Secret-free credential evidence was refreshed.",
        );
      }
    } catch (caught) {
      const normalized = normalizeApiError(caught);
      if (selectedServerIdRef.current === serverId) {
        setError(normalized);
        toast.error(lang === "ar" ? "فشل الأمر" : "Command failed", normalized.message);
      }
      throw normalized;
    } finally {
      setActiveAction(null);
    }
  };

  const ownsSelectedServerState = ownsSelectedBackupServerState(
    serverContext.selectedServerId,
    bindingServerId,
  );

  return {
    ...serverContext,
    canRead,
    canUpdatePolicy,
    canRegenerate,
    canReconcile,
    binding: ownsSelectedServerState ? binding : null,
    bindingServerId,
    ownsSelectedServerState,
    isLoadingBinding:
      isLoadingBinding ||
      (serverContext.selectedServerId.length > 0 &&
        !ownsSelectedServerState &&
        error === null &&
        serverContext.error === null),
    error: error ?? serverContext.error,
    activeAction,
    refreshBinding,
    updatePolicy,
    regenerate: (reason: string) => runCredentialCommand("regenerate", reason),
    reconcile: (reason: string) => runCredentialCommand("reconcile", reason),
  };
}

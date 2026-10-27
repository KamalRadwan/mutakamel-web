"use client";
import { useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { fetchAuditEvent, type AuditEvent } from "@/lib/audit/audit-contract";
import { canReadAudit } from "@/lib/audit/permissions";

export function useAuditEvent(id: string | null) {
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const canRead = canReadAudit(user?.permissions ?? []);
  const [revision, setRevision] = useState(0);
  const key = JSON.stringify([id, user?.id, user?.permissions, user?.permissionScopes, realtimeAuthGeneration, revision]);
  const [result, setResult] = useState<{ key: string; event: AuditEvent | null; error: NormalizedApiError | null } | null>(null);
  if (result !== null && result.key !== key) setResult(null);
  useEffect(() => {
    if (!id || !canRead) return;
    const controller = new AbortController();
    void fetchAuditEvent(id, controller.signal).then(
      (event) => { if (!controller.signal.aborted) setResult({ key, event, error: null }); },
      (error: unknown) => { if (!controller.signal.aborted) setResult({ key, event: null, error: normalizeApiError(error) }); },
    );
    return () => controller.abort();
  }, [id, canRead, key]);
  const current = result?.key === key ? result : null;
  return { canRead, event: canRead ? current?.event ?? null : null, error: current?.error ?? null,
    isLoading: !!id && canRead && current === null, reload: () => setRevision((value) => value + 1) };
}

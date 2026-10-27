"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useRealtimeResync } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { fetchAuditLedger, type AuditFilters, type AuditPage } from "@/lib/audit/audit-contract";
import { canReadAudit } from "@/lib/audit/permissions";

export function useAuditLedger() {
  const { t, lang } = useI18n();
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const canRead = canReadAudit(user?.permissions ?? []);
  const [filters, setFilters] = useState<AuditFilters>({});
  const [deletedOnly, setDeletedOnly] = useState(false);
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const cursor = cursors[cursors.length - 1] ?? null;
  const key = JSON.stringify([user?.id, user?.permissions, user?.permissionScopes, realtimeAuthGeneration, filters, deletedOnly, cursor, revision]);
  const [result, setResult] = useState<{ key: string; page: AuditPage | null; error: NormalizedApiError | null } | null>(null);
  if (result !== null && result.key !== key) setResult(null);
  useEffect(() => {
    if (!canRead) return;
    const controller = new AbortController();
    void fetchAuditLedger(cursor, filters, deletedOnly, controller.signal).then(
      (page) => { if (!controller.signal.aborted) setResult({ key, page, error: null }); },
      (error: unknown) => { if (!controller.signal.aborted) setResult({ key, page: null, error: normalizeApiError(error) }); },
    );
    return () => controller.abort();
  }, [canRead, key, cursor, filters, deletedOnly]);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useRealtimeResync(reload);
  const current = result?.key === key ? result : null;
  const nextCursor = current?.page?.nextCursor;
  return {
    t, lang, canRead, filters, deletedOnly, selectedId, setSelectedId,
    events: canRead ? current?.page?.items ?? [] : [],
    error: current?.error ?? null, isLoading: canRead && current === null,
    hasPrevious: cursors.length > 1, hasNext: !!nextCursor,
    previous: () => setCursors((values) => values.length > 1 ? values.slice(0, -1) : values),
    next: () => { if (nextCursor) setCursors((values) => [...values, nextCursor]); },
    applyFilters: (value: AuditFilters) => { setFilters(value); setCursors([null]); setSelectedId(null); },
    changeTab: (value: string) => { setDeletedOnly(value === "deleted"); setCursors([null]); setSelectedId(null); },
    reload,
  };
}

"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useUserProfiles } from "@/hooks/useUserProfiles";
import { useAuditReferenceLabels } from "@/hooks/useAuditReferenceLabels";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { AUDIT_HISTORY_PAGE_SIZE, fetchEntityHistory, type EntityAuditEvent } from "@/lib/audit/entity-history-contract";
import { auditUserIds } from "@/lib/audit/history-references";
import { canReadAudit } from "@/lib/audit/permissions";

export interface RecordHistoryOptions {
  entityType: string;
  entityId: string | null;
  relatedPartyIds?: readonly string[];
  refreshToken?: object | number;
  valueLabels?: Readonly<Record<string, Readonly<Record<string, string>>>>;
}
interface HistoryResult {
  key: object; events: EntityAuditEvent[]; cursor: string | null; error: NormalizedApiError | null;
}

export function useRecordHistory({ entityType, entityId, relatedPartyIds, refreshToken, valueLabels }: RecordHistoryOptions) {
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const canRead = canReadAudit(user?.permissions ?? []);
  const permissionsKey = (user?.permissions ?? []).join(",");
  const scopesKey = JSON.stringify(user?.permissionScopes);
  const relatedKey = [...new Set(relatedPartyIds ?? [])].sort().join(",");
  const [revision, setRevision] = useState(0);
  // A fresh identity on every context transition also fences A -> B -> A.
  const key = useMemo(() => ({ entityType, entityId, relatedKey, refreshToken, revision,
    userId: user?.id, realtimeAuthGeneration, permissionsKey, scopesKey }), [entityType, entityId, relatedKey, refreshToken, revision,
    user?.id, realtimeAuthGeneration, permissionsKey, scopesKey]);
  const [result, setResult] = useState<HistoryResult | null>(null);
  const [moreRequest, setMoreRequest] = useState<object | null>(null);
  const [moreError, setMoreError] = useState<{ key: object; error: NormalizedApiError } | null>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const pendingMore = useRef<AbortController | null>(null);
  const current = result?.key === key ? result : null;
  const denied = current?.error?.status === 403 || (moreError?.key === key && moreError.error.status === 403);
  const events = canRead && !denied ? current?.events ?? [] : [];
  const people = useUserProfiles(auditUserIds(events), canRead && !!entityId && !denied, refreshToken);
  const resolvedLabels = useAuditReferenceLabels(events, valueLabels, canRead && !!entityId && !denied, refreshToken);

  useEffect(() => {
    if (!entityId || !canRead) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    void fetchEntityHistory(entityType, entityId, null, AUDIT_HISTORY_PAGE_SIZE, controller.signal,
      relatedKey ? relatedKey.split(",") : undefined).then(
      (page) => { if (!controller.signal.aborted) setResult({ key, events: page.events, cursor: page.nextCursor, error: null }); },
      (error: unknown) => { if (!controller.signal.aborted) setResult({ key, events: [], cursor: null, error: normalizeApiError(error) }); },
    );
    return () => controller.abort();
  }, [entityType, entityId, canRead, key, relatedKey]);

  const cursor = current?.cursor ?? null;
  const loadMore = useCallback(() => {
    const controller = activeRequest.current;
    if (!entityId || !canRead || !cursor || !controller || controller.signal.aborted || pendingMore.current === controller) return;
    pendingMore.current = controller;
    setMoreRequest(key);
    setMoreError(null);
    void fetchEntityHistory(entityType, entityId, cursor, AUDIT_HISTORY_PAGE_SIZE, controller.signal,
      relatedKey ? relatedKey.split(",") : undefined).then(
      (page) => {
        if (controller.signal.aborted) return;
        setResult((previous) => {
          if (previous?.key !== key) return previous;
          const seen = new Set(previous.events.map((event) => event.id));
          return { ...previous, events: [...previous.events, ...page.events.filter((event) => !seen.has(event.id))], cursor: page.nextCursor };
        });
      },
      (error: unknown) => { if (!controller.signal.aborted) setMoreError({ key, error: normalizeApiError(error) }); },
    ).finally(() => {
      if (pendingMore.current === controller) pendingMore.current = null;
      if (!controller.signal.aborted) setMoreRequest(null);
    });
  }, [entityType, entityId, canRead, cursor, key, relatedKey]);

  return { canRead, events, people, resolvedLabels, cursor, denied,
    failed: !!current?.error, moreFailed: moreError?.key === key,
    isLoading: canRead && !!entityId && !current, isLoadingMore: moreRequest === key,
    loadMore, reload: () => setRevision((value) => value + 1) };
}

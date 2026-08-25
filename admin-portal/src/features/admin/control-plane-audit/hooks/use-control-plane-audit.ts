"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { adminCan } from "@/lib/auth/rbac";
import {
  normalizeApiError,
  type NormalizedApiError,
} from "@/shared/api/normalized-api-error";
import { controlPlaneAuditApi } from "../api/control-plane-audit-api";
import {
  EMPTY_CONTROL_PLANE_AUDIT_FILTERS,
  toControlPlaneAuditQuery,
  validateControlPlaneAuditFilters,
} from "../lib/control-plane-audit-utils";
import type {
  ControlPlaneAuditFilterDraft,
  ControlPlaneAuditFilterErrors,
  ControlPlaneAuditMode,
  ControlPlaneAuditPage,
  ControlPlaneAuditQuery,
} from "../types/control-plane-audit";

export type ControlPlaneAuditRequestState =
  | "IDLE"
  | "LOADING"
  | "READY"
  | "EMPTY"
  | "FORBIDDEN"
  | "UNAVAILABLE";

export function useControlPlaneAudit() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const canRead = adminCan(user, "admin.audit.read");
  const [mode, setModeState] =
    useState<ControlPlaneAuditMode>("ALL_EVENTS");
  const [draft, setDraft] = useState<ControlPlaneAuditFilterDraft>({
    ...EMPTY_CONTROL_PLANE_AUDIT_FILTERS,
  });
  const [appliedQuery, setAppliedQuery] = useState<
    Omit<ControlPlaneAuditQuery, "page" | "limit">
  >({});
  const [validationErrors, setValidationErrors] =
    useState<ControlPlaneAuditFilterErrors>({});
  const [page, setPage] = useState(1);
  const [limit, setLimitState] = useState(25);
  const [refreshRevision, setRefreshRevision] = useState(0);
  const [data, setData] = useState<ControlPlaneAuditPage | null>(null);
  const dataRef = useRef<ControlPlaneAuditPage | null>(null);
  const [requestState, setRequestState] =
    useState<ControlPlaneAuditRequestState>("IDLE");
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const entityScopeReady = mode !== "ENTITY_HISTORY" ||
    Boolean(appliedQuery.entityType && appliedQuery.entityId);

  useEffect(() => {
    if (isAuthLoading || !canRead) return;

    const entityType = appliedQuery.entityType;
    const entityId = appliedQuery.entityId;
    if (!entityScopeReady) return;

    const controller = new AbortController();
    let disposed = false;
    const load = async () => {
      if (dataRef.current) setIsRefreshing(true);
      else setRequestState("LOADING");
      setError(null);
      try {
        const query = { ...appliedQuery, page, limit };
        const result = mode === "ENTITY_HISTORY"
          ? await controlPlaneAuditApi.entityHistory(
              entityType as string,
              entityId as string,
              withoutEntityScope(query),
              controller.signal,
            )
          : await controlPlaneAuditApi.list(query, controller.signal);
        if (disposed) return;
        dataRef.current = result;
        setData(result);
        setRequestState(result.items.length ? "READY" : "EMPTY");
      } catch (requestError) {
        if (disposed || isAbortError(requestError)) return;
        const normalized = normalizeApiError(requestError);
        setError(normalized);
        setRequestState(
          normalized.httpStatus === 403 ? "FORBIDDEN" : "UNAVAILABLE",
        );
      } finally {
        if (!disposed) setIsRefreshing(false);
      }
    };
    queueMicrotask(() => {
      if (!disposed) void load();
    });

    return () => {
      disposed = true;
      controller.abort();
    };
  }, [
    appliedQuery,
    canRead,
    entityScopeReady,
    isAuthLoading,
    limit,
    mode,
    page,
    refreshRevision,
  ]);

  const updateDraft = useCallback(
    <K extends keyof ControlPlaneAuditFilterDraft>(
      field: K,
      value: ControlPlaneAuditFilterDraft[K],
    ) => {
      setDraft((current) => ({ ...current, [field]: value }));
      setValidationErrors((current) => {
        if (!current[field] && !current.dateRange) return current;
        const next = { ...current };
        delete next[field];
        if (field === "from" || field === "to") delete next.dateRange;
        return next;
      });
    },
    [],
  );

  const applyFilters = useCallback(() => {
    const nextErrors = validateControlPlaneAuditFilters(draft, mode);
    setValidationErrors(nextErrors);
    if (Object.keys(nextErrors).length) return false;
    setAppliedQuery(toControlPlaneAuditQuery(draft));
    setPage(1);
    setRefreshRevision((current) => current + 1);
    return true;
  }, [draft, mode]);

  const clearFilters = useCallback(() => {
    setDraft({ ...EMPTY_CONTROL_PLANE_AUDIT_FILTERS });
    setAppliedQuery({});
    setValidationErrors({});
    setPage(1);
    dataRef.current = null;
    setData(null);
    setRefreshRevision((current) => current + 1);
  }, []);

  const setMode = useCallback((nextMode: ControlPlaneAuditMode) => {
    setModeState(nextMode);
    setDraft({ ...EMPTY_CONTROL_PLANE_AUDIT_FILTERS });
    setAppliedQuery({});
    setValidationErrors({});
    setPage(1);
    dataRef.current = null;
    setData(null);
    setError(null);
  }, []);

  const setLimit = useCallback((nextLimit: number) => {
    setLimitState(nextLimit);
    setPage(1);
  }, []);

  const refresh = useCallback(() => {
    setRefreshRevision((current) => current + 1);
  }, []);

  const activeFilterCount = useMemo(
    () => Object.values(appliedQuery).filter(Boolean).length,
    [appliedQuery],
  );
  const visibleRequestState: ControlPlaneAuditRequestState = isAuthLoading
    ? "LOADING"
    : !canRead
      ? "FORBIDDEN"
      : !entityScopeReady
        ? "IDLE"
        : requestState;
  const visibleData = visibleRequestState === "READY" ||
    visibleRequestState === "EMPTY"
    ? data
    : null;

  return {
    mode,
    draft,
    validationErrors,
    data: visibleData,
    requestState: visibleRequestState,
    error,
    isRefreshing,
    isAuthLoading,
    canRead,
    page,
    limit,
    activeFilterCount,
    setMode,
    updateDraft,
    applyFilters,
    clearFilters,
    refresh,
    setPage,
    setLimit,
  };
}

function withoutEntityScope(query: ControlPlaneAuditQuery): ControlPlaneAuditQuery {
  const rest = { ...query };
  delete rest.entityType;
  delete rest.entityId;
  return rest;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

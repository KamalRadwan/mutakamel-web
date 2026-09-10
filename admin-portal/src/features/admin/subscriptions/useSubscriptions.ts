"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { adminCan } from "@/lib/auth/rbac";
import {
  normalizeApiError,
  type NormalizedApiError,
} from "@/shared/api/normalized-api-error";
import { subscriptionsApi } from "./api";
import { isUuidV7 } from "./readers";
import { SUBSCRIPTION_SORT_FIELDS } from "./types";
import type {
  SubscriptionFilterDraft,
  SubscriptionListQuery,
  SubscriptionPage,
  SubscriptionRequestState,
  SubscriptionsViewModel,
} from "./types";

const DEFAULT_FILTERS: SubscriptionFilterDraft = {
  status: "",
  tenantId: "",
  sortBy: "createdAt",
  sortDir: "DESC",
};

type AppliedFilters = Omit<SubscriptionListQuery, "page" | "limit">;

export function useSubscriptions(): SubscriptionsViewModel {
  const { user, isLoading: isAuthLoading } = useAuth();
  const canRead = adminCan(user, "admin.subscriptions.read");
  const authorizationOwnerId = user?.id ?? null;
  const [draft, setDraft] = useState<SubscriptionFilterDraft>(DEFAULT_FILTERS);
  const [applied, setApplied] = useState<AppliedFilters>({
    sortBy: DEFAULT_FILTERS.sortBy,
    sortDir: DEFAULT_FILTERS.sortDir,
  });
  const [tenantIdError, setTenantIdError] = useState<string | null>(null);
  const [page, setPageState] = useState(1);
  const [limit, setLimitState] = useState(20);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<SubscriptionPage | null>(null);
  const dataRef = useRef<SubscriptionPage | null>(null);
  const [responseOwnerId, setResponseOwnerId] = useState<string | null>(null);
  const [requestState, setRequestState] =
    useState<SubscriptionRequestState>("LOADING");
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (isAuthLoading || !canRead) return;
    const controller = new AbortController();
    let disposed = false;

    const load = async () => {
      if (dataRef.current) setIsRefreshing(true);
      else setRequestState("LOADING");
      setError(null);
      try {
        const result = await subscriptionsApi.list(
          { ...applied, page, limit },
          controller.signal,
        );
        if (disposed) return;
        dataRef.current = result;
        setResponseOwnerId(authorizationOwnerId);
        setData(result);
        setRequestState(result.items.length ? "READY" : "EMPTY");
      } catch (requestError) {
        if (disposed || isAbortError(requestError)) return;
        const normalized = normalizeApiError(requestError);
        dataRef.current = null;
        setResponseOwnerId(authorizationOwnerId);
        setData(null);
        setError(normalized);
        setRequestState(classifyFailure(requestError, normalized));
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
    applied,
    authorizationOwnerId,
    canRead,
    isAuthLoading,
    limit,
    page,
    revision,
  ]);

  const setDraftField = useCallback(
    <K extends keyof SubscriptionFilterDraft>(
      field: K,
      value: SubscriptionFilterDraft[K],
    ) => {
      setDraft((current) => ({ ...current, [field]: value }));
      if (field === "tenantId") setTenantIdError(null);
    },
    [],
  );

  const applyFilters = useCallback(() => {
    const tenantId = draft.tenantId.trim();
    if (tenantId && !isUuidV7(tenantId)) {
      setTenantIdError("INVALID_TENANT_UUID_V7");
      return false;
    }
    setTenantIdError(null);
    setApplied({
      sortBy: draft.sortBy,
      sortDir: draft.sortDir,
      ...(draft.status ? { status: draft.status } : {}),
      ...(tenantId ? { tenantId } : {}),
    });
    dataRef.current = null;
    setResponseOwnerId(null);
    setData(null);
    setPageState(1);
    setRevision((current) => current + 1);
    return true;
  }, [draft]);

  const clearFilters = useCallback(() => {
    setDraft(DEFAULT_FILTERS);
    setApplied({
      sortBy: DEFAULT_FILTERS.sortBy,
      sortDir: DEFAULT_FILTERS.sortDir,
    });
    setTenantIdError(null);
    dataRef.current = null;
    setResponseOwnerId(null);
    setData(null);
    setPageState(1);
    setRevision((current) => current + 1);
  }, []);

  const refresh = useCallback(() => {
    setRevision((current) => current + 1);
  }, []);

  // Header sorting bypasses the draft/apply cycle the filter form uses: the
  // click is the request. The field is still checked against the endpoint's
  // list first -- not because the endpoint rejects an unknown one, but because
  // it does NOT: `SubscriptionDirectoryReadService` resolves
  // `SORTS[sortBy] ?? SORTS.createdAt`, so an unrecognised field silently sorts
  // by creation date and the header would show an order the rows are not in.
  // Refusing locally is what keeps the header honest.
  const changeSort = useCallback((sortBy: string, sortDir: "ASC" | "DESC") => {
    const field = SUBSCRIPTION_SORT_FIELDS.find((allowed) => allowed === sortBy);
    if (!field) return;
    setDraft((current) => ({ ...current, sortBy: field, sortDir }));
    setApplied((current) => ({ ...current, sortBy: field, sortDir }));
    dataRef.current = null;
    setResponseOwnerId(null);
    setData(null);
    setPageState(1);
    setRevision((current) => current + 1);
  }, []);

  const setPage = useCallback((nextPage: number) => {
    if (!Number.isSafeInteger(nextPage) || nextPage < 1) return;
    setPageState(nextPage);
  }, []);

  const setLimit = useCallback((nextLimit: number) => {
    if (!Number.isSafeInteger(nextLimit) || nextLimit < 1 || nextLimit > 100) {
      return;
    }
    dataRef.current = null;
    setResponseOwnerId(null);
    setData(null);
    setLimitState(nextLimit);
    setPageState(1);
  }, []);

  const activeFilterCount = useMemo(
    () => Number(Boolean(applied.status)) + Number(Boolean(applied.tenantId)),
    [applied.status, applied.tenantId],
  );
  const ownsResponse =
    authorizationOwnerId !== null && responseOwnerId === authorizationOwnerId;
  const hasBoundResponse = data !== null || error !== null;
  const visibleRequestState: SubscriptionRequestState = isAuthLoading
    ? "LOADING"
    : !canRead
      ? "FORBIDDEN"
      : hasBoundResponse && !ownsResponse
        ? "LOADING"
        : requestState;
  const visibleData = canRead && !isAuthLoading && ownsResponse ? data : null;
  const visibleError = canRead && !isAuthLoading && ownsResponse ? error : null;

  return {
    canRead,
    draft,
    applied: { sortBy: applied.sortBy, sortDir: applied.sortDir },
    tenantIdError,
    data: visibleData,
    requestState: visibleRequestState,
    error: visibleError,
    isRefreshing,
    page,
    limit,
    activeFilterCount,
    setDraftField,
    applyFilters,
    clearFilters,
    refresh,
    changeSort,
    setPage,
    setLimit,
  };
}

function classifyFailure(
  original: unknown,
  error: NormalizedApiError,
): SubscriptionRequestState {
  if (error.httpStatus === 403) return "FORBIDDEN";
  if (
    original instanceof TypeError ||
    [502, 503, 504].includes(error.httpStatus) ||
    /(?:UPSTREAM|UNAVAILABLE|TIMEOUT)/u.test(error.errorCode)
  ) {
    return "UNAVAILABLE";
  }
  return "ERROR";
}

function isAbortError(error: unknown): boolean {
  return (
    (typeof DOMException !== "undefined" &&
      error instanceof DOMException &&
      error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

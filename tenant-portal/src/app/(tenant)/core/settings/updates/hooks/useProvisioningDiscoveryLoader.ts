"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readCorePage } from "@/lib/api/envelope";
import { normalizeApiError } from "@/lib/api/errors";
import {
  PROVISIONING_UPDATES_PAGE_SIZE,
  PROVISIONING_UPDATES_PATH,
  buildProvisioningUpdatesQuery,
  isValidComponentKeyFilter,
  type ProvisioningUpdatesFilters,
  type ProvisioningUpdatesSort,
  type TenantAvailableUpdate,
} from "../provisioning-updates-contract";
import { parseProvisioningUpdatesPage } from "../provisioning-updates-parsers";
import {
  doesDiscoveryReconcileAcceptedAttempt,
  type UnreadableAcceptedAttempt,
} from "../provisioning-updates-snapshot";
import { isAbortError, type UpdatesReadFailure } from "./useProvisioningOperationTracker";

const UPDATES_RESPONSE_LIMIT_BYTES = 500_000;

interface DiscoveryLoaderCallbacks {
  onClearSelection: () => void;
  onPruneSelection: (items: readonly TenantAvailableUpdate[]) => void;
  onFenceOrForbiddenReset: () => void;
  onNonPendingDismiss: () => void;
  onItemsLoaded: (
    items: readonly TenantAvailableUpdate[],
    reconciliation: { wasPending: boolean; correlatedOperationId: string | null },
  ) => void;
}

interface UseProvisioningDiscoveryLoaderParams {
  canReadEffective: boolean;
  readFenceKey: string;
  filters: ProvisioningUpdatesFilters;
  page: number;
  sort: ProvisioningUpdatesSort;
  onRecoverPage: (maxPage: number) => void;
  callbacks: DiscoveryLoaderCallbacks;
}

export function useProvisioningDiscoveryLoader({
  canReadEffective,
  readFenceKey,
  filters,
  page,
  sort,
  onRecoverPage,
  callbacks,
}: UseProvisioningDiscoveryLoaderParams) {
  const [items, setItems] = useState<TenantAvailableUpdate[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isQueryForbidden, setIsQueryForbidden] = useState(false);
  const [loadFailure, setLoadFailure] = useState<UpdatesReadFailure | null>(null);
  const [loadedQueryKey, setLoadedQueryKey] = useState<string | null>(null);
  const [unreadableAcceptedAttempt, setUnreadableAcceptedAttempt] =
    useState<UnreadableAcceptedAttempt | null>(null);

  const listAbortRef = useRef<AbortController | null>(null);
  const listRequestIdRef = useRef(0);
  const loadedQueryKeyRef = useRef<string | null>(null);
  const unreadableAttemptRef = useRef<UnreadableAcceptedAttempt | null>(null);
  const readFenceRef = useRef(readFenceKey);
  const callbacksRef = useRef(callbacks);
  const onRecoverPageRef = useRef(onRecoverPage);

  useEffect(() => {
    callbacksRef.current = callbacks;
    onRecoverPageRef.current = onRecoverPage;
  });

  const setUnreadableAttempt = useCallback((attempt: UnreadableAcceptedAttempt | null) => {
    unreadableAttemptRef.current = attempt;
    setUnreadableAcceptedAttempt(attempt);
  }, []);

  const reconcileUnreadableByOperationId = useCallback(
    (operationId: string) => {
      const pending = unreadableAttemptRef.current;
      if (pending !== null && pending.responseOperationId === operationId) {
        setUnreadableAttempt(null);
      }
    },
    [setUnreadableAttempt],
  );

  const markUnreadableAccepted = useCallback(
    (attempt: UnreadableAcceptedAttempt) => {
      setLoadedQueryKey(null);
      setUnreadableAttempt(attempt);
    },
    [setUnreadableAttempt],
  );

  const abortListRequest = useCallback(() => {
    listAbortRef.current?.abort();
    listAbortRef.current = null;
    listRequestIdRef.current += 1;
  }, []);

  const clearDiscoveryData = useCallback(() => {
    loadedQueryKeyRef.current = null;
    setLoadedQueryKey(null);
    setUnreadableAttempt(null);
    setItems([]);
    setTotal(0);
  }, [setUnreadableAttempt]);

  const prepareDiscoveryQuery = useCallback(
    (componentKey: string) => {
      abortListRequest();
      setLoadedQueryKey(null);
      setIsQueryForbidden(false);
      setLoadFailure(null);
      setIsLoading(canReadEffective && isValidComponentKeyFilter(componentKey));
    },
    [abortListRequest, canReadEffective],
  );

  const loadUpdates = useCallback(async (): Promise<void> => {
    if (!canReadEffective) {
      abortListRequest();
      clearDiscoveryData();
      callbacksRef.current.onFenceOrForbiddenReset();
      setIsQueryForbidden(false);
      setLoadFailure(null);
      setIsLoading(false);
      return;
    }
    if (!isValidComponentKeyFilter(filters.componentKey)) {
      abortListRequest();
      setIsLoading(false);
      return;
    }

    listAbortRef.current?.abort();
    const controller = new AbortController();
    listAbortRef.current = controller;
    const requestId = ++listRequestIdRef.current;
    const requestFence = readFenceRef.current;
    const isCurrent = () =>
      listRequestIdRef.current === requestId &&
      readFenceRef.current === requestFence &&
      !controller.signal.aborted;
    const query = buildProvisioningUpdatesQuery(filters, page, PROVISIONING_UPDATES_PAGE_SIZE, sort);
    let recoveringPage = false;

    setIsLoading(true);
    setIsQueryForbidden(false);
    setLoadFailure(null);
    try {
      let envelope: { data: unknown; meta: unknown };
      try {
        envelope = await readCorePage(PROVISIONING_UPDATES_PATH, query, {
          signal: controller.signal,
          cache: "no-store",
          suppressForbiddenToast: true,
          maxResponseBytes: UPDATES_RESPONSE_LIMIT_BYTES,
        });
      } catch (error) {
        if (!isCurrent() || isAbortError(error)) return;
        const normalized = normalizeApiError(error);
        callbacksRef.current.onClearSelection();
        callbacksRef.current.onNonPendingDismiss();
        if (normalized.status === 403) {
          clearDiscoveryData();
          callbacksRef.current.onFenceOrForbiddenReset();
          setIsQueryForbidden(true);
          return;
        }
        if (loadedQueryKeyRef.current !== query) {
          setItems([]);
          setTotal(0);
        }
        setLoadFailure(
          normalized.code === "API_RESPONSE_TOO_LARGE"
            ? { kind: "invalidResponse" }
            : { kind: "api", error: normalized },
        );
        return;
      }
      if (!isCurrent()) return;

      let parsed: ReturnType<typeof parseProvisioningUpdatesPage>;
      try {
        parsed = parseProvisioningUpdatesPage(envelope);
      } catch {
        callbacksRef.current.onClearSelection();
        callbacksRef.current.onNonPendingDismiss();
        if (loadedQueryKeyRef.current !== query) {
          setItems([]);
          setTotal(0);
        }
        setLoadFailure({ kind: "invalidResponse" });
        return;
      }

      const maxPage = Math.max(1, parsed.totalPages);
      if (page > maxPage) {
        recoveringPage = true;
        loadedQueryKeyRef.current = null;
        setLoadedQueryKey(null);
        callbacksRef.current.onClearSelection();
        onRecoverPageRef.current(maxPage);
        return;
      }

      loadedQueryKeyRef.current = query;
      setLoadedQueryKey(query);
      const pendingAttempt = unreadableAttemptRef.current;
      let correlatedOperationId: string | null = null;
      if (pendingAttempt !== null) {
        const check = doesDiscoveryReconcileAcceptedAttempt(pendingAttempt, parsed.items);
        if (check.resolved) {
          setUnreadableAttempt(null);
          correlatedOperationId = check.correlatedOperationId;
        }
      }
      callbacksRef.current.onItemsLoaded(parsed.items, {
        wasPending: pendingAttempt !== null,
        correlatedOperationId,
      });
      setItems(parsed.items);
      setTotal(parsed.total);
      callbacksRef.current.onPruneSelection(parsed.items);
    } finally {
      if (isCurrent() && !recoveringPage) setIsLoading(false);
    }
  }, [
    abortListRequest,
    canReadEffective,
    clearDiscoveryData,
    filters,
    page,
    setUnreadableAttempt,
    sort,
  ]);

  useEffect(() => {
    if (readFenceRef.current !== readFenceKey) {
      readFenceRef.current = readFenceKey;
      loadedQueryKeyRef.current = null;
      unreadableAttemptRef.current = null;
      abortListRequest();
      queueMicrotask(() => {
        clearDiscoveryData();
        callbacksRef.current.onFenceOrForbiddenReset();
      });
    }
  }, [abortListRequest, clearDiscoveryData, readFenceKey]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadUpdates();
    });
    return () => {
      cancelled = true;
      abortListRequest();
    };
  }, [abortListRequest, loadUpdates, readFenceKey]);

  return {
    items,
    total,
    isLoading,
    isQueryForbidden,
    loadFailure,
    loadedQueryKey,
    unreadableAcceptedAttempt,
    reconcileUnreadableByOperationId,
    markUnreadableAccepted,
    prepareDiscoveryQuery,
    loadUpdates,
  };
}

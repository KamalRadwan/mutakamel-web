"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PageInfo } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useCoreErrorText } from "../../../hooks/useCoreErrorText";
import {
  DEFAULT_PROVISIONING_UPDATES_SORT, MAX_PROVISIONING_UPDATE_SELECTIONS,
  PROVISIONING_UPDATES_PAGE_SIZE, buildProvisioningUpdatesQuery,
  canSelectAvailableUpdate, isValidComponentKeyFilter,
  type ProvisioningUpdatesFilters, type ProvisioningUpdatesSort,
  type TenantAvailableUpdate, type TenantProvisioningOperationView,
} from "../provisioning-updates-contract";
import {
  findPlannedOperationId,
  type ApplyAttemptSnapshot,
  type UnreadableAcceptedAttempt,
} from "../provisioning-updates-snapshot";
import { useApplyProvisioningUpdates } from "./useApplyProvisioningUpdates";
import { useProvisioningDiscoveryLoader } from "./useProvisioningDiscoveryLoader";
import { useProvisioningOperationTracker } from "./useProvisioningOperationTracker";
import { useProvisioningUpdatesAccess } from "./useProvisioningUpdatesAccess";

const INITIAL_FILTERS: ProvisioningUpdatesFilters = {
  componentKey: "",
  riskLevel: "",
  requiresBackup: "",
  requiresMaintenance: "",
};

export function useProvisioningUpdates() {
  const { t, lang } = useI18n();
  const describeError = useCoreErrorText();
  const access = useProvisioningUpdatesAccess(t);
  const { canReadEffective, canManageEffective, readFenceKey, applyFenceKey } = access;

  const [filters, setFilters] = useState<ProvisioningUpdatesFilters>(INITIAL_FILTERS);
  const [sort, setSortState] = useState<ProvisioningUpdatesSort>(DEFAULT_PROVISIONING_UPDATES_SORT);
  const [page, setPageState] = useState(1);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const reconcileByOpRef = useRef<(operationId: string) => void>(() => {});
  const unreadableRef = useRef<UnreadableAcceptedAttempt | null>(null);
  const applyEventsRef = useRef<{
    clearApplyState: () => void;
    dismissNonPendingConfirmModal: () => void;
    reconcileSnapshotWithLiveItems: (items: readonly TenantAvailableUpdate[]) => void;
  }>({
    clearApplyState: () => {},
    dismissNonPendingConfirmModal: () => {},
    reconcileSnapshotWithLiveItems: () => {},
  });
  const loadUpdatesRef = useRef<() => Promise<void>>(async () => {});

  const handleOperationLoaded = useCallback(
    (operation: TenantProvisioningOperationView, transitionedToTerminal: boolean) => {
      reconcileByOpRef.current(operation.id);
      if (transitionedToTerminal && unreadableRef.current === null) {
        void loadUpdatesRef.current();
      }
    },
    [],
  );

  const tracker = useProvisioningOperationTracker(
    canReadEffective,
    readFenceKey,
    handleOperationLoaded,
  );
  const {
    activeOperation, correlatedOperationItems,
    isOperationModalOpen: rawIsOperationModalOpen,
    trackOperationById, seedInitialOperation, recordAppliedOperation,
    recordCorrelatedAttemptItems, clearTrackedOperation,
    openOperationModal, closeOperationModal,
  } = tracker;

  const clearSelectedKeys = useCallback(() => setSelectedKeys([]), []);
  const pruneSelectedKeys = useCallback((nextItems: readonly TenantAvailableUpdate[]) => {
    setSelectedKeys((prev) =>
      prev.filter((key) =>
        nextItems.some((item) => item.componentKey === key && canSelectAvailableUpdate(item)),
      ),
    );
  }, []);

  const discovery = useProvisioningDiscoveryLoader({
    canReadEffective, readFenceKey, filters, page, sort,
    onRecoverPage: setPageState,
    callbacks: {
      onClearSelection: clearSelectedKeys,
      onPruneSelection: pruneSelectedKeys,
      onFenceOrForbiddenReset: () => {
        setSelectedKeys([]);
        clearTrackedOperation();
        applyEventsRef.current.clearApplyState();
      },
      onNonPendingDismiss: () => applyEventsRef.current.dismissNonPendingConfirmModal(),
      onItemsLoaded: (nextItems, reconciliation) => {
        applyEventsRef.current.reconcileSnapshotWithLiveItems(nextItems);
        if (reconciliation.wasPending) {
          if (reconciliation.correlatedOperationId) {
            void trackOperationById(reconciliation.correlatedOperationId);
          }
          return;
        }
        seedInitialOperation(findPlannedOperationId(nextItems));
      },
    },
  });
  const {
    items, total, isLoading, isQueryForbidden, loadFailure, loadedQueryKey,
    unreadableAcceptedAttempt, reconcileUnreadableByOperationId, markUnreadableAccepted,
    prepareDiscoveryQuery, loadUpdates,
  } = discovery;

  // Never unlocked by an arbitrary activeOperation — only by correlated discovery/operation proof.
  const requiresReconciliation = unreadableAcceptedAttempt !== null;
  const currentQuery = useMemo(
    () => buildProvisioningUpdatesQuery(filters, page, PROVISIONING_UPDATES_PAGE_SIZE, sort),
    [filters, page, sort],
  );
  const isComponentFilterValid = isValidComponentKeyFilter(filters.componentKey);
  const hasActiveFilters =
    filters.componentKey.trim().length > 0 ||
    filters.riskLevel !== "" ||
    filters.requiresBackup !== "" ||
    filters.requiresMaintenance !== "";
  const hasAuthoritativeDiscovery =
    canReadEffective && isComponentFilterValid && !isLoading &&
    !isQueryForbidden && loadFailure === null &&
    loadedQueryKey === currentQuery && !requiresReconciliation;

  const effectiveSelectedKeys = useMemo(
    () => (canManageEffective ? selectedKeys : []),
    [canManageEffective, selectedKeys],
  );
  const selectableItems = useMemo(() => items.filter(canSelectAvailableUpdate), [items]);
  const selectedItems = useMemo(
    () =>
      selectableItems
        .filter((item) => effectiveSelectedKeys.includes(item.componentKey))
        .slice(0, MAX_PROVISIONING_UPDATE_SELECTIONS),
    [effectiveSelectedKeys, selectableItems],
  );
  const pageInfo: PageInfo = useMemo(
    () => ({ page, limit: PROVISIONING_UPDATES_PAGE_SIZE, total }),
    [page, total],
  );

  const handleApplied = useCallback(
    (operation: TenantProvisioningOperationView, snapshot: ApplyAttemptSnapshot) => {
      recordAppliedOperation(operation, snapshot.items);
      void loadUpdatesRef.current();
    },
    [recordAppliedOperation],
  );

  const handleAppliedUnreadable = useCallback(
    (attempt: UnreadableAcceptedAttempt) => {
      markUnreadableAccepted(attempt);
      if (attempt.responseOperationId) {
        recordCorrelatedAttemptItems(attempt.responseOperationId, attempt.snapshot.items);
        void trackOperationById(attempt.responseOperationId);
      }
      void loadUpdatesRef.current();
    },
    [markUnreadableAccepted, recordCorrelatedAttemptItems, trackOperationById],
  );

  const handleReloadFromStale = useCallback(() => void loadUpdatesRef.current(), []);

  const apply = useApplyProvisioningUpdates({
    t, describeError, applyFenceKey, canManageEffective, hasAuthoritativeDiscovery,
    canRetryAmbiguous: canManageEffective && !isQueryForbidden && !requiresReconciliation,
    liveItems: items, selectedItems, onResetSelection: clearSelectedKeys,
    onApplied: handleApplied, onAppliedUnreadable: handleAppliedUnreadable,
    onReloadFromStale: handleReloadFromStale,
  });
  const {
    isModalOpen: isApplyModalOpen, setIsModalOpen: setRawApplyModalOpen,
    isApplying, clearApplyState, dismissNonPendingConfirmModal, reconcileSnapshotWithLiveItems,
  } = apply;
  const isApplyModalActive = isApplyModalOpen || isApplying;

  useEffect(() => {
    if (isApplyModalActive && rawIsOperationModalOpen) closeOperationModal();
  }, [closeOperationModal, isApplyModalActive, rawIsOperationModalOpen]);

  useEffect(() => {
    unreadableRef.current = unreadableAcceptedAttempt;
    reconcileByOpRef.current = reconcileUnreadableByOperationId;
    loadUpdatesRef.current = loadUpdates;
    applyEventsRef.current = {
      clearApplyState, dismissNonPendingConfirmModal, reconcileSnapshotWithLiveItems,
    };
  }, [
    clearApplyState, dismissNonPendingConfirmModal, loadUpdates,
    reconcileSnapshotWithLiveItems, reconcileUnreadableByOperationId, unreadableAcceptedAttempt,
  ]);

  const setIsModalOpen = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) closeOperationModal();
      setRawApplyModalOpen(nextOpen);
    },
    [closeOperationModal, setRawApplyModalOpen],
  );

  const setIsOperationModalOpen = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) return closeOperationModal();
      if (!isApplyModalActive) openOperationModal();
    },
    [closeOperationModal, isApplyModalActive, openOperationModal],
  );

  const reload = useCallback(async () => {
    if (unreadableAcceptedAttempt?.responseOperationId) {
      void trackOperationById(unreadableAcceptedAttempt.responseOperationId);
    }
    await loadUpdates();
  }, [loadUpdates, trackOperationById, unreadableAcceptedAttempt]);

  const prepareQueryChange = useCallback(
    (nextPage: number, componentKey: string) => {
      prepareDiscoveryQuery(componentKey);
      setPageState(nextPage);
      setSelectedKeys([]);
      dismissNonPendingConfirmModal();
    },
    [dismissNonPendingConfirmModal, prepareDiscoveryQuery],
  );

  const updateFilters = useCallback(
    (patch: Partial<ProvisioningUpdatesFilters>) => {
      const next = { ...filters, ...patch };
      if (
        next.componentKey === filters.componentKey && next.riskLevel === filters.riskLevel &&
        next.requiresBackup === filters.requiresBackup &&
        next.requiresMaintenance === filters.requiresMaintenance
      ) {
        return;
      }
      setFilters(next);
      prepareQueryChange(1, next.componentKey);
    },
    [filters, prepareQueryChange],
  );

  const clearFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
    prepareQueryChange(1, "");
  }, [prepareQueryChange]);

  const setSort = useCallback(
    (nextSort: ProvisioningUpdatesSort) => {
      if (nextSort.sortBy === sort.sortBy && nextSort.sortDir === sort.sortDir) return;
      setSortState(nextSort);
      prepareQueryChange(1, filters.componentKey);
    },
    [filters.componentKey, prepareQueryChange, sort.sortBy, sort.sortDir],
  );

  const setPage = useCallback(
    (nextPage: number) => {
      const normalized = Number.isInteger(nextPage) && nextPage >= 1 ? nextPage : 1;
      if (normalized !== page) prepareQueryChange(normalized, filters.componentKey);
    },
    [filters.componentKey, page, prepareQueryChange],
  );

  const toggleSelection = useCallback(
    (componentKey: string, checked: boolean) => {
      if (!apply.canConfirmFresh) return;
      setSelectedKeys((current) => {
        if (!checked) return current.filter((key) => key !== componentKey);
        if (current.includes(componentKey) || current.length >= MAX_PROVISIONING_UPDATE_SELECTIONS) {
          return current;
        }
        return selectableItems.some((item) => item.componentKey === componentKey)
          ? [...current, componentKey]
          : current;
      });
    },
    [apply.canConfirmFresh, selectableItems],
  );

  const toggleSelectAll = useCallback(
    (checked: boolean) => {
      if (!apply.canConfirmFresh) return;
      setSelectedKeys(
        checked
          ? selectableItems
              .slice(0, MAX_PROVISIONING_UPDATE_SELECTIONS)
              .map((item) => item.componentKey)
          : [],
      );
    },
    [apply.canConfirmFresh, selectableItems],
  );

  return {
    t, lang, describeError,
    canReadTenantWide: access.canReadTenantWide, canManageEffective,
    effectiveAccessMode: access.effectiveAccessMode, readOnlyLabels: access.readOnlyLabels,
    filters, sort, hasActiveFilters, isComponentFilterValid,
    items, pageInfo, selectableItems, selectedKeys: effectiveSelectedKeys, selectedItems, isLoading,
    isCheckingOperation: tracker.isCheckingOperation,
    isQueryForbidden, loadFailure, requiresReconciliation, activeOperation, correlatedOperationItems,
    hasTrackedOperation: tracker.hasTrackedOperation,
    isOperationModalOpen: rawIsOperationModalOpen && !isApplyModalActive,
    setIsOperationModalOpen, operationFailure: tracker.operationFailure,
    updateFilters, clearFilters, setSort, setPage, toggleSelection, toggleSelectAll,
    refreshActiveOperation: tracker.refreshActiveOperation, reload,
    ...apply, setIsModalOpen,
  };
}

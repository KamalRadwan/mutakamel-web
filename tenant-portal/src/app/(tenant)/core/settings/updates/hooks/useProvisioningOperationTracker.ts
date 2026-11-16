"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { coreGet } from "../../../core-api";
import { isUuidV7 } from "../../../core-validation";
import {
  isTerminalOperationStatus,
  provisioningOperationPath,
  type TenantAvailableUpdate,
  type TenantProvisioningOperationView,
} from "../provisioning-updates-contract";
import { parseProvisioningOperationView } from "../provisioning-updates-parsers";
import { cloneAvailableUpdate } from "../provisioning-updates-snapshot";
import { useOperationModalPolling } from "./useOperationModalPolling";

const OPERATION_RESPONSE_LIMIT_BYTES = 50_000;
const EMPTY_CORRELATED_ITEMS: readonly TenantAvailableUpdate[] = [];

export type UpdatesReadFailure =
  | { kind: "api"; error: NormalizedApiError }
  | { kind: "invalidResponse" };

interface ScopedOperationState {
  scopeFenceKey: string;
  activeOperation: TenantProvisioningOperationView | null;
  trackedOperationId: string | null;
  correlatedSnapshot: { operationId: string; items: TenantAvailableUpdate[] } | null;
  isOperationModalOpen: boolean;
  modalSessionId: number;
  isCheckingOperation: boolean;
  operationFailure: UpdatesReadFailure | null;
}

function emptyOperationState(scopeFenceKey: string): ScopedOperationState {
  return {
    scopeFenceKey,
    activeOperation: null,
    trackedOperationId: null,
    correlatedSnapshot: null,
    isOperationModalOpen: false,
    modalSessionId: 0,
    isCheckingOperation: false,
    operationFailure: null,
  };
}

function scopedBase(prev: ScopedOperationState, scope: string): ScopedOperationState {
  return prev.scopeFenceKey === scope ? prev : emptyOperationState(scope);
}

export function useProvisioningOperationTracker(
  canReadEffective: boolean,
  scopeFenceKey = "default",
  onOperationLoaded?: (
    operation: TenantProvisioningOperationView,
    transitionedToTerminal: boolean,
  ) => void,
) {
  const [rawState, setRawState] = useState<ScopedOperationState>(() =>
    emptyOperationState(scopeFenceKey),
  );
  const state = scopedBase(rawState, scopeFenceKey);

  const trackedIdRef = useRef<string | null>(null);
  const lastKnownOpRef = useRef<TenantProvisioningOperationView | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const scopeFenceRef = useRef(scopeFenceKey);
  const onOperationLoadedRef = useRef(onOperationLoaded);

  useEffect(() => {
    onOperationLoadedRef.current = onOperationLoaded;
  }, [onOperationLoaded]);

  const abortInFlight = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    requestIdRef.current += 1;
  }, []);

  const stopInFlightCheck = useCallback(() => {
    abortInFlight();
    const currentScope = scopeFenceRef.current;
    setRawState((prev) =>
      prev.scopeFenceKey === currentScope && prev.isCheckingOperation
        ? { ...prev, isCheckingOperation: false }
        : prev,
    );
  }, [abortInFlight]);

  useEffect(() => {
    if (scopeFenceRef.current !== scopeFenceKey) {
      scopeFenceRef.current = scopeFenceKey;
      trackedIdRef.current = null;
      lastKnownOpRef.current = null;
      abortInFlight();
    }
  }, [abortInFlight, scopeFenceKey]);

  useEffect(() => () => abortInFlight(), [abortInFlight]);

  const clearTrackedOperation = useCallback(() => {
    abortInFlight();
    trackedIdRef.current = null;
    lastKnownOpRef.current = null;
    setRawState(emptyOperationState(scopeFenceRef.current));
  }, [abortInFlight]);

  const loadOperation = useCallback(
    async (operationId: string): Promise<void> => {
      if (!canReadEffective) return;
      const requestScope = scopeFenceRef.current;
      if (!isUuidV7(operationId)) {
        setRawState((prev) => ({
          ...scopedBase(prev, requestScope),
          isCheckingOperation: false,
          operationFailure: { kind: "invalidResponse" },
        }));
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const requestId = ++requestIdRef.current;
      const isCurrent = () =>
        requestIdRef.current === requestId &&
        scopeFenceRef.current === requestScope &&
        !controller.signal.aborted;

      trackedIdRef.current = operationId;
      setRawState((prev) => {
        const base = scopedBase(prev, requestScope);
        return {
          ...base,
          trackedOperationId: base.activeOperation?.id ?? operationId,
          isCheckingOperation: true,
          operationFailure: null,
        };
      });

      try {
        let payload: unknown;
        try {
          const result = await coreGet(provisioningOperationPath(operationId), {
            signal: controller.signal,
            cache: "no-store",
            suppressForbiddenToast: true,
            maxResponseBytes: OPERATION_RESPONSE_LIMIT_BYTES,
          });
          payload = result.data;
        } catch (error) {
          if (!isCurrent() || isAbortError(error)) return;
          const normalized = normalizeApiError(error);
          if (normalized.status === 403) {
            trackedIdRef.current = null;
            lastKnownOpRef.current = null;
            setRawState({
              ...emptyOperationState(requestScope),
              operationFailure: { kind: "api", error: normalized },
            });
            return;
          }
          // Retain last known `activeOperation` — never fabricate completion or disrupt list data.
          const nextFailure: UpdatesReadFailure =
            normalized.code === "API_RESPONSE_TOO_LARGE"
              ? { kind: "invalidResponse" }
              : { kind: "api", error: normalized };
          setRawState((prev) => ({ ...scopedBase(prev, requestScope), operationFailure: nextFailure }));
          return;
        }
        if (!isCurrent()) return;

        try {
          const parsed = parseProvisioningOperationView(payload, operationId);
          const previousOp = lastKnownOpRef.current;
          const transitionedToTerminal =
            previousOp !== null &&
            previousOp.id === parsed.id &&
            !isTerminalOperationStatus(previousOp.status) &&
            isTerminalOperationStatus(parsed.status);
          lastKnownOpRef.current = parsed;
          trackedIdRef.current = parsed.id;
          setRawState((prev) => {
            const base = scopedBase(prev, requestScope);
            return {
              ...base,
              activeOperation: parsed,
              trackedOperationId: parsed.id,
              correlatedSnapshot:
                base.correlatedSnapshot?.operationId === parsed.id ? base.correlatedSnapshot : null,
              isCheckingOperation: false,
              operationFailure: null,
            };
          });
          onOperationLoadedRef.current?.(parsed, transitionedToTerminal);
        } catch {
          trackedIdRef.current = lastKnownOpRef.current?.id ?? operationId;
          setRawState((prev) => ({
            ...scopedBase(prev, requestScope),
            operationFailure: { kind: "invalidResponse" },
          }));
        }
      } finally {
        if (isCurrent()) {
          abortRef.current = null;
          setRawState((prev) =>
            prev.scopeFenceKey === requestScope ? { ...prev, isCheckingOperation: false } : prev,
          );
        }
      }
    },
    [canReadEffective],
  );

  const seedInitialOperation = useCallback(
    (operationId: string | null | undefined) => {
      if (operationId && trackedIdRef.current === null) void loadOperation(operationId);
    },
    [loadOperation],
  );

  const recordAppliedOperation = useCallback(
    (
      operation: TenantProvisioningOperationView,
      snapshotItems?: readonly TenantAvailableUpdate[],
    ) => {
      abortInFlight();
      trackedIdRef.current = operation.id;
      lastKnownOpRef.current = operation;
      setRawState({
        ...emptyOperationState(scopeFenceRef.current),
        activeOperation: operation,
        trackedOperationId: operation.id,
        correlatedSnapshot:
          snapshotItems && snapshotItems.length > 0
            ? { operationId: operation.id, items: snapshotItems.map(cloneAvailableUpdate) }
            : null,
      });
    },
    [abortInFlight],
  );

  const recordCorrelatedAttemptItems = useCallback(
    (operationId: string, snapshotItems: readonly TenantAvailableUpdate[]) => {
      if (!isUuidV7(operationId) || snapshotItems.length === 0) return;
      const currentScope = scopeFenceRef.current;
      setRawState((prev) => ({
        ...scopedBase(prev, currentScope),
        correlatedSnapshot: { operationId, items: snapshotItems.map(cloneAvailableUpdate) },
      }));
    },
    [],
  );

  const openOperationModal = useCallback(() => {
    if (!canReadEffective) return;
    const currentScope = scopeFenceRef.current;
    setRawState((prev) => {
      const base = scopedBase(prev, currentScope);
      if ((base.activeOperation === null && base.trackedOperationId === null) || base.isOperationModalOpen) {
        return base;
      }
      return { ...base, isOperationModalOpen: true, modalSessionId: base.modalSessionId + 1 };
    });
  }, [canReadEffective]);

  const closeOperationModal = useCallback(() => {
    if (abortRef.current !== null) abortInFlight();
    const currentScope = scopeFenceRef.current;
    setRawState((prev) => {
      const base = scopedBase(prev, currentScope);
      if (!base.isOperationModalOpen && !base.isCheckingOperation) return base;
      return { ...base, isOperationModalOpen: false, isCheckingOperation: false };
    });
  }, [abortInFlight]);

  const refreshActiveOperation = useCallback(async (): Promise<void> => {
    const targetId = state.activeOperation?.id ?? trackedIdRef.current;
    if (targetId) await loadOperation(targetId);
  }, [loadOperation, state.activeOperation]);

  useOperationModalPolling({
    canReadEffective,
    scopeFenceKey,
    isOpen: state.isOperationModalOpen,
    modalSessionId: state.modalSessionId,
    activeOperation: state.activeOperation,
    isCheckingOperation: state.isCheckingOperation,
    operationFailure: state.operationFailure,
    onPoll: loadOperation,
    onStopInFlight: stopInFlightCheck,
  });

  const correlatedOperationItems = useMemo(
    () =>
      state.activeOperation && state.correlatedSnapshot?.operationId === state.activeOperation.id
        ? state.correlatedSnapshot.items
        : EMPTY_CORRELATED_ITEMS,
    [state.activeOperation, state.correlatedSnapshot],
  );

  return {
    activeOperation: state.activeOperation,
    correlatedOperationItems,
    hasTrackedOperation: state.activeOperation !== null || state.trackedOperationId !== null,
    isOperationModalOpen: state.isOperationModalOpen,
    isCheckingOperation: state.isCheckingOperation,
    operationFailure: state.operationFailure,
    trackOperationById: loadOperation,
    seedInitialOperation,
    recordAppliedOperation,
    recordCorrelatedAttemptItems,
    clearTrackedOperation,
    openOperationModal,
    closeOperationModal,
    refreshActiveOperation,
  };
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

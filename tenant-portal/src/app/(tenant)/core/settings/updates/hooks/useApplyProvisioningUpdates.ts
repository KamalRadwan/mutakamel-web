"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  IDEMPOTENCY_KEY_HEADER,
  createWriteAttempt,
  isAmbiguousWriteFailure,
} from "@/lib/api/idempotent-write";
import { classifyApiOutcome } from "@/lib/api/outcomes";
import { corePost } from "../../../core-api";
import {
  PROVISIONING_UPDATES_APPLY_PATH,
  type TenantAvailableUpdate,
  type TenantProvisioningOperationView,
} from "../provisioning-updates-contract";
import {
  extractAcceptedResponseOperationId,
  parseApplyProvisioningUpdatesResponse,
} from "../provisioning-updates-parsers";
import {
  createApplyAttemptSnapshot,
  hasSnapshotDiverged,
  isStaleApplyConflictError,
  type ApplyAttemptSnapshot,
  type UnreadableAcceptedAttempt,
} from "../provisioning-updates-snapshot";
import {
  closeApplyModalState,
  dismissNonPendingConfirmState,
  emptyApplyState,
  setApplyConsentState,
  transitionAmbiguousState,
  transitionLiveDriftState,
  transitionStaleConflictState,
  type ApplyModalPhase,
  type ScopedApplyState,
} from "./apply-updates-state";

const APPLY_RESPONSE_LIMIT_BYTES = 100_000;

interface UseApplyProvisioningUpdatesParams {
  t: Dictionary;
  describeError: (error: NormalizedApiError) => string | null;
  applyFenceKey: string;
  canManageEffective: boolean;
  hasAuthoritativeDiscovery: boolean;
  canRetryAmbiguous: boolean;
  liveItems: readonly TenantAvailableUpdate[];
  selectedItems: readonly TenantAvailableUpdate[];
  onResetSelection: () => void;
  onApplied: (
    operation: TenantProvisioningOperationView,
    snapshot: ApplyAttemptSnapshot,
  ) => void;
  onAppliedUnreadable: (attempt: UnreadableAcceptedAttempt) => void;
  onReloadFromStale: () => void;
}

export function useApplyProvisioningUpdates({
  t,
  describeError,
  applyFenceKey,
  canManageEffective,
  hasAuthoritativeDiscovery,
  canRetryAmbiguous,
  liveItems,
  selectedItems,
  onResetSelection,
  onApplied,
  onAppliedUnreadable,
  onReloadFromStale,
}: UseApplyProvisioningUpdatesParams) {
  const toast = useToast();
  const [rawState, setRawState] = useState<ScopedApplyState>(() => emptyApplyState(applyFenceKey));
  const state = rawState.fenceKey === applyFenceKey ? rawState : emptyApplyState(applyFenceKey);

  const inFlightRef = useRef(false);
  const applyGenerationRef = useRef(0);
  const applyFenceRef = useRef(applyFenceKey);

  useEffect(() => {
    if (applyFenceRef.current !== applyFenceKey) {
      applyFenceRef.current = applyFenceKey;
      applyGenerationRef.current += 1;
      inFlightRef.current = false;
    }
  }, [applyFenceKey]);

  const clearApplyState = useCallback(() => {
    applyGenerationRef.current += 1;
    inFlightRef.current = false;
    setRawState(emptyApplyState(applyFenceRef.current));
  }, []);

  const hasAmbiguousOutcome = state.ambiguousOutcome !== null;
  const canConfirmFresh =
    canManageEffective && hasAuthoritativeDiscovery && !state.isApplying && !hasAmbiguousOutcome;

  const liveDivergedFromSnapshot =
    state.isModalOpen &&
    state.modalPhase === "confirm" &&
    !state.isApplying &&
    hasAuthoritativeDiscovery &&
    state.modalSnapshot !== null &&
    hasSnapshotDiverged(state.modalSnapshot.items, liveItems);

  const effectiveModalPhase: ApplyModalPhase = liveDivergedFromSnapshot
    ? "stale"
    : state.modalPhase;

  const isConsented =
    effectiveModalPhase === "confirm" &&
    state.modalSnapshot !== null &&
    state.consentedAttemptKey === state.modalSnapshot.attemptKey;

  const reconcileSnapshotWithLiveItems = useCallback(
    (nextItems: readonly TenantAvailableUpdate[]) => {
      if (inFlightRef.current) return;
      setRawState((prev) => transitionLiveDriftState(prev, applyFenceRef.current, nextItems));
    },
    [],
  );

  const dismissNonPendingConfirmModal = useCallback(() => {
    if (inFlightRef.current) return;
    setRawState((prev) => dismissNonPendingConfirmState(prev, applyFenceRef.current));
  }, []);

  const setConsent = useCallback((checked: boolean) => {
    if (inFlightRef.current) return;
    setRawState((prev) => setApplyConsentState(prev, applyFenceRef.current, checked));
  }, []);

  const openApplyModal = useCallback(() => {
    if (inFlightRef.current || !canConfirmFresh) return;
    const snapshot = createApplyAttemptSnapshot(createWriteAttempt().idempotencyKey, selectedItems);
    if (!snapshot) return;
    setRawState({
      ...emptyApplyState(applyFenceKey),
      isModalOpen: true,
      modalSnapshot: snapshot,
    });
  }, [applyFenceKey, canConfirmFresh, selectedItems]);

  const closeModal = useCallback(() => {
    if (inFlightRef.current) return;
    setRawState((prev) => closeApplyModalState(prev, applyFenceKey));
  }, [applyFenceKey]);

  const setModalOpen = useCallback(
    (nextOpen: boolean) => (nextOpen ? openApplyModal() : closeModal()),
    [closeModal, openApplyModal],
  );

  const reloadFromStaleModal = useCallback(() => {
    if (inFlightRef.current || state.isApplying) return;
    setRawState(emptyApplyState(applyFenceKey));
    onResetSelection();
    onReloadFromStale();
  }, [applyFenceKey, onReloadFromStale, onResetSelection, state.isApplying]);

  const executeApply = useCallback(
    async (snapshot: ApplyAttemptSnapshot): Promise<void> => {
      if (
        inFlightRef.current ||
        !canManageEffective ||
        snapshot.requestBody.selections.length === 0
      ) {
        return;
      }
      inFlightRef.current = true;
      const requestGeneration = applyGenerationRef.current;
      const requestFence = applyFenceKey;
      const isCurrentAttempt = () =>
        applyGenerationRef.current === requestGeneration && applyFenceRef.current === requestFence;
      const updatesUi = t.coreSettings.updatesUi;

      setRawState((prev) => {
        const base = prev.fenceKey === requestFence ? prev : emptyApplyState(requestFence);
        return { ...base, isApplying: true };
      });

      try {
        let responseData: unknown;
        try {
          const result = await corePost(PROVISIONING_UPDATES_APPLY_PATH, snapshot.requestBody, {
            skipAutoIdempotency: true,
            headers: { [IDEMPOTENCY_KEY_HEADER]: snapshot.attemptKey },
            maxResponseBytes: APPLY_RESPONSE_LIMIT_BYTES,
          });
          responseData = result.data;
        } catch (error) {
          if (!isCurrentAttempt()) return;
          if (isAmbiguousWriteFailure(error)) {
            setRawState((prev) => transitionAmbiguousState(prev, requestFence, snapshot));
            return;
          }
          const normalized = normalizeApiError(error);
          const outcome = classifyApiOutcome(normalized);
          if (
            outcome === "idempotencyProcessing" ||
            outcome === "rateLimited" ||
            outcome === "rateLimiterUnavailable"
          ) {
            setRawState((prev) => transitionAmbiguousState(prev, requestFence, snapshot));
            toast.outcomeFromApi(normalized);
            return;
          }
          if (isStaleApplyConflictError(normalized)) {
            const msg = describeError(normalized) ?? updatesUi.staleModalDescription;
            setRawState(transitionStaleConflictState(requestFence, snapshot, msg));
            return;
          }
          setRawState(emptyApplyState(requestFence));
          if (normalized.status === 403) onResetSelection();
          if (normalized.status === 403 || toast.outcomeFromApi(normalized)) return;
          toast.errorFromApi(updatesUi.applyFailed, normalized);
          return;
        }
        if (!isCurrentAttempt()) return;

        let parsed: ReturnType<typeof parseApplyProvisioningUpdatesResponse>;
        try {
          parsed = parseApplyProvisioningUpdatesResponse(responseData);
        } catch {
          setRawState(emptyApplyState(requestFence));
          onResetSelection();
          onAppliedUnreadable({
            snapshot,
            responseOperationId: extractAcceptedResponseOperationId(responseData),
          });
          return;
        }

        setRawState(emptyApplyState(requestFence));
        onResetSelection();
        toast.success(updatesUi.applySuccessTitle);
        onApplied(parsed.operation, snapshot);
      } finally {
        if (isCurrentAttempt()) {
          inFlightRef.current = false;
          setRawState((prev) =>
            prev.fenceKey === requestFence ? { ...prev, isApplying: false } : prev,
          );
        }
      }
    },
    [
      applyFenceKey,
      canManageEffective,
      describeError,
      onApplied,
      onAppliedUnreadable,
      onResetSelection,
      t,
      toast,
    ],
  );

  return {
    isModalOpen: state.isModalOpen,
    setIsModalOpen: setModalOpen,
    modalPhase: effectiveModalPhase,
    modalSnapshot: state.ambiguousOutcome ?? state.modalSnapshot,
    staleConflictMessage: state.staleConflictMessage,
    isConsented,
    setConsent,
    isApplying: state.isApplying,
    hasAmbiguousOutcome,
    canConfirmFresh,
    clearApplyState,
    dismissNonPendingConfirmModal,
    reconcileSnapshotWithLiveItems,
    reloadFromStaleModal,
    confirmApply: async () => {
      if (
        !canConfirmFresh ||
        effectiveModalPhase !== "confirm" ||
        !state.modalSnapshot ||
        state.consentedAttemptKey !== state.modalSnapshot.attemptKey
      ) {
        return;
      }
      await executeApply(state.modalSnapshot);
    },
    retryAmbiguous: async () => {
      if (
        !state.ambiguousOutcome ||
        !canRetryAmbiguous ||
        inFlightRef.current ||
        state.isApplying
      ) {
        return;
      }
      await executeApply(state.ambiguousOutcome);
    },
  };
}

import type { TenantAvailableUpdate } from "../provisioning-updates-contract";
import { hasSnapshotDiverged, type ApplyAttemptSnapshot } from "../provisioning-updates-snapshot";

export type ApplyModalPhase = "confirm" | "stale" | "ambiguous";

export interface ScopedApplyState {
  fenceKey: string;
  isModalOpen: boolean;
  modalPhase: ApplyModalPhase;
  modalSnapshot: ApplyAttemptSnapshot | null;
  staleConflictMessage: string | null;
  consentedAttemptKey: string | null;
  isApplying: boolean;
  ambiguousOutcome: ApplyAttemptSnapshot | null;
}

export function emptyApplyState(fenceKey: string): ScopedApplyState {
  return {
    fenceKey,
    isModalOpen: false,
    modalPhase: "confirm",
    modalSnapshot: null,
    staleConflictMessage: null,
    consentedAttemptKey: null,
    isApplying: false,
    ambiguousOutcome: null,
  };
}

export function transitionAmbiguousState(
  prev: ScopedApplyState,
  fenceKey: string,
  snapshot: ApplyAttemptSnapshot,
): ScopedApplyState {
  return {
    fenceKey,
    isModalOpen: prev.fenceKey === fenceKey ? prev.isModalOpen : false,
    modalPhase: "ambiguous",
    modalSnapshot: snapshot,
    staleConflictMessage: null,
    consentedAttemptKey: null,
    isApplying: false,
    ambiguousOutcome: snapshot,
  };
}

export function transitionStaleConflictState(
  fenceKey: string,
  snapshot: ApplyAttemptSnapshot,
  message: string,
): ScopedApplyState {
  return {
    fenceKey,
    isModalOpen: true,
    modalPhase: "stale",
    modalSnapshot: snapshot,
    staleConflictMessage: message,
    consentedAttemptKey: null,
    isApplying: false,
    ambiguousOutcome: null,
  };
}

export function transitionLiveDriftState(
  prev: ScopedApplyState,
  activeFence: string,
  nextItems: readonly TenantAvailableUpdate[],
): ScopedApplyState {
  if (
    prev.fenceKey !== activeFence ||
    prev.isApplying ||
    !prev.isModalOpen ||
    prev.modalPhase !== "confirm" ||
    !prev.modalSnapshot ||
    !hasSnapshotDiverged(prev.modalSnapshot.items, nextItems)
  ) {
    return prev;
  }
  return {
    ...prev,
    modalPhase: "stale",
    consentedAttemptKey: null,
    staleConflictMessage: null,
  };
}

export function dismissNonPendingConfirmState(
  prev: ScopedApplyState,
  activeFence: string,
): ScopedApplyState {
  if (
    prev.fenceKey !== activeFence ||
    prev.isApplying ||
    prev.ambiguousOutcome !== null ||
    !prev.isModalOpen ||
    prev.modalPhase !== "confirm"
  ) {
    return prev;
  }
  return {
    ...prev,
    isModalOpen: false,
    modalSnapshot: null,
    staleConflictMessage: null,
    consentedAttemptKey: null,
  };
}

export function setApplyConsentState(
  prev: ScopedApplyState,
  activeFence: string,
  checked: boolean,
): ScopedApplyState {
  if (
    prev.fenceKey !== activeFence ||
    prev.isApplying ||
    prev.modalPhase !== "confirm" ||
    !prev.modalSnapshot
  ) {
    return prev;
  }
  return {
    ...prev,
    consentedAttemptKey: checked ? prev.modalSnapshot.attemptKey : null,
  };
}

export function closeApplyModalState(
  prev: ScopedApplyState,
  activeFence: string,
): ScopedApplyState {
  const base = prev.fenceKey === activeFence ? prev : emptyApplyState(activeFence);
  if (base.isApplying) return base;
  // Closing an ambiguous modal hides presentation only — never forgets unresolved attempt evidence.
  if (base.ambiguousOutcome !== null || base.modalPhase === "ambiguous") {
    return { ...base, isModalOpen: false };
  }
  return emptyApplyState(activeFence);
}

"use client";

import { useCallback, useMemo, useState, type RefObject } from "react";
import type { Currency } from "../currency-contract";
import type { CurrencyActionBlocker } from "./currency-errors";

interface EditingCurrencyState {
  currency: Currency;
  activateOnSubmit: boolean;
}

interface CurrencyModalState {
  createOpen: boolean;
  editingState: EditingCurrencyState | null;
  settingDefault: Currency | null;
  deactivating: Currency | null;
  blocker: CurrencyActionBlocker | null;
  formError: string | null;
  formErrorCode: string | null;
  pendingId: string | null;
  isSubmitting: boolean;
}

interface UseCurrencyModalStateOptions {
  authFenceKey: string;
  canManage: boolean;
  isForbidden: boolean;
  mountedRef: RefObject<boolean>;
  mutationInFlightRef: RefObject<boolean>;
}

const CLOSED_MODAL_STATE: CurrencyModalState = {
  createOpen: false,
  editingState: null,
  settingDefault: null,
  deactivating: null,
  blocker: null,
  formError: null,
  formErrorCode: null,
  pendingId: null,
  isSubmitting: false,
};

/**
 * Owns currency dialog state, pending/submitting indicators, inline server form
 * feedback, synchronous scope/permission/403 modal resets, and guarded open/close
 * commands while sharing the synchronous write lock with `useCurrencyMutations`.
 */
export function useCurrencyModalState({
  authFenceKey,
  canManage,
  isForbidden,
  mountedRef,
  mutationInFlightRef,
}: UseCurrencyModalStateOptions) {
  const [trackedAuthKey, setTrackedAuthKey] = useState(authFenceKey);
  const [trackedCanManage, setTrackedCanManage] = useState(canManage);
  const [trackedForbidden, setTrackedForbidden] = useState(isForbidden);
  const [modals, setModals] = useState<CurrencyModalState>(CLOSED_MODAL_STATE);

  const shouldResetModals =
    trackedAuthKey !== authFenceKey ||
    (trackedCanManage && !canManage) ||
    (!trackedForbidden && isForbidden);

  if (
    trackedAuthKey !== authFenceKey ||
    trackedCanManage !== canManage ||
    trackedForbidden !== isForbidden
  ) {
    setTrackedAuthKey(authFenceKey);
    setTrackedCanManage(canManage);
    setTrackedForbidden(isForbidden);
    if (shouldResetModals) {
      setModals(CLOSED_MODAL_STATE);
    }
  }

  const { pendingId, isSubmitting, editingState, settingDefault, deactivating } = modals;

  const transitions = useMemo(
    () => ({
      beginFormSubmit: () =>
        setModals((prev) => ({ ...prev, isSubmitting: true, formError: null, formErrorCode: null })),
      finishFormSubmit: () =>
        setModals((prev) => (prev.isSubmitting ? { ...prev, isSubmitting: false } : prev)),
      failFormSubmit: (message: string, code: string | null) =>
        setModals((prev) => ({ ...prev, formError: message, formErrorCode: code })),
      beginRowMutation: (id: string) => setModals((prev) => ({ ...prev, pendingId: id })),
      finishRowMutation: () =>
        setModals((prev) => (prev.pendingId !== null ? { ...prev, pendingId: null } : prev)),
      setActionBlocker: (blocker: CurrencyActionBlocker) =>
        setModals((prev) => ({ ...prev, blocker })),
      openReactivateInEdit: (currency: Currency) =>
        setModals((prev) => ({
          ...prev,
          formError: null,
          formErrorCode: null,
          editingState: { currency, activateOnSubmit: true },
        })),
      completeCreate: () => setModals((prev) => ({ ...prev, createOpen: false })),
      completeEdit: () => setModals((prev) => ({ ...prev, editingState: null })),
      clearSettingDefault: () => setModals((prev) => ({ ...prev, settingDefault: null })),
      clearDeactivating: () => setModals((prev) => ({ ...prev, deactivating: null })),
      resetAll: () => setModals(CLOSED_MODAL_STATE),
    }),
    [],
  );

  const canTargetActiveNonDefault = useCallback(
    (currency: Currency) =>
      mountedRef.current &&
      canManage &&
      !isForbidden &&
      !mutationInFlightRef.current &&
      !currency.isDefault &&
      currency.status === "ACTIVE",
    [canManage, isForbidden, mountedRef, mutationInFlightRef],
  );

  const openCreate = useCallback(() => {
    if (!mountedRef.current || !canManage || isForbidden || mutationInFlightRef.current) return;
    setModals((prev) => ({ ...prev, formError: null, formErrorCode: null, createOpen: true }));
  }, [canManage, isForbidden, mountedRef, mutationInFlightRef]);

  const closeCreate = useCallback(() => {
    if (!mountedRef.current || isSubmitting || mutationInFlightRef.current) return;
    setModals((prev) => ({ ...prev, formError: null, formErrorCode: null, createOpen: false }));
  }, [isSubmitting, mountedRef, mutationInFlightRef]);

  const openEdit = useCallback(
    (currency: Currency) => {
      if (!mountedRef.current || !canManage || isForbidden || mutationInFlightRef.current) return;
      setModals((prev) => ({
        ...prev,
        formError: null,
        formErrorCode: null,
        editingState: { currency, activateOnSubmit: false },
      }));
    },
    [canManage, isForbidden, mountedRef, mutationInFlightRef],
  );

  const closeEdit = useCallback(() => {
    if (!mountedRef.current || isSubmitting || mutationInFlightRef.current) return;
    setModals((prev) => ({ ...prev, formError: null, formErrorCode: null, editingState: null }));
  }, [isSubmitting, mountedRef, mutationInFlightRef]);

  const openSetDefault = useCallback(
    (currency: Currency) => {
      if (canTargetActiveNonDefault(currency)) {
        setModals((prev) => ({ ...prev, settingDefault: currency }));
      }
    },
    [canTargetActiveNonDefault],
  );

  const closeSetDefault = useCallback(() => {
    if (!mountedRef.current || pendingId !== null || mutationInFlightRef.current) return;
    setModals((prev) => ({ ...prev, settingDefault: null }));
  }, [mountedRef, mutationInFlightRef, pendingId]);

  const openDeactivate = useCallback(
    (currency: Currency) => {
      if (canTargetActiveNonDefault(currency)) {
        setModals((prev) => ({ ...prev, deactivating: currency }));
      }
    },
    [canTargetActiveNonDefault],
  );

  const closeDeactivate = useCallback(() => {
    if (!mountedRef.current || pendingId !== null || mutationInFlightRef.current) return;
    setModals((prev) => ({ ...prev, deactivating: null }));
  }, [mountedRef, mutationInFlightRef, pendingId]);

  const closeBlocker = useCallback(() => {
    if (!mountedRef.current) return;
    setModals((prev) => ({ ...prev, blocker: null }));
  }, [mountedRef]);

  return {
    state: { editingState, settingDefault, deactivating, pendingId, isSubmitting },
    transitions,
    uiProps: {
      pendingId,
      isSubmitting,
      formError: modals.formError,
      formErrorCode: modals.formErrorCode,
      createOpen: modals.createOpen,
      editing: editingState?.currency ?? null,
      isReactivatingInEdit: editingState?.activateOnSubmit ?? false,
      settingDefault,
      deactivating,
      blocker: modals.blocker,
      openCreate,
      closeCreate,
      openEdit,
      closeEdit,
      openSetDefault,
      closeSetDefault,
      openDeactivate,
      closeDeactivate,
      closeBlocker,
    },
  };
}

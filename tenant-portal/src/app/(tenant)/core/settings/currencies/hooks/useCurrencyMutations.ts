"use client";

import { useCallback, useEffect, useRef } from "react";
import { formatApiErrorMessage, useToast } from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { coreDelete, corePatch, corePost } from "../../../core-api";
import {
  CURRENCIES_PATH,
  buildCreateCurrencyRequest,
  buildUpdateCurrencyRequest,
  currencyPath,
  hasValidSavedExchangeRate,
  parseCurrencyResponse,
  setDefaultCurrencyPath,
  type Currency,
  type CurrencyFormValues,
} from "../currency-contract";
import {
  currencyMutationFallbackError,
  currencyMutationMessage,
  normalizeCurrencyQueryError,
  resolveCurrencyActionBlocker,
  resolveCurrencyFormFailure,
  type CurrencyBlockerKind,
} from "./currency-errors";
import { useCurrencyModalState } from "./useCurrencyModalState";

const ROW_RESPONSE_LIMIT_BYTES = 20_000;
const DELETE_RESPONSE_LIMIT_BYTES = 10_000;

interface UseCurrencyMutationsOptions {
  t: Dictionary;
  authFenceKey: string;
  canManage: boolean;
  isForbidden: boolean;
  onRefreshList: () => Promise<void>;
  onRefreshAll: () => Promise<void>;
}

export function useCurrencyMutations({
  t,
  authFenceKey,
  canManage,
  isForbidden,
  onRefreshList,
  onRefreshAll,
}: UseCurrencyMutationsOptions) {
  const toast = useToast();
  const mountedRef = useRef(true);
  const mutationInFlightRef = useRef(false);
  const latestAuthFenceRef = useRef(authFenceKey);
  const activeMutationIdRef = useRef(0);

  const invalidateActiveOperation = useCallback(() => {
    activeMutationIdRef.current += 1;
    mutationInFlightRef.current = false;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      invalidateActiveOperation();
    };
  }, [invalidateActiveOperation]);

  useEffect(() => {
    latestAuthFenceRef.current = authFenceKey;
    if (!canManage || isForbidden) invalidateActiveOperation();
    return () => {
      invalidateActiveOperation();
    };
  }, [authFenceKey, canManage, invalidateActiveOperation, isForbidden]);

  const { state, transitions, uiProps } = useCurrencyModalState({
    authFenceKey,
    canManage,
    isForbidden,
    mountedRef,
    mutationInFlightRef,
  });

  const { editingState, settingDefault, deactivating, pendingId, isSubmitting } = state;
  const isBusy = isSubmitting || pendingId !== null;

  const canStartOperation = useCallback(
    () => mountedRef.current && canManage && !isForbidden && !isBusy && !mutationInFlightRef.current,
    [canManage, isBusy, isForbidden],
  );

  const beginOperation = useCallback(() => {
    if (!canStartOperation()) return null;
    const startedFence = authFenceKey;
    const opId = ++activeMutationIdRef.current;
    mutationInFlightRef.current = true;
    return () =>
      mountedRef.current &&
      latestAuthFenceRef.current === startedFence &&
      activeMutationIdRef.current === opId;
  }, [authFenceKey, canStartOperation]);

  const dismissAllModals = useCallback(() => {
    invalidateActiveOperation();
    if (!mountedRef.current) return;
    transitions.resetAll();
  }, [invalidateActiveOperation, transitions]);

  const runFormMutation = useCallback(
    async (
      mode: "create" | "update",
      execute: (isCurrentOp: () => boolean) => Promise<void>,
    ): Promise<boolean> => {
      const isCurrentOp = beginOperation();
      if (!isCurrentOp) return false;
      transitions.beginFormSubmit();
      try {
        await execute(isCurrentOp);
        return isCurrentOp();
      } catch (error) {
        if (!isCurrentOp()) return false;
        const resolved = resolveCurrencyFormFailure(error, t, mode);
        transitions.failFormSubmit(resolved.message, resolved.code);
        return false;
      } finally {
        if (isCurrentOp()) {
          mutationInFlightRef.current = false;
          transitions.finishFormSubmit();
        }
      }
    },
    [beginOperation, t, transitions],
  );

  const runRowMutation = useCallback(
    async (options: {
      target: Currency;
      kind: CurrencyBlockerKind;
      failureTitle: string;
      successMessage: string;
      refresh: () => Promise<void>;
      closeDialog?: () => void;
      execute: () => Promise<void>;
    }): Promise<boolean> => {
      const isCurrentOp = beginOperation();
      if (!isCurrentOp) return false;
      transitions.beginRowMutation(options.target.id);
      try {
        await options.execute();
        if (!isCurrentOp()) return false;
        options.closeDialog?.();
        toast.success(t.coreSettings.savedTitle, options.successMessage);
        await options.refresh();
        return isCurrentOp();
      } catch (error) {
        if (!isCurrentOp()) return false;
        const normalized = normalizeCurrencyQueryError(error);
        const domainBlocker = resolveCurrencyActionBlocker(normalized, options.kind, options.target, t);
        options.closeDialog?.();
        if (domainBlocker) {
          transitions.setActionBlocker(domainBlocker);
          return false;
        }
        // Transport already toasts a 403 — a second would double-fire.
        if (normalized.status !== 403 && !toast.outcomeFromApi(normalized)) {
          const specific = currencyMutationMessage(normalized.code, t);
          if (specific) {
            toast.error(
              options.failureTitle,
              formatApiErrorMessage(
                { status: normalized.status, message: specific, correlationId: normalized.correlationId },
                t,
              ),
            );
          } else {
            toast.errorFromApi(options.failureTitle, currencyMutationFallbackError(normalized, t));
          }
        }
        return false;
      } finally {
        if (isCurrentOp()) {
          mutationInFlightRef.current = false;
          transitions.finishRowMutation();
        }
      }
    },
    [beginOperation, t, toast, transitions],
  );

  const create = useCallback(
    (values: CurrencyFormValues): Promise<boolean> =>
      runFormMutation("create", async (isCurrentOp) => {
        const request = buildCreateCurrencyRequest(values);
        const result = await corePost(CURRENCIES_PATH, request, {
          maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES,
        });
        parseCurrencyResponse(result.data);
        if (!isCurrentOp()) return;
        transitions.completeCreate();
        toast.success(t.coreSettings.savedTitle, t.coreSettings.currencyCreated);
        await onRefreshAll();
      }),
    [onRefreshAll, runFormMutation, t, toast, transitions],
  );

  const update = useCallback(
    async (values: CurrencyFormValues): Promise<boolean> => {
      if (!editingState) return false;
      const { currency: target, activateOnSubmit } = editingState;
      return runFormMutation("update", async (isCurrentOp) => {
        const request = buildUpdateCurrencyRequest(target, values, { activate: activateOnSubmit });
        if (Object.keys(request).length === 0) {
          if (isCurrentOp()) transitions.completeEdit();
          return;
        }
        const result = await corePatch(currencyPath(target.id), request, {
          maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES,
        });
        parseCurrencyResponse(result.data);
        if (!isCurrentOp()) return;
        transitions.completeEdit();
        toast.success(
          t.coreSettings.savedTitle,
          activateOnSubmit ? t.coreSettings.currencyReactivated : t.coreSettings.currencyUpdated,
        );
        await onRefreshAll();
      });
    },
    [editingState, onRefreshAll, runFormMutation, t, toast, transitions],
  );

  const confirmSetDefault = useCallback(async (): Promise<boolean> => {
    if (!settingDefault || settingDefault.isDefault || settingDefault.status !== "ACTIVE") return false;
    const target = settingDefault;
    // Promotion and demotion happen in ONE server transaction — never swap
    // the default optimistically before server confirmation.
    return runRowMutation({
      target,
      kind: "setDefault",
      failureTitle: t.coreSettings.currencySetDefaultFailed,
      successMessage: t.coreSettings.currencyDefaultSet,
      refresh: onRefreshAll,
      closeDialog: transitions.clearSettingDefault,
      execute: async () => {
        const result = await corePost(setDefaultCurrencyPath(target.id), undefined, {
          maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES,
        });
        parseCurrencyResponse(result.data);
      },
    });
  }, [onRefreshAll, runRowMutation, settingDefault, t, transitions]);

  const deactivate = useCallback(async (): Promise<boolean> => {
    if (!deactivating || deactivating.isDefault || deactivating.status !== "ACTIVE") return false;
    const target = deactivating;
    return runRowMutation({
      target,
      kind: "deactivate",
      failureTitle: t.coreSettings.currencyDeactivateFailed,
      successMessage: t.coreSettings.currencyDeactivated,
      refresh: onRefreshList,
      closeDialog: transitions.clearDeactivating,
      execute: async () => {
        await coreDelete(currencyPath(target.id), { maxResponseBytes: DELETE_RESPONSE_LIMIT_BYTES });
      },
    });
  }, [deactivating, onRefreshList, runRowMutation, t, transitions]);

  const reactivate = useCallback(
    async (currency: Currency): Promise<boolean> => {
      if (!canStartOperation() || currency.isDefault || currency.status !== "INACTIVE") return false;
      // Non-default activation requires a positive rate (`CurrenciesService.update`);
      // open edit to collect one rather than firing an impossible PATCH.
      if (!hasValidSavedExchangeRate(currency.exchangeRate)) {
        transitions.openReactivateInEdit(currency);
        return false;
      }
      return runRowMutation({
        target: currency,
        kind: "reactivate",
        failureTitle: t.coreSettings.currencyReactivateFailed,
        successMessage: t.coreSettings.currencyReactivated,
        refresh: onRefreshList,
        execute: async () => {
          const result = await corePatch(
            currencyPath(currency.id),
            { status: "ACTIVE" },
            { maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES },
          );
          parseCurrencyResponse(result.data);
        },
      });
    },
    [canStartOperation, onRefreshList, runRowMutation, t, transitions],
  );

  return {
    ...uiProps,
    dismissAllModals,
    create,
    update,
    confirmSetDefault,
    deactivate,
    reactivate,
  };
}

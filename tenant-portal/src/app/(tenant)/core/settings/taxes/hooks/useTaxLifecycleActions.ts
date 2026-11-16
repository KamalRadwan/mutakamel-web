"use client";

import { useCallback, useState, type RefObject } from "react";
import { useToast } from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { coreDelete, corePatch } from "../../../core-api";
import { parseTaxResponse, taxPath, type Tax } from "../tax-contract";
import { resolveTaxReactivateError } from "../tax-errors";

const ROW_RESPONSE_LIMIT_BYTES = 20_000;
const DEACTIVATE_RESPONSE_LIMIT_BYTES = 10_000;

export interface UseTaxLifecycleActionsOptions {
  t: Dictionary;
  authFenceKey: string;
  latestAuthFenceRef: RefObject<string>;
  mutationInFlightRef: RefObject<boolean>;
  canMutate: boolean;
  canManageScope: (companyId: string | null) => boolean;
  onBeforeOpenDeactivate: () => void;
  reloadList: () => Promise<void>;
}

export function useTaxLifecycleActions({
  t,
  authFenceKey,
  latestAuthFenceRef,
  mutationInFlightRef,
  canMutate,
  canManageScope,
  onBeforeOpenDeactivate,
  reloadList,
}: UseTaxLifecycleActionsOptions) {
  const toast = useToast();
  const [trackedAuthKey, setTrackedAuthKey] = useState(authFenceKey);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState<Tax | null>(null);

  if (trackedAuthKey !== authFenceKey) {
    setTrackedAuthKey(authFenceKey);
    setPendingId(null);
    setDeactivating(null);
  }

  const isLocked = pendingId !== null;

  const notifyFailure = useCallback(
    (title: string, failure: ReturnType<typeof resolveTaxReactivateError>) => {
      if (failure.isInvalidResponse) {
        toast.error(title, failure.message);
      } else if (failure.normalized.status !== 403 && !toast.outcomeFromApi(failure.normalized)) {
        toast.error(title, failure.message);
      }
    },
    [toast],
  );

  const deactivate = useCallback(async (): Promise<void> => {
    if (
      !deactivating ||
      !canMutate ||
      deactivating.status !== "ACTIVE" ||
      !canManageScope(deactivating.companyId) ||
      mutationInFlightRef.current ||
      isLocked
    ) {
      return;
    }
    const target = deactivating;
    const startedFence = latestAuthFenceRef.current;
    mutationInFlightRef.current = true;
    setPendingId(target.id);
    try {
      const response = await coreDelete(taxPath(target.id), {
        maxResponseBytes: DEACTIVATE_RESPONSE_LIMIT_BYTES,
      });
      if (response.status !== 204 && response.data !== null && response.data !== undefined) {
        parseTaxResponse(response.data);
      }
      if (latestAuthFenceRef.current !== startedFence) return;
      setDeactivating(null);
      toast.success(t.coreSettings.savedTitle, t.coreSettings.taxDeactivated);
      await reloadList();
    } catch (error) {
      if (latestAuthFenceRef.current !== startedFence) return;
      setDeactivating(null);
      const failure = resolveTaxReactivateError(error, t);
      notifyFailure(t.coreSettings.taxDeactivateFailed, failure);
      if (failure.shouldReload) await reloadList();
    } finally {
      mutationInFlightRef.current = false;
      if (latestAuthFenceRef.current === startedFence) {
        setPendingId(null);
      }
    }
  }, [canManageScope, canMutate, deactivating, isLocked, latestAuthFenceRef, mutationInFlightRef, notifyFailure, reloadList, t, toast]);

  const reactivate = useCallback(
    async (tax: Tax): Promise<void> => {
      if (
        !canMutate ||
        tax.status !== "INACTIVE" ||
        !canManageScope(tax.companyId) ||
        mutationInFlightRef.current ||
        isLocked
      ) {
        return;
      }
      const startedFence = latestAuthFenceRef.current;
      mutationInFlightRef.current = true;
      setPendingId(tax.id);
      try {
        const response = await corePatch(
          taxPath(tax.id),
          { status: "ACTIVE" },
          { maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES },
        );
        parseTaxResponse(response.data);
        if (latestAuthFenceRef.current !== startedFence) return;
        toast.success(t.coreSettings.savedTitle, t.coreSettings.taxUpdated);
        await reloadList();
      } catch (error) {
        if (latestAuthFenceRef.current !== startedFence) return;
        const failure = resolveTaxReactivateError(error, t);
        notifyFailure(t.coreSettings.taxUpdateFailed, failure);
        if (failure.shouldReload) await reloadList();
      } finally {
        mutationInFlightRef.current = false;
        if (latestAuthFenceRef.current === startedFence) {
          setPendingId(null);
        }
      }
    },
    [canManageScope, canMutate, isLocked, latestAuthFenceRef, mutationInFlightRef, notifyFailure, reloadList, t, toast],
  );

  const dismissDeactivate = useCallback(() => {
    setDeactivating(null);
  }, []);

  return {
    pendingId,
    deactivating,
    dismissDeactivate,
    openDeactivate: (tax: Tax) => {
      if (
        !canMutate ||
        tax.status !== "ACTIVE" ||
        !canManageScope(tax.companyId) ||
        mutationInFlightRef.current ||
        isLocked
      ) {
        return;
      }
      onBeforeOpenDeactivate();
      setDeactivating(tax);
    },
    closeDeactivate: () => {
      if (mutationInFlightRef.current || pendingId !== null) return;
      setDeactivating(null);
    },
    deactivate,
    reactivate,
  };
}

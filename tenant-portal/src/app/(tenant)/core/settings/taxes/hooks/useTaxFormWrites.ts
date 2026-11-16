"use client";

import { useCallback, useState, type RefObject } from "react";
import { useToast } from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { CompanyOption } from "../../company-options";
import { corePatch, corePost } from "../../../core-api";
import {
  TAXES_PATH,
  buildCreateTaxRequest,
  buildUpdateTaxRequest,
  parseTaxResponse,
  taxPath,
  type Tax,
  type TaxFormValues,
} from "../tax-contract";
import { resolveTaxFormWriteError } from "../tax-errors";

const ROW_RESPONSE_LIMIT_BYTES = 20_000;

export interface UseTaxFormWritesOptions {
  t: Dictionary;
  authFenceKey: string;
  latestAuthFenceRef: RefObject<string>;
  mutationInFlightRef: RefObject<boolean>;
  isPeerBusy: boolean;
  canMutate: boolean;
  canCreate: boolean;
  canManageScope: (companyId: string | null) => boolean;
  companies: readonly CompanyOption[];
  onBeforeOpenModal: () => void;
  reloadList: () => Promise<void>;
}

export function useTaxFormWrites({
  t,
  authFenceKey,
  latestAuthFenceRef,
  mutationInFlightRef,
  isPeerBusy,
  canMutate,
  canCreate,
  canManageScope,
  companies,
  onBeforeOpenModal,
  reloadList,
}: UseTaxFormWritesOptions) {
  const toast = useToast();
  const [trackedAuthKey, setTrackedAuthKey] = useState(authFenceKey);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Tax | null>(null);

  if (trackedAuthKey !== authFenceKey) {
    setTrackedAuthKey(authFenceKey);
    setIsSubmitting(false);
    setFormError(null);
    setCreateOpen(false);
    setEditing(null);
  }

  const isLocked = isSubmitting || isPeerBusy;

  const create = useCallback(
    async (values: TaxFormValues): Promise<boolean> => {
      if (!canMutate || !canManageScope(values.companyId) || mutationInFlightRef.current || isLocked) {
        return false;
      }
      const startedFence = latestAuthFenceRef.current;
      mutationInFlightRef.current = true;
      setIsSubmitting(true);
      setFormError(null);
      try {
        const request = buildCreateTaxRequest(values);
        const response = await corePost(TAXES_PATH, request, {
          maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES,
        });
        parseTaxResponse(response.data);
        if (latestAuthFenceRef.current !== startedFence) return false;
        setCreateOpen(false);
        toast.success(t.coreSettings.savedTitle, t.coreSettings.taxCreated);
        await reloadList();
        return true;
      } catch (error) {
        if (latestAuthFenceRef.current !== startedFence) return false;
        const failure = resolveTaxFormWriteError({
          error,
          fallbackTitle: t.coreSettings.taxCreateFailed,
          scopeCompanyId: values.companyId,
          companies,
          t,
        });
        setFormError(failure.message);
        return false;
      } finally {
        mutationInFlightRef.current = false;
        if (latestAuthFenceRef.current === startedFence) {
          setIsSubmitting(false);
        }
      }
    },
    [canManageScope, canMutate, companies, isLocked, latestAuthFenceRef, mutationInFlightRef, reloadList, t, toast],
  );

  const update = useCallback(
    async (values: TaxFormValues): Promise<boolean> => {
      if (!editing || !canMutate || !canManageScope(editing.companyId) || mutationInFlightRef.current || isLocked) {
        return false;
      }
      const target = editing;
      const startedFence = latestAuthFenceRef.current;
      mutationInFlightRef.current = true;
      setIsSubmitting(true);
      setFormError(null);
      try {
        const request = buildUpdateTaxRequest(target, values);
        if (Object.keys(request).length === 0) {
          setEditing(null);
          return true;
        }
        const response = await corePatch(taxPath(target.id), request, {
          maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES,
        });
        parseTaxResponse(response.data);
        if (latestAuthFenceRef.current !== startedFence) return false;
        setEditing(null);
        toast.success(t.coreSettings.savedTitle, t.coreSettings.taxUpdated);
        await reloadList();
        return true;
      } catch (error) {
        if (latestAuthFenceRef.current !== startedFence) return false;
        const failure = resolveTaxFormWriteError({
          error,
          fallbackTitle: t.coreSettings.taxUpdateFailed,
          scopeCompanyId: target.companyId,
          companies,
          t,
        });
        setFormError(failure.message);
        if (failure.shouldReload) void reloadList();
        return false;
      } finally {
        mutationInFlightRef.current = false;
        if (latestAuthFenceRef.current === startedFence) {
          setIsSubmitting(false);
        }
      }
    },
    [canManageScope, canMutate, companies, editing, isLocked, latestAuthFenceRef, mutationInFlightRef, reloadList, t, toast],
  );

  const dismissFormModals = useCallback(() => {
    setFormError(null);
    setCreateOpen(false);
    setEditing(null);
  }, []);

  return {
    isSubmitting,
    formError,
    createOpen,
    editing,
    dismissFormModals,
    openCreate: () => {
      if (!canCreate || mutationInFlightRef.current || isLocked) return;
      onBeforeOpenModal();
      setFormError(null);
      setEditing(null);
      setCreateOpen(true);
    },
    closeCreate: () => {
      if (mutationInFlightRef.current || isSubmitting) return;
      setFormError(null);
      setCreateOpen(false);
    },
    openEdit: (tax: Tax) => {
      if (!canMutate || !canManageScope(tax.companyId) || mutationInFlightRef.current || isLocked) {
        return;
      }
      onBeforeOpenModal();
      setFormError(null);
      setCreateOpen(false);
      setEditing(tax);
    },
    closeEdit: () => {
      if (mutationInFlightRef.current || isSubmitting) return;
      setFormError(null);
      setEditing(null);
    },
    create,
    update,
  };
}

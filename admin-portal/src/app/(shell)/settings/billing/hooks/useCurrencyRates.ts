"use client";

import { useCallback, useEffect, useState } from "react";
import { useHasPermission } from "@/components/auth/RequirePermission";
import { useToast } from "@/components/ui/ToastContext";
import { applicationsApi } from "@/features/admin/applications/api/applications.api";
import type { CurrencyRateView, SetCurrencyRatesDto } from "@/features/admin/applications/types";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError } from "@/shared/api/normalized-api-error";
import { useIdempotency } from "@/shared/hooks/useIdempotency";

export type { CurrencyRateView } from "@/features/admin/applications/types";

const ratePattern = /^\d{1,12}(?:\.\d{1,12})?$/;

export function useCurrencyRates() {
  const { lang, t } = useI18n();
  const copy = t.settings.currencyRates.validation;
  const toast = useToast();
  const { getIdempotencyKey, resetKey } = useIdempotency();
  const [rates, setRates] = useState<CurrencyRateView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<CurrencyRateView | null>(null);
  const canRead = useHasPermission("admin.catalog.read");
  const canManageCurrency = useHasPermission("admin.billing.currency.manage");
  const canUseCritical = useHasPermission("admin.catalog.critical");
  const canManage = canManageCurrency && canUseCritical;

  const showError = useCallback((requestError: unknown, fallback: string) => {
    const normalized = normalizeApiError(requestError);
    const message = normalized.errorCode === "UNKNOWN_ERROR"
      ? requestError instanceof Error ? requestError.message : fallback
      : normalized.message;
    setError(message);
    toast.error(copy.actionFailedTitle, `${message}${normalized.correlationId ? ` · ${normalized.correlationId}` : ""}`);
  }, [copy.actionFailedTitle, toast]);

  const fetchRates = useCallback(async () => {
    if (!canRead) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setRates(await applicationsApi.listCurrencyRates());
    } catch (requestError) {
      showError(requestError, copy.loadFailed);
    } finally {
      setIsLoading(false);
    }
  }, [canRead, copy.loadFailed, showError]);

  useEffect(() => { queueMicrotask(() => { void fetchRates(); }); }, [fetchRates]);

  const validateRate = (currencyCode: string, currencyUnitsPerUsd: string) => {
    const cleanCode = currencyCode.trim().toUpperCase();
    const cleanRate = currencyUnitsPerUsd.trim();
    if (!/^[A-Z]{3}$/.test(cleanCode)) throw new Error(copy.currencyCodeInvalid);
    if (cleanCode === "USD") throw new Error(copy.usdImmutable);
    if (!ratePattern.test(cleanRate) || !/[1-9]/.test(cleanRate)) throw new Error(copy.rateFormatInvalid);
    return { cleanCode, cleanRate };
  };

  const upsertRate = async (currencyCode: string, currencyUnitsPerUsd: string, isActive = true) => {
    if (!canManage) {
      toast.error(copy.insufficientPermissions);
      return false;
    }
    try {
      const { cleanCode, cleanRate } = validateRate(currencyCode, currencyUnitsPerUsd);
      const dto = { currencyUnitsPerUsd: cleanRate, isActive };
      setIsSaving(true);
      setError(null);
      const result = await applicationsApi.upsertCurrencyRate(cleanCode, dto, getIdempotencyKey({ action: "currency:upsert", cleanCode, dto }));
      resetKey();
      setRates((current) => [...current.filter((rate) => rate.currencyCode !== result.currencyCode), result].sort((a, b) => a.currencyCode.localeCompare(b.currencyCode)));
      toast.success(copy.rateSavedTitle, result.currencyCode);
      setIsAddModalOpen(false);
      setEditingRate(null);
      return true;
    } catch (requestError) {
      showError(requestError, copy.saveFailed);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const batchUpsertRates = async (input: SetCurrencyRatesDto["rates"]) => {
    if (!canManage) throw new Error(copy.insufficientPermissions);
    const rates = input.map((rate) => {
      const { cleanCode, cleanRate } = validateRate(rate.currencyCode, rate.currencyUnitsPerUsd);
      return { currencyCode: cleanCode, currencyUnitsPerUsd: cleanRate, isActive: rate.isActive ?? true };
    });
    if (new Set(rates.map((rate) => rate.currencyCode)).size !== rates.length) throw new Error(copy.batchCodesUnique);
    setIsSaving(true);
    try {
      await applicationsApi.batchUpsertCurrencyRates({ rates }, getIdempotencyKey({ action: "currency:batch", rates }));
      resetKey();
      await fetchRates();
      toast.success(copy.batchSavedTitle, `${rates.length} rate(s)`);
      return true;
    } catch (requestError) {
      showError(requestError, copy.batchSaveFailed);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return { lang, rates, isLoading, isSaving, error, canRead, canManage, isAddModalOpen, setIsAddModalOpen, editingRate, setEditingRate, fetchRates, upsertRate, batchUpsertRates, toggleRateStatus: (rate: CurrencyRateView) => upsertRate(rate.currencyCode, rate.currencyUnitsPerUsd, !rate.isActive) };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useHasPermission } from "@/components/auth/RequirePermission";
import { ADMIN_RBAC_CRITICAL } from "@/lib/auth/rbac";
import { useToast } from "@/components/ui/ToastContext";
import { applicationsApi } from "@/features/admin/applications/api/applications.api";
import type { CurrencyRateView, SetCurrencyRatesDto } from "@/features/admin/applications/types";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError } from "@/shared/api/normalized-api-error";
import { useIdempotency } from "@/shared/hooks/useIdempotency";
import { CurrencyRateValidationError } from "./currency-rate-validation-error";

export type { CurrencyRateView } from "@/features/admin/applications/types";

const ratePattern = /^\d{1,12}(?:\.\d{1,12})?$/;

type RateConfirmation =
  | { kind: "status"; rate: CurrencyRateView }
  | { kind: "single"; rates: [CurrencyRateView]; changes: { before: CurrencyRateView | undefined; after: CurrencyRateView }[] }
  | { kind: "batch"; rates: CurrencyRateView[]; changes: { before: CurrencyRateView | undefined; after: CurrencyRateView }[] };

// Compare exact decimal strings without converting billing rates to numbers.
function comparableRate(value: string) {
  return value.replace(/^0+(?=\d)/, "").replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

export function useCurrencyRates() {
  const { lang, t } = useI18n();
  const copy = t.settings.currencyRates.validation;
  const toast = useToast();
  const { getIdempotencyKey, resetKey } = useIdempotency();
  const [rates, setRates] = useState<CurrencyRateView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const inFlight = useRef(false);
  const [confirmation, setConfirmation] = useState<RateConfirmation | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<CurrencyRateView | null>(null);
  const canRead = useHasPermission("admin.catalog.read");
  const canManageCurrency = useHasPermission(ADMIN_RBAC_CRITICAL.CURRENCY_MANAGE[0]);
  const canUseCritical = useHasPermission(ADMIN_RBAC_CRITICAL.CURRENCY_MANAGE[1]);
  const canManage = canManageCurrency && canUseCritical;

  const showError = useCallback((requestError: unknown, fallback: string) => {
    const normalized = normalizeApiError(requestError);
    const message = requestError instanceof CurrencyRateValidationError ? requestError.message
      : normalized.errorCode === "CURRENCY_RATE_CHANGE_TOO_LARGE" ? copy.rateChangeTooLarge : fallback;
    const detail = `${message}${normalized.correlationId ? ` · ${normalized.correlationId}` : ""}`;
    setError(detail);
    toast.error(copy.actionFailedTitle, detail);
  }, [copy.actionFailedTitle, copy.rateChangeTooLarge, toast]);

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
    if (!/^[A-Z]{3}$/.test(cleanCode)) throw new CurrencyRateValidationError(copy.currencyCodeInvalid);
    if (cleanCode === "USD") throw new CurrencyRateValidationError(copy.usdImmutable);
    if (!ratePattern.test(cleanRate) || !/[1-9]/.test(cleanRate)) throw new CurrencyRateValidationError(copy.rateFormatInvalid);
    return { cleanCode, cleanRate };
  };

  const upsertRate = async (currencyCode: string, currencyUnitsPerUsd: string, isActive = true) => {
    if (inFlight.current) return false;
    if (!canManage) {
      toast.error(copy.insufficientPermissions);
      return false;
    }
    try {
      const { cleanCode, cleanRate } = validateRate(currencyCode, currencyUnitsPerUsd);
      const after = { currencyCode: cleanCode, currencyUnitsPerUsd: cleanRate, isActive };
      setError(null);
      setConfirmation({ kind: "single", rates: [after], changes: [{ before: rates.find((rate) => rate.currencyCode === cleanCode), after }] });
      return true;
    } catch (requestError) {
      showError(requestError, copy.saveFailed);
      return false;
    }
  };

  // Only confirmRateChange invokes the writers, after explicit operator approval.
  const saveRate = async (currencyCode: string, currencyUnitsPerUsd: string, isActive: boolean) => {
    if (inFlight.current) return false;
    if (!canManage) {
      toast.error(copy.insufficientPermissions);
      return false;
    }
    inFlight.current = true;
    try {
      const { cleanCode, cleanRate } = validateRate(currencyCode, currencyUnitsPerUsd);
      const dto = { currencyUnitsPerUsd: cleanRate, isActive, confirmLargeChange: true };
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
      inFlight.current = false;
      setIsSaving(false);
    }
  };

  const batchUpsertRates = async (input: SetCurrencyRatesDto["rates"]) => {
    if (inFlight.current) return false;
    if (!canManage) throw new CurrencyRateValidationError(copy.insufficientPermissions);
    const rates = input.map((rate) => {
      const { cleanCode, cleanRate } = validateRate(rate.currencyCode, rate.currencyUnitsPerUsd);
      return { currencyCode: cleanCode, currencyUnitsPerUsd: cleanRate, isActive: rate.isActive ?? true, confirmLargeChange: true };
    });
    if (new Set(rates.map((rate) => rate.currencyCode)).size !== rates.length) throw new CurrencyRateValidationError(copy.batchCodesUnique);
    inFlight.current = true;
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
      inFlight.current = false;
      setIsSaving(false);
    }
  };

  const requestBatchConfirmation = (input: SetCurrencyRatesDto["rates"]) => {
    if (inFlight.current || !canManage) return;
    const nextRates = input.map((rate) => {
      const { cleanCode, cleanRate } = validateRate(rate.currencyCode, rate.currencyUnitsPerUsd);
      return { currencyCode: cleanCode, currencyUnitsPerUsd: cleanRate, isActive: rate.isActive ?? true };
    });
    if (!nextRates.length) throw new CurrencyRateValidationError(copy.atLeastOneRate);
    if (new Set(nextRates.map((rate) => rate.currencyCode)).size !== nextRates.length) throw new CurrencyRateValidationError(copy.batchCodesUnique);
    const changes = nextRates.map((after) => ({ before: rates.find((rate) => rate.currencyCode === after.currencyCode), after }))
      .filter(({ before, after }) => !before || comparableRate(before.currencyUnitsPerUsd) !== comparableRate(after.currencyUnitsPerUsd) || before.isActive !== after.isActive);
    setConfirmation({ kind: "batch", rates: nextRates, changes });
  };

  const closeConfirmation = () => {
    if (!inFlight.current) setConfirmation(null);
  };

  const confirmRateChange = async () => {
    if (!confirmation || inFlight.current) return false;
    const success = confirmation.kind === "batch"
      ? await batchUpsertRates(confirmation.rates)
      : confirmation.kind === "single"
        ? await saveRate(confirmation.rates[0].currencyCode, confirmation.rates[0].currencyUnitsPerUsd, confirmation.rates[0].isActive)
        : await saveRate(confirmation.rate.currencyCode, confirmation.rate.currencyUnitsPerUsd, !confirmation.rate.isActive);
    if (success) setConfirmation(null);
    return success;
  };

  const toggleRateStatus = (rate: CurrencyRateView) => {
    if (!inFlight.current && canManage) setConfirmation({ kind: "status", rate: { ...rate } });
  };

  return { lang, rates, isLoading, isSaving, error, canRead, canManage, isAddModalOpen, setIsAddModalOpen, editingRate, setEditingRate, fetchRates, upsertRate, toggleRateStatus, confirmation, requestBatchConfirmation, closeConfirmation, confirmRateChange };
}

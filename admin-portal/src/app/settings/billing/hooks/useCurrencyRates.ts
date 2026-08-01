"use client";

import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { SuccessResponse } from "@/types/common";
import { useHasPermission } from "@/components/auth/RequirePermission";
import { useToast } from "@/components/ui/ToastContext";

export interface CurrencyRateView {
  currencyCode: string;
  currencyUnitsPerUsd: string;
  isActive: boolean;
}

export function useCurrencyRates() {
  const { lang } = useI18n();
  const toast = useToast();

  const [rates, setRates] = useState<CurrencyRateView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<CurrencyRateView | null>(null);

  const canRead = useHasPermission("admin.catalog.read");
  const canManage = useHasPermission("admin.billing.currency.manage");

  const fetchRates = useCallback(async () => {
    if (!canRead) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await axiosClient.get<SuccessResponse<CurrencyRateView[]>>(
        "/api/admin/core/v1/billing/currency-rates"
      );
      const data = response.data?.data || [];
      setRates(Array.isArray(data) ? data : []);
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        (lang === "ar"
          ? "فشل في تحميل أسعار الصرف."
          : "Failed to load exchange rates.");
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [canRead, lang, toast]);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  const upsertRate = async (
    currencyCode: string,
    currencyUnitsPerUsd: string,
    isActive: boolean = true
  ) => {
    if (!canManage) {
      toast.error(
        lang === "ar"
          ? "ليس لديك صلاحية لتعديل أسعار الصرف."
          : "You do not have permission to manage currency rates."
      );
      return false;
    }

    const cleanCode = currencyCode.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(cleanCode)) {
      toast.error(
        lang === "ar"
          ? "رمز العملة يجب أن يتكون من 3 أحرف (مثل EUR, EGP)."
          : "Currency code must be exactly 3 letters (e.g. EUR, EGP)."
      );
      return false;
    }

    if (cleanCode === "USD") {
      toast.error(
        lang === "ar"
          ? "الدولار الأمريكي هو العملة الأساسية ولا يمكن تعديله."
          : "USD is the base currency and cannot be modified."
      );
      return false;
    }

    const rateNum = parseFloat(currencyUnitsPerUsd);
    if (isNaN(rateNum) || rateNum <= 0) {
      toast.error(
        lang === "ar"
          ? "سعر الصرف يجب أن يكون رقماً أكبر من صفر."
          : "Exchange rate must be a valid number greater than zero."
      );
      return false;
    }

    setIsSaving(true);
    try {
      await axiosClient.patch(
        `/api/admin/core/v1/billing/currency-rates/${cleanCode}`,
        {
          currencyUnitsPerUsd: currencyUnitsPerUsd.trim(),
          isActive,
        }
      );

      toast.success(
        lang === "ar"
          ? `تم تحديث سعر صرف ${cleanCode} بنجاح.`
          : `Currency rate for ${cleanCode} updated successfully.`
      );

      await fetchRates();
      setIsAddModalOpen(false);
      setEditingRate(null);
      return true;
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        (lang === "ar"
          ? "فشل حفظ سعر الصرف."
          : "Failed to save currency rate.");
      toast.error(msg);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const toggleRateStatus = async (rate: CurrencyRateView) => {
    await upsertRate(rate.currencyCode, rate.currencyUnitsPerUsd, !rate.isActive);
  };

  return {
    lang,
    rates,
    isLoading,
    isSaving,
    error,
    canRead,
    canManage,
    isAddModalOpen,
    setIsAddModalOpen,
    editingRate,
    setEditingRate,
    fetchRates,
    upsertRate,
    toggleRateStatus,
  };
}

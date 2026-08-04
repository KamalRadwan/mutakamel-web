"use client";
 
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useCallback, useMemo } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { useI18n } from "@/i18n/I18nContext";
import { useToast } from "@/components/ui/ToastContext";
import type { SuccessResponse } from "@/types/common";
import type { AdminUserProfile } from "@/app/users/types";

export function useMyProfile() {
  const { lang, setLang } = useI18n();
  const toast = useToast();

  const [profile, setProfile] = useState<AdminUserProfile | null>(null);
  const [themeKey, setThemeKey] = useState<string>("dark");
  const [language, setLanguage] = useState<string>("en");
  const [tableDensity, setTableDensity] = useState<string>("compact");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMyProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await axiosClient.get<SuccessResponse<AdminUserProfile>>(
        "/api/admin/core/v1/users/me/profile"
      );
      const data = res.data.data;
      setProfile(data);
      if (data.themeKey) setThemeKey(data.themeKey);
      if (data.language) setLanguage(data.language);
      if (data.extensions?.tableDensity) setTableDensity(data.extensions.tableDensity as string);
    } catch (err: any) {
      const message = err?.response?.data?.message || "Failed to load profile.";
      setError(message);
      toast.error(lang === "ar" ? "فشل تحميل الملف الشخصي" : "Profile Load Failed", message);
    } finally {
      setIsLoading(false);
    }
  }, [lang, toast]);

  useEffect(() => {
    queueMicrotask(() => loadMyProfile());
  }, [loadMyProfile]);

  const hasChanges = useMemo(() => {
    if (!profile) return false;
    return (
      themeKey !== (profile.themeKey || "dark") ||
      language !== (profile.language || "en") ||
      tableDensity !== (profile.extensions?.tableDensity || "compact")
    );
  }, [profile, themeKey, language, tableDensity]);

  const saveProfile = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setError(null);

    try {
      const payload = {
        themeKey,
        language,
        extensions: {
          ...profile?.extensions,
          tableDensity,
        },
      };

      const res = await axiosClient.patch<SuccessResponse<AdminUserProfile>>(
        "/api/admin/core/v1/users/me/profile",
        payload
      );

      const updated = res.data.data;
      setProfile(updated);

      if (language === "ar" || language === "en") {
        setLang(language);
      }

      toast.success(
        lang === "ar" ? "تم الحفظ" : "Preferences Saved",
        lang === "ar"
          ? "تم تحديث تفضيلات الحساب الشخصي بنجاح."
          : "Your profile preferences have been updated."
      );
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Failed to update profile.";
      setError(msg);
      toast.error(lang === "ar" ? "خطأ في الحفظ" : "Save Error", msg);
    } finally {
      setIsSaving(false);
    }
  };

  return {
    lang,
    profile,
    themeKey,
    setThemeKey,
    language,
    setLanguage,
    tableDensity,
    setTableDensity,
    isLoading,
    isSaving,
    error,
    hasChanges,
    saveProfile,
    reload: loadMyProfile,
  };
}

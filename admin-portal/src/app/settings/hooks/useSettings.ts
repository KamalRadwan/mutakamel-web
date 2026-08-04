"use client";

import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { SETTINGS_UI_REGISTRY, SettingUIMetadata } from "./useSettingsRegistry";
import { axiosClient } from "@/lib/api/axiosClient";
import { SuccessResponse } from "@/types/common";

import { useHasPermission } from "@/components/auth/RequirePermission";
import { useToast } from "@/components/ui/ToastContext";

export interface MergedSystemSetting {
  key: string;
  value: string | number | boolean;
  description: string;
  descriptionI18n: { en: string; ar: string };
  isDefault: boolean;
  readOnly: boolean;
}

export interface SettingFieldData extends MergedSystemSetting {
  uiMeta?: SettingUIMetadata;
  isSaving?: boolean;
  lastSaved?: Date | null;
  error?: string | null;
}

export function useSettings(prefix: string) {
  const { lang } = useI18n();
  const toast = useToast();
  const [settings, setSettings] = useState<SettingFieldData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pendingChanges, setPendingChanges] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);

  const hasUpdatePermission = useHasPermission("admin.settings.update");

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    setLoadError(undefined);
    try {
      const url = prefix ? `/api/admin/core/v1/system-settings?prefix=${encodeURIComponent(prefix)}` : `/api/admin/core/v1/system-settings`;
      const res = await axiosClient.get<SuccessResponse<MergedSystemSetting[]>>(url);

      const data = res.data.data;

      const merged = data.map((item) => {
        const registered = SETTINGS_UI_REGISTRY[item.key];
        const isBool = typeof item.value === "boolean";
        const isNum = typeof item.value === "number";
        const labelClean = item.key.split(".").pop()?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || item.key;

        const fallback: SettingUIMetadata = {
          key: item.key,
          titleEn: labelClean,
          titleAr: labelClean,
          inputType: isBool ? "boolean" : isNum ? "number" : "string",
          defaultValue: item.value,
          descEn: item.descriptionI18n?.en || item.description || `System configuration setting for ${item.key}`,
          descAr: item.descriptionI18n?.ar || item.description || `إعداد للنظام الخاص بـ ${item.key}`,
        };

        return {
          ...item,
          readOnly: item.readOnly || !hasUpdatePermission,
          uiMeta: registered || fallback,
          isSaving: false,
          lastSaved: null,
        };
      });

      setSettings(merged);
      setPendingChanges({});
    } catch (err) {
      setLoadError(settingErrorMessage(err));
      setSettings([]);
    } finally {
      setIsLoading(false);
    }
  }, [prefix, hasUpdatePermission]);

  useEffect(() => {
    void Promise.resolve().then(fetchSettings);
  }, [fetchSettings]);

  const updateSetting = (
    key: string,
    newValue: string | number | boolean,
  ) => {
    validateSettingValue(key, newValue, lang);

    setSettings((prev) =>
      prev.map((s) => (s.key === key ? { ...s, value: newValue, error: null } : s))
    );

    setPendingChanges((prev) => ({
      ...prev,
      [key]: newValue,
    }));
  };

  const saveAllSettings = async () => {
    const keys = Object.keys(pendingChanges);
    if (keys.length === 0) return;

    setIsSaving(true);
    let hasError = false;
    const failureMessages: string[] = [];

    setSettings((prev) =>
      prev.map((s) => (keys.includes(s.key) ? { ...s, isSaving: true, error: null } : s))
    );

    for (const key of keys) {
      try {
        const newValue = pendingChanges[key];
        const res = await axiosClient.put<SuccessResponse<MergedSystemSetting>>(
          `/api/admin/core/v1/system-settings/${encodeURIComponent(key)}`,
          { value: newValue }
        );

        setSettings((prev) =>
          prev.map((s) =>
            s.key === key ? { ...s, isSaving: false, lastSaved: new Date(), isDefault: false, value: res.data.data.value } : s
          )
        );

        setPendingChanges((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      } catch (err: unknown) {
        hasError = true;
        const errorMessage = settingErrorMessage(err);
        failureMessages.push(`${key}: ${errorMessage}`);
        setSettings((prev) =>
          prev.map((s) =>
            s.key === key ? { ...s, isSaving: false, error: errorMessage } : s
          )
        );
      }
    }

    setIsSaving(false);
    if (hasError) {
      const errorMsg = failureMessages.join("\n") || (lang === "ar" ? "فشل حفظ بعض الإعدادات." : "Failed to save some settings.");
      toast.error(
        lang === "ar" ? "فشل الحفظ" : "Save Error",
        errorMsg
      );
      throw new Error(errorMsg);
    } else {
      toast.success(
        lang === "ar" ? "تم الحفظ بنجاح" : "Settings Saved",
        lang === "ar" ? "تم تحديث إعدادات النظام بنجاح." : "System configuration updated successfully."
      );
    }
  };

  const hasUnsavedChanges = Object.keys(pendingChanges).length > 0;

  return {
    lang,
    settings,
    isLoading,
    isSaving,
    hasUnsavedChanges,
    loadError,
    updateSetting,
    saveAllSettings,
    refetch: fetchSettings,
  };
}

function validateSettingValue(
  key: string,
  value: string | number | boolean,
  lang: "ar" | "en",
) {
  const uiMeta = SETTINGS_UI_REGISTRY[key];
  if (uiMeta) {
    if (uiMeta.inputType === "number" && typeof value === "number") {
      if (uiMeta.min !== undefined && value < uiMeta.min) {
        throw new Error(lang === "ar" ? `يجب أن تكون القيمة على الأقل ${uiMeta.min}.` : `Value must be at least ${uiMeta.min}.`);
      }
      if (uiMeta.max !== undefined && value > uiMeta.max) {
        throw new Error(lang === "ar" ? `يجب أن تكون القيمة على الأكثر ${uiMeta.max}.` : `Value must be at most ${uiMeta.max}.`);
      }
    }
    if (uiMeta.inputType === "enum" && uiMeta.options) {
      if (!uiMeta.options.some((opt) => opt.value === String(value))) {
        throw new Error(lang === "ar" ? "قيمة غير صالحة." : "Invalid option selected.");
      }
    }
  }

  const invalidJsonArray =
    lang === "ar"
      ? "يجب إدخال مصفوفة JSON صحيحة من إعدادات RTCIceServer."
      : "Enter a valid JSON array of RTCIceServer objects.";
  const invalidJsonObject =
    lang === "ar"
      ? "يجب إدخال كائن JSON صحيح."
      : "Enter a valid JSON object.";

  if (
    key === "asterisk.turn_servers_json" ||
    key === "asterisk.ice_servers_json"
  ) {
    if (typeof value !== "string" || value.length > 10_000) {
      throw new Error(invalidJsonArray);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new Error(invalidJsonArray);
    }

    if (
      !Array.isArray(parsed) ||
      !parsed.every(isValidIceServerObject)
    ) {
      throw new Error(invalidJsonArray);
    }
  }

  if (key === "asterisk.extra_json") {
    if (typeof value !== "string" || value.length > 10_000) {
      throw new Error(invalidJsonObject);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new Error(invalidJsonObject);
    }

    if (!isRecord(parsed)) {
      throw new Error(invalidJsonObject);
    }
  }

  if (
    key === "asterisk.websocket_url" &&
    (typeof value !== "string" ||
      (value !== "" && !/^wss?:\/\/\S+$/i.test(value)))
  ) {
    throw new Error(
      lang === "ar"
        ? "رابط WebSocket يجب أن يبدأ بـ ws:// أو wss:// بدون مسافات."
        : "WebSocket URL must start with ws:// or wss:// and contain no spaces.",
    );
  }
}

function isValidIceServerObject(value: unknown) {
  if (!isRecord(value)) return false;
  const urls = value.urls;
  if (typeof urls === "string") return Boolean(urls.trim());
  return (
    Array.isArray(urls) &&
    urls.length > 0 &&
    urls.every((url) => typeof url === "string" && Boolean(url.trim()))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function settingErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error
  ) {
    const response = (
      error as {
        response?: {
          data?: {
            message?: string;
            title?: string;
            detail?: string;
            correlationId?: string;
          };
        };
      }
    ).response;
    const data = response?.data;
    const message = data?.message ?? data?.title ?? data?.detail;
    if (message) {
      return data?.correlationId
        ? `${message} (${data.correlationId})`
        : message;
    }
  }

  return error instanceof Error && error.message
    ? error.message
    : "Failed to load system settings.";
}

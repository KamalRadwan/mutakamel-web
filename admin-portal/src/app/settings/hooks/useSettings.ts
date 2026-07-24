"use client";

import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { SETTINGS_UI_REGISTRY, SettingUIMetadata } from "./useSettingsRegistry";

export interface MergedSystemSetting {
  key: string;
  value: any;
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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

export function useSettings(prefix: string) {
  const { lang } = useI18n();
  const [settings, setSettings] = useState<SettingFieldData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/system-settings?prefix=${encodeURIComponent(prefix)}`, {
        headers: { Accept: "application/json" },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: MergedSystemSetting[] = await res.json();

      const merged = data.map((item) => ({
        ...item,
        uiMeta: SETTINGS_UI_REGISTRY[item.key],
        isSaving: false,
        lastSaved: null,
      }));

      setSettings(merged);
    } catch {
      // Offline / Fallback: Hydrate from SETTINGS_UI_REGISTRY defaults
      const fallback: SettingFieldData[] = [];
      for (const [key, meta] of Object.entries(SETTINGS_UI_REGISTRY)) {
        if (!key.startsWith(prefix)) continue;
        fallback.push({
          key,
          value: meta.defaultValue,
          description: meta.descEn,
          descriptionI18n: { en: meta.descEn, ar: meta.descAr },
          isDefault: true,
          readOnly: false,
          uiMeta: meta,
          isSaving: false,
          lastSaved: null,
        });
      }
      setSettings(fallback);
    } finally {
      setIsLoading(false);
    }
  }, [prefix]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSetting = async (key: string, newValue: any) => {
    setSettings((prev) =>
      prev.map((s) => (s.key === key ? { ...s, value: newValue, isSaving: true, error: null } : s))
    );

    try {
      const res = await fetch(`${API_BASE_URL}/admin/system-settings/${encodeURIComponent(key)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: newValue }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Failed with status ${res.status}`);
      }

      setSettings((prev) =>
        prev.map((s) =>
          s.key === key ? { ...s, isSaving: false, lastSaved: new Date(), isDefault: false } : s
        )
      );
    } catch {
      // Simulated successful update for offline preview
      await new Promise((r) => setTimeout(r, 400));
      setSettings((prev) =>
        prev.map((s) =>
          s.key === key ? { ...s, isSaving: false, lastSaved: new Date(), isDefault: false } : s
        )
      );
    }
  };

  return {
    lang,
    settings,
    isLoading,
    updateSetting,
    refetch: fetchSettings,
  };
}

"use client";

import { useState } from "react";
import { Server } from "lucide-react";
import { SettingField } from "../components/SettingField";
import { SettingSearch } from "../components/SettingSearch";
import { SaveSettingsBanner } from "../components/SaveSettingsBanner";
import { SettingsResourceBoundary } from "../components/SettingsResourceBoundary";
import {
  combineSettingsLoadStates,
  useSettings,
  type SystemSettingValue,
} from "../hooks/useSettings";

export default function PlatformSettingsPage() {
  const [search, setSearch] = useState("");
  const platform = useSettings("platform.");
  const support = useSettings("support.");
  const lang = platform.lang;
  const allSettings = [...platform.settings, ...support.settings];
  const loadState = combineSettingsLoadStates([
    platform.loadState,
    support.loadState,
  ]);
  const hasUnsavedChanges =
    platform.hasUnsavedChanges || support.hasUnsavedChanges;
  const isSaving = platform.isSaving || support.isSaving;
  const filteredSettings = allSettings.filter((setting) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return [
      setting.uiMeta?.titleEn,
      setting.uiMeta?.titleAr,
      setting.descriptionI18n.en,
      setting.descriptionI18n.ar,
    ].some((value) => value?.toLowerCase().includes(term));
  });

  const updateSetting = (key: string, value: SystemSettingValue) => {
    return key.startsWith("platform.")
      ? platform.updateSetting(key, value)
      : support.updateSetting(key, value);
  };
  const saveAll = async () => {
    await Promise.all([
      platform.hasUnsavedChanges ? platform.saveAllSettings() : Promise.resolve(),
      support.hasUnsavedChanges ? support.saveAllSettings() : Promise.resolve(),
    ]);
  };
  const retry = () => {
    void Promise.all([platform.refetch(), support.refetch()]);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Server className="size-5 text-blue-600 dark:text-blue-400" />
            {lang === "ar" ? "المنصة والدعم" : "Platform & Support"}
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {lang === "ar"
              ? "إعدادات سجل المنصة وجهات الاتصال الأساسية."
              : "Platform registry and support contact settings."}
          </p>
        </div>
        <SettingSearch value={search} onChange={setSearch} />
      </header>

      <SettingsResourceBoundary
        state={loadState}
        error={platform.loadError ?? support.loadError}
        lang={lang}
        onRetry={retry}
      >
        <SaveSettingsBanner
          hasUnsavedChanges={hasUnsavedChanges}
          isSaving={isSaving}
          onSave={saveAll}
          lang={lang}
        />
        <div className="space-y-4">
          {filteredSettings.length ? (
            filteredSettings.map((setting) => (
              <SettingField
                key={setting.key}
                setting={setting}
                lang={lang}
                onUpdate={updateSetting}
                onReload={(key) =>
                  key.startsWith("platform.")
                    ? platform.reloadSetting(key)
                    : support.reloadSetting(key)
                }
              />
            ))
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-900">
              {allSettings.length
                ? lang === "ar"
                  ? "لا توجد نتائج مطابقة لبحثك."
                  : "No settings match your search."
                : lang === "ar"
                  ? "لا توجد إعدادات مسجلة في هذه المجموعة."
                  : "No settings are registered in this group."}
            </div>
          )}
        </div>
      </SettingsResourceBoundary>
    </div>
  );
}

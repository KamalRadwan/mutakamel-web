"use client";

import { ShieldCheck } from "lucide-react";
import { SettingField } from "../components/SettingField";
import { SaveSettingsBanner } from "../components/SaveSettingsBanner";
import { SettingsResourceBoundary } from "../components/SettingsResourceBoundary";
import { useSettings } from "../hooks/useSettings";
import { AuthInvalidationReplayPanel } from "./components/AuthInvalidationReplayPanel";
import { AuthSessionsPanel } from "./components/AuthSessionsPanel";

export default function AuthSettingsPage() {
  const settingsState = useSettings("auth.");
  const { lang } = settingsState;
  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <ShieldCheck className="size-5 text-blue-600 dark:text-blue-400" />
          {lang === "ar" ? "المصادقة والأمان" : "Authentication"}
        </h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {lang === "ar"
            ? "إعدادات السجل وجلسات الحساب واسترداد أحداث الإبطال مستقلة الصلاحيات."
            : "Registry settings, account sessions, and invalidation recovery are independently authorized."}
        </p>
      </header>

      <SettingsResourceBoundary
        state={settingsState.loadState}
        error={settingsState.loadError}
        lang={lang}
        onRetry={() => void settingsState.refetch()}
      >
        <SaveSettingsBanner
          hasUnsavedChanges={settingsState.hasUnsavedChanges}
          isSaving={settingsState.isSaving}
          onSave={settingsState.saveAllSettings}
          lang={lang}
        />
        <div className="space-y-4">
          {settingsState.settings.length ? (
            settingsState.settings.map((setting) => (
              <SettingField
                key={setting.key}
                setting={setting}
                lang={lang}
                onUpdate={settingsState.updateSetting}
                onReload={settingsState.reloadSetting}
              />
            ))
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-900">
              {lang === "ar"
                ? "لا توجد إعدادات مصادقة مسجلة."
                : "No authentication registry settings are configured."}
            </div>
          )}
        </div>
      </SettingsResourceBoundary>

      <AuthSessionsPanel />
      <AuthInvalidationReplayPanel />
    </div>
  );
}

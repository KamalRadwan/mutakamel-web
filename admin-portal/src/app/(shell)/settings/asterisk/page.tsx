"use client";

import { PageHeader } from "@/design-system";
import { SettingField } from "../components/SettingField";
import { SaveSettingsBanner } from "../components/SaveSettingsBanner";
import { SettingsResourceBoundary } from "../components/SettingsResourceBoundary";
import { useSettings } from "../hooks/useSettings";

export default function AsteriskSettingsPage() {
  const settingsState = useSettings("asterisk.");
  const { lang } = settingsState;
  return (
    <div className="space-y-6">
      <PageHeader title={lang === "ar" ? "بوابة WebRTC (Asterisk)" : "WebRTC (Asterisk)"} />
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
                ? "لا توجد إعدادات Asterisk مسجلة."
                : "No Asterisk settings are registered."}
            </div>
          )}
        </div>
      </SettingsResourceBoundary>
    </div>
  );
}

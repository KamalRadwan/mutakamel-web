"use client";

import { PageHeader } from "@/design-system";
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
      <PageHeader title={lang === "ar" ? "المصادقة والأمان" : "Authentication"} />

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
            <div className="rounded-lg border border-border bg-card p-8 text-center text-xs text-muted-foreground">
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

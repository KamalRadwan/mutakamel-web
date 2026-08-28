"use client";

import { PageHeader } from "@/design-system";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { SettingField } from "../components/SettingField";
import { SaveSettingsBanner } from "../components/SaveSettingsBanner";
import { SettingsResourceBoundary } from "../components/SettingsResourceBoundary";
import { useSettings } from "../hooks/useSettings";

export default function AsteriskSettingsPage() {
  const settingsState = useSettings("asterisk.");
  const { lang } = settingsState;
  const copy = (lang === "ar" ? ar : en).settings.pages.asterisk;
  return (
    <div className="space-y-6">
      <PageHeader title={copy.title} />
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
                onRetryExact={settingsState.saveAllSettings}
              />
            ))
          ) : (
            <div className="rounded-lg border border-border bg-card p-8 text-center text-xs text-muted-foreground">
              {copy.empty}
            </div>
          )}
        </div>
      </SettingsResourceBoundary>
    </div>
  );
}

"use client";

import { PageHeader } from "@/design-system";
import { SettingField } from "../components/SettingField";
import { SaveSettingsBanner } from "../components/SaveSettingsBanner";
import { SettingsResourceBoundary } from "../components/SettingsResourceBoundary";
import { useSettings } from "../hooks/useSettings";

export default function NotificationsSettingsPage() {
  const settingsState = useSettings("notifications.");
  const { lang } = settingsState;
  return (
    <div className="space-y-6">
      <PageHeader title={lang === "ar" ? "قنوات الإشعارات" : "Notifications"} />
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
            <EmptyNotifications lang={lang} />
          )}
        </div>
      </SettingsResourceBoundary>
    </div>
  );
}

function EmptyNotifications({ lang }: { lang: "ar" | "en" }) {
  return (
    <div className="rounded-lg border border-border bg-card p-8 text-center text-xs text-muted-foreground">
      {lang === "ar"
        ? "لا توجد مفاتيح إشعارات مسجلة."
        : "No notification settings are registered."}
    </div>
  );
}

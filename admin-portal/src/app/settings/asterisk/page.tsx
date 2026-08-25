"use client";

import { Phone } from "lucide-react";
import { SettingField } from "../components/SettingField";
import { SaveSettingsBanner } from "../components/SaveSettingsBanner";
import { SettingsResourceBoundary } from "../components/SettingsResourceBoundary";
import { useSettings } from "../hooks/useSettings";

export default function AsteriskSettingsPage() {
  const settingsState = useSettings("asterisk.");
  const { lang } = settingsState;
  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Phone className="size-5 text-blue-600 dark:text-blue-400" />
          {lang === "ar" ? "بوابة WebRTC (Asterisk)" : "WebRTC (Asterisk)"}
        </h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {lang === "ar"
            ? "إعدادات WebSocket وSTUN/TURN وسلوك SIP."
            : "WebSocket, STUN/TURN, and SIP behavior settings."}
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
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-900">
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

"use client";

import { useState } from "react";
import { PageHeader } from "@/design-system";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
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
  const copy = (lang === "ar" ? ar : en).settings.pages.platform;
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
      <PageHeader
        title={copy.title}
        action={<SettingSearch value={search} onChange={setSearch} />}
      />

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
            <div className="rounded-lg border border-border bg-card p-8 text-center text-xs text-muted-foreground">
              {allSettings.length ? copy.emptyFiltered : copy.emptyGroup}
            </div>
          )}
        </div>
      </SettingsResourceBoundary>
    </div>
  );
}

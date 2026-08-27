"use client";

import { PageHeader } from "@/design-system";
import { SettingField } from "../components/SettingField";
import { SaveSettingsBanner } from "../components/SaveSettingsBanner";
import { SettingsResourceBoundary } from "../components/SettingsResourceBoundary";
import {
  combineSettingsLoadStates,
  useSettings,
  type SystemSettingValue,
} from "../hooks/useSettings";
import { CurrencyRatesSection } from "./components/CurrencyRatesSection";

export default function BillingSettingsPage() {
  const billing = useSettings("billing.");
  const tenants = useSettings("tenants.");
  const lang = billing.lang;
  const settings = [...billing.settings, ...tenants.settings];
  const loadState = combineSettingsLoadStates([
    billing.loadState,
    tenants.loadState,
  ]);
  const hasUnsavedChanges =
    billing.hasUnsavedChanges || tenants.hasUnsavedChanges;
  const isSaving = billing.isSaving || tenants.isSaving;

  const updateSetting = (key: string, value: SystemSettingValue) => {
    return key.startsWith("billing.")
      ? billing.updateSetting(key, value)
      : tenants.updateSetting(key, value);
  };
  const saveAll = async () => {
    await Promise.all([
      billing.hasUnsavedChanges ? billing.saveAllSettings() : Promise.resolve(),
      tenants.hasUnsavedChanges ? tenants.saveAllSettings() : Promise.resolve(),
    ]);
  };
  const retry = () => {
    void Promise.all([billing.refetch(), tenants.refetch()]);
  };

  return (
    <div className="space-y-6">
      <PageHeader title={lang === "ar" ? "الفوترة والاشتراكات" : "Billing & Trials"} />

      <SettingsResourceBoundary
        state={loadState}
        error={billing.loadError ?? tenants.loadError}
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
          {settings.length ? (
            settings.map((setting) => (
              <SettingField
                key={setting.key}
                setting={setting}
                lang={lang}
                onUpdate={updateSetting}
                onReload={(key) =>
                  key.startsWith("billing.")
                    ? billing.reloadSetting(key)
                    : tenants.reloadSetting(key)
                }
              />
            ))
          ) : (
            <EmptySettings lang={lang} />
          )}
        </div>
      </SettingsResourceBoundary>

      <CurrencyRatesSection />
    </div>
  );
}

function EmptySettings({ lang }: { lang: "ar" | "en" }) {
  return (
    <div className="rounded-lg border border-border bg-card p-8 text-center text-xs text-muted-foreground">
      {lang === "ar"
        ? "لا توجد إعدادات فوترة أو تجربة مسجلة."
        : "No billing or trial settings are registered."}
    </div>
  );
}

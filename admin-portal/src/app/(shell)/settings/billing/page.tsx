"use client";

import { CreditCard } from "lucide-react";
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
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <CreditCard className="size-5 text-blue-600 dark:text-blue-400" />
          {lang === "ar" ? "الفوترة والاشتراكات" : "Billing & Trials"}
        </h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {lang === "ar"
            ? "إعدادات الفواتير وحدود شحن المحفظة وأسعار الصرف مستقلة الصلاحيات."
            : "Invoice, wallet top-up, and independently authorized currency-rate controls."}
        </p>
      </header>

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
    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-900">
      {lang === "ar"
        ? "لا توجد إعدادات فوترة أو تجربة مسجلة."
        : "No billing or trial settings are registered."}
    </div>
  );
}

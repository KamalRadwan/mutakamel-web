"use client";

import { useSettings } from "../hooks/useSettings";
import { SettingField } from "../components/SettingField";
import { CreditCard, Loader2 } from "lucide-react";

import { SaveSettingsBanner } from "../components/SaveSettingsBanner";

import { CurrencyRatesSection } from "./components/CurrencyRatesSection";

export default function BillingSettingsPage() {
  const { 
    lang, 
    settings: billingSettings, 
    isLoading: isBillingLoading, 
    updateSetting: updateBillingSetting,
    hasUnsavedChanges: billingHasUnsaved,
    isSaving: billingIsSaving,
    saveAllSettings: saveBillingSettings
  } = useSettings("billing.");
  
  const { 
    settings: tenantsSettings, 
    isLoading: isTenantsLoading,
    updateSetting: updateTenantsSetting,
    hasUnsavedChanges: tenantsHasUnsaved,
    isSaving: tenantsIsSaving,
    saveAllSettings: saveTenantsSettings
  } = useSettings("tenants.");

  const allSettings = [...billingSettings, ...tenantsSettings];
  const isLoading = isBillingLoading || isTenantsLoading;
  const hasUnsavedChanges = billingHasUnsaved || tenantsHasUnsaved;
  const isSaving = billingIsSaving || tenantsIsSaving;

  const updateSetting = (key: string, newValue: string | number | boolean) => {
    if (key.startsWith("billing.")) {
      updateBillingSetting(key, newValue);
    } else {
      updateTenantsSetting(key, newValue);
    }
  };

  const handleSaveAll = async () => {
    const promises = [];
    if (billingHasUnsaved) promises.push(saveBillingSettings());
    if (tenantsHasUnsaved) promises.push(saveTenantsSettings());
    await Promise.all(promises);
  };

  const handleUpdate = async (key: string, newValue: string | number | boolean) => {
    if (key === "billing.min_topup_usd") {
      const maxSetting = allSettings.find(s => s.key === "billing.max_topup_usd");
      if (maxSetting && typeof maxSetting.value === "number" && typeof newValue === "number") {
        if (newValue > maxSetting.value) {
          throw new Error(lang === "ar" ? `الحد الأدنى لا يمكن أن يكون أكبر من الحد الأقصى (${maxSetting.value}).` : `Minimum cannot be greater than the maximum (${maxSetting.value}).`);
        }
      }
    }
    
    if (key === "billing.max_topup_usd") {
      const minSetting = allSettings.find(s => s.key === "billing.min_topup_usd");
      if (minSetting && typeof minSetting.value === "number" && typeof newValue === "number") {
        if (newValue < minSetting.value) {
          throw new Error(lang === "ar" ? `الحد الأقصى لا يمكن أن يكون أصغر من الحد الأدنى (${minSetting.value}).` : `Maximum cannot be less than the minimum (${minSetting.value}).`);
        }
      }
    }

    return updateSetting(key, newValue);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            {lang === "ar" ? "الفوترة والاشتراكات" : "Billing & Trials"}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {lang === "ar" ? "إعدادات الفواتير، العملة الافتراضية، وحدود شحن المحفظة المالية." : "Configure default currencies, invoice lead days, and wallet top-up limits."}
          </p>
        </div>
      </div>

      <SaveSettingsBanner 
        hasUnsavedChanges={hasUnsavedChanges} 
        isSaving={isSaving} 
        onSave={handleSaveAll} 
        lang={lang} 
      />

      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center p-12 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          allSettings.map((setting) => (
            <SettingField 
              key={setting.key} 
              setting={setting} 
              lang={lang} 
              onUpdate={handleUpdate} 
            />
          ))
        )}
      </div>

      <CurrencyRatesSection />
    </div>
  );
}

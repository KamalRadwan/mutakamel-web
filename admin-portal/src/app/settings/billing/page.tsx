"use client";

import { useSettings } from "../hooks/useSettings";
import { SettingField } from "../components/SettingField";
import { CreditCard, Loader2 } from "lucide-react";

export default function BillingSettingsPage() {
  const { lang, settings: billingSettings, isLoading: isBillingLoading, updateSetting } = useSettings("billing.");
  const { settings: tenantsSettings, isLoading: isTenantsLoading } = useSettings("tenants.");

  const allSettings = [...billingSettings, ...tenantsSettings];
  const isLoading = isBillingLoading || isTenantsLoading;

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
              onUpdate={updateSetting} 
            />
          ))
        )}
      </div>
    </div>
  );
}

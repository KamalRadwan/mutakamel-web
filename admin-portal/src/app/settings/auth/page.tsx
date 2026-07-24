"use client";

import { useSettings } from "../hooks/useSettings";
import { SettingField } from "../components/SettingField";
import { ShieldCheck, Loader2 } from "lucide-react";

export default function AuthSettingsPage() {
  const { lang, settings, isLoading, updateSetting } = useSettings("auth.");

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            {lang === "ar" ? "المصادقة والأمان" : "Authentication"}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {lang === "ar" ? "إعدادات الأمان الخاصة بمدة صلاحية روابط الدعوات واستعادة كلمة المرور." : "Security policies and token time-to-live settings."}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center p-12 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          settings.map((setting) => (
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

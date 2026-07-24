"use client";

import { useState } from "react";
import { useSettings } from "../hooks/useSettings";
import { SettingField } from "../components/SettingField";
import { SettingSearch } from "../components/SettingSearch";
import { Server, Loader2 } from "lucide-react";

export default function PlatformSettingsPage() {
  const [search, setSearch] = useState("");
  const { lang, settings: platformSettings, isLoading: isPlatformLoading, updateSetting } = useSettings("platform.");
  const { settings: supportSettings, isLoading: isSupportLoading } = useSettings("support.");

  const allSettings = [...platformSettings, ...supportSettings];
  const isLoading = isPlatformLoading || isSupportLoading;

  const filteredSettings = allSettings.filter((s) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const titleEn = s.uiMeta?.titleEn?.toLowerCase() || "";
    const titleAr = s.uiMeta?.titleAr?.toLowerCase() || "";
    const descEn = s.descriptionI18n?.en?.toLowerCase() || "";
    const descAr = s.descriptionI18n?.ar?.toLowerCase() || "";
    return titleEn.includes(term) || titleAr.includes(term) || descEn.includes(term) || descAr.includes(term);
  });

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            {lang === "ar" ? "المنصة والدعم" : "Platform & Support"}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {lang === "ar" ? "إعدادات صيانة النظام وجهات الاتصال الأساسية." : "Core platform maintenance mode and support contact details."}
          </p>
        </div>

        <SettingSearch value={search} onChange={setSearch} />
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center p-12 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : filteredSettings.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            {lang === "ar" ? "لا توجد نتائج مطابقة لبحثك." : "No settings match your search query."}
          </div>
        ) : (
          filteredSettings.map((setting) => (
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

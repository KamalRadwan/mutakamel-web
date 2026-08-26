"use client";

import { Search, X } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

interface SettingSearchProps {
  value: string;
  onChange: (val: string) => void;
}

export function SettingSearch({ value, onChange }: SettingSearchProps) {
  const { lang } = useI18n();

  return (
    <div className="relative w-full sm:w-72">
      <Search className="w-4 h-4 text-slate-400 absolute top-3 start-3 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={lang === "ar" ? "تصفية الإعدادات..." : "Search settings..."}
        className="w-full ps-9 pe-8 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 transition-colors shadow-2xs"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute top-2.5 end-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

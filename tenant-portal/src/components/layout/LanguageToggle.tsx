"use client";

import { useI18n } from "@/i18n/I18nContext";
import { Globe } from "lucide-react";

export function LanguageToggle() {
  const { lang, toggleLang } = useI18n();

  return (
    <button
      onClick={toggleLang}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
    >
      <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
      <span>{lang === "ar" ? "English" : "العربية"}</span>
    </button>
  );
}

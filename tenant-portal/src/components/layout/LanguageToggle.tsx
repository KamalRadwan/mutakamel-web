"use client";

import { useI18n } from "@/i18n/I18nContext";
import { Globe } from "lucide-react";

export function LanguageToggle() {
  const { lang, toggleLang } = useI18n();

  return (
    <button
      type="button"
      onClick={toggleLang}
      aria-label={lang === "ar" ? "Switch language to English" : "تغيير اللغة إلى العربية"}
      className="flex items-center rounded-lg bg-slate-100 p-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200 sm:gap-1.5 sm:px-3 sm:py-1.5 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
    >
      <Globe className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
      <span className="hidden sm:inline">{lang === "ar" ? "English" : "العربية"}</span>
    </button>
  );
}

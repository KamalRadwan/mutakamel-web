"use client";

import { Globe } from "lucide-react";
import { useLanguageToggle } from "./hooks/useLanguageToggle";

export function LanguageToggle() {
  const { toggleLanguage, title, buttonLabel } = useLanguageToggle();

  return (
    <button
      onClick={toggleLanguage}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
      title={title}
    >
      <Globe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
      <span>{buttonLabel}</span>
    </button>
  );
}

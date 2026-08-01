"use client";

import { Globe } from "lucide-react";
import { useLanguageToggle } from "./hooks/useLanguageToggle";

export function LanguageToggle() {
  const { toggleLanguage, title, buttonLabel } = useLanguageToggle();

  return (
    <button
      onClick={toggleLanguage}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-xl border border-slate-700/80 bg-slate-800/60 text-slate-200 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
      title={title}
    >
      <Globe className="w-3.5 h-3.5 text-blue-400" />
      <span>{buttonLabel}</span>
    </button>
  );
}

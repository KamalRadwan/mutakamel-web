"use client";

import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

export function UsersErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { lang } = useI18n();

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center shadow-2xs space-y-4 max-w-lg mx-auto my-8">
      <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-100 dark:border-amber-900/50">
        <AlertCircle className="w-6 h-6" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          {lang === "ar" ? "تعذر تحميل البيانات" : "Failed to load data"}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
          {message}
        </p>
      </div>
      <button
        onClick={onRetry}
        className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-600/20 transition-colors inline-flex items-center gap-2 cursor-pointer"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span>{lang === "ar" ? "إعادة المحاولة" : "Retry"}</span>
      </button>
    </div>
  );
}

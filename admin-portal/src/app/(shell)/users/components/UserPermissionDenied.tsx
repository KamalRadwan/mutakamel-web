"use client";

import React from "react";
import Link from "next/link";
import { ShieldAlert, ArrowLeft, ArrowRight } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

export function UserPermissionDenied() {
  const { lang, t } = useI18n();

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center shadow-2xs space-y-4 max-w-xl mx-auto my-12">
      <div className="w-16 h-16 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto border border-rose-100 dark:border-rose-900/50">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {t.users.permissionDeniedTitle}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
          {t.users.permissionDeniedDesc}
        </p>
      </div>
      <Link
        href="/users"
        className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-colors inline-flex items-center gap-2 cursor-pointer"
      >
        {lang === "ar" ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
        <span>{t.users.backToUsers}</span>
      </Link>
    </div>
  );
}

"use client";

import React from "react";
import { ShieldAlert } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

export function UsersPermissionDenied() {
  const { lang } = useI18n();

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center shadow-2xs space-y-4 max-w-xl mx-auto my-8">
      <div className="w-16 h-16 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto border border-rose-100 dark:border-rose-900/50">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {lang === "ar" ? "وصول غير مصرح به" : "Access Denied"}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
          {lang === "ar"
            ? "عفواً، لا تملك صلاحية (admin.users.read) المطلوبة لعرض حسابات أعضاء الفريق."
            : "You do not have the required permission (admin.users.read) to view the staff directory."}
        </p>
      </div>
    </div>
  );
}

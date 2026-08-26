"use client";

import React from "react";
import { Users } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

export function UsersEmptyState({ hasFilters }: { hasFilters: boolean }) {
  const { lang } = useI18n();

  return (
    <div className="py-12 text-center space-y-3">
      <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
        <Users className="w-6 h-6" />
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          {hasFilters
            ? lang === "ar"
              ? "لا تتوفر نتائج مطابقة للفلاتر المحددة."
              : "No staff members match the selected filters."
            : lang === "ar"
              ? "لا يوجد أعضاء مشرفين في النظام حالياً."
              : "No admin staff users found."}
        </p>
        <p className="text-xs text-slate-400">
          {hasFilters
            ? lang === "ar"
              ? "جرب تغيير فلاتر البحث أو إلغائها."
              : "Try adjusting or clearing your search filters."
            : lang === "ar"
              ? "استخدم زر (دعوة عضو جديد) لإضافة أول مشرف."
              : "Use the Invite Admin button to add your first staff member."}
        </p>
      </div>
    </div>
  );
}

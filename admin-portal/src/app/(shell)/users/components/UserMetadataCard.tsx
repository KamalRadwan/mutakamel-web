"use client";

import React from "react";
import { Clock, ShieldAlert, Calendar, Copy } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useToast } from "@/components/ui/ToastContext";
import type { AdminUser } from "../types";

export function UserMetadataCard({ user }: { user: AdminUser }) {
  const { lang, t } = useI18n();
  const toast = useToast();

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return t.users.neverLoggedIn;
    try {
      return new Date(dateStr).toLocaleString(lang === "ar" ? "ar-EG" : "en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return dateStr;
    }
  };

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(user.id);
      toast.success(
        lang === "ar" ? "تم النسخ" : "Copied",
        lang === "ar" ? "تم نسخ معرف المستخدم." : "The user ID was copied.",
      );
    } catch {
      toast.error(
        lang === "ar" ? "فشل النسخ" : "Copy Failed",
        lang === "ar" ? "تعذر نسخ معرف المستخدم." : "The user ID could not be copied.",
      );
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-500" />
          <span>{lang === "ar" ? "معلومات النظام والنشاط" : "System & Activity Metadata"}</span>
        </h2>
      </div>

      <div className="p-4 space-y-3.5 text-xs">
        <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/50">
          <span className="text-slate-500">{t.users.lastLogin}</span>
          <span className="font-mono text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            {formatDate(user.lastLoginAt)}
          </span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/50">
          <span className="text-slate-500">{t.users.createdAt}</span>
          <span className="font-mono text-slate-700 dark:text-slate-300">
            {formatDate(user.createdAt)}
          </span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/50">
          <span className="text-slate-500">{t.users.updatedAt}</span>
          <span className="font-mono text-slate-700 dark:text-slate-300">
            {formatDate(user.updatedAt)}
          </span>
        </div>

        {user.sessionVersion !== undefined && (
          <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/50">
            <span className="text-slate-500">{t.users.sessionVersion}</span>
            <span className="font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs">
              v{user.sessionVersion}
            </span>
          </div>
        )}

        {user.failedLoginAttempts !== undefined && user.failedLoginAttempts > 0 && (
          <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/50">
            <span className="text-slate-500">{t.users.failedLoginAttempts}</span>
            <span className="font-mono px-2 py-0.5 rounded bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 font-semibold text-xs flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" />
              {user.failedLoginAttempts}
            </span>
          </div>
        )}

        {user.lockedUntil && (
          <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/50">
            <span className="text-slate-500">{t.users.lockedUntil}</span>
            <span className="font-mono text-rose-600 dark:text-rose-400 font-semibold text-xs">
              {formatDate(user.lockedUntil)}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <span className="text-slate-500">ID</span>
          <div className="flex items-center gap-1">
            <span className="font-mono text-xs text-slate-400 truncate max-w-[140px]">
              {user.id}
            </span>
            <button
              onClick={copyId}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition-colors cursor-pointer"
              title="Copy ID"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

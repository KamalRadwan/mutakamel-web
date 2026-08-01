"use client";

import React from "react";
import { Clock, ShieldAlert, KeyRound, Calendar, Copy, Check } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useState } from "react";
import type { AdminUser } from "../types";

export function UserMetadataCard({ user }: { user: AdminUser }) {
  const { lang, t } = useI18n();
  const [copiedId, setCopiedId] = useState(false);

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

  const copyId = () => {
    navigator.clipboard.writeText(user.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
        <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
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
            <span className="font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[11px]">
              v{user.sessionVersion}
            </span>
          </div>
        )}

        {user.failedLoginAttempts !== undefined && user.failedLoginAttempts > 0 && (
          <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/50">
            <span className="text-slate-500">{t.users.failedLoginAttempts}</span>
            <span className="font-mono px-2 py-0.5 rounded bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 font-bold text-[11px] flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" />
              {user.failedLoginAttempts}
            </span>
          </div>
        )}

        {user.lockedUntil && (
          <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/50">
            <span className="text-slate-500">{t.users.lockedUntil}</span>
            <span className="font-mono text-rose-600 dark:text-rose-400 font-bold text-[11px]">
              {formatDate(user.lockedUntil)}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <span className="text-slate-500">ID</span>
          <div className="flex items-center gap-1">
            <span className="font-mono text-[10px] text-slate-400 truncate max-w-[140px]">
              {user.id}
            </span>
            <button
              onClick={copyId}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition-colors cursor-pointer"
              title="Copy ID"
            >
              {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

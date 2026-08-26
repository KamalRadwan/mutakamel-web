"use client";

import React from "react";
import { PhoneCall, Edit2, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import type { AdminWebphoneConfig } from "../types";

export function WebphoneSummaryCard({
  webphone,
  canEdit,
  onEditToggle,
}: {
  webphone?: AdminWebphoneConfig | null;
  canEdit: boolean;
  onEditToggle: () => void;
}) {
  const { lang, t } = useI18n();

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <PhoneCall className="w-4 h-4 text-blue-500" />
          <span>{t.users.webphoneSummary}</span>
        </h2>
        {canEdit && (
          <button
            onClick={onEditToggle}
            className="px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Edit2 className="w-3 h-3" />
            <span>{t.users.editWebphone}</span>
          </button>
        )}
      </div>

      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
        <div>
          <span className="block text-xs text-slate-500 mb-1">{t.users.status}</span>
          {webphone?.enabled ? (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400 px-2 py-0.5 rounded-md font-medium">
              <CheckCircle2 className="w-3 h-3" />
              {lang === "ar" ? "مفعل" : "Enabled"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 px-2 py-0.5 rounded-md font-medium">
              <XCircle className="w-3 h-3" />
              {lang === "ar" ? "معطل" : "Disabled"}
            </span>
          )}
        </div>

        <div>
          <span className="block text-xs text-slate-500 mb-1">{t.users.sipExtension}</span>
          <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
            {webphone?.extension || t.users.notConfigured}
          </span>
        </div>

        <div>
          <span className="block text-xs text-slate-500 mb-1">SIP Username</span>
          <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
            {webphone?.sipUsername || t.users.notConfigured}
          </span>
        </div>

        <div>
          <span className="block text-xs text-slate-500 mb-1">Display Name</span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {webphone?.displayName || t.users.notConfigured}
          </span>
        </div>

        <div>
          <span className="block text-xs text-slate-500 mb-1">Outbound Caller ID</span>
          <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
            {webphone?.outboundCallerId || t.users.notConfigured}
          </span>
        </div>

        <div>
          <span className="block text-xs text-slate-500 mb-1">SIP Transport</span>
          <span className="font-mono font-semibold uppercase text-slate-900 dark:text-slate-100">
            {webphone?.transport || "wss"}
          </span>
        </div>
      </div>

      <div className="p-3 bg-slate-50/80 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
          {webphone?.passwordConfigured ? t.users.passwordConfigured : t.users.noPasswordConfigured}
        </span>
      </div>
    </div>
  );
}

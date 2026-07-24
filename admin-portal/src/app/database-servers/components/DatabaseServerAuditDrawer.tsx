"use client";

import { History, FileText } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

interface DatabaseServerAuditDrawerProps {
  serverId: string | null;
  onClose: () => void;
}

export function DatabaseServerAuditDrawer({ serverId, onClose }: DatabaseServerAuditDrawerProps) {
  const { t } = useI18n();

  if (!serverId) return null;

  const mockAuditLogs = [
    {
      id: "log-1",
      action: "LIFECYCLE",
      user: "منى علي (Mona Ali)",
      timestamp: "2026-07-20 14:30:15",
      changes: [
        { field: "status", oldValue: "DRAINING", newValue: "ACTIVE" },
        { field: "isPlacementTarget", oldValue: "false", newValue: "true" },
      ],
    },
    {
      id: "log-2",
      action: "UPDATE",
      user: "أحمد صابر (Ahmed Saber)",
      timestamp: "2026-07-01 09:12:00",
      changes: [
        { field: "maxTenants", oldValue: "40", newValue: "50" },
      ],
    },
    {
      id: "log-3",
      action: "CREATE",
      user: "النظام الرئيسية (System Admin)",
      timestamp: "2026-06-15 10:00:00",
      changes: [
        { field: "host", oldValue: "N/A", newValue: "db-primary-eg-01.internal" },
        { field: "countryIsoCode", oldValue: "N/A", newValue: "EG" },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg h-full bg-white dark:bg-slate-900 border-s border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col justify-between overflow-y-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {t.dbServers.historyTitle}
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                ID: {serverId}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-semibold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Audit Log Timeline Items */}
        <div className="space-y-4 flex-1 overflow-y-auto pr-1">
          {mockAuditLogs.map((log) => (
            <div
              key={log.id}
              className="p-4 bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 text-xs"
            >
              <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-md bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-mono">
                    {log.action}
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 text-[11px]">{log.user}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">{log.timestamp}</span>
              </div>

              {/* Field Changes List */}
              <div className="space-y-2">
                {log.changes.map((ch, idx) => (
                  <div key={idx} className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800 space-y-1">
                    <div className="font-mono font-bold text-slate-700 dark:text-slate-300 text-[11px] flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                      <span>{ch.field}</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono pt-0.5" dir="ltr">
                      <span className="px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-medium line-through">
                        {ch.oldValue}
                      </span>
                      <span className="text-slate-400">➔</span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold">
                        {ch.newValue}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-3 text-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}

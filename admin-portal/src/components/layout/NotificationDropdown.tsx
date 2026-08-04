"use client";

import { Bell, CheckCheck, CheckCircle2, AlertCircle, Info, ArrowUpRight } from "lucide-react";
import { useNotificationDropdown } from "./hooks/useNotificationDropdown";

export function NotificationDropdown() {
  const {
    t,
    isOpen,
    unreadCount,
    notifications,
    toggleOpen,
    close,
    markAllRead
  } = useNotificationDropdown();

  return (
    <div className="relative">
      <button
        onClick={toggleOpen}
        className="relative p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        title={t.common.notifications}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 end-1.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={close}
          />
          <div className="absolute end-0 mt-2 z-50 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Header */}
            <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {t.common.notifications}
                </h4>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-full border border-blue-200 dark:border-blue-800">
                    {unreadCount} {t.common.newNotifications}
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>{t.common.markAllRead}</span>
                </button>
              )}
            </div>

            {/* Notification Items */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60 max-h-80 overflow-y-auto">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3 transition-colors cursor-pointer flex items-start gap-3 ${
                    n.read
                      ? "bg-transparent opacity-75"
                      : "bg-blue-50/40 dark:bg-slate-800/40 hover:bg-blue-50/80 dark:hover:bg-slate-800/80"
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {n.type === "success" && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    )}
                    {n.type === "warning" && (
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                    )}
                    {n.type === "info" && (
                      <Info className="w-4 h-4 text-blue-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {n.title}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                      {n.description}
                    </p>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {n.time}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-2.5 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 text-center">
              <button
                onClick={close}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>{t.common.viewAllNotifications}</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

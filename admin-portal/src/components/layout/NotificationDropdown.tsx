"use client";

import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  Bell,
  Check,
  CheckCheck,
  Info,
  Loader2,
} from "lucide-react";
import type { AdminNotification } from "@/features/admin/notifications/types";
import { useNotificationDropdown } from "./hooks/useNotificationDropdown";

const PANEL_ID = "admin-notification-dropdown";

export function NotificationDropdown() {
  const view = useNotificationDropdown();

  if (!view.canRead) return null;

  return (
    <div className="relative" dir={view.dir}>
      <button
        type="button"
        onClick={view.toggleOpen}
        className="relative cursor-pointer rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        title={view.copy.title}
        aria-label={view.copy.title}
        aria-haspopup="dialog"
        aria-expanded={view.isOpen}
        aria-controls={PANEL_ID}
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {view.unreadCount > 0 ? (
          <span className="absolute end-0 top-0 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-white dark:ring-slate-950">
            {view.unreadCount > 99 ? "99+" : view.unreadCount}
          </span>
        ) : null}
      </button>

      {view.isOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            onClick={view.close}
            aria-label={view.copy.close}
          />
          <section
            id={PANEL_ID}
            role="dialog"
            aria-modal="false"
            aria-labelledby={`${PANEL_ID}-title`}
            className="absolute end-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl sm:w-96 dark:border-slate-800 dark:bg-slate-900"
          >
            <header className="flex items-center justify-between gap-3 border-b border-slate-200 p-3.5 dark:border-slate-800">
              <div className="min-w-0">
                <h2
                  id={`${PANEL_ID}-title`}
                  className="truncate text-xs font-bold text-slate-900 dark:text-slate-100"
                >
                  {view.copy.title}
                </h2>
                {view.unreadCount > 0 ? (
                  <p className="mt-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                    {view.unreadCount} {view.copy.newNotifications}
                  </p>
                ) : null}
              </div>
              {view.unreadCount > 0 && view.canManage ? (
                <button
                  type="button"
                  onClick={() => void view.markAllRead()}
                  disabled={view.isPending}
                  className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline disabled:cursor-not-allowed disabled:opacity-60 dark:text-blue-400"
                >
                  {view.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>{view.copy.readAll}</span>
                </button>
              ) : null}
            </header>

            <div aria-live="polite">
              {view.loadError ? (
                <DropdownError
                  message={view.copy.dropdownError}
                  errorCodeLabel={view.copy.errorCode}
                  correlationLabel={view.copy.correlation}
                  error={view.loadError}
                />
              ) : null}
              {view.actionState === "FORBIDDEN" ? (
                <p className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                  {view.copy.managePermission}
                </p>
              ) : null}
              {view.actionError ? (
                <DropdownError
                  message={view.copy.actionError}
                  errorCodeLabel={view.copy.errorCode}
                  correlationLabel={view.copy.correlation}
                  error={view.actionError}
                />
              ) : null}
            </div>

            <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800/60">
              {view.loadState === "LOADING" || view.loadState === "IDLE" ? (
                <div className="flex items-center justify-center gap-2 p-8 text-xs text-slate-500 dark:text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>{view.copy.loading}</span>
                </div>
              ) : null}
              {view.loadState === "EMPTY" ? (
                <p className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  {view.copy.dropdownEmpty}
                </p>
              ) : null}
              {view.loadState === "READY"
                ? view.notifications.map((notification) => (
                    <NotificationPreview
                      key={notification.id}
                      notification={notification}
                      canManage={view.canManage}
                      isPending={view.isPending}
                      copy={view.copy}
                      onMarkRead={() => void view.markRead(notification.id)}
                      onAcknowledge={() => void view.acknowledge(notification.id)}
                    />
                  ))
                : null}
            </div>

            <footer className="border-t border-slate-200 bg-slate-50 p-2.5 text-center dark:border-slate-800 dark:bg-slate-900/50">
              <Link
                href="/notifications"
                onClick={view.close}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                <span>{view.copy.viewAll}</span>
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </footer>
          </section>
        </>
      ) : null}
    </div>
  );
}

function NotificationPreview({
  notification,
  canManage,
  isPending,
  copy,
  onMarkRead,
  onAcknowledge,
}: {
  notification: AdminNotification;
  canManage: boolean;
  isPending: boolean;
  copy: ReturnType<typeof useNotificationDropdown>["copy"];
  onMarkRead: () => void;
  onAcknowledge: () => void;
}) {
  const unread = !notification.readAt;
  const urgent = /(?:critical|high|urgent)/i.test(notification.priority);
  return (
    <article
      className={`flex items-start gap-3 p-3 transition-colors ${
        unread
          ? "bg-blue-50/40 dark:bg-slate-800/40"
          : "bg-transparent opacity-80"
      }`}
    >
      <div className="mt-0.5 shrink-0">
        {notification.acknowledgedAt ? (
          <Check className="h-4 w-4 text-emerald-500" aria-hidden="true" />
        ) : urgent ? (
          <AlertCircle className="h-4 w-4 text-amber-500" aria-hidden="true" />
        ) : (
          <Info className="h-4 w-4 text-blue-500" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
          {notification.title}
        </p>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          {notification.body}
        </p>
        <time
          dateTime={notification.createdAt}
          className="mt-1 block text-[10px] text-slate-400"
        >
          {formatNotificationTime(notification.createdAt)}
        </time>
        {canManage && (!notification.readAt || !notification.acknowledgedAt) ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {!notification.readAt ? (
              <button
                type="button"
                onClick={onMarkRead}
                disabled={isPending}
                className="cursor-pointer text-[10px] font-semibold text-blue-600 hover:underline disabled:cursor-not-allowed disabled:opacity-60 dark:text-blue-400"
              >
                {copy.markRead}
              </button>
            ) : null}
            {!notification.acknowledgedAt ? (
              <button
                type="button"
                onClick={onAcknowledge}
                disabled={isPending}
                className="cursor-pointer text-[10px] font-semibold text-emerald-600 hover:underline disabled:cursor-not-allowed disabled:opacity-60 dark:text-emerald-400"
              >
                {copy.acknowledge}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function DropdownError({
  message,
  errorCodeLabel,
  correlationLabel,
  error,
}: {
  message: string;
  errorCodeLabel: string;
  correlationLabel: string;
  error: { errorCode: string; correlationId?: string };
}) {
  return (
    <div className="border-b border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
      <p>{message}</p>
      <p className="mt-0.5 font-mono">
        {errorCodeLabel}: {error.errorCode}
      </p>
      {error.correlationId ? (
        <p className="mt-0.5 break-all font-mono">
          {correlationLabel}: {error.correlationId}
        </p>
      ) : null}
    </div>
  );
}

function formatNotificationTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

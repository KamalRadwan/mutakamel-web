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
        className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-ink-100 hover:text-foreground dark:hover:bg-ink-800"
        title={view.copy.title}
        aria-label={view.copy.title}
        aria-haspopup="dialog"
        aria-expanded={view.isOpen}
        aria-controls={PANEL_ID}
      >
        <Bell className="size-4" aria-hidden="true" />
        {view.unreadCount > 0 ? (
          <span className="absolute end-0 top-0 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-xs font-semibold leading-none text-ink-950 ring-2 ring-card">
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
            className="absolute end-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-xl sm:w-96"
          >
            <header className="flex items-center justify-between gap-3 border-b border-border p-3.5">
              <div className="min-w-0">
                <h2 id={`${PANEL_ID}-title`} className="truncate text-xs font-semibold text-foreground">
                  {view.copy.title}
                </h2>
                {view.unreadCount > 0 ? (
                  <p className="mt-0.5 text-xs font-medium text-brand-700 dark:text-brand-400">
                    {view.unreadCount} {view.copy.newNotifications}
                  </p>
                ) : null}
              </div>
              {view.unreadCount > 0 && view.canManage ? (
                <button
                  type="button"
                  onClick={() => void view.markAllRead()}
                  disabled={view.isPending}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline disabled:cursor-not-allowed disabled:opacity-60 dark:text-brand-400"
                >
                  {view.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <CheckCheck className="size-3.5" aria-hidden="true" />
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
                <p className="border-b border-warn-200 bg-warn-50 px-3 py-2 text-xs text-warn-800 dark:border-warn-800/60 dark:bg-warn-950/30 dark:text-warn-200">
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

            <div className="max-h-80 divide-y divide-border overflow-y-auto">
              {view.loadState === "LOADING" || view.loadState === "IDLE" ? (
                <div className="flex items-center justify-center gap-2 p-8 text-xs text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  <span>{view.copy.loading}</span>
                </div>
              ) : null}
              {view.loadState === "EMPTY" ? (
                <p className="p-8 text-center text-xs text-muted-foreground">{view.copy.dropdownEmpty}</p>
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

            <footer className="border-t border-border bg-muted p-2.5 text-center">
              <Link
                href="/notifications"
                onClick={view.close}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline dark:text-brand-400"
              >
                <span>{view.copy.viewAll}</span>
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
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
        unread ? "bg-brand-500/5 dark:bg-ink-800/40" : "bg-transparent opacity-80"
      }`}
    >
      <div className="mt-0.5 shrink-0">
        {notification.acknowledgedAt ? (
          <Check className="size-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
        ) : urgent ? (
          <AlertCircle className="size-4 text-warn-600 dark:text-warn-400" aria-hidden="true" />
        ) : (
          <Info className="size-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-foreground">{notification.title}</p>
        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{notification.body}</p>
        <time dateTime={notification.createdAt} className="mt-1 block text-xs text-muted-foreground">
          {formatNotificationTime(notification.createdAt)}
        </time>
        {canManage && (!notification.readAt || !notification.acknowledgedAt) ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {!notification.readAt ? (
              <button
                type="button"
                onClick={onMarkRead}
                disabled={isPending}
                className="text-xs font-semibold text-brand-700 hover:underline disabled:cursor-not-allowed disabled:opacity-60 dark:text-brand-400"
              >
                {copy.markRead}
              </button>
            ) : null}
            {!notification.acknowledgedAt ? (
              <button
                type="button"
                onClick={onAcknowledge}
                disabled={isPending}
                className="text-xs font-semibold text-brand-700 hover:underline disabled:cursor-not-allowed disabled:opacity-60 dark:text-brand-400"
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
    <div className="border-b border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-800 dark:border-danger-800/60 dark:bg-danger-950/30 dark:text-danger-200">
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

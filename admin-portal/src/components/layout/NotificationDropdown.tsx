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
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/design-system";
import type { AdminNotification } from "@/features/admin/notifications/types";
import { useNotificationDropdown } from "./hooks/useNotificationDropdown";

const PANEL_ID = "admin-notification-dropdown";

export function NotificationDropdown() {
  const view = useNotificationDropdown();

  if (!view.canRead) return null;

  return (
    <Popover open={view.isOpen} onOpenChange={view.setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          dir={view.dir}
          className="relative size-8 p-0 text-muted-foreground"
          aria-label={view.unreadCount > 0
            ? `${view.copy.title}: ${new Intl.NumberFormat(view.locale).format(view.unreadCount)} ${view.copy.newNotifications}`
            : view.copy.title}
        >
          <Bell className="size-4" aria-hidden="true" />
          {view.unreadCount > 0 ? (
            <span
              aria-hidden="true"
              className="absolute end-0 top-0 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-xs font-semibold leading-none text-primary-foreground ring-2 ring-card"
            >
              {view.unreadCount > 99
                ? `${new Intl.NumberFormat(view.locale).format(99)}+`
                : new Intl.NumberFormat(view.locale).format(view.unreadCount)}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        id={PANEL_ID}
        role="dialog"
        aria-modal="false"
        aria-labelledby={`${PANEL_ID}-title`}
        align="end"
        dir={view.dir}
        className="w-[min(24rem,calc(100vw-1rem))] overflow-hidden p-0"
      >
            <header className="flex items-center justify-between gap-3 border-b border-border p-3.5">
              <div className="min-w-0">
                <h2 id={`${PANEL_ID}-title`} className="truncate text-xs font-semibold text-foreground">
                  {view.copy.title}
                </h2>
                {view.unreadCount > 0 ? (
                  <p className="mt-0.5 text-xs font-medium text-primary">
                    {view.unreadCount} {view.copy.newNotifications}
                  </p>
                ) : null}
              </div>
              {view.unreadCount > 0 && view.canManage ? (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={() => void view.markAllRead()}
                  disabled={view.isPending}
                  className="h-auto shrink-0 px-1.5 py-1 text-xs"
                >
                  {view.isPending ? (
                    <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  ) : (
                    <CheckCheck className="size-3.5" aria-hidden="true" />
                  )}
                  <span>{view.copy.readAll}</span>
                </Button>
              ) : null}
            </header>

            <div aria-live="polite" aria-atomic="true">
              {view.loadError ? (
                <DropdownError
                  message={view.copy.dropdownError}
                  errorCodeLabel={view.copy.errorCode}
                  correlationLabel={view.copy.correlation}
                  error={view.loadError}
                />
              ) : null}
              {view.actionState === "FORBIDDEN" ? (
                <p className="border-b border-warning/30 bg-warning-subtle px-3 py-2 text-xs text-warning-subtle-foreground">
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
                <div className="flex items-center justify-center gap-2 p-8 text-xs text-muted-foreground" role="status">
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
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
                      locale={view.locale}
                      onMarkRead={() => void view.markRead(notification.id)}
                      onAcknowledge={() => void view.acknowledge(notification.id)}
                    />
                  ))
                : null}
            </div>

            <footer className="border-t border-border bg-muted p-2.5 text-center">
              <Button asChild variant="link" size="sm" className="h-auto px-2 py-1 text-xs">
                <Link href="/notifications" onClick={view.close}>
                  <span>{view.copy.viewAll}</span>
                  <ArrowUpRight className="size-3.5 rtl:-scale-x-100" aria-hidden="true" />
                </Link>
              </Button>
            </footer>
      </PopoverContent>
    </Popover>
  );
}

function NotificationPreview({
  notification,
  canManage,
  isPending,
  copy,
  locale,
  onMarkRead,
  onAcknowledge,
}: {
  notification: AdminNotification;
  canManage: boolean;
  isPending: boolean;
  copy: ReturnType<typeof useNotificationDropdown>["copy"];
  locale: string;
  onMarkRead: () => void;
  onAcknowledge: () => void;
}) {
  const unread = !notification.readAt;
  const urgent = /(?:critical|high|urgent)/i.test(notification.priority);
  return (
    <article
      className={`flex items-start gap-3 p-3 transition-colors motion-reduce:transition-none ${
        unread ? "bg-selected/50" : "bg-transparent opacity-80"
      }`}
    >
      <div className="mt-0.5 shrink-0">
        {notification.acknowledgedAt ? (
          <Check className="size-4 text-success" aria-hidden="true" />
        ) : urgent ? (
          <AlertCircle className="size-4 text-warning" aria-hidden="true" />
        ) : (
          <Info className="size-4 text-info" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-foreground">{notification.title}</p>
        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{notification.body}</p>
        <time dateTime={notification.createdAt} className="mt-1 block text-xs text-muted-foreground">
          {formatNotificationTime(notification.createdAt, locale)}
        </time>
        {canManage && (!notification.readAt || !notification.acknowledgedAt) ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {!notification.readAt ? (
              <Button
                type="button"
                variant="link"
                size="xs"
                onClick={onMarkRead}
                disabled={isPending}
                className="h-auto px-1 py-0.5 text-xs font-semibold"
              >
                {copy.markRead}
              </Button>
            ) : null}
            {!notification.acknowledgedAt ? (
              <Button
                type="button"
                variant="link"
                size="xs"
                onClick={onAcknowledge}
                disabled={isPending}
                className="h-auto px-1 py-0.5 text-xs font-semibold"
              >
                {copy.acknowledge}
              </Button>
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
    <div className="border-b border-destructive/30 bg-destructive-subtle px-3 py-2 text-xs text-destructive-subtle-foreground">
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

function formatNotificationTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

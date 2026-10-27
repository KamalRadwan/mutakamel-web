"use client";

import { useId, useMemo, useRef } from "react";
import { Bell, Clock, Columns3, FolderGit2, UserCheck } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantAuth } from "@/context/AuthContext";
import { can } from "@/lib/auth/permission-scope";
import { useLanguage } from "@/i18n/useLanguage";
import { INTL_LOCALE } from "@/lib/format/locale";
import { formatTemplate } from "@/lib/format/template";
import { auditNotificationText } from "@/lib/audit/notification-text";
import { useNotificationsDropdown } from "./hooks/useNotificationsDropdown";
import { Badge } from "../primitives/Badge";
import { Button } from "../primitives/Button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../primitives/Popover";
import { ScrollArea } from "../primitives/ScrollArea";
import { PermissionGate } from "../patterns/permission-gate/PermissionGate";
import { cn } from "../lib/cn";

function NotificationTypeIcon({ type }: { type: string }) {
  if (type.includes("lead")) return <FolderGit2 className="size-3.5 text-caution-600" aria-hidden="true" />;
  if (type.includes("pipeline") || type.includes("opportunity"))
    return <Columns3 className="size-3.5 text-brand-600" aria-hidden="true" />;
  if (type.includes("reminder")) return <Clock className="size-3.5 text-negative-600" aria-hidden="true" />;
  return <UserCheck className="size-3.5 text-brand-600" aria-hidden="true" />;
}

export function NotificationsDropdown() {
  const { user } = useTenantAuth();
  return can(user, "notifications.notification.read") ? <AuthorizedNotificationsDropdown /> : null;
}

function AuthorizedNotificationsDropdown() {
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { t } = useI18n();
  const lang = useLanguage();
  const { open, pending, failed, snapshot, handleOpenChange, retry, handleMarkAllRead, handleMarkRead } = useNotificationsDropdown();

  const formatter = useMemo(
    () => new Intl.DateTimeFormat(INTL_LOCALE[lang], { dateStyle: "medium", timeStyle: "short" }),
    [lang],
  );

  const countFormatter = useMemo(() => new Intl.NumberFormat(INTL_LOCALE[lang]), [lang]);

  const triggerLabel =
    snapshot.unreadCount > 0 ? `${t.common.notifications}, ${snapshot.unreadCount}` : t.common.notifications;

  // B13 (SKILL-AUDIT.md): the realtime count changes silently otherwise. A
  // whole phrase, not a bare number, announced politely and without moving
  // focus — accessibility.md#announcements. The trigger's aria-label alone
  // cannot do this: a screen reader only re-reads it when focus returns.
  const unreadAnnouncement =
    snapshot.unreadCount > 0
      ? formatTemplate(t.common.unreadNotifications, {
          count: countFormatter.format(snapshot.unreadCount),
        })
      : t.common.noUnreadNotifications;

  if (snapshot.generation === null) return null;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={triggerLabel}
          className="relative size-9 rounded-full border border-nav-chrome-line bg-white/8 px-0 text-nav-foreground not-disabled:hover:bg-white/15 not-disabled:hover:text-nav-foreground-strong"
        >
          <Bell className="size-4 shrink-0" aria-hidden="true" />
          {snapshot.unreadCount > 0 && (
            <span
              className="absolute end-1.5 top-1.5 size-2 rounded-full bg-activity-overdue ring-2 ring-navy-900"
              aria-hidden="true"
            />
          )}
        </Button>
      </PopoverTrigger>
      <span role="status" aria-live="polite" className="sr-only">
        {snapshot.loadState === "ready" ? unreadAnnouncement : ""}
      </span>
      <PopoverContent
        align="end"
        className="w-96 p-0"
        aria-labelledby={headingId}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          headingRef.current?.focus();
        }}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border p-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <h3 ref={headingRef} id={headingId} tabIndex={-1} className="truncate text-xs font-semibold text-foreground">{t.common.notifications}</h3>
            {snapshot.unreadCount > 0 && <Badge tone="negative">{snapshot.unreadCount}</Badge>}
          </div>
          {snapshot.unreadCount > 0 && snapshot.loadState !== "forbidden" && (
            <Button variant="link" size="sm" onClick={() => void handleMarkAllRead()} disabled={pending} className="text-xs">
              {t.common.markAllRead}
            </Button>
          )}
        </div>

        {failed && (
          <p role="alert" className="border-b border-negative-200 bg-negative-100 px-3 py-1.5 text-xs text-negative-800 dark:border-negative-800 dark:bg-negative-950 dark:text-negative-300">
            {t.errors.notificationUpdateFailed}
          </p>
        )}

        {snapshot.loadState === "error" && (
          <div className="border-b border-border p-3">
            <p role="alert" className="text-xs text-negative-700 dark:text-negative-300">
              {t.errors.notificationLoadFailed}
            </p>
            <Button variant="outline" size="sm" onClick={() => void retry()} className="mt-2">
              {t.common.retry}
            </Button>
          </div>
        )}

        {snapshot.items.length > 0 && (snapshot.loadState === "loading" || snapshot.loadState === "error") && (
          <p role="status" className="border-b border-border p-3 text-xs text-muted-foreground">
            {t.errors.notificationCacheStale}
            {snapshot.loadState === "loading" && <> {t.common.loading}</>}
          </p>
        )}

        <ScrollArea className="h-80" aria-busy={snapshot.loadState === "loading"}>
          {snapshot.loadState === "forbidden" ? (
            <PermissionGate require="notifications.notification.read" denied>{null}</PermissionGate>
          ) : snapshot.items.length === 0 && (snapshot.loadState === "loading" || snapshot.loadState === "idle") ? (
            <p role="status" className="p-8 text-center text-xs text-muted-foreground">{t.common.loading}</p>
          ) : snapshot.items.length === 0 && snapshot.loadState === "ready" ? (
            <p className="p-8 text-center text-xs text-muted-foreground">{t.common.noData}</p>
          ) : (
            snapshot.items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void handleMarkRead(item)}
                disabled={pending || item.readAt !== null}
                className={cn(
                  "flex w-full cursor-pointer items-start gap-2 border-b border-border px-3 py-2.5 text-start transition-colors last:border-b-0",
                  "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-default",
                  item.readAt === null && "bg-brand-50 dark:bg-brand-950/30",
                )}
              >
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-sm bg-muted">
                  <NotificationTypeIcon type={item.notificationType} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-1">
                    <span className="truncate text-xs font-medium text-foreground">{auditNotificationText(item, t.audit.recordMessages).title}</span>
                    <span className="shrink-0 font-mono text-2xs text-muted-foreground">
                      {formatter.format(new Date(item.createdAt))}
                    </span>
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{auditNotificationText(item, t.audit.recordMessages).body}</span>
                </span>
                {item.readAt === null && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />}
              </button>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

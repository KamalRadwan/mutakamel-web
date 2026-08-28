"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Bell, Clock, Columns3, FolderGit2, UserCheck } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useLanguage } from "@/i18n/useLanguage";
import {
  markAllTenantNotificationsRead,
  markTenantNotificationRead,
  resyncTenantNotifications,
  tenantNotificationRuntime,
  type TenantNotification,
} from "@/lib/notifications/tenant-notification-runtime";
import { Badge } from "../primitives/Badge";
import { Button } from "../primitives/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../primitives/DropdownMenu";
import { ScrollArea } from "../primitives/ScrollArea";
import { cn } from "../lib/cn";

function NotificationTypeIcon({ type }: { type: string }) {
  if (type.includes("lead")) return <FolderGit2 className="size-3.5 text-caution-600" aria-hidden="true" />;
  if (type.includes("pipeline") || type.includes("opportunity"))
    return <Columns3 className="size-3.5 text-brand-600" aria-hidden="true" />;
  if (type.includes("reminder")) return <Clock className="size-3.5 text-negative-600" aria-hidden="true" />;
  return <UserCheck className="size-3.5 text-brand-600" aria-hidden="true" />;
}

// Consumes the already-populated notification store (Tier 1,
// src/lib/notifications/) exactly as the component it replaces did —
// subscribe/getSnapshot for live state, resync only after a mutation. The
// initial resync-on-generation-change lives in TenantRealtimeProvider, not
// here.
export function NotificationsDropdown() {
  const { t } = useI18n();
  const lang = useLanguage();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const snapshot = useSyncExternalStore(
    tenantNotificationRuntime.subscribe,
    tenantNotificationRuntime.getSnapshot,
    tenantNotificationRuntime.getSnapshot,
  );

  const formatter = useMemo(
    () => new Intl.DateTimeFormat(lang === "ar" ? "ar-EG-u-nu-latn" : "en-US", { dateStyle: "medium", timeStyle: "short" }),
    [lang],
  );

  async function resyncCurrentGeneration() {
    const current = tenantNotificationRuntime.getSnapshot();
    if (current.generation === null) return;
    await resyncTenantNotifications(current.generation, current.lastRealtimeCursor);
  }

  async function handleMarkAllRead() {
    if (pending) return;
    setPending(true);
    setFailed(false);
    try {
      await markAllTenantNotificationsRead();
      await resyncCurrentGeneration();
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  async function handleMarkRead(item: TenantNotification) {
    if (item.readAt !== null || pending) return;
    setPending(true);
    setFailed(false);
    try {
      await markTenantNotificationRead(item.id);
      await resyncCurrentGeneration();
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  const triggerLabel =
    snapshot.unreadCount > 0 ? `${t.common.notifications}, ${snapshot.unreadCount}` : t.common.notifications;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={triggerLabel} className="relative">
          <Bell className={cn("size-4", snapshot.unreadCount > 0 && "animate-bell-ring text-negative-600 dark:text-negative-400")} aria-hidden="true" />
          {snapshot.unreadCount > 0 && (
            <span className="absolute end-1 top-1 size-1.5 rounded-full bg-negative-500" aria-hidden="true" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border p-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-xs font-semibold text-foreground">{t.common.notifications}</h3>
            {snapshot.unreadCount > 0 && <Badge tone="negative">{snapshot.unreadCount}</Badge>}
          </div>
          {snapshot.unreadCount > 0 && (
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

        <ScrollArea className="h-80">
          {snapshot.items.length === 0 ? (
            <p className="p-8 text-center text-xs text-muted-foreground">{t.common.noData}</p>
          ) : (
            snapshot.items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void handleMarkRead(item)}
                disabled={pending || item.readAt !== null}
                className={cn(
                  "flex w-full items-start gap-2 border-b border-border px-3 py-2.5 text-start transition-colors last:border-b-0",
                  "hover:bg-accent disabled:cursor-default",
                  item.readAt === null && "bg-brand-50 dark:bg-brand-950/30",
                )}
              >
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-sm bg-muted">
                  <NotificationTypeIcon type={item.notificationType} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-1">
                    <span className="truncate text-xs font-medium text-foreground">{item.title}</span>
                    <span className="shrink-0 font-mono text-2xs text-muted-foreground">
                      {formatter.format(new Date(item.createdAt))}
                    </span>
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{item.body}</span>
                </span>
                {item.readAt === null && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />}
              </button>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

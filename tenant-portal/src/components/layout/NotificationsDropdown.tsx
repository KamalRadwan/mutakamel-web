"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  Bell,
  Clock,
  FolderGit2,
  Kanban,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import {
  markAllTenantNotificationsRead,
  markTenantNotificationRead,
  resyncTenantNotifications,
  tenantNotificationRuntime,
  type TenantNotification,
} from "@/lib/notifications/tenant-notification-runtime";

export function NotificationsDropdown() {
  const { lang } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [mutationInFlight, setMutationInFlight] = useState(false);
  const [mutationFailed, setMutationFailed] = useState(false);
  const snapshot = useSyncExternalStore(
    tenantNotificationRuntime.subscribe,
    tenantNotificationRuntime.getSnapshot,
    tenantNotificationRuntime.getSnapshot,
  );
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const resyncCurrentGeneration = async () => {
    const current = tenantNotificationRuntime.getSnapshot();
    if (current.generation === null) return;
    await resyncTenantNotifications(
      current.generation,
      current.lastRealtimeCursor,
    );
  };

  const handleMarkAllRead = async () => {
    if (mutationInFlight) return;
    setMutationInFlight(true);
    setMutationFailed(false);
    try {
      await markAllTenantNotificationsRead();
      await resyncCurrentGeneration();
    } catch {
      setMutationFailed(true);
    } finally {
      setMutationInFlight(false);
    }
  };

  const handleMarkRead = async (item: TenantNotification) => {
    if (item.readAt !== null || mutationInFlight) return;
    setMutationInFlight(true);
    setMutationFailed(false);
    try {
      await markTenantNotificationRead(item.id);
      await resyncCurrentGeneration();
    } catch {
      setMutationFailed(true);
    } finally {
      setMutationInFlight(false);
    }
  };

  const timestampFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(lang === "ar" ? "ar" : "en", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [lang],
  );

  const triggerLabel =
    snapshot.unreadCount > 0
      ? lang === "ar"
        ? `الإشعارات، ${snapshot.unreadCount} غير مقروءة`
        : `Notifications, ${snapshot.unreadCount} unread`
      : lang === "ar"
        ? "الإشعارات"
        : "Notifications";

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        id="tenant-notifications-trigger"
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative cursor-pointer"
        title={lang === "ar" ? "الإشعارات" : "Notifications"}
        aria-label={triggerLabel}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls="tenant-notifications-popover"
      >
        <Bell
          className={`w-4 h-4 origin-top transition-transform ${
            snapshot.unreadCount > 0
              ? "animate-bell-ring text-rose-600 dark:text-rose-400"
              : ""
          }`}
          aria-hidden="true"
        />
        {snapshot.unreadCount > 0 && (
          <span className="absolute top-0.5 end-0.5 flex h-2 w-2" aria-hidden="true">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
          </span>
        )}
      </button>

      {isOpen && (
        <div
          id="tenant-notifications-popover"
          role="dialog"
          aria-modal="false"
          aria-labelledby="tenant-notifications-heading"
          className="fixed inset-x-2 top-[49px] z-50 max-h-[calc(100dvh-3.5rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in slide-in-from-top-2 sm:absolute sm:inset-x-auto sm:end-0 sm:top-full sm:mt-1.5 sm:w-96 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="flex min-w-0 items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-rose-500" aria-hidden="true" />
              <h3 id="tenant-notifications-heading" className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">
                {lang === "ar" ? "مركز الإشعارات" : "Notifications Center"}
              </h3>
              {snapshot.unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400">
                  {snapshot.unreadCount} {lang === "ar" ? "جديد" : "New"}
                </span>
              )}
            </div>
            {snapshot.unreadCount > 0 && (
              <button
                type="button"
                onClick={() => { void handleMarkAllRead(); }}
                disabled={mutationInFlight}
                className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer disabled:cursor-wait disabled:opacity-50"
              >
                {lang === "ar" ? "تحديد الكل كمقروء" : "Mark all read"}
              </button>
            )}
          </div>

          {mutationFailed ? (
            <p
              role="alert"
              className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
            >
              {lang === "ar"
                ? "تعذر تحديث حالة الإشعارات. حاول مرة أخرى."
                : "The notification state could not be updated. Try again."}
            </p>
          ) : null}

          <div className="max-h-[min(20rem,calc(100dvh-10rem))] divide-y divide-slate-100 overflow-y-auto custom-scrollbar dark:divide-slate-800">
            {snapshot.items.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => { void handleMarkRead(item); }}
                disabled={mutationInFlight || item.readAt !== null}
                className={`w-full text-start p-3 transition-colors flex items-start gap-3 disabled:cursor-default ${
                  item.readAt === null
                    ? "bg-rose-50/30 dark:bg-rose-950/20 hover:bg-rose-50/60 dark:hover:bg-rose-950/30"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0 mt-0.5">
                  <NotificationTypeIcon type={item.notificationType} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className={`text-xs font-bold truncate ${
                      item.readAt === null
                        ? "text-slate-900 dark:text-slate-100"
                        : "text-slate-600 dark:text-slate-400"
                    }`}>
                      {item.title}
                    </h4>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {timestampFormatter.format(new Date(item.createdAt))}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                    {item.body}
                  </p>
                </div>
                {item.readAt === null && (
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-500" aria-hidden="true" />
                )}
              </button>
            ))}
            {snapshot.items.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-400">
                {lang === "ar" ? "لا توجد إشعارات حالياً" : "No notifications available"}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationTypeIcon({ type }: { type: string }) {
  if (type.includes("lead")) {
    return <FolderGit2 className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />;
  }
  if (type.includes("pipeline") || type.includes("opportunity")) {
    return <Kanban className="h-3.5 w-3.5 text-purple-500" aria-hidden="true" />;
  }
  if (type.includes("reminder")) {
    return <Clock className="h-3.5 w-3.5 text-rose-500" aria-hidden="true" />;
  }
  return <UserCheck className="h-3.5 w-3.5 text-blue-500" aria-hidden="true" />;
}

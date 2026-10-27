"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import {
  markAllTenantNotificationsRead,
  markTenantNotificationRead,
  refreshTenantNotifications,
  tenantNotificationRuntime,
  type TenantNotification,
} from "@/lib/notifications/tenant-notification-runtime";

export function useNotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const mutationPending = useRef(false);
  const snapshot = useSyncExternalStore(
    tenantNotificationRuntime.subscribe,
    tenantNotificationRuntime.getSnapshot,
    tenantNotificationRuntime.getSnapshot,
  );

  async function retry() {
    const current = tenantNotificationRuntime.getSnapshot();
    if (current.generation === null) return;
    try {
      await refreshTenantNotifications(current.generation, current.lastRealtimeCursor);
    } catch {
      // The shared snapshot exposes the retryable REST failure to the bell.
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) void retry();
  }

  async function mutate(markRead: () => Promise<void>) {
    if (mutationPending.current) return;
    const generation = tenantNotificationRuntime.getSnapshot().generation;
    if (generation === null) return;
    mutationPending.current = true;
    setPending(true);
    setFailed(false);
    try {
      await markRead();
      if (tenantNotificationRuntime.getSnapshot().generation === generation) {
        const current = tenantNotificationRuntime.getSnapshot();
        await refreshTenantNotifications(generation, current.lastRealtimeCursor, tenantNotificationRuntime, true);
      }
    } catch {
      if (tenantNotificationRuntime.getSnapshot().generation === generation) setFailed(true);
    } finally {
      mutationPending.current = false;
      setPending(false);
    }
  }

  function handleMarkAllRead() {
    return mutate(markAllTenantNotificationsRead);
  }

  async function handleMarkRead(item: TenantNotification) {
    if (item.readAt !== null) return;
    await mutate(() => markTenantNotificationRead(item.id));
  }

  return { open, pending, failed, snapshot, handleOpenChange, retry, handleMarkAllRead, handleMarkRead };
}

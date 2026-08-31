"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  markAllTenantNotificationsRead,
  resyncTenantNotifications,
  tenantNotificationRuntime,
} from "@/lib/notifications/tenant-notification-runtime";
import { coreDelete, coreGet, corePost } from "../../core-api";
import {
  notificationAcknowledgePath,
  notificationPath,
  notificationReadPath,
  notificationsListPath,
  parseNotificationPage,
  parseUnreadCount,
  NOTIFICATIONS_UNREAD_COUNT_PATH,
  type InboxNotification,
} from "../notification-contract";

const PAGE_RESPONSE_LIMIT_BYTES = 1_048_576;

export function useNotificationInbox() {
  const { t, lang } = useI18n();
  const toast = useToast();

  const [items, setItems] = useState<InboxNotification[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const loadFirstPage = useCallback(
    async (signal?: AbortSignal, onlyUnread = unreadOnly): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await coreGet(notificationsListPath(null, onlyUnread), {
          signal,
          maxResponseBytes: PAGE_RESPONSE_LIMIT_BYTES,
        });
        const page = parseNotificationPage(result.data);
        setItems(page.items);
        // The cursor is opaque and is stored verbatim; it is only ever handed
        // straight back to the same endpoint.
        setCursor(page.hasNext ? page.nextCursor : null);
        setUnreadCount(page.unreadCount);
        setHasLoaded(true);
      } catch (loadError) {
        if (isAbortError(loadError)) return;
        setError(normalizeApiError(loadError));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [unreadOnly],
  );

  const loadMore = useCallback(async (): Promise<void> => {
    if (cursor === null || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const result = await coreGet(notificationsListPath(cursor, unreadOnly), {
        maxResponseBytes: PAGE_RESPONSE_LIMIT_BYTES,
      });
      const page = parseNotificationPage(result.data);
      setItems((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...page.items.filter((item) => !seen.has(item.id))];
      });
      setCursor(page.hasNext ? page.nextCursor : null);
      setUnreadCount(page.unreadCount);
    } catch (loadError) {
      toast.errorFromApi(t.coreNotifications.loadFailed, normalizeApiError(loadError));
    } finally {
      setIsLoadingMore(false);
    }
  }, [cursor, isLoadingMore, unreadOnly, toast, t]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void loadFirstPage(controller.signal);
    });
    return () => controller.abort();
  }, [loadFirstPage]);

  const refreshUnreadCount = useCallback(async (): Promise<void> => {
    try {
      const result = await coreGet(NOTIFICATIONS_UNREAD_COUNT_PATH, { maxResponseBytes: 10_000 });
      setUnreadCount(parseUnreadCount(result.data));
    } catch {
      // The badge is advisory; the next page load carries an authoritative count.
    }
  }, []);

  /**
   * Keeps the shell's dropdown in step after an inbox action.
   *
   * The runtime is resynced from its OWN last committed cursor — never from a
   * cursor this screen observed. Feeding a socket-side or page-side cursor into
   * the handshake silently skips notifications (docs/api/core-settings.md).
   */
  const resyncRuntime = useCallback(async (): Promise<void> => {
    const snapshot = tenantNotificationRuntime.getSnapshot();
    if (snapshot.generation === null) return;
    try {
      await resyncTenantNotifications(snapshot.generation, snapshot.lastRealtimeCursor);
    } catch {
      // The dropdown repairs itself on its next realtime event or resync.
    }
  }, []);

  const runAction = useCallback(
    async (id: string, action: () => Promise<void>, failureTitle: string): Promise<void> => {
      if (pendingId) return;
      setPendingId(id);
      try {
        await action();
        await Promise.all([loadFirstPage(), refreshUnreadCount(), resyncRuntime()]);
      } catch (actionError) {
        const normalized = normalizeApiError(actionError);
        if (normalized.status === 403) return;
        if (toast.outcomeFromApi(normalized)) return;
        toast.errorFromApi(failureTitle, normalized);
      } finally {
        setPendingId(null);
      }
    },
    [pendingId, loadFirstPage, refreshUnreadCount, resyncRuntime, toast],
  );

  const markRead = useCallback(
    (item: InboxNotification) =>
      runAction(
        item.id,
        async () => {
          await corePost(notificationReadPath(item.id), undefined, { maxResponseBytes: 10_000 });
        },
        t.coreNotifications.markReadFailed,
      ),
    [runAction, t],
  );

  const acknowledge = useCallback(
    (item: InboxNotification) =>
      runAction(
        item.id,
        async () => {
          await corePost(notificationAcknowledgePath(item.id), undefined, {
            maxResponseBytes: 10_000,
          });
        },
        t.coreNotifications.acknowledgeFailed,
      ),
    [runAction, t],
  );

  const dismiss = useCallback(
    (item: InboxNotification) =>
      runAction(
        item.id,
        async () => {
          await coreDelete(notificationPath(item.id), { maxResponseBytes: 10_000 });
        },
        t.coreNotifications.dismissFailed,
      ),
    [runAction, t],
  );

  const markAllRead = useCallback(async (): Promise<void> => {
    if (isMarkingAll) return;
    setIsMarkingAll(true);
    try {
      await markAllTenantNotificationsRead();
      await Promise.all([loadFirstPage(), refreshUnreadCount(), resyncRuntime()]);
      toast.success(t.coreNotifications.markAllReadTitle, t.coreNotifications.markAllReadMessage);
    } catch (actionError) {
      const normalized = normalizeApiError(actionError);
      if (normalized.status !== 403 && !toast.outcomeFromApi(normalized)) {
        toast.errorFromApi(t.coreNotifications.markAllReadFailed, normalized);
      }
    } finally {
      setIsMarkingAll(false);
    }
  }, [isMarkingAll, loadFirstPage, refreshUnreadCount, resyncRuntime, toast, t]);

  return {
    t,
    lang,
    items,
    unreadCount,
    unreadOnly,
    hasMore: cursor !== null,
    isLoading: isLoading && !hasLoaded,
    isRefreshing: isLoading,
    isLoadingMore,
    isMarkingAll,
    pendingId,
    error,
    setUnreadOnly: (next: boolean) => {
      setUnreadOnly(next);
      setCursor(null);
    },
    loadMore,
    markRead,
    acknowledge,
    dismiss,
    markAllRead,
    reload: () => loadFirstPage(),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

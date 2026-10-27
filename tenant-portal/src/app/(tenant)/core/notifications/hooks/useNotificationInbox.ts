"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  markAllTenantNotificationsRead,
  revalidateTenantNotifications,
  tenantNotificationRuntime,
} from "@/lib/notifications/tenant-notification-runtime";
import { coreDelete, coreGet, corePost } from "../../core-api";
import {
  notificationAcknowledgePath,
  notificationPath,
  notificationReadPath,
  notificationsListPath,
  parseNotificationPage,
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
  const query = useRef({
    generation: 0, unreadOnly: false, cursor: null as string | null,
    controller: null as AbortController | null, pageCount: 1,
  });

  const invalidatePages = useCallback(() => {
    query.current.controller?.abort();
    query.current.controller = null;
    query.current.generation++;
    query.current.cursor = null;
  }, []);

  const loadFirstPage = useCallback(
    async (preserveHistory = false): Promise<void> => {
      const pageCount = preserveHistory ? query.current.pageCount : 1;
      invalidatePages();
      const { generation, unreadOnly: onlyUnread } = query.current;
      const controller = new AbortController();
      query.current.controller = controller;
      const isCurrent = () => query.current.generation === generation && !controller.signal.aborted;
      setIsLoading(true);
      setIsLoadingMore(false);
      setCursor(null);
      setError(null);
      try {
        const refreshed: InboxNotification[] = [];
        const seen = new Set<string>();
        let nextCursor: string | null = null;
        let count = 0;
        let loadedPages = 0;
        do {
          const result = await coreGet(notificationsListPath(nextCursor, onlyUnread), {
            signal: controller.signal,
            maxResponseBytes: PAGE_RESPONSE_LIMIT_BYTES,
          });
          if (!isCurrent()) return;
          const page = parseNotificationPage(result.data);
          for (const item of page.items) {
            if (!seen.has(item.id)) { seen.add(item.id); refreshed.push(item); }
          }
          if (loadedPages === 0) count = page.unreadCount;
          nextCursor = page.hasNext ? page.nextCursor : null;
          loadedPages++;
        } while (nextCursor !== null && loadedPages < pageCount);
        setItems(refreshed);
        // The cursor is opaque and is stored verbatim; it is only ever handed
        // straight back to the same endpoint.
        query.current.cursor = nextCursor;
        query.current.pageCount = loadedPages;
        setCursor(query.current.cursor);
        setUnreadCount(count);
        setHasLoaded(true);
      } catch (loadError) {
        if (!isCurrent() || isAbortError(loadError)) return;
        setError(normalizeApiError(loadError));
      } finally {
        if (isCurrent()) {
          query.current.controller = null;
          setIsLoading(false);
        }
      }
    },
    [invalidatePages],
  );

  const loadMore = useCallback(async (): Promise<void> => {
    const { generation, cursor: pageCursor, unreadOnly: onlyUnread } = query.current;
    if (pageCursor === null || query.current.controller) return;
    const controller = new AbortController();
    query.current.controller = controller;
    const isCurrent = () => query.current.generation === generation &&
      query.current.cursor === pageCursor && !controller.signal.aborted;
    setIsLoadingMore(true);
    try {
      const result = await coreGet(notificationsListPath(pageCursor, onlyUnread), {
        signal: controller.signal,
        maxResponseBytes: PAGE_RESPONSE_LIMIT_BYTES,
      });
      if (!isCurrent()) return;
      const page = parseNotificationPage(result.data);
      query.current.pageCount++;
      setItems((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...page.items.filter((item) => !seen.has(item.id))];
      });
      query.current.cursor = page.hasNext ? page.nextCursor : null;
      setCursor(query.current.cursor);
      setUnreadCount(page.unreadCount);
    } catch (loadError) {
      if (!isCurrent() || isAbortError(loadError)) return;
      toast.errorFromApi(t.coreNotifications.loadFailed, normalizeApiError(loadError));
    } finally {
      if (query.current.controller === controller && !controller.signal.aborted) {
        query.current.controller = null;
        setIsLoadingMore(false);
      }
    }
  }, [toast, t]);

  useEffect(() => {
    let disposed = false;
    const unsubscribe = tenantNotificationRuntime.subscribeInvalidation(() => loadFirstPage(true));
    queueMicrotask(() => {
      if (!disposed) void loadFirstPage();
    });
    return () => { disposed = true; unsubscribe(); invalidatePages(); };
  }, [loadFirstPage, invalidatePages, unreadOnly]);

  const runAction = useCallback(
    async (id: string, action: () => Promise<void>, failureTitle: string): Promise<void> => {
      if (pendingId) return;
      setPendingId(id);
      try {
        await action();
        await revalidateTenantNotifications();
      } catch (actionError) {
        const normalized = normalizeApiError(actionError);
        if (normalized.status === 403) return;
        if (toast.outcomeFromApi(normalized)) return;
        toast.errorFromApi(failureTitle, normalized);
      } finally {
        setPendingId(null);
      }
    },
    [pendingId, toast],
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
      await revalidateTenantNotifications();
      toast.success(t.coreNotifications.markAllReadTitle, t.coreNotifications.markAllReadMessage);
    } catch (actionError) {
      const normalized = normalizeApiError(actionError);
      if (normalized.status !== 403 && !toast.outcomeFromApi(normalized)) {
        toast.errorFromApi(t.coreNotifications.markAllReadFailed, normalized);
      }
    } finally {
      setIsMarkingAll(false);
    }
  }, [isMarkingAll, toast, t]);

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
      if (next === query.current.unreadOnly) return;
      invalidatePages();
      query.current.unreadOnly = next;
      query.current.pageCount = 1;
      setUnreadOnly(next);
      setCursor(null);
      setIsLoadingMore(false);
    },
    loadMore,
    markRead,
    acknowledge,
    dismiss,
    markAllRead,
    reload: () => loadFirstPage(true),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

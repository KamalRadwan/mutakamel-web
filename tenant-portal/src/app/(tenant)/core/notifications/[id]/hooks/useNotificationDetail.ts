"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tenantNotificationRuntime } from "@/lib/notifications/tenant-notification-runtime";
import { coreDelete, coreGet, corePost } from "../../../core-api";
import {
  notificationAcknowledgePath,
  notificationPath,
  notificationReadPath,
  notificationsListPath,
  parseNotificationPage,
  type InboxNotification,
} from "../../notification-contract";

const PAGE_RESPONSE_LIMIT_BYTES = 1_048_576;
/** 10 pages × 25 — bounded, so a deep inbox cannot turn one detail view into a crawl. */
const MAX_SEARCH_PAGES = 10;

export type NotificationDetailStatus = "loading" | "found" | "notFound" | "failed";

/**
 * Core exposes **no** `GET /notifications/:id`. The 14 documented routes are
 * the list, the config, the unread count, and the state commands — nothing
 * addresses a single notification for reading.
 *
 * So this resolves the record the only two honest ways available: the realtime
 * store, which already holds recently delivered items, and otherwise a bounded
 * walk of the same cursor-paginated list the inbox uses. Beyond that bound the
 * answer is `notFound`, which is what `NotFoundState` is for — no retry can
 * change it.
 */
export function useNotificationDetail(id: string) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const router = useRouter();

  const [notification, setNotification] = useState<InboxNotification | null>(null);
  const [status, setStatus] = useState<NotificationDetailStatus>("loading");
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [isPending, setIsPending] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setStatus("loading");
      setError(null);

      const cached = tenantNotificationRuntime
        .getSnapshot()
        .items.find((item) => item.id === id);
      if (cached) {
        setNotification(cached);
        setStatus("found");
        return;
      }

      let cursor: string | null = null;
      try {
        for (let pageNumber = 0; pageNumber < MAX_SEARCH_PAGES; pageNumber += 1) {
          const result = await coreGet(notificationsListPath(cursor, false), {
            signal,
            maxResponseBytes: PAGE_RESPONSE_LIMIT_BYTES,
          });
          const page = parseNotificationPage(result.data);
          const match = page.items.find((item) => item.id === id);
          if (match) {
            setNotification(match);
            setStatus("found");
            return;
          }
          if (!page.hasNext || page.nextCursor === null) break;
          // Opaque: handed straight back, never parsed or rebuilt.
          cursor = page.nextCursor;
        }
        setNotification(null);
        setStatus("notFound");
      } catch (loadError) {
        if (isAbortError(loadError)) return;
        setNotification(null);
        setError(normalizeApiError(loadError));
        setStatus("failed");
      }
    },
    [id],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const runAction = useCallback(
    async (action: () => Promise<void>, failureTitle: string, thenLeave: boolean): Promise<void> => {
      if (isPending) return;
      setIsPending(true);
      try {
        await action();
        if (thenLeave) {
          router.push(TENANT_ROUTES.coreNotifications);
          return;
        }
        await load();
      } catch (actionError) {
        const normalized = normalizeApiError(actionError);
        if (normalized.status === 403) return;
        if (toast.outcomeFromApi(normalized)) return;
        toast.errorFromApi(failureTitle, normalized);
      } finally {
        setIsPending(false);
      }
    },
    [isPending, router, load, toast],
  );

  return {
    t,
    lang,
    notification,
    status,
    error,
    isPending,
    markRead: () =>
      runAction(
        async () => {
          await corePost(notificationReadPath(id), undefined, { maxResponseBytes: 10_000 });
        },
        t.coreNotifications.markReadFailed,
        false,
      ),
    acknowledge: () =>
      runAction(
        async () => {
          await corePost(notificationAcknowledgePath(id), undefined, { maxResponseBytes: 10_000 });
        },
        t.coreNotifications.acknowledgeFailed,
        false,
      ),
    dismiss: () =>
      runAction(
        async () => {
          await coreDelete(notificationPath(id), { maxResponseBytes: 10_000 });
        },
        t.coreNotifications.dismissFailed,
        true,
      ),
    reload: () => load(),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

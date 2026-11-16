"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import {
  revalidateTenantNotifications,
  tenantNotificationRuntime,
} from "@/lib/notifications/tenant-notification-runtime";
import { coreDelete, coreGet, corePost } from "../../../core-api";
import {
  notificationAcknowledgePath,
  notificationPath,
  notificationReadPath,
  parseNotification,
  type InboxNotification,
} from "../../notification-contract";

const PAGE_RESPONSE_LIMIT_BYTES = 1_048_576;

export type NotificationDetailStatus = "loading" | "found" | "notFound" | "failed";

export function useNotificationDetail(id: string) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const router = useRouter();

  const [notification, setNotification] = useState<InboxNotification | null>(null);
  const [status, setStatus] = useState<NotificationDetailStatus>("loading");
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [isPending, setIsPending] = useState(false);
  const request = useRef<AbortController | null>(null);
  const hasSettled = useRef(false);

  const load = useCallback(
    async (silent = false): Promise<void> => {
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      const { signal } = controller;
      if (!silent) {
        hasSettled.current = false;
        setStatus("loading");
        setError(null);
        setNotification(null);
      }

      try {
        const result = await coreGet(notificationPath(id), {
          signal,
          maxResponseBytes: PAGE_RESPONSE_LIMIT_BYTES,
        });
        if (signal.aborted) return;
        setNotification(parseNotification(result.data, id));
        hasSettled.current = true;
        setError(null);
        setStatus("found");
      } catch (loadError) {
        if (signal.aborted || isAbortError(loadError)) return;
        const normalized = normalizeApiError(loadError);
        if (silent && hasSettled.current && normalized.status !== 404) return;
        hasSettled.current = true;
        setNotification(null);
        setError(normalized.status === 404 ? null : normalized);
        setStatus(normalized.status === 404 ? "notFound" : "failed");
      }
    },
    [id],
  );

  const revalidate = useCallback(() => load(true), [load]);

  useEffect(() => {
    let disposed = false;
    const unsubscribe = tenantNotificationRuntime.subscribeInvalidation(revalidate);
    queueMicrotask(() => {
      if (!disposed) void load();
    });
    return () => { disposed = true; unsubscribe(); request.current?.abort(); };
  }, [load, revalidate]);

  const runAction = useCallback(
    async (action: () => Promise<void>, failureTitle: string, thenLeave: boolean): Promise<void> => {
      if (isPending) return;
      setIsPending(true);
      try {
        await action();
        await revalidateTenantNotifications();
        if (thenLeave) {
          router.push(TENANT_ROUTES.coreNotifications);
          return;
        }
      } catch (actionError) {
        const normalized = normalizeApiError(actionError);
        if (normalized.status === 403) return;
        if (toast.outcomeFromApi(normalized)) return;
        toast.errorFromApi(failureTitle, normalized);
      } finally {
        setIsPending(false);
      }
    },
    [isPending, router, toast],
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

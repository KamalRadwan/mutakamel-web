"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  getAdminNotificationConfig,
  getAdminNotificationUnreadCount,
  listAdminNotifications,
  performAdminNotificationBulkAction,
  performAdminNotificationItemAction,
} from "@/features/admin/notifications/api";
import { NotificationContractError } from "@/features/admin/notifications/contracts";
import { getNotificationsCopy } from "@/features/admin/notifications/copy";
import type {
  AdminNotificationPage,
  NotificationRuntimeConfig,
} from "@/features/admin/notifications/types";
import { useI18n } from "@/i18n/I18nContext";
import { localeForLanguage } from "@/i18n/locale";
import { adminCan } from "@/lib/auth/rbac";
import {
  normalizeApiError,
  type NormalizedApiError,
} from "@/shared/api/normalized-api-error";

type DropdownLoadState = "IDLE" | "LOADING" | "READY" | "EMPTY" | "ERROR";
type DropdownActionState = "IDLE" | "PENDING" | "SUCCESS" | "FORBIDDEN" | "ERROR";

export function useNotificationDropdown() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { lang, dir } = useI18n();
  const copy = getNotificationsCopy(lang);
  const canRead = adminCan(user, "admin.notifications.read");
  const canManage = adminCan(user, "admin.notifications.manage");
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [countOwnerId, setCountOwnerId] = useState<string | null>(null);
  const [config, setConfig] = useState<NotificationRuntimeConfig | null>(null);
  const [configOwnerId, setConfigOwnerId] = useState<string | null>(null);
  const [page, setPage] = useState<AdminNotificationPage | null>(null);
  const [previewOwnerId, setPreviewOwnerId] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<DropdownLoadState>("IDLE");
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [actionState, setActionState] = useState<DropdownActionState>("IDLE");
  const [actionError, setActionError] = useState<NormalizedApiError | null>(null);
  const [actionOwnerId, setActionOwnerId] = useState<string | null>(null);
  const identityRef = useRef<string | null>(user?.id ?? null);
  const previewRequestRef = useRef(0);

  useEffect(() => {
    identityRef.current = user?.id ?? null;
  }, [user?.id]);

  useEffect(() => {
    const ownerId = user?.id ?? null;
    const controller = new AbortController();
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      if (isAuthLoading) return;
      if (!ownerId || !canRead) {
        setIsOpen(false);
        setUnreadCount(0);
        setCountOwnerId(null);
        setConfig(null);
        setConfigOwnerId(null);
        setPage(null);
        setPreviewOwnerId(null);
        setLoadState("IDLE");
        setLoadError(null);
        return;
      }

      void Promise.all([
        getAdminNotificationConfig(controller.signal),
        getAdminNotificationUnreadCount(controller.signal),
      ]).then(([nextConfig, nextUnreadCount]) => {
        if (controller.signal.aborted || identityRef.current !== ownerId) return;
        setConfig(nextConfig);
        setConfigOwnerId(ownerId);
        setUnreadCount(nextUnreadCount);
        setCountOwnerId(ownerId);
        if (!nextConfig.enabled || !nextConfig.inAppEnabled) return;
        pollTimer = setInterval(() => {
          void getAdminNotificationUnreadCount().then((count) => {
            if (identityRef.current === ownerId) {
              setUnreadCount(count);
              setCountOwnerId(ownerId);
            }
          }).catch(() => undefined);
        }, nextConfig.pollIntervalMs);
      }).catch((caught: unknown) => {
        if (controller.signal.aborted || identityRef.current !== ownerId) return;
        setLoadError(notificationDropdownError(caught));
      });
    });

    return () => {
      controller.abort();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [canRead, isAuthLoading, user?.id]);

  const currentOwnerId = user?.id ?? null;
  const previewLimit = Math.min(
    configOwnerId === currentOwnerId ? config?.previewLimit ?? 10 : 10,
    20,
  );
  const loadPreview = useCallback(async () => {
    const ownerId = user?.id ?? null;
    if (!canRead || !ownerId) return;
    const request = ++previewRequestRef.current;
    setLoadState("LOADING");
    setLoadError(null);
    try {
      const nextPage = await listAdminNotifications({
        limit: previewLimit,
        unreadOnly: false,
      });
      if (previewRequestRef.current !== request || identityRef.current !== ownerId) return;
      setPage(nextPage);
      setPreviewOwnerId(ownerId);
      setUnreadCount(nextPage.unreadCount);
      setCountOwnerId(ownerId);
      setLoadState(nextPage.items.length ? "READY" : "EMPTY");
    } catch (caught) {
      if (previewRequestRef.current !== request || identityRef.current !== ownerId) return;
      setPage(null);
      setPreviewOwnerId(null);
      setLoadError(notificationDropdownError(caught));
      setLoadState("ERROR");
    }
  }, [canRead, previewLimit, user?.id]);

  const runAction = useCallback(async (
    operation: () => Promise<unknown>,
    applySuccess: () => void,
  ) => {
    const ownerId = user?.id ?? null;
    if (!ownerId || !canManage) {
      setActionOwnerId(ownerId);
      setActionState("FORBIDDEN");
      setActionError(null);
      return;
    }
    if (identityRef.current !== ownerId) return;
    setActionOwnerId(ownerId);
    setActionState("PENDING");
    setActionError(null);
    try {
      await operation();
      if (identityRef.current !== ownerId) return;
      applySuccess();
      setActionState("SUCCESS");
    } catch (caught) {
      if (identityRef.current !== ownerId) return;
      setActionError(notificationDropdownError(caught));
      setActionState("ERROR");
    }
  }, [canManage, user?.id]);

  const markAllRead = useCallback(() => runAction(
    () => performAdminNotificationBulkAction("read-all"),
    () => {
      const now = new Date().toISOString();
      setUnreadCount(0);
      setPage((current) => current ? {
        ...current,
        unreadCount: 0,
        items: current.items.map((item) => ({ ...item, readAt: item.readAt ?? now })),
      } : current);
    },
  ), [runAction]);

  const markRead = useCallback((id: string) => runAction(
    () => performAdminNotificationItemAction(id, "read"),
    () => {
      const now = new Date().toISOString();
      setPage((current) => {
        if (!current) return current;
        const target = current.items.find((item) => item.id === id);
        if (target?.readAt) return current;
        return {
          ...current,
          unreadCount: Math.max(0, current.unreadCount - 1),
          items: current.items.map((item) => item.id === id
            ? { ...item, readAt: now }
            : item),
        };
      });
      setUnreadCount((current) => Math.max(0, current - 1));
    },
  ), [runAction]);

  const acknowledge = useCallback((id: string) => runAction(
    () => performAdminNotificationItemAction(id, "acknowledge"),
    () => {
      const now = new Date().toISOString();
      setPage((current) => {
        if (!current) return current;
        const wasUnread = current.items.some((item) => item.id === id && !item.readAt);
        return {
          ...current,
          unreadCount: wasUnread ? Math.max(0, current.unreadCount - 1) : current.unreadCount,
          items: current.items.map((item) => item.id === id
            ? { ...item, readAt: item.readAt ?? now, acknowledgedAt: now }
            : item),
        };
      });
      setUnreadCount((current) => {
        const wasUnread = page?.items.some((item) => item.id === id && !item.readAt) ?? false;
        return wasUnread ? Math.max(0, current - 1) : current;
      });
    },
  ), [page?.items, runAction]);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen && !isOpen) void loadPreview();
    setIsOpen(nextOpen);
  }, [isOpen, loadPreview]);
  const close = useCallback(() => setIsOpen(false), []);
  const exposesPreview = Boolean(currentOwnerId) && previewOwnerId === currentOwnerId;
  const exposesAction = Boolean(currentOwnerId) && actionOwnerId === currentOwnerId;
  const effectiveLoadState: DropdownLoadState = isOpen && !exposesPreview && loadState === "READY"
    ? "LOADING"
    : loadState;

  return useMemo(() => ({
    copy,
    dir,
    locale: localeForLanguage(lang),
    canRead,
    canManage,
    isOpen,
    unreadCount: countOwnerId === currentOwnerId ? unreadCount : 0,
    notifications: exposesPreview ? page?.items ?? [] : [],
    loadState: effectiveLoadState,
    loadError,
    actionState: exposesAction ? actionState : "IDLE",
    actionError: exposesAction ? actionError : null,
    isPending: exposesAction && actionState === "PENDING",
    setOpen: handleOpenChange,
    close,
    markAllRead,
    markRead,
    acknowledge,
  }), [
    acknowledge,
    actionError,
    actionState,
    countOwnerId,
    canManage,
    canRead,
    close,
    copy,
    currentOwnerId,
    dir,
    isOpen,
    effectiveLoadState,
    exposesAction,
    exposesPreview,
    loadError,
    markAllRead,
    markRead,
    page?.items,
    handleOpenChange,
    lang,
    unreadCount,
  ]);
}

function notificationDropdownError(error: unknown): NormalizedApiError {
  if (error instanceof NotificationContractError) {
    return {
      isNormalized: true,
      httpStatus: 500,
      errorCode: "NOTIFICATION_CONTRACT_INVALID",
      message: error.message,
    };
  }
  return normalizeApiError(error);
}

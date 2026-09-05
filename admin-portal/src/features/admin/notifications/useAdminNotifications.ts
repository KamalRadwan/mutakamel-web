"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { adminCan } from "@/lib/auth/rbac";
import {
  normalizeApiError,
  type NormalizedApiError,
} from "@/shared/api/normalized-api-error";
import {
  getAdminNotificationConfig,
  getAdminNotificationPreferences,
  getAdminNotificationUnreadCount,
  listAdminNotifications,
  performAdminNotificationBulkAction,
  performAdminNotificationItemAction,
  registerAdminNotificationDeviceToken,
  revokeAdminNotificationDeviceToken,
  upsertAdminNotificationPreference,
} from "./api";
import { NotificationContractError } from "./contracts";
import type {
  AdminNotificationPage,
  DeviceTokenReceipt,
  NotificationActionState,
  NotificationActionStatus,
  NotificationBulkAction,
  NotificationItemAction,
  NotificationPreference,
  NotificationPreferenceCommand,
  NotificationRequestState,
  NotificationRuntimeConfig,
  RegisterDeviceTokenCommand,
} from "./types";

const EMPTY_ACTION: NotificationActionStatus = {
  state: "IDLE",
  operation: null,
  messageKey: null,
  error: null,
};

export function useAdminNotifications() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const canRead = adminCan(user, "admin.notifications.read");
  const canManage = adminCan(user, "admin.notifications.manage");
  const [limit, setLimit] = useState(20);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [requestState, setRequestState] =
    useState<NotificationRequestState>("LOADING");
  const [page, setPage] = useState<AdminNotificationPage | null>(null);
  const [dataOwnerId, setDataOwnerId] = useState<string | null>(null);
  const [config, setConfig] = useState<NotificationRuntimeConfig | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [actionStatus, setActionStatus] =
    useState<NotificationActionStatus>(EMPTY_ACTION);
  const [actionOwnerId, setActionOwnerId] = useState<string | null>(null);
  const [lastUpdatedCount, setLastUpdatedCount] = useState<number | null>(null);
  const [deviceReceipt, setDeviceReceipt] = useState<DeviceTokenReceipt | null>(null);
  const [deviceReceiptOwnerId, setDeviceReceiptOwnerId] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const requestSequence = useRef(0);
  const identityRef = useRef<string | null>(user?.id ?? null);
  /**
   * UI-005. `loadMore` guarded only on the account, while `unreadOnly` stayed
   * captured in its closure. Flipping the filter mid-request reloaded page one
   * under the new filter and then appended the old filter's page onto it, so
   * the list showed read and unread rows together under an unread-only header.
   */
  const unreadOnlyRef = useRef(unreadOnly);
  const retryActionRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    identityRef.current = user?.id ?? null;
    retryActionRef.current = null;
  }, [user?.id]);

  useEffect(() => {
    unreadOnlyRef.current = unreadOnly;
  }, [unreadOnly]);

  const refresh = useCallback(() => setReloadVersion((value) => value + 1), []);

  useEffect(() => {
    const sequence = ++requestSequence.current;
    const ownerId = user?.id ?? null;
    const controller = new AbortController();

    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      if (isAuthLoading) {
        setRequestState("LOADING");
        return;
      }
      if (!canRead || !ownerId) {
        setDataOwnerId(null);
        setPage(null);
        setConfig(null);
        setPreferences([]);
        setUnreadCount(0);
        setLoadError(null);
        setRequestState("FORBIDDEN");
        return;
      }

      setRequestState("LOADING");
      setLoadError(null);
      void Promise.all([
        listAdminNotifications({ limit, unreadOnly }, controller.signal),
        getAdminNotificationConfig(controller.signal),
        getAdminNotificationPreferences(controller.signal),
        getAdminNotificationUnreadCount(controller.signal),
      ]).then(([nextPage, nextConfig, nextPreferences, nextUnreadCount]) => {
        if (!ownsRequest(sequence, ownerId, requestSequence, identityRef)) return;
        setDataOwnerId(ownerId);
        setPage(nextPage);
        setConfig(nextConfig);
        setPreferences(nextPreferences);
        setUnreadCount(nextUnreadCount);
        setRequestState(nextPage.items.length ? "READY" : "EMPTY");
      }).catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        if (!ownsRequest(sequence, ownerId, requestSequence, identityRef)) return;
        const normalized = notificationError(caught);
        setDataOwnerId(null);
        setPage(null);
        setConfig(null);
        setPreferences([]);
        setUnreadCount(0);
        setLoadError(normalized);
        setRequestState(loadStateFromError(normalized));
      });
    });
    return () => controller.abort();
  }, [canRead, isAuthLoading, limit, reloadVersion, unreadOnly, user?.id]);

  const loadMore = useCallback(async () => {
    const cursor = page?.nextCursor;
    const ownerId = user?.id ?? null;
    if (!canRead || dataOwnerId !== ownerId || !ownerId || !cursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const next = await listAdminNotifications({ limit, unreadOnly, cursor });
      // The filter is as much a part of "is this still my page" as the account:
      // a page fetched under the other filter cannot be appended to this one.
      if (identityRef.current !== ownerId || unreadOnlyRef.current !== unreadOnly) {
        return;
      }
      setPage((current) => {
        if (!current) return next;
        const known = new Set(current.items.map((item) => item.id));
        return {
          ...next,
          items: [...current.items, ...next.items.filter((item) => !known.has(item.id))],
        };
      });
      setUnreadCount(next.unreadCount);
    } catch (caught) {
      if (identityRef.current !== ownerId || unreadOnlyRef.current !== unreadOnly) {
        return;
      }
      const normalized = notificationError(caught);
      setActionStatus({
        state: actionStateFromError(normalized),
        operation: "load-more",
        messageKey: null,
        error: normalized,
      });
    } finally {
      // Account-scoped, deliberately not filter-scoped: the filter guard above
      // protects the append, and refusing to clear the spinner here would
      // strand it whenever the operator switched filters mid-request.
      if (identityRef.current === ownerId) setIsLoadingMore(false);
    }
  }, [canRead, dataOwnerId, isLoadingMore, limit, page?.nextCursor, unreadOnly, user?.id]);

  const runAction = useCallback(async <T,>(
    operation: string,
    work: () => Promise<T>,
    onSuccess: (result: T) => void,
    messageKey: string,
  ): Promise<T | null> => {
    const ownerId = user?.id ?? null;
    if (!canManage || !ownerId) {
      setActionOwnerId(ownerId);
      setActionStatus({
        state: "FORBIDDEN",
        operation,
        messageKey: null,
        error: null,
      });
      return null;
    }
    const execute = async (): Promise<T | null> => {
      if (identityRef.current !== ownerId) return null;
      setActionOwnerId(ownerId);
      setActionStatus({ state: "PENDING", operation, messageKey: null, error: null });
      setLastUpdatedCount(null);
      try {
        const result = await work();
        if (identityRef.current !== ownerId) return null;
        onSuccess(result);
        retryActionRef.current = null;
        setActionStatus({ state: "SUCCESS", operation, messageKey, error: null });
        refresh();
        return result;
      } catch (caught) {
        if (identityRef.current !== ownerId) return null;
        const normalized = notificationError(caught);
        const state = actionStateFromError(normalized);
        retryActionRef.current = state === "UNAVAILABLE" || state === "CONFLICT"
          ? async () => { await execute(); }
          : null;
        setActionStatus({ state, operation, messageKey: null, error: normalized });
        return null;
      }
    };
    return execute();
  }, [canManage, refresh, user?.id]);

  const performItemAction = useCallback((id: string, action: NotificationItemAction) =>
    runAction(
      `${action}:${id}`,
      () => performAdminNotificationItemAction(id, action),
      () => undefined,
      "actionSucceeded",
    ), [runAction]);

  const performBulkAction = useCallback((action: NotificationBulkAction) =>
    runAction(
      action,
      () => performAdminNotificationBulkAction(action),
      (updated) => setLastUpdatedCount(updated),
      "bulkCompleted",
    ), [runAction]);

  const savePreference = useCallback((command: NotificationPreferenceCommand) =>
    runAction(
      `preference:${command.notificationType}`,
      () => upsertAdminNotificationPreference(command),
      (saved) => setPreferences((current) => [
        ...current.filter((item) => item.notificationType !== saved.notificationType),
        saved,
      ].sort((a, b) => a.notificationType.localeCompare(b.notificationType))),
      "preferenceSaved",
    ), [runAction]);

  const registerDevice = useCallback((command: RegisterDeviceTokenCommand) =>
    runAction(
      "device-register",
      () => registerAdminNotificationDeviceToken(command),
      (receipt) => {
        setDeviceReceipt(receipt);
        setDeviceReceiptOwnerId(user?.id ?? null);
      },
      "deviceRegistered",
    ), [runAction, user?.id]);

  const revokeDevice = useCallback((id: string) =>
    runAction(
      `device-revoke:${id}`,
      () => revokeAdminNotificationDeviceToken(id),
      () => setDeviceReceipt((current) => current?.id === id ? null : current),
      "deviceRevoked",
    ), [runAction]);

  const retryLastAction = useCallback(() => {
    if (actionOwnerId !== user?.id || !canManage) return;
    return retryActionRef.current?.();
  }, [actionOwnerId, canManage, user?.id]);
  const clearActionStatus = useCallback(() => {
    retryActionRef.current = null;
    setActionOwnerId(null);
    setActionStatus(EMPTY_ACTION);
    setLastUpdatedCount(null);
  }, []);

  const currentOwnerId = user?.id ?? null;
  const exposesData = Boolean(currentOwnerId) && dataOwnerId === currentOwnerId;
  const effectiveRequestState: NotificationRequestState = isAuthLoading
    ? "LOADING"
    : !canRead || !currentOwnerId
      ? "FORBIDDEN"
      : !exposesData && (requestState === "READY" || requestState === "EMPTY")
        ? "LOADING"
        : requestState;
  const exposesAction = Boolean(currentOwnerId) && actionOwnerId === currentOwnerId;

  return useMemo(() => ({
    canRead,
    canManage,
    requestState: effectiveRequestState,
    page: exposesData ? page : null,
    config: exposesData ? config : null,
    preferences: exposesData ? preferences : [],
    unreadCount: exposesData ? unreadCount : 0,
    loadError,
    limit,
    setLimit,
    unreadOnly,
    setUnreadOnly,
    refresh,
    loadMore,
    isLoadingMore,
    actionStatus: exposesAction ? actionStatus : EMPTY_ACTION,
    lastUpdatedCount: exposesAction ? lastUpdatedCount : null,
    clearActionStatus,
    retryLastAction,
    performItemAction,
    performBulkAction,
    savePreference,
    registerDevice,
    revokeDevice,
    deviceReceipt: deviceReceiptOwnerId === currentOwnerId ? deviceReceipt : null,
  }), [
    actionStatus,
    canManage,
    canRead,
    clearActionStatus,
    config,
    currentOwnerId,
    deviceReceiptOwnerId,
    deviceReceipt,
    effectiveRequestState,
    exposesAction,
    exposesData,
    isLoadingMore,
    lastUpdatedCount,
    limit,
    loadError,
    loadMore,
    page,
    performBulkAction,
    performItemAction,
    preferences,
    refresh,
    registerDevice,
    retryLastAction,
    revokeDevice,
    savePreference,
    unreadCount,
    unreadOnly,
  ]);
}

function ownsRequest(
  sequence: number,
  ownerId: string,
  sequenceRef: { current: number },
  identityRef: { current: string | null },
): boolean {
  return sequenceRef.current === sequence && identityRef.current === ownerId;
}

function notificationError(error: unknown): NormalizedApiError {
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

function loadStateFromError(error: NormalizedApiError): NotificationRequestState {
  if (error.httpStatus === 403) return "FORBIDDEN";
  if (
    error.httpStatus >= 500 &&
    error.errorCode !== "NOTIFICATION_CONTRACT_INVALID"
  ) return "UNAVAILABLE";
  return "ERROR";
}

function actionStateFromError(error: NormalizedApiError): NotificationActionState {
  if (error.httpStatus === 403) return "FORBIDDEN";
  if (error.httpStatus === 404) return "STALE";
  if (error.httpStatus === 409) return "CONFLICT";
  if (error.httpStatus === 400 || error.httpStatus === 422) return "VALIDATION";
  if (
    error.httpStatus >= 500 ||
    /(?:UNAVAILABLE|TIMEOUT|TRANSPORT)/.test(error.errorCode)
  ) return "UNAVAILABLE";
  return "ERROR";
}

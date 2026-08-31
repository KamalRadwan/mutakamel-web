"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { coreGet, corePut } from "../../core-api";
import {
  NOTIFICATIONS_CONFIG_PATH,
  NOTIFICATION_PREFERENCES_PATH,
  parseChannelConfig,
  parseNotificationPreference,
  parseNotificationPreferences,
  type NotificationChannel,
  type NotificationChannelConfig,
  type NotificationPreference,
  type UpsertPreferenceRequest,
} from "../notification-contract";

const PREFERENCES_RESPONSE_LIMIT_BYTES = 400_000;

export function useNotificationPreferences() {
  const { t } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const canRead = user?.permissions.includes("notifications.preference.read") ?? false;
  const canManage = user?.permissions.includes("notifications.preference.manage") ?? false;

  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [channelConfig, setChannelConfig] = useState<NotificationChannelConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [pendingType, setPendingType] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      if (!canRead) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const result = await coreGet(NOTIFICATION_PREFERENCES_PATH, {
          signal,
          maxResponseBytes: PREFERENCES_RESPONSE_LIMIT_BYTES,
        });
        setPreferences(parseNotificationPreferences(result.data));
      } catch (loadError) {
        if (isAbortError(loadError)) return;
        setError(normalizeApiError(loadError));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [canRead],
  );

  const loadChannelConfig = useCallback(async (signal?: AbortSignal): Promise<void> => {
    try {
      const result = await coreGet(NOTIFICATIONS_CONFIG_PATH, {
        signal,
        maxResponseBytes: 40_000,
      });
      setChannelConfig(parseChannelConfig(result.data));
    } catch {
      // Advisory: without it every channel stays offerable, and the server is
      // still the authority on what it will actually deliver.
      setChannelConfig(null);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      void load(controller.signal);
      void loadChannelConfig(controller.signal);
    });
    return () => controller.abort();
  }, [load, loadChannelConfig]);

  const toggle = useCallback(
    async (
      preference: NotificationPreference,
      channel: NotificationChannel,
      enabled: boolean,
    ): Promise<void> => {
      if (!canManage || pendingType) return;
      setPendingType(preference.notificationType);
      // Only the toggle the user moved is sent; an omitted channel keeps its
      // current value server-side (UpsertNotificationPreferenceDto).
      const request: UpsertPreferenceRequest = {
        notificationType: preference.notificationType,
        ...(channel === "inApp" ? { inAppEnabled: enabled } : {}),
        ...(channel === "push" ? { pushEnabled: enabled } : {}),
        ...(channel === "email" ? { emailEnabled: enabled } : {}),
      };
      try {
        const result = await corePut(NOTIFICATION_PREFERENCES_PATH, request, {
          maxResponseBytes: 40_000,
        });
        const saved = parseNotificationPreference(result.data);
        setPreferences((current) =>
          current.map((item) =>
            item.notificationType === saved.notificationType ? saved : item,
          ),
        );
      } catch (saveError) {
        const normalized = normalizeApiError(saveError);
        if (normalized.status !== 403 && !toast.outcomeFromApi(normalized)) {
          toast.errorFromApi(t.coreNotifications.preferenceSaveFailed, normalized);
        }
        await load();
      } finally {
        setPendingType(null);
      }
    },
    [canManage, pendingType, toast, t, load],
  );

  return {
    canRead,
    canManage,
    preferences,
    channelConfig,
    isLoading,
    error,
    pendingType,
    toggle,
    reload: () => load(),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

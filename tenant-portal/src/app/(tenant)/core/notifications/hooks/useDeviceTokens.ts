"use client";

import { useCallback, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError } from "@/lib/api/errors";
import { coreDelete, corePost } from "../../core-api";
import {
  DEVICE_TOKENS_PATH,
  deviceTokenPath,
  parseDeviceToken,
  type DeviceToken,
  type DeviceTokenProvider,
  type RegisterDeviceTokenRequest,
} from "../notification-contract";

/**
 * Register and revoke only.
 *
 * The Core contract exposes **no listing** of device tokens — the 14 routes are
 * `POST /device-tokens` and `DELETE /device-tokens/:id` and nothing else. So
 * this panel can show exactly what the server returned from a registration made
 * in this session, and says so; it never renders an invented roster of devices.
 */
export function useDeviceTokens() {
  const { t } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const canManage = user?.permissions.includes("notifications.device_token.manage") ?? false;

  const [registered, setRegistered] = useState<DeviceToken[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const register = useCallback(
    async (
      provider: DeviceTokenProvider,
      token: string,
      deviceId: string,
      platform: string,
    ): Promise<boolean> => {
      if (!canManage || isSubmitting) return false;
      const trimmedToken = token.trim();
      if (trimmedToken.length === 0 || trimmedToken.length > 4_096) {
        setFormError(t.coreNotifications.deviceTokenInvalid);
        return false;
      }

      setIsSubmitting(true);
      setFormError(null);
      const request: RegisterDeviceTokenRequest = {
        provider,
        token: trimmedToken,
        ...(deviceId.trim() ? { deviceId: deviceId.trim() } : {}),
        ...(platform.trim() ? { platform: platform.trim() } : {}),
      };
      try {
        const result = await corePost(DEVICE_TOKENS_PATH, request, { maxResponseBytes: 20_000 });
        const saved = parseDeviceToken(result.data);
        setRegistered((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
        toast.success(t.coreNotifications.deviceTokenSavedTitle, t.coreNotifications.deviceTokenSavedMessage);
        return true;
      } catch (error) {
        const normalized = normalizeApiError(error);
        if (normalized.status !== 403 && !toast.outcomeFromApi(normalized)) {
          toast.errorFromApi(t.coreNotifications.deviceTokenRegisterFailed, normalized);
        }
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [canManage, isSubmitting, toast, t],
  );

  const revoke = useCallback(
    async (deviceToken: DeviceToken): Promise<void> => {
      if (!canManage || revokingId) return;
      setRevokingId(deviceToken.id);
      try {
        await coreDelete(deviceTokenPath(deviceToken.id), { maxResponseBytes: 10_000 });
        setRegistered((current) => current.filter((item) => item.id !== deviceToken.id));
        toast.success(t.coreNotifications.deviceTokenRevokedTitle, t.coreNotifications.deviceTokenRevokedMessage);
      } catch (error) {
        const normalized = normalizeApiError(error);
        if (normalized.status !== 403 && !toast.outcomeFromApi(normalized)) {
          toast.errorFromApi(t.coreNotifications.deviceTokenRevokeFailed, normalized);
        }
      } finally {
        setRevokingId(null);
      }
    },
    [canManage, revokingId, toast, t],
  );

  return {
    canManage,
    registered,
    isSubmitting,
    revokingId,
    formError,
    clearFormError: () => setFormError(null),
    register,
    revoke,
  };
}

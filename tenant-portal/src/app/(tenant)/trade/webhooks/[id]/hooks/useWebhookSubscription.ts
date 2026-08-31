"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { tradeGet, tradeIfMatch, tradePatch, tradePost } from "../../../trade-api";
import { hasTradePermission, useTradeScope } from "../../../trade-advanced-scope";
import {
  WEBHOOK_MANAGE_PERMISSION,
  buildRotateSecretRequest,
  buildUpdateWebhookStatusRequest,
  parseWebhookSubscriptionDetail,
  webhookFormMessage,
  webhookMessage,
  webhookSubscriptionActionPath,
  webhookSubscriptionPath,
  type WebhookSettableStatus,
  type WebhookSubscriptionDetail,
} from "../../webhook-contract";

const DETAIL_RESPONSE_LIMIT_BYTES = 200_000;

type PendingAction = "status" | "rotate" | "revoke" | "test" | null;

export function useWebhookSubscription(id: string) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const { branchId } = useTenantBranchSelection(user);
  const scope = useTradeScope("BRANCH", branchId);

  const [subscription, setSubscription] = useState<WebhookSubscriptionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const canManage = hasTradePermission(
    scope.permissions,
    scope.isTenantOwner,
    WEBHOOK_MANAGE_PERMISSION,
  );

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setIsLoading(true);
      setQueryError(null);
      try {
        const response = await tradeGet(webhookSubscriptionPath(id), {
          signal,
          headers: scope.headers,
          maxResponseBytes: DETAIL_RESPONSE_LIMIT_BYTES,
        });
        setSubscription(parseWebhookSubscriptionDetail(response.data));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setQueryError(normalizeApiError(error));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [id, scope.headers],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const run = useCallback(
    async (action: PendingAction, call: () => Promise<unknown>, success: string): Promise<void> => {
      if (!canManage || !subscription || pending) return;
      setPending(action);
      setActionError(null);
      try {
        await call();
        toast.success(t.tradeCommon.savedTitle, success);
      } catch (error) {
        const normalized = normalizeApiError(error);
        if (normalized.status !== 403 && !toast.outcomeFromApi(normalized)) {
          setActionError(webhookMessage(normalized, t) ?? webhookFormMessage(error, t));
        }
      } finally {
        setPending(null);
        await load();
      }
    },
    [canManage, subscription, pending, toast, t, load],
  );

  const ifMatch = () => ({
    ...scope.headers,
    "If-Match": tradeIfMatch(subscription?.version ?? 0),
  });

  return {
    t,
    lang,
    canManage,
    subscription,
    isLoading,
    queryError,
    isNotFound: queryError?.status === 404,
    pending,
    actionError,
    setStatus: (status: WebhookSettableStatus) =>
      run(
        "status",
        () =>
          tradePatch(webhookSubscriptionPath(id), buildUpdateWebhookStatusRequest(status), {
            headers: ifMatch(),
            maxResponseBytes: DETAIL_RESPONSE_LIMIT_BYTES,
          }),
        t.tradeAutomation.subscriptionUpdated,
      ),
    // 202 with nothing in the body, and no route ever returns the secret —
    // the success message says the rotation was accepted, not what it is.
    rotateSecret: (overlapHours: string) =>
      run(
        "rotate",
        () =>
          tradePost(
            webhookSubscriptionActionPath(id, "rotate-secret"),
            buildRotateSecretRequest(overlapHours),
            { headers: ifMatch(), maxResponseBytes: DETAIL_RESPONSE_LIMIT_BYTES },
          ),
        t.tradeAutomation.rotateAccepted,
      ),
    revokeSecret: () =>
      run(
        "revoke",
        () =>
          tradePost(webhookSubscriptionActionPath(id, "revoke-secret"), undefined, {
            headers: ifMatch(),
            maxResponseBytes: DETAIL_RESPONSE_LIMIT_BYTES,
          }),
        t.tradeAutomation.revokeAccepted,
      ),
    // `test` is the one action on this screen with no If-Match at all.
    sendTest: () =>
      run(
        "test",
        () =>
          tradePost(webhookSubscriptionActionPath(id, "test"), undefined, {
            headers: scope.headers,
            maxResponseBytes: DETAIL_RESPONSE_LIMIT_BYTES,
          }),
        t.tradeAutomation.testAccepted,
      ),
    reload: () => load(),
  };
}

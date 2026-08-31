"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isTradeReplay, tradeGet, tradePost } from "../../trade-api";
import { hasTradePermission, useTradeScope } from "../../trade-advanced-scope";
import {
  WEBHOOK_EVENTS_PATH,
  WEBHOOK_MANAGE_PERMISSION,
  WEBHOOK_PAGE_SIZE,
  WEBHOOK_SUBSCRIPTIONS_PATH,
  buildCreateWebhookSubscriptionRequest,
  parseWebhookEvents,
  parseWebhookSubscriptionsResponse,
  webhookFormMessage,
  webhookMessage,
  webhookSubscriptionsListPath,
  type WebhookEventDescriptor,
  type WebhookSubscription,
  type WebhookSubscriptionFormValues,
  type WebhookSubscriptionStatus,
} from "../webhook-contract";

const LIST_RESPONSE_LIMIT_BYTES = 600_000;
const EVENTS_RESPONSE_LIMIT_BYTES = 400_000;
const ROW_RESPONSE_LIMIT_BYTES = 200_000;

export function useWebhookSubscriptions() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const { branchIds, branchId, selectBranch } = useTenantBranchSelection(user);
  const scope = useTradeScope("BRANCH", branchId);

  const [items, setItems] = useState<WebhookSubscription[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<WebhookSubscriptionStatus | undefined>(undefined);
  const [events, setEvents] = useState<WebhookEventDescriptor[]>([]);
  const [eventsUnavailable, setEventsUnavailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const canManage = hasTradePermission(
    scope.permissions,
    scope.isTenantOwner,
    WEBHOOK_MANAGE_PERMISSION,
  );

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setIsLoading(true);
      setQueryError(null);
      // The event catalogue is a second source and the create form cannot be
      // built without it — but the list is still worth showing if it fails.
      const [listResult, eventsResult] = await Promise.allSettled([
        tradeGet(webhookSubscriptionsListPath(page, status), {
          signal,
          headers: scope.headers,
          maxResponseBytes: LIST_RESPONSE_LIMIT_BYTES,
        }),
        tradeGet(WEBHOOK_EVENTS_PATH, {
          signal,
          headers: scope.headers,
          maxResponseBytes: EVENTS_RESPONSE_LIMIT_BYTES,
        }),
      ]);

      if (listResult.status === "fulfilled") {
        try {
          const parsed = parseWebhookSubscriptionsResponse(listResult.value.data);
          setItems(parsed.items);
          setTotal(parsed.total);
          setHasLoaded(true);
        } catch (error) {
          setQueryError(normalizeApiError(error));
        }
      } else if (!isAbortError(listResult.reason)) {
        setQueryError(normalizeApiError(listResult.reason));
      }

      if (eventsResult.status === "fulfilled") {
        try {
          setEvents(parseWebhookEvents(eventsResult.value.data));
          setEventsUnavailable(false);
        } catch {
          setEventsUnavailable(true);
        }
      } else if (!isAbortError(eventsResult.reason)) {
        setEventsUnavailable(true);
      }

      if (!signal?.aborted) setIsLoading(false);
    },
    [page, status, scope.headers],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const create = useCallback(
    async (values: WebhookSubscriptionFormValues): Promise<boolean> => {
      if (!canManage || isSubmitting) return false;
      setIsSubmitting(true);
      setFormError(null);
      try {
        const response = await tradePost(
          WEBHOOK_SUBSCRIPTIONS_PATH,
          buildCreateWebhookSubscriptionRequest(values, events),
          { headers: scope.headers, maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES },
        );
        setCreateOpen(false);
        toast.success(
          t.tradeCommon.savedTitle,
          isTradeReplay(response.headers)
            ? t.tradeCommon.replayedDescription
            : t.tradeAutomation.subscriptionCreated,
        );
        await load();
        return true;
      } catch (error) {
        const normalized = normalizeApiError(error);
        if (normalized.status === 403) return false;
        if (toast.outcomeFromApi(normalized)) return false;
        setFormError(webhookMessage(normalized, t) ?? webhookFormMessage(error, t));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [canManage, isSubmitting, events, scope.headers, toast, t, load],
  );

  return {
    t,
    lang,
    canManage,
    branchIds,
    branchId,
    selectBranch,
    items,
    events,
    eventsUnavailable,
    pageInfo: { page, limit: WEBHOOK_PAGE_SIZE, total },
    status,
    isLoading: isLoading && !hasLoaded,
    isRefreshing: isLoading,
    queryError,
    createOpen,
    isSubmitting,
    formError,
    setPage,
    setStatus: (next: WebhookSubscriptionStatus | undefined) => {
      setPage(1);
      setStatus(next);
    },
    openCreate: () => {
      setFormError(null);
      setCreateOpen(true);
    },
    closeCreate: () => {
      if (isSubmitting) return;
      setCreateOpen(false);
    },
    create,
    reload: () => load(),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { tradeGet } from "../../../trade-api";
import { hasTradePermission, useTradeScope } from "../../../trade-advanced-scope";
import {
  WEBHOOK_MANAGE_PERMISSION,
  WEBHOOK_PAGE_SIZE,
  parseWebhookDeliveriesResponse,
  webhookDeliveriesListPath,
  type WebhookDelivery,
  type WebhookDeliveryStatus,
} from "../../webhook-contract";

const LIST_RESPONSE_LIMIT_BYTES = 800_000;

/**
 * Reading the delivery log needs `trade.webhooks.manage` — the same grant as
 * creating a subscription. There is no read-only webhook permission.
 */
export function useWebhookDeliveries() {
  const { t, lang } = useI18n();
  const { user } = useTenantAuth();
  const { branchIds, branchId, selectBranch } = useTenantBranchSelection(user);
  const scope = useTradeScope("BRANCH", branchId);

  const [items, setItems] = useState<WebhookDelivery[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<WebhookDeliveryStatus | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);

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
        const response = await tradeGet(webhookDeliveriesListPath(page, status), {
          signal,
          headers: scope.headers,
          maxResponseBytes: LIST_RESPONSE_LIMIT_BYTES,
        });
        const parsed = parseWebhookDeliveriesResponse(response.data);
        setItems(parsed.items);
        setTotal(parsed.total);
        setHasLoaded(true);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setQueryError(normalizeApiError(error));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
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

  return {
    t,
    lang,
    canManage,
    branchIds,
    branchId,
    selectBranch,
    items,
    pageInfo: { page, limit: WEBHOOK_PAGE_SIZE, total },
    status,
    isLoading: isLoading && !hasLoaded,
    isRefreshing: isLoading,
    queryError,
    setPage,
    setStatus: (next: WebhookDeliveryStatus | undefined) => {
      setPage(1);
      setStatus(next);
    },
    reload: () => load(),
  };
}

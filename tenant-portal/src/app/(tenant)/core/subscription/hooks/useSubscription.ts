"use client";

import { useCallback, useEffect, useState } from "react";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  fetchSubscription,
  fetchSubscriptionItems,
  type SubscriptionItem,
  type TenantSubscription,
} from "../subscription-contract";

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * `GET /subscription` and `GET /subscription/items`, settled independently.
 *
 * They are two projections of one resource: the first carries the lifecycle
 * header plus catalogue-enriched item names, the second the authoritative item
 * rows the plan-change DTO's `itemId` must come from. `allSettled` keeps the
 * screen alive when only one of them answers, and the caller says which half is
 * missing rather than blanking both.
 */
export function useSubscription() {
  const [subscription, setSubscription] = useState<TenantSubscription | null>(null);
  const [subscriptionError, setSubscriptionError] = useState<NormalizedApiError | null>(null);
  const [items, setItems] = useState<SubscriptionItem[] | null>(null);
  const [itemsFailed, setItemsFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

  const load = useCallback(async (signal?: AbortSignal): Promise<void> => {
    setIsLoading(true);
    const [headerResult, itemsResult] = await Promise.allSettled([
      fetchSubscription(signal),
      fetchSubscriptionItems(signal),
    ]);
    if (signal?.aborted) return;

    if (headerResult.status === "fulfilled") {
      setSubscription(headerResult.value);
      setSubscriptionError(null);
    } else if (!isAbortError(headerResult.reason)) {
      setSubscriptionError(normalizeApiError(headerResult.reason));
    }

    if (itemsResult.status === "fulfilled") {
      setItems(itemsResult.value);
      setItemsFailed(false);
    } else if (!isAbortError(itemsResult.reason)) {
      setItemsFailed(true);
    }

    setHasLoaded(true);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  return {
    subscription,
    subscriptionError,
    // The enriched list is what a reader wants; the raw rows are the fallback
    // when catalogue enrichment is what failed.
    items: subscription?.items ?? items ?? [],
    itemsFailed,
    isLoading: isLoading && !hasLoaded,
    isRefreshing: isLoading,
    reload: () => load(),
  };
}

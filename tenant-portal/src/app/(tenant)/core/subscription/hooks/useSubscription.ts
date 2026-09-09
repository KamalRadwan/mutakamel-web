"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { readSubscription, readSubscriptionItems, type SubscriptionView } from "../subscription-read";

interface ReadState { key: string; view: SubscriptionView | null; error: NormalizedApiError | null }

/** One coherent accepted snapshot, without a partial base-only fallback. */
export function useSubscription() {
  const { user, isAuthenticated, realtimeAuthGeneration } = useTenantAuth();
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState<ReadState | null>(null);
  const allowed = isAuthenticated && user?.isTenantOwner === true;
  const key = JSON.stringify([user?.id, realtimeAuthGeneration, allowed, refresh]);
  // A restored owner/session must obtain a new observation before showing financial facts.
  if (state !== null && state.key !== key) setState(null);

  useEffect(() => {
    if (!allowed) return;
    const controller = new AbortController();
    Promise.all([readSubscription(controller.signal), readSubscriptionItems(controller.signal)]).then(
      ([view, items]) => {
        if (controller.signal.aborted) return;
        if (view.subscription.id !== items.subscriptionId || view.subscriptionRevision !== items.subscriptionRevision
          || JSON.stringify(view.baseItems) !== JSON.stringify(items.baseItems)
          || JSON.stringify(view.addonSelections) !== JSON.stringify(items.addonSelections)) {
          setState({ key, view: null, error: { status: 0 } });
          return;
        }
        setState({ key, view, error: null });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setState({ key, view: null, error: normalizeApiError(error) });
          controller.abort();
        }
      },
    );
    return () => controller.abort();
  }, [allowed, key]);

  const current = state?.key === key ? state : null;
  const reload = useCallback(() => setRefresh((value) => value + 1), []);
  return {
    view: current?.view ?? null, subscriptionError: current?.error ?? null,
    items: current?.view?.baseItems ?? [], denied: !allowed || current?.error?.status === 403,
    isLoading: allowed && !current, isRefreshing: allowed && !current, reload,
  };
}

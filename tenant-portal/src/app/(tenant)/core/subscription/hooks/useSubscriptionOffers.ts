"use client";

import { useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { SubscriptionOffer, SubscriptionOfferPage, SubscriptionOfferRequest } from "../subscription-offers";
import { readSubscriptionOffers } from "../subscription-offers-api";

interface Input { identity: string; request: SubscriptionOfferRequest; selectedTier: string | null }
interface State { key: string; data: SubscriptionOfferPage | null; error: NormalizedApiError | null }
const defaultRequest: SubscriptionOfferRequest = { page: 1, limit: 20 };

export function useSubscriptionOffers() {
  const { user, isAuthenticated, realtimeAuthGeneration } = useTenantAuth();
  const { t, lang } = useI18n();
  const allowed = isAuthenticated && !!user?.isTenantOwner;
  const identity = JSON.stringify([user?.id, realtimeAuthGeneration, allowed]);
  const [input, setInput] = useState<Input | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState<State | null>(null);
  const request = input?.identity === identity ? input.request : defaultRequest;
  const selectedTier = input?.identity === identity ? input.selectedTier : null;
  const key = JSON.stringify([identity, request, refresh]);
  // Retire the previous observation so returning to an earlier filter cannot revive its prices.
  if (state !== null && state.key !== key) setState(null);
  useEffect(() => {
    if (!allowed) return;
    const controller = new AbortController();
    readSubscriptionOffers(request, controller.signal).then(
      (data) => { if (!controller.signal.aborted) setState({ key, data, error: null }); },
      (error: unknown) => { if (!controller.signal.aborted) setState({ key, data: null, error: normalizeApiError(error) }); },
    );
    return () => controller.abort();
  }, [allowed, key, request]);
  const current = state?.key === key ? state : null;
  const reload = () => setRefresh((value) => value + 1);
  const reset = () => setInput({ identity, request: defaultRequest, selectedTier: null });
  const changePage = (page: number) => {
    if (page !== request.page && Number.isInteger(page) && page >= 1 && page <= 1_000_000) setInput({ identity, request: { ...request, page }, selectedTier });
  };
  const selectTier = (offer: SubscriptionOffer) => {
    if (!allowed || offer.sourceKind !== "APPLICATION") return;
    const selected = current?.data?.items.find((value) => value.sourceKind === "APPLICATION" && value.tier.id === offer.tier.id
      && value.application.id === offer.application.id);
    if (!selected || selected.sourceKind !== "APPLICATION") return;
    if (request.page === 1 && request.applicationKey === selected.application.key && request.parentTierId === selected.tier.id) return;
    setInput({ identity, request: { page: 1, limit: 20, applicationKey: selected.application.key, parentTierId: selected.tier.id },
      selectedTier: `${selected.application.name} · ${selected.tier.name}` });
  };
  return { t, data: current?.data ?? null, error: current?.error ?? null, loading: allowed && !current,
    denied: !allowed || current?.error?.status === 403, selectedTier, selectTier, changePage, reload, reset,
    paginationLabels: { previous: t.common.previousPage, next: t.common.nextPage,
      summary: (from: number, to: number, total: number) => formatTemplate(t.common.showingOf, { from: formatNumber(from, lang), to: formatNumber(to, lang), total: formatNumber(total, lang) }) },
  };
}

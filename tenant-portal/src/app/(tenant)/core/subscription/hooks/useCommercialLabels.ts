"use client";

import { useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { createCommercialLabels } from "../commercial-labels";
import type { DefinitionAdoptionSelection } from "../definition-adoption-discovery";
import type { SubscriptionOffer } from "../subscription-offers";
import { readSubscriptionOffers } from "../subscription-offers-api";
import type { SubscriptionView } from "../subscription-read";

const noSelections: readonly DefinitionAdoptionSelection[] = [];

export function useCommercialLabels(view: SubscriptionView | null = null, selections: readonly DefinitionAdoptionSelection[] = noSelections) {
  const { user, isAuthenticated, realtimeAuthGeneration } = useTenantAuth();
  const allowed = isAuthenticated && !!user?.isTenantOwner;
  const key = JSON.stringify([user?.id, realtimeAuthGeneration, allowed]);
  const [state, setState] = useState<{ key: string; offers: SubscriptionOffer[] } | null>(null);
  const [draft, setDraft] = useState<{ key: string; offers: SubscriptionOffer[] } | null>(null);
  const [discovery, setDiscovery] = useState<{ key: string; observed: string; selections: DefinitionAdoptionSelection[] } | null>(null);
  const observed = JSON.stringify(selections);
  if (selections.length > 0 && (discovery?.key !== key || discovery.observed !== observed)) {
    const rows = new Map((discovery?.key === key ? discovery.selections : []).map((row) => [row.addonSelectionId, row]));
    for (const row of selections) rows.set(row.addonSelectionId, row);
    setDiscovery({ key, observed, selections: [...rows.values()] });
  }
  const rememberOffers = (offers: readonly SubscriptionOffer[]) => setDraft((previous) => {
    const rows = new Map((previous?.key === key ? previous.offers : []).map((offer) => [
      offer.sourceKind === "APPLICATION" ? offer.tier.id : offer.addon.id, offer,
    ]));
    for (const offer of offers) rows.set(offer.sourceKind === "APPLICATION" ? offer.tier.id : offer.addon.id, offer);
    return { key, offers: [...rows.values()] };
  });
  useEffect(() => {
    if (!allowed) return;
    const controller = new AbortController();
    // Catalogue names are optional. Failure must not block retained intent recovery.
    void (async () => {
      const offers: SubscriptionOffer[] = [];
      for (let page = 1; page <= 10; page += 1) {
        const result = await readSubscriptionOffers({ page, limit: 100 }, controller.signal);
        if (controller.signal.aborted) return;
        offers.push(...result.items);
        setState({ key, offers: [...offers] });
        if (!result.meta.hasNext) return;
      }
    })().catch(() => { /* Current subscription names and keys remain usable. */ });
    return () => controller.abort();
  }, [allowed, key]);
  return { ...createCommercialLabels(view, [
    ...(state?.key === key ? state.offers : []), ...(draft?.key === key ? draft.offers : []),
  ], [...(discovery?.key === key ? discovery.selections : []), ...selections]), rememberOffers };
}

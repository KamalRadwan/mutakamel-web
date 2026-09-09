"use client";

import { useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { generateUUIDv7 } from "@/lib/uuid";
import { buildCommercialCart, canSelectCommercialOffer, commercialOfferKey, emptyCommercialCart, type CommercialCart } from "../commercial-cart";
import type { CommercialPreparationRequest } from "../commercial-command-request";
import type { SubscriptionOffer } from "../subscription-offers";
import type { SubscriptionView } from "../subscription-read";

interface State { key: string; cart: CommercialCart; review: CommercialPreparationRequest | null; invalid: boolean }
export function useCommercialCart(view: SubscriptionView | null, enabled: boolean, offers: readonly SubscriptionOffer[]) {
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const key = JSON.stringify([user?.id, realtimeAuthGeneration, view?.subscription.id, view?.subscriptionRevision, enabled]);
  const [state, setState] = useState<State | null>(null);
  if (state !== null && state.key !== key) setState(null);
  const current = state?.key === key ? state : null;
  const cart = current?.cart ?? emptyCommercialCart();
  const update = (next: CommercialCart) => { if (enabled && view) setState({ key, cart: next, review: null, invalid: false }); };
  const select = (offer: SubscriptionOffer) => {
    if (!view || !enabled || !offers.includes(offer) || !canSelectCommercialOffer(offer, view)) return;
    const id = commercialOfferKey(offer), previous = cart.offers.find((row) => commercialOfferKey(row.offer) === id);
    const row = { selectionKey: previous?.selectionKey ?? generateUUIDv7(), offer, seats: previous?.seats ?? "" };
    update({ ...cart, offers: [...cart.offers.filter((value) => commercialOfferKey(value.offer) !== id), row] });
  };
  const remove = (selectionKey: string) => update({ ...cart, offers: cart.offers.filter((row) => row.selectionKey !== selectionKey) });
  const quantity = (id: string, seats: string) => {
    if (!view || ![...view.baseItems, ...view.addonSelections].some((row) => row.id === id)) return;
    const selectionKey = cart.quantities[id]?.selectionKey ?? generateUUIDv7();
    update({ ...cart, quantities: { ...cart.quantities, [id]: { selectionKey, seats } } });
  };
  const offerQuantity = (selectionKey: string, seats: string) => update({ ...cart,
    offers: cart.offers.map((row) => row.selectionKey === selectionKey ? { ...row, seats } : row) });
  const reason = (value: string) => update({ ...cart, reason: value });
  const review = () => {
    if (!view || !enabled) return;
    try { setState({ key, cart, review: buildCommercialCart(view, cart), invalid: false }); }
    catch { setState({ key, cart, review: null, invalid: true }); }
  };
  const closeReview = () => { if (current) setState({ ...current, review: null }); };
  return { cart, request: current?.review ?? null, invalid: current?.invalid ?? false, select, remove, quantity, offerQuantity, reason, review, closeReview };
}

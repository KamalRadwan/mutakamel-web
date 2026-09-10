import type { CommercialChange, CommercialPreparationRequest } from "./commercial-command-request";
import { parseTenantCommercialRequest } from "./commercial-intent";
import type { SubscriptionOffer } from "./subscription-offers";
import type { SubscriptionView } from "./subscription-read";

interface CommercialCartRow { selectionKey: string; offer: SubscriptionOffer; seats: string }
interface CommercialSeatEdit { selectionKey: string; seats: string }
export interface CommercialCart { offers: CommercialCartRow[]; quantities: Record<string, CommercialSeatEdit>; reason: string }
export const emptyCommercialCart = (): CommercialCart => ({ offers: [], quantities: {}, reason: "" });
const quantity = (text: string) => {
  if (!/^[1-9][0-9]{0,5}$/u.test(text)) invalid();
  const value = Number(text);
  if (value > 100_000) invalid();
  return value;
};
export function commercialOfferKey(offer: SubscriptionOffer) { return offer.sourceKind === "APPLICATION" ? `APPLICATION:${offer.application.id}` : `ADDON:${offer.addon.id}`; }
export function canSelectCommercialOffer(offer: SubscriptionOffer, view: SubscriptionView): boolean {
  if (!offer.ladders.some((row) => row.billingCycle === view.subscription.billingCycle && row.state === "CONFIGURED")) return false;
  if (offer.sourceKind === "ADDON") return !view.addonSelections.some((row) => row.addonId === offer.addon.id);
  const current = view.baseItems.find((row) => row.applicationId === offer.application.id);
  return !current || (offer.tier.rank >= current.tierRank && offer.tier.id !== current.tierId);
}

/** Only source-bound selections are editable. Published prices are discovery;
 * the prepared server preview remains the sole quote authority. */
export function buildCommercialCart(view: SubscriptionView, cart: CommercialCart): CommercialPreparationRequest {
  const changes: CommercialChange[] = [];
  const parents = new Map(view.baseItems.map((row) => [row.applicationId, { seats: row.seats, tierId: row.tierId, itemId: row.id, selectionKey: null as string | null }]));
  if (new Set(cart.offers.map((row) => commercialOfferKey(row.offer))).size !== cart.offers.length) invalid();
  for (const item of view.baseItems) {
    const edit = cart.quantities[item.id], chosen = cart.offers.find((row) => row.offer.sourceKind === "APPLICATION" && row.offer.application.id === item.applicationId);
    const seats = edit?.seats ? quantity(edit.seats) : item.seats;
    if (seats < item.seats) invalid();
    const offer = chosen?.offer;
    if (offer && (offer.sourceKind !== "APPLICATION" || !canSelectCommercialOffer(offer, view))) invalid();
    const tierId = offer?.sourceKind === "APPLICATION" ? offer.tier.id : item.tierId;
    parents.set(item.applicationId, { seats, tierId, itemId: item.id, selectionKey: null });
    if (seats !== item.seats || tierId !== item.tierId) changes.push({ sourceKind: "APPLICATION", operation: "CHANGE",
      selectionKey: chosen?.selectionKey ?? edit!.selectionKey, itemId: item.id,
      ...(seats !== item.seats ? { seats } : {}), ...(tierId !== item.tierId ? { tierId } : {}) });
  }
  for (const row of cart.offers) {
    const offer = row.offer;
    if (!canSelectCommercialOffer(offer, view)) invalid();
    if (offer.sourceKind !== "APPLICATION" || parents.has(offer.application.id)) continue;
    const seats = quantity(row.seats);
    parents.set(offer.application.id, { seats, tierId: offer.tier.id, itemId: "", selectionKey: row.selectionKey });
    changes.push({ sourceKind: "APPLICATION", operation: "ADD", selectionKey: row.selectionKey, applicationId: offer.application.id, tierId: offer.tier.id, seats });
  }
  for (const item of view.addonSelections) {
    const edit = cart.quantities[item.id], seats = edit?.seats ? quantity(edit.seats) : item.seats;
    const parent = view.baseItems.find((base) => base.id === item.parentItemId);
    if (!parent || seats < item.seats || seats > (parents.get(parent.applicationId)?.seats ?? 0)) invalid();
    if (seats !== item.seats) changes.push({ sourceKind: "ADDON", operation: "CHANGE", selectionKey: edit!.selectionKey, addonSelectionId: item.id, seats });
  }
  for (const row of cart.offers) {
    const offer = row.offer;
    if (offer.sourceKind !== "ADDON") continue;
    const parent = parents.get(offer.application.id), seats = quantity(row.seats);
    if (!parent || seats > parent.seats || (offer.addon.compatibility.mode === "ALLOWLIST" && !offer.addon.compatibility.tierIds.includes(parent.tierId))) invalid();
    changes.push({ sourceKind: "ADDON", operation: "ADD", selectionKey: row.selectionKey, addonId: offer.addon.id,
      targetDefinitionVersionId: offer.addon.definitionVersionId, seats,
      ...(parent.selectionKey ? { parentSelectionKey: parent.selectionKey } : { parentItemId: parent.itemId }) });
  }
  const reason = cart.reason.trim();
  return parseTenantCommercialRequest({ expectedSubscriptionRevision: view.subscriptionRevision, changes, ...(reason ? { reason } : {}) });
}
function invalid(): never { throw new Error("Review the selected tiers, parent Applications and increasing seat quantities."); }

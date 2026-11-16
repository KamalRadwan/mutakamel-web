import type { CommercialChange } from "./commercial-command-request";
import type { DefinitionAdoptionSelection } from "./definition-adoption-discovery";
import type { SubscriptionOffer } from "./subscription-offers";
import type { SubscriptionView } from "./subscription-read";

interface LabelSource {
  sourceKind: "APPLICATION" | "ADDON";
  applicationId?: string | null; itemId?: string | null; tierId?: string | null; toTierId?: string | null;
  addonId?: string | null; addonSelectionId?: string | null; parentItemId?: string | null; parentSelectionKey?: string | null;
}

/** Presentation evidence only; never attach these names to a command or journal. */
export function createCommercialLabels(view: SubscriptionView | null = null, offers: readonly SubscriptionOffer[] = [],
  selections: readonly DefinitionAdoptionSelection[] = []) {
  const applications = new Map<string, string>(), tiers = new Map<string, string>(), addons = new Map<string, string>();
  const items = new Map<string, { applicationId: string; tierId: string }>();
  const addonSelections = new Map<string, { addonId: string; applicationId: string }>();
  for (const row of view?.baseItems ?? []) {
    applications.set(row.applicationId, row.applicationName ?? row.applicationKey);
    applications.set(row.applicationKey, row.applicationName ?? row.applicationKey);
    tiers.set(row.tierId, row.tierName ?? row.tierKey);
    items.set(row.id, row);
  }
  for (const row of view?.addonSelections ?? []) {
    addons.set(row.addonId, row.addonKey);
    const parent = items.get(row.parentItemId);
    if (parent) addonSelections.set(row.id, { addonId: row.addonId, applicationId: parent.applicationId });
  }
  for (const row of selections) {
    applications.set(row.applicationKey, row.applicationKey);
    addons.set(row.addonKey, row.addonKey);
    addonSelections.set(row.addonSelectionId, { addonId: row.addonKey, applicationId: row.applicationKey });
  }
  for (const offer of offers) {
    applications.set(offer.application.id, offer.application.name);
    applications.set(offer.application.key, offer.application.name);
    if (offer.sourceKind === "APPLICATION") tiers.set(offer.tier.id, offer.tier.name);
    else { addons.set(offer.addon.id, offer.addon.name); addons.set(offer.addon.key, offer.addon.name); }
  }
  return { applications, tiers, addons, items, addonSelections };
}

export type CommercialLabels = ReturnType<typeof createCommercialLabels>;

export function withCommercialOffers(labels: CommercialLabels, offers: readonly SubscriptionOffer[]): CommercialLabels {
  const published = createCommercialLabels(null, offers);
  return { ...labels,
    applications: new Map([...labels.applications, ...published.applications]),
    tiers: new Map([...labels.tiers, ...published.tiers]),
    addons: new Map([...labels.addons, ...published.addons]),
  };
}

export function commercialLabel(labels: CommercialLabels, row: LabelSource, fallback: string,
  changes: readonly CommercialChange[] = []): string {
  const item = labels.items.get(row.itemId ?? row.parentItemId ?? "");
  const selection = labels.addonSelections.get(row.addonSelectionId ?? "");
  const parent = changes.find((change) => change.selectionKey === row.parentSelectionKey);
  const applicationId = row.applicationId ?? item?.applicationId ?? selection?.applicationId
    ?? (parent && "applicationId" in parent ? parent.applicationId : undefined);
  const application = labels.applications.get(applicationId ?? "") ?? labels.applications.get(selection?.applicationId ?? "");
  const detail = row.sourceKind === "APPLICATION"
    ? labels.tiers.get(row.toTierId ?? row.tierId ?? item?.tierId ?? "")
    : labels.addons.get(row.addonId ?? "") ?? labels.addons.get(selection?.addonId ?? "");
  return [application, detail].filter(Boolean).join(" · ") || fallback;
}

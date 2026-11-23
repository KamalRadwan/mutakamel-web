import {
  BillingCycle,
  OfferLadder,
  OfferStatus,
  SubscriptionBaseItem,
  SubscriptionOffer,
  SubscriptionView,
} from '../billing.model';
import { BillingBadge, offerStatusBadge } from '../shared/billing-badges';
import { CatalogueNames } from '../shared/catalogue-names';
import { changeLink } from '../shared/change-link';
import { formatUnitPrice } from '../shared/money';
import { BillingApi } from '../billing.api';

export class CatalogueTooLargeError extends Error {}

export async function loadAllCatalogue(api: BillingApi): Promise<SubscriptionOffer[]> {
  const offers: SubscriptionOffer[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const result = await api.listCatalogue({ page, limit: 100 });
    offers.push(...result.data);
    if (!result.meta.hasNext) return offers;
  }
  throw new CatalogueTooLargeError();
}

export interface AppVisual {
  readonly icon: string;
  readonly tile: string;
}

export interface RouteLink {
  readonly path: string;
  readonly queryParams: { readonly add: string };
}

export interface PriceLadderTarget {
  readonly appName: string;
  readonly itemName: string;
  readonly icon: string;
  readonly tile: string;
  readonly ladders: readonly OfferLadder[];
  readonly defaultCycle: BillingCycle;
}

export type TierActionKind = 'current' | 'upgrade' | 'add' | 'lower' | 'none';

export interface CatalogueTierItem {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly rank: number;
  readonly status: OfferStatus;
  readonly current: boolean;
  readonly fromPrice: string | null;
  readonly priceNotSet: boolean;
  readonly actionKind: TierActionKind;
  readonly actionLink: RouteLink | null;
  readonly priceTarget: PriceLadderTarget;
}

export type AddonActionKind = 'subscribed' | 'add' | 'none';

export interface CatalogueAddonItem {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly definitionVersionId: string;
  readonly status: OfferStatus;
  readonly statusBadge: BillingBadge;
  readonly subscribed: boolean;
  readonly fromPrice: string | null;
  readonly priceNotSet: boolean;
  readonly actionKind: AddonActionKind;
  readonly actionLink: RouteLink | null;
  readonly priceTarget: PriceLadderTarget;
}

export interface CatalogueAppGroup {
  readonly application: { readonly id: string; readonly key: string; readonly name: string };
  readonly visual: AppVisual;
  readonly subscribed: boolean;
  readonly baseItem: SubscriptionBaseItem | null;
  readonly tiers: readonly CatalogueTierItem[];
  readonly addons: readonly CatalogueAddonItem[];
}

const APP_VISUALS: Readonly<Record<string, AppVisual>> = {
  crm: { icon: 'tablerUsers', tile: 'bg-icon-blue' },
  trade: { icon: 'tablerBox', tile: 'bg-icon-orange' },
  accounting: { icon: 'tablerCalculator', tile: 'bg-icon-gray' },
  hr: { icon: 'tablerId', tile: 'bg-icon-violet' },
};

const DEFAULT_APP_VISUAL: AppVisual = { icon: 'tablerApps', tile: 'bg-icon-teal' };

type ApplicationOffer = Extract<SubscriptionOffer, { sourceKind: 'APPLICATION' }>;
type AddonOffer = Extract<SubscriptionOffer, { sourceKind: 'ADDON' }>;

interface ApplicationBucket {
  readonly application: { readonly id: string; readonly key: string; readonly name: string };
  readonly tierOffers: ApplicationOffer[];
  readonly addonOffers: AddonOffer[];
}

export function appVisual(applicationKey: string): AppVisual {
  const normalized = applicationKey.trim().toLowerCase();
  return APP_VISUALS[normalized] ?? DEFAULT_APP_VISUAL;
}

export function findLadder(ladders: readonly OfferLadder[], cycle: BillingCycle): OfferLadder | null {
  return ladders.find((ladder) => ladder.billingCycle === cycle) ?? null;
}

export function isLadderConfigured(ladder: OfferLadder | null): ladder is OfferLadder {
  return ladder !== null && ladder.state === 'CONFIGURED' && ladder.brackets.length > 0;
}

export function fromUnitPrice(ladders: readonly OfferLadder[], cycle: BillingCycle): string | null {
  const ladder = findLadder(ladders, cycle);
  if (!isLadderConfigured(ladder)) return null;
  return formatUnitPrice(ladder.brackets[0].unitPrice);
}

export function groupCatalogueOffers(
  offers: readonly SubscriptionOffer[],
  subscription: SubscriptionView | null,
): CatalogueAppGroup[] {
  const cycle = subscription?.subscription.billingCycle ?? 'MONTHLY';
  const baseByAppId = new Map(subscription?.baseItems.map((item) => [item.applicationId, item]) ?? []);
  const subscribedAddonIds = new Set(subscription?.addonSelections.map((sel) => sel.addonId) ?? []);
  const buckets = new Map<string, ApplicationBucket>();

  for (const offer of offers) {
    let bucket = buckets.get(offer.application.id);
    if (!bucket) {
      bucket = {
        application: {
          id: offer.application.id,
          key: offer.application.key,
          name: offer.application.name,
        },
        tierOffers: [],
        addonOffers: [],
      };
      buckets.set(offer.application.id, bucket);
    }
    if (offer.sourceKind === 'APPLICATION') {
      bucket.tierOffers.push(offer);
    } else {
      bucket.addonOffers.push(offer);
    }
  }

  const groups: CatalogueAppGroup[] = [];
  for (const bucket of buckets.values()) {
    const visual = appVisual(bucket.application.key);
    const baseItem = baseByAppId.get(bucket.application.id) ?? null;
    const sortedTierOffers = bucket.tierOffers.slice().sort((a, b) => a.tier.rank - b.tier.rank);

    const tiers = sortedTierOffers.map((offer) =>
      buildTierItem(offer, bucket.application, visual, baseItem, cycle),
    );
    const addons = bucket.addonOffers.map((offer) =>
      buildAddonItem(
        offer,
        bucket.application,
        visual,
        baseItem,
        subscribedAddonIds,
        cycle,
      ),
    );

    groups.push({
      application: bucket.application,
      visual,
      subscribed: baseItem !== null,
      baseItem,
      tiers,
      addons,
    });
  }

  return groups;
}

/** Replaces the API (English) names with their localized names for display. */
export function localizeCatalogueGroups(
  groups: readonly CatalogueAppGroup[],
  names: CatalogueNames,
): CatalogueAppGroup[] {
  return groups.map((group) => {
    const appName = names.app(group.application.key, group.application.name);
    return {
      ...group,
      application: { ...group.application, name: appName },
      tiers: group.tiers.map((tier) => {
        const name = names.tier(tier.key, tier.name);
        return { ...tier, name, priceTarget: { ...tier.priceTarget, appName, itemName: name } };
      }),
      addons: group.addons.map((addon) => {
        const name = names.addon(addon.key, addon.name);
        return { ...addon, name, priceTarget: { ...addon.priceTarget, appName, itemName: name } };
      }),
    };
  });
}

export function filterAppGroups(
  groups: readonly CatalogueAppGroup[],
  appKey: string,
): readonly CatalogueAppGroup[] {
  return appKey ? groups.filter((group) => group.application.key === appKey) : groups;
}

function buildTierItem(
  offer: ApplicationOffer,
  application: { readonly id: string; readonly name: string },
  visual: AppVisual,
  baseItem: SubscriptionBaseItem | null,
  cycle: BillingCycle,
): CatalogueTierItem {
  const current = baseItem !== null && baseItem.tierId === offer.tier.id;
  const fromPrice = fromUnitPrice(offer.ladders, cycle);
  const priceNotSet = isPriceNotSet(offer, cycle);
  const canPurchase = fromPrice !== null && !priceNotSet && offer.status === 'PREPARATION_REQUIRED';

  let actionKind: TierActionKind = 'none';
  let actionLink: RouteLink | null = null;

  if (current) {
    actionKind = 'current';
  } else if (baseItem !== null) {
    if (offer.tier.rank > baseItem.tierRank) {
      if (canPurchase) {
        actionKind = 'upgrade';
        actionLink = changeLink({ kind: 'tier', itemId: baseItem.id, tierId: offer.tier.id });
      }
    } else if (offer.tier.rank < baseItem.tierRank) {
      actionKind = 'lower';
    }
  } else if (canPurchase) {
    actionKind = 'add';
    actionLink = changeLink({
      kind: 'app',
      applicationId: application.id,
      tierId: offer.tier.id,
    });
  }

  return {
    id: offer.tier.id,
    key: offer.tier.key,
    name: offer.tier.name,
    rank: offer.tier.rank,
    status: offer.status,
    current,
    fromPrice,
    priceNotSet,
    actionKind,
    actionLink,
    priceTarget: {
      appName: application.name,
      itemName: offer.tier.name,
      icon: visual.icon,
      tile: visual.tile,
      ladders: offer.ladders,
      defaultCycle: cycle,
    },
  };
}

function buildAddonItem(
  offer: AddonOffer,
  application: { readonly name: string },
  visual: AppVisual,
  baseItem: SubscriptionBaseItem | null,
  subscribedAddonIds: ReadonlySet<string>,
  cycle: BillingCycle,
): CatalogueAddonItem {
  const isSubscribed = subscribedAddonIds.has(offer.addon.id);
  const fromPrice = fromUnitPrice(offer.ladders, cycle);
  const priceNotSet = isPriceNotSet(offer, cycle);
  const statusBadge = offerStatusBadge(offer.status);

  let actionKind: AddonActionKind = 'none';
  let actionLink: RouteLink | null = null;

  if (isSubscribed) {
    actionKind = 'subscribed';
  } else if (
    offer.status === 'PREPARATION_REQUIRED' &&
    baseItem !== null &&
    fromPrice !== null && !priceNotSet
  ) {
    actionKind = 'add';
    actionLink = changeLink({
      kind: 'addon',
      addonId: offer.addon.id,
      definitionVersionId: offer.addon.definitionVersionId,
      parentItemId: baseItem.id,
    });
  }

  return {
    id: offer.addon.id,
    key: offer.addon.key,
    name: offer.addon.name,
    definitionVersionId: offer.addon.definitionVersionId,
    status: offer.status,
    statusBadge,
    subscribed: isSubscribed,
    fromPrice,
    priceNotSet,
    actionKind,
    actionLink,
    priceTarget: {
      appName: application.name,
      itemName: offer.addon.name,
      icon: visual.icon,
      tile: visual.tile,
      ladders: offer.ladders,
      defaultCycle: cycle,
    },
  };
}

function isPriceNotSet(offer: SubscriptionOffer, cycle: BillingCycle): boolean {
  const ladder = findLadder(offer.ladders, cycle);
  return offer.status === 'UNAVAILABLE' ||
    ['PRICE_UNAVAILABLE', 'PRICE_NOT_CONFIGURED'].includes(offer.safeReasonCode) ||
    ladder?.safeReasonCode === 'PRICE_UNAVAILABLE' || ladder?.safeReasonCode === 'PRICE_NOT_CONFIGURED' ||
    !isLadderConfigured(ladder);
}

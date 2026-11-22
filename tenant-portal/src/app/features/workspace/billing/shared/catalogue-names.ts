import { SubscriptionOffer, SubscriptionView } from '../billing.model';

/**
 * Localized display names for catalogue items (applications, plans, add-ons) and currencies.
 * The API sends English names; the UI shows the translation from i18n when one exists and falls
 * back to the API name, then to the key. Application names reuse the navigation keys
 * (`nav.apps.<key>`); plans, add-ons and currencies live under `bill.names` (ws-billing scope),
 * so callers must have that scope loaded. Currency codes are never translated.
 */
export interface Translator {
  translate(key: string, params?: Record<string, unknown>): string;
}

export interface CatalogueNames {
  app(appKey: string, fallback?: string | null): string;
  tier(tierKey: string, fallback?: string | null): string;
  addon(addonKey: string, fallback?: string | null): string;
  /** "USD - US dollar" when a name exists, otherwise the bare code. */
  currencyLabel(code: string): string;
}

function lookup(t: Translator, key: string): string | null {
  const value: unknown = t.translate(key);
  return typeof value === 'string' && value !== '' && value !== key ? value : null;
}

export function catalogueNames(t: Translator): CatalogueNames {
  return {
    app: (appKey, fallback) =>
      lookup(t, `nav.apps.${appKey}`) ?? lookup(t, `bill.names.apps.${appKey}`) ?? fallback ?? appKey,
    tier: (tierKey, fallback) => lookup(t, `bill.names.tiers.${tierKey}`) ?? fallback ?? tierKey,
    addon: (addonKey, fallback) => lookup(t, `bill.names.addons.${addonKey}`) ?? fallback ?? addonKey,
    currencyLabel: (code) => {
      const name = lookup(t, `bill.names.currencies.${code}`);
      return name ? `${code} - ${name}` : code;
    },
  };
}

/** Offers with localized application, plan and add-on names (display copy; ids and keys unchanged). */
export function localizeOffers(offers: readonly SubscriptionOffer[], names: CatalogueNames): SubscriptionOffer[] {
  return offers.map((offer) => {
    const application = { ...offer.application, name: names.app(offer.application.key, offer.application.name) };
    return offer.sourceKind === 'APPLICATION'
      ? { ...offer, application, tier: { ...offer.tier, name: names.tier(offer.tier.key, offer.tier.name) } }
      : { ...offer, application, addon: { ...offer.addon, name: names.addon(offer.addon.key, offer.addon.name) } };
  });
}

/** A subscription whose base items carry localized application and plan names (display copy). */
export function localizeSubscription(view: SubscriptionView, names: CatalogueNames): SubscriptionView {
  return {
    ...view,
    baseItems: view.baseItems.map((item) => ({
      ...item,
      applicationName: names.app(item.applicationKey, item.applicationName),
      tierName: names.tier(item.tierKey, item.tierName),
    })),
  };
}

import type { PriceEntry, PricingReferenceItem } from "./pricing-contract";

/** Version detail enriches raw profile cost without its currency; references supply that currency. */
export function resolveCatalogCost(
  canViewCost: boolean | undefined,
  entry: Pick<PriceEntry, "standardCost"> | undefined,
  item: Pick<PricingReferenceItem, "currencyCode" | "standardCost"> | undefined,
): { amount: string; currencyCode: string } | null {
  if (canViewCost !== true || !item?.currencyCode) return null;
  const amount = entry?.standardCost ?? item.standardCost;
  return amount == null ? null : { amount, currencyCode: item.currencyCode };
}

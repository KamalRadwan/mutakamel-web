import { z } from "zod";

// Core admin/subscriptions/addons/commercial-pricing-evidence.ts.
export const commercialReadUuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
export const commercialReadMoney = z.string().regex(/^(?:0|[1-9][0-9]{0,13})\.[0-9]{4}$/u);
const integer = z.number().int().min(1).max(2_147_483_647);
const common = { billingCycle: z.enum(["MONTHLY", "ANNUAL"]), currencyCode: z.literal("USD"), recurringAmountUsd: commercialReadMoney };
export const acceptedPricingSchema = z.object({ ...common, priceRevision: z.string().max(64), breakdown: z.array(z.object({
    minUsers: integer, maxUsers: integer.nullable(), chargedUsers: integer,
    unitPriceUsd: commercialReadMoney, amountUsd: commercialReadMoney,
  }).strict()).min(1).max(100) }).strict();
export type AcceptedPricing = z.infer<typeof acceptedPricingSchema>;

export function acceptedPricingConsistent(price: AcceptedPricing, seats: number, addon: boolean): boolean {
  if (!commercialReadMoney.safeParse(price.recurringAmountUsd).success) return false;
  // Accepted Addon price revisions use the owner's UUID grammar, not a new intent's v7 grammar.
  const pattern = addon ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u : /^[0-9a-f]{64}$/u;
  if (!pattern.test(price.priceRevision)) return false;
  let charged = 0;
  let sum = BigInt(0);
  for (const row of price.breakdown) {
    if (!commercialReadMoney.safeParse(row.amountUsd).success || !commercialReadMoney.safeParse(row.unitPriceUsd).success
      || row.minUsers !== charged + 1 || (row.maxUsers !== null && row.maxUsers < row.minUsers)
      || row.chargedUsers !== Math.min(seats, row.maxUsers ?? seats) - row.minUsers + 1
      || moneyUnits(row.amountUsd) !== moneyUnits(row.unitPriceUsd) * BigInt(row.chargedUsers)) return false;
    charged += row.chargedUsers;
    sum += moneyUnits(row.amountUsd);
  }
  return charged === seats && sum === moneyUnits(price.recurringAmountUsd);
}

/** Consistency check only: displayed amounts always remain the server's original strings. */
export function moneyUnits(value: string): bigint { return BigInt(value.replace(".", "")); }

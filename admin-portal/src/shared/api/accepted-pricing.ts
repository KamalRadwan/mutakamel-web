import { array, contractFailure, integer, nullable, object, oneOf, text, uuid } from "./commercial-contract";

export const acceptedMoney = text(19, /^(?:0|[1-9][0-9]{0,13})\.[0-9]{4}$/u);
export const acceptedAmountUnits = (value: string) => BigInt(value.replace(".", ""));
export const readAcceptedPricing = object({
  billingCycle: oneOf(["MONTHLY", "ANNUAL"]), currencyCode: oneOf(["USD"]), recurringAmountUsd: acceptedMoney,
  priceRevision: text(64),
  breakdown: array(object({ minUsers: integer(1, 2147483647), maxUsers: nullable(integer(1, 2147483647)),
    chargedUsers: integer(1, 100000), unitPriceUsd: acceptedMoney, amountUsd: acceptedMoney })),
});
export type AcceptedPricing = ReturnType<typeof readAcceptedPricing>;

/** Verify retained arithmetic only; this never prices against today's catalogue. */
export function verifyAcceptedPricing(value: AcceptedPricing, seats: number, kind: "APPLICATION" | "ADDON", billingCycle: string) {
  if (value.billingCycle !== billingCycle) contractFailure();
  if (kind === "APPLICATION") text(64, /^[0-9a-f]{64}$/u)(value.priceRevision); else uuid(value.priceRevision);
  if (!value.breakdown.length) contractFailure();
  let charged = 0; let amount = BigInt(0);
  for (const bracket of value.breakdown) {
    if (bracket.minUsers !== charged + 1 || (bracket.maxUsers !== null && bracket.maxUsers < bracket.minUsers)
      || bracket.chargedUsers !== Math.min(seats, bracket.maxUsers ?? seats) - bracket.minUsers + 1
      || BigInt(bracket.chargedUsers) * acceptedAmountUnits(bracket.unitPriceUsd) !== acceptedAmountUnits(bracket.amountUsd)) contractFailure();
    charged += bracket.chargedUsers; amount += acceptedAmountUnits(bracket.amountUsd);
  }
  if (charged !== seats || amount !== acceptedAmountUnits(value.recurringAmountUsd)) contractFailure();
}

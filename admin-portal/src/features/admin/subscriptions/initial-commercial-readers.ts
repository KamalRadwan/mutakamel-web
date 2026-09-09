import type { AxiosResponse } from "@/lib/api/axiosClient";
import { acceptedAmountUnits as units, acceptedMoney as money, readAcceptedPricing, verifyAcceptedPricing } from "@/shared/api/accepted-pricing";
import { array, contractFailure, date, integer, nullable, object, oneOf, readCommercialResponse, uuid, uuid7 } from "@/shared/api/commercial-contract";

export const INITIAL_QUOTE_RESPONSE_MAX_BYTES = 4 * 1024 * 1024;
export const INITIAL_SEED_RESPONSE_MAX_BYTES = 256 * 1024;
const cycle = oneOf(["MONTHLY", "ANNUAL"]);
const seats = integer(1, 100000);
const trialDays = integer(1, 365);
const instant = (value: unknown) => {
  const parsed = date(value);
  if (new Date(parsed).toISOString() !== parsed) contractFailure();
  return parsed;
};
const totals = object({ baseRecurringUsd: money, addonRecurringUsd: money, combinedRecurringUsd: money });
const pricedChild = object({ selectionKey: uuid7, addonId: uuid7, definitionVersionId: uuid7, seats, acceptedPricing: readAcceptedPricing });
const pricedApplication = object({ selectionKey: uuid7, applicationId: uuid, tierId: uuid, seats, acceptedPricing: readAcceptedPricing, addons: array(pricedChild) });
const quote = object({ quoteId: uuid7, purpose: oneOf(["TENANT_CREATION", "INITIAL_SEED"]), targetTenantId: nullable(uuid),
  billingCycle: cycle, currencyCode: oneOf(["USD"]), resolvedTrialDays: trialDays, items: array(pricedApplication), totals, createdAt: instant, expiresAt: instant });
export type InitialQuoteView = ReturnType<typeof quote>;
const childMapping = object({ selectionKey: uuid7, addonSelectionId: uuid7, addonId: uuid7, definitionVersionId: uuid7 });
const applicationMapping = object({ selectionKey: uuid7, itemId: uuid7, applicationId: uuid, addons: array(childMapping) });
const seedReceipt = object({ commandId: uuid7, tenantId: uuid, subscriptionId: uuid7, quoteId: uuid7,
  subscriptionRevision: oneOf(["1"]), status: oneOf(["TRIAL"]), billingCycle: cycle, currencyCode: oneOf(["USD"]), trialDays,
  trialStartedAt: instant, trialEndsAt: instant, totals, selections: array(applicationMapping), createdAt: instant });
export type OriginalInitialSeedReceipt = ReturnType<typeof seedReceipt>;
const unique = (values: string[]) => { if (new Set(values).size !== values.length) contractFailure(); };
const encodedBytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;

/** Public expiring price evidence, not purchase, readiness or a private quote pin. */
export function readInitialQuote(value: unknown): InitialQuoteView {
  const result = quote(value);
  if (!result.items.length || (result.purpose === "TENANT_CREATION"
    ? result.targetTenantId !== null || result.items.length > 50 : result.targetTenantId === null)
    || Date.parse(result.expiresAt) - Date.parse(result.createdAt) !== 15 * 60_000) contractFailure();
  const children = result.items.flatMap(item => item.addons);
  if (children.length > 100) contractFailure();
  unique([...result.items, ...children].map(item => item.selectionKey));
  unique(result.items.map(item => item.applicationId)); unique(children.map(item => item.addonId));
  let base = BigInt(0); let addons = BigInt(0);
  for (const item of result.items) {
    verifyAcceptedPricing(item.acceptedPricing, item.seats, "APPLICATION", result.billingCycle);
    base += units(item.acceptedPricing.recurringAmountUsd);
    for (const child of item.addons) {
      if (child.seats > item.seats) contractFailure();
      verifyAcceptedPricing(child.acceptedPricing, child.seats, "ADDON", result.billingCycle);
      addons += units(child.acceptedPricing.recurringAmountUsd);
    }
  }
  if (base !== units(result.totals.baseRecurringUsd) || addons !== units(result.totals.addonRecurringUsd)
    || base + addons !== units(result.totals.combinedRecurringUsd)
    || encodedBytes(result) > INITIAL_QUOTE_RESPONSE_MAX_BYTES - 1024) contractFailure();
  return result;
}

/** Immutable ORIGINAL result only. Never use this as a current subscription view. */
export function readOriginalInitialSeedReceipt(value: unknown): OriginalInitialSeedReceipt {
  const result = seedReceipt(value);
  if (Date.parse(result.trialEndsAt) - Date.parse(result.trialStartedAt) !== result.trialDays * 86_400_000
    || units(result.totals.baseRecurringUsd) + units(result.totals.addonRecurringUsd) !== units(result.totals.combinedRecurringUsd)
    || !result.selections.length) contractFailure();
  const children = result.selections.flatMap(item => item.addons);
  if (children.length > 100) contractFailure();
  const keys = [...result.selections, ...children].map(item => item.selectionKey);
  const ids = [...result.selections.map(item => item.itemId), ...children.map(item => item.addonSelectionId)];
  unique(keys); unique(ids); unique(result.selections.map(item => item.applicationId)); unique(children.map(item => item.addonId));
  const generated = new Set(ids);
  if (keys.some(key => generated.has(key)) || encodedBytes(result) > INITIAL_SEED_RESPONSE_MAX_BYTES - 1024) contractFailure();
  return result;
}

export type InitialQuoteScope = { purpose: "TENANT_CREATION"; targetTenantId: null } | { purpose: "INITIAL_SEED"; targetTenantId: string };

/** Closed response adapters with explicit purpose and target ownership. */
export function readInitialQuoteResponse(response: AxiosResponse<unknown>, scope: InitialQuoteScope): InitialQuoteView {
  return readCommercialResponse(response, value => {
    const parsed = readInitialQuote(value);
    if (parsed.purpose !== scope.purpose || parsed.targetTenantId !== scope.targetTenantId) contractFailure();
    return parsed;
  }, false, INITIAL_QUOTE_RESPONSE_MAX_BYTES);
}
export function readInitialSeedResponse(response: AxiosResponse<unknown>, scope: { tenantId: string; quoteId: string }): OriginalInitialSeedReceipt {
  return readCommercialResponse(response, value => {
    const parsed = readOriginalInitialSeedReceipt(value);
    if (parsed.tenantId !== scope.tenantId || parsed.quoteId !== scope.quoteId) contractFailure();
    return parsed;
  }, false, INITIAL_SEED_RESPONSE_MAX_BYTES);
}

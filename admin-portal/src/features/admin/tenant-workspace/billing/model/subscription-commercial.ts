import { array, contractFailure, date, integer, nullable, object, oneOf, positiveRevision, text, uuid, type Reader } from "@/shared/api/commercial-contract";
import type { SubscriptionView } from "../types";
import { readAcceptedPricing as pricing, verifyAcceptedPricing as verifyPricing } from "@/shared/api/accepted-pricing";
export type { AcceptedPricing } from "@/shared/api/accepted-pricing";
const money = text(19, /^(?:0|[1-9][0-9]{0,13})\.[0-9]{4}$/u);
const cycle = oneOf(["MONTHLY", "ANNUAL"]);
const key = text(64, /^[a-z][a-z0-9_]{0,63}$/u);
const lifecycle = nullable(oneOf(["DRAFT", "ACTIVE", "DEPRECATED", "DISABLED"]));
const amountUnits = (value: string) => BigInt(value.replace(".", ""));
const header = object({ id: uuid, tenantId: uuid, allowedUsers: integer(1, 2147483647), status: oneOf(["TRIAL", "PENDING_ACTIVATION", "ACTIVE", "PAST_DUE", "CANCELLED"]),
  billingCycle: cycle, currencyCode: oneOf(["USD"]), startedAt: date, currentPeriodStart: nullable(date), currentPeriodEnd: date,
  pendingPeriodStart: nullable(date), pendingPeriodEnd: nullable(date), trialDays: integer(1, 365), trialStartedAt: nullable(date), trialEndsAt: nullable(date),
  activationScheduledAt: nullable(date), activatedAt: nullable(date), cancelAt: nullable(date), totalPrice: nullable(money), createdAt: date, updatedAt: date, currentCollectionInvoiceId: nullable(uuid) });
const baseItem = object({ id: uuid, applicationId: uuid, applicationKey: key, applicationName: nullable(text(255, /\S/u)), tierId: uuid,
  tierKey: key, tierName: nullable(text(255, /\S/u)), tierRank: integer(-2147483648, 2147483647), seats: integer(1, 100000), acceptedPricing: pricing });
const addonSelection = object({ id: uuid, parentItemId: uuid, addonId: uuid, addonKey: text(65, /^[a-z][a-z0-9_]{0,31}\.[a-z][a-z0-9_]{0,31}$/u),
  definitionVersionId: uuid, seats: integer(1, 100000), acceptedPricing: pricing, effectiveState: object({ applicationLifecycleStatus: lifecycle, addonLifecycleStatus: lifecycle,
    definitionState: oneOf(["PUBLISHED", "REVOKED", "UNAVAILABLE"]), operationalUse: oneOf(["NOT_EVALUATED"]) }) });
const itemsFields = { subscriptionId: uuid, subscriptionRevision: positiveRevision, baseItems: array(baseItem), addonSelections: array(addonSelection) };
export const readSubscriptionItems = object(itemsFields);
const view = object({ subscription: header, subscriptionRevision: positiveRevision, baseItems: array(baseItem), addonSelections: array(addonSelection),
  baseAllowance: object({ allowedUsers: integer(1, 2147483647), effectiveAllowedUsers: integer(1, 10000000), enabledApplications: array(key) }),
  totals: object({ baseRecurringUsd: money, addonRecurringUsd: money, combinedRecurringUsd: money }),
  projection: object({ observation: oneOf(["NOT_OBSERVED"]), state: oneOf([null]), safeReasonCode: oneOf(["TENANT_PROJECTION_NOT_OBSERVED"]) }) });
export type SubscriptionCommercial = ReturnType<typeof view>;
const unique = (values: string[]) => { if (new Set(values).size !== values.length) contractFailure(); };
export const readSubscriptionCommercial: Reader<SubscriptionCommercial> = value => {
  const result = view(value); const { subscription, baseItems, addonSelections, baseAllowance, totals } = result;
  if (!baseItems.length) contractFailure();
  if ((subscription.currentPeriodStart !== null && Date.parse(subscription.currentPeriodEnd) <= Date.parse(subscription.currentPeriodStart))
    || (subscription.pendingPeriodStart === null) !== (subscription.pendingPeriodEnd === null)
    || (subscription.pendingPeriodStart !== null && Date.parse(subscription.pendingPeriodEnd!) <= Date.parse(subscription.pendingPeriodStart))
    || Date.parse(subscription.updatedAt) < Date.parse(subscription.createdAt)) contractFailure();
  unique(baseItems.map(item => item.id)); unique(baseItems.map(item => item.applicationId)); unique(baseItems.map(item => item.applicationKey));
  unique(addonSelections.map(item => item.id)); unique(addonSelections.map(item => item.addonId));
  baseItems.forEach(item => verifyPricing(item.acceptedPricing, item.seats, "APPLICATION", subscription.billingCycle));
  addonSelections.forEach(item => {
    const parent = baseItems.find(base => base.id === item.parentItemId);
    if (!parent || item.seats > parent.seats || !item.addonKey.startsWith(`${parent.applicationKey}.`) || baseItems.some(base => base.id === item.id)) contractFailure();
    verifyPricing(item.acceptedPricing, item.seats, "ADDON", subscription.billingCycle);
  });
  if (baseAllowance.allowedUsers !== subscription.allowedUsers || baseAllowance.effectiveAllowedUsers !== baseItems.reduce((sum, item) => sum + item.seats, 0)
    || JSON.stringify([...baseAllowance.enabledApplications].sort()) !== JSON.stringify(baseItems.map(item => item.applicationKey).sort())) contractFailure();
  const baseTotal = baseItems.reduce((sum, item) => sum + amountUnits(item.acceptedPricing.recurringAmountUsd), BigInt(0));
  const addonTotal = addonSelections.reduce((sum, item) => sum + amountUnits(item.acceptedPricing.recurringAmountUsd), BigInt(0));
  if (amountUnits(totals.baseRecurringUsd) !== baseTotal || amountUnits(totals.addonRecurringUsd) !== addonTotal
    || amountUnits(totals.combinedRecurringUsd) !== baseTotal + addonTotal || (subscription.totalPrice !== null && amountUnits(subscription.totalPrice) !== baseTotal + addonTotal)) contractFailure();
  return result;
};
/** Display model keeps base capacity separate from complete commercial evidence. */
export function adaptSubscriptionCommercial(value: SubscriptionCommercial): SubscriptionView {
  return { subscription: value.subscription, effectiveAllowedUsers: value.baseAllowance.effectiveAllowedUsers,
    enabledModules: value.baseAllowance.enabledApplications.map(key => `module.${key}`), commercial: value,
    items: value.baseItems.map(item => ({ id: item.id, subscriptionId: value.subscription.id, moduleId: item.applicationId, tierId: item.tierId, seats: item.seats,
      lineTotal: item.acceptedPricing.recurringAmountUsd, features: null, moduleKey: item.applicationKey, moduleName: item.applicationName ?? undefined,
      tierKey: item.tierKey, tierName: item.tierName ?? undefined, currencyCode: "USD" })) };
}

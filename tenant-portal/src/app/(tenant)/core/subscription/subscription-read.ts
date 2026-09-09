import { z } from "zod";
import { readCoreResponse } from "@/lib/api/envelope";
import { acceptedPricingConsistent, acceptedPricingSchema, commercialReadMoney as money, commercialReadUuid as uuid, moneyUnits } from "./subscription-pricing";

const timestamp = z.iso.datetime().max(30);
const count = z.number().int().min(1).max(2_147_483_647);
const seats = z.number().int().min(1).max(100_000);
const key = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/u);
const name = z.string().max(255).refine((value) => value.trim().length > 0).nullable();
const revision = z.string().regex(/^[1-9][0-9]{0,18}$/u)
  .refine((value) => /^[1-9][0-9]{0,18}$/u.test(value) && BigInt(value) <= BigInt("9223372036854775807"));
const lifecycle = z.enum(["DRAFT", "ACTIVE", "DEPRECATED", "DISABLED"]).nullable();
const baseItem = z.object({
  id: uuid, applicationId: uuid, applicationKey: key, applicationName: name,
  tierId: uuid, tierKey: key, tierName: name, tierRank: z.number().int().min(-2_147_483_648).max(2_147_483_647), seats, acceptedPricing: acceptedPricingSchema,
}).strict().refine((item) => acceptedPricingConsistent(item.acceptedPricing, item.seats, false));
const addonSelection = z.object({
  id: uuid, parentItemId: uuid, addonId: uuid,
  addonKey: z.string().regex(/^[a-z][a-z0-9_]{0,31}\.[a-z][a-z0-9_]{0,31}$/u),
  definitionVersionId: uuid, seats, acceptedPricing: acceptedPricingSchema,
  effectiveState: z.object({ applicationLifecycleStatus: lifecycle, addonLifecycleStatus: lifecycle,
    definitionState: z.enum(["PUBLISHED", "REVOKED", "UNAVAILABLE"]), operationalUse: z.literal("NOT_EVALUATED") }).strict(),
}).strict().refine((item) => acceptedPricingConsistent(item.acceptedPricing, item.seats, true));
const collections = { baseItems: z.array(baseItem).min(1).max(100), addonSelections: z.array(addonSelection).max(100) };
const header = z.object({
  id: uuid, tenantId: uuid, allowedUsers: count, status: z.enum(["PENDING_ACTIVATION", "TRIAL", "ACTIVE", "PAST_DUE", "CANCELLED"]),
  billingCycle: z.enum(["MONTHLY", "ANNUAL"]), currencyCode: z.literal("USD"), startedAt: timestamp,
  currentPeriodStart: timestamp.nullable(), currentPeriodEnd: timestamp, pendingPeriodStart: timestamp.nullable(), pendingPeriodEnd: timestamp.nullable(),
  trialDays: z.number().int().min(1).max(365), trialStartedAt: timestamp.nullable(), trialEndsAt: timestamp.nullable(),
  activationScheduledAt: timestamp.nullable(), activatedAt: timestamp.nullable(), cancelAt: timestamp.nullable(),
  totalPrice: money.nullable(), createdAt: timestamp, updatedAt: timestamp, currentCollectionInvoiceId: uuid.nullable(),
}).strict();
const view = z.object({
  subscription: header, subscriptionRevision: revision, ...collections,
  baseAllowance: z.object({ allowedUsers: count, effectiveAllowedUsers: count, enabledApplications: z.array(key).min(1).max(100) }).strict(),
  totals: z.object({ baseRecurringUsd: money, addonRecurringUsd: money, combinedRecurringUsd: money }).strict(),
  projection: z.object({ observation: z.literal("NOT_OBSERVED"), state: z.null(), safeReasonCode: z.literal("TENANT_PROJECTION_NOT_OBSERVED") }).strict(),
}).strict();
const itemsView = z.object({ subscriptionId: uuid, subscriptionRevision: revision, ...collections }).strict();
const envelope = { success: z.literal(true), correlationId: z.string().max(128), timestamp };
const detailEnvelope = z.object({ ...envelope, data: view }).strict();
const itemsEnvelope = z.object({ ...envelope, data: itemsView }).strict();

export type SubscriptionView = z.infer<typeof view>;
export type SubscriptionItems = z.infer<typeof itemsView>;

function validCollections(value: Pick<SubscriptionView, "baseItems" | "addonSelections">): boolean {
  const { baseItems, addonSelections } = value;
  const unique = (values: string[]) => new Set(values).size === values.length;
  if (!unique(baseItems.map((item) => item.id)) || !unique(baseItems.map((item) => item.applicationId))
    || !unique(baseItems.map((item) => item.applicationKey)) || !unique(addonSelections.map((item) => item.id))
    || !unique(addonSelections.map((item) => item.addonId)) || !unique(addonSelections.map((item) => item.addonKey))
    || addonSelections.some((item) => baseItems.some((base) => base.id === item.id))) return false;
  return addonSelections.every((item) => {
    const parent = baseItems.find((base) => base.id === item.parentItemId);
    return !!parent && item.addonKey.split(".")[0] === parent.applicationKey && item.seats <= parent.seats
      && item.acceptedPricing.billingCycle === parent.acceptedPricing.billingCycle;
  });
}

export function parseSubscriptionView(body: unknown): SubscriptionView {
  const parsed = detailEnvelope.safeParse(body);
  if (!parsed.success) invalidRead();
  const value = parsed.data.data;
  const { baseItems, addonSelections, totals, baseAllowance, subscription } = value;
  if (!validCollections(value) || baseItems.some((item) => item.acceptedPricing.billingCycle !== subscription.billingCycle)
    || baseAllowance.allowedUsers !== subscription.allowedUsers
    || baseAllowance.effectiveAllowedUsers !== baseItems.reduce((sum, item) => sum + item.seats, 0)
    || (subscription.totalPrice !== null && subscription.totalPrice !== totals.combinedRecurringUsd)
    || JSON.stringify(baseAllowance.enabledApplications) !== JSON.stringify(baseItems.map((item) => item.applicationKey).sort())
    || baseItems.reduce((sum, item) => sum + moneyUnits(item.acceptedPricing.recurringAmountUsd), BigInt(0)) !== moneyUnits(totals.baseRecurringUsd)
    || addonSelections.reduce((sum, item) => sum + moneyUnits(item.acceptedPricing.recurringAmountUsd), BigInt(0)) !== moneyUnits(totals.addonRecurringUsd)
    || moneyUnits(totals.baseRecurringUsd) + moneyUnits(totals.addonRecurringUsd) !== moneyUnits(totals.combinedRecurringUsd)) invalidRead();
  return value;
}

export function parseSubscriptionItems(body: unknown): SubscriptionItems {
  const parsed = itemsEnvelope.safeParse(body);
  if (!parsed.success || !validCollections(parsed.data.data)) invalidRead();
  return parsed.data.data;
}

export async function readSubscription(signal?: AbortSignal): Promise<SubscriptionView> {
  const response = await readCoreResponse("/api/tenant/core/v1/subscription", {
    signal, cache: "no-store", maxResponseBytes: 4 * 1024 * 1024,
  });
  return parseSubscriptionView(response.data);
}

export async function readSubscriptionItems(signal?: AbortSignal): Promise<SubscriptionItems> {
  const response = await readCoreResponse("/api/tenant/core/v1/subscription/items", {
    signal, cache: "no-store", maxResponseBytes: 4 * 1024 * 1024,
  });
  return parseSubscriptionItems(response.data);
}

function invalidRead(): never { throw new Error("The complete subscription response could not be verified."); }

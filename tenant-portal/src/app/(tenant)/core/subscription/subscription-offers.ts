import { z } from "zod";
import { commercialReadMoney as money, commercialReadUuid as uuid } from "./subscription-pricing";

// Core tenant/subscription/subscription-offers.{contract,openapi}.ts and admin/catalog/price-ladder.ts.
const key = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/u);
const revision = z.string().regex(/^[1-9][0-9]{0,18}$/u)
  .refine((value) => /^[1-9][0-9]{0,18}$/u.test(value) && BigInt(value) <= BigInt("9223372036854775807"));
const count = z.number().int().min(1).max(2_147_483_647);
const displayName = (max: number) => z.string().min(1).max(max);
const bracket = z.object({ minUsers: count, maxUsers: count.nullable(), unitPrice: money }).strict();
const cycle = z.enum(["MONTHLY", "ANNUAL"]);
const ladder = z.discriminatedUnion("state", [
  z.object({ billingCycle: cycle, state: z.literal("CONFIGURED"), brackets: z.array(bracket).min(1).max(100), safeReasonCode: z.null() }).strict(),
  z.object({ billingCycle: cycle, state: z.literal("UNCONFIGURED"), brackets: z.array(bracket).max(0), safeReasonCode: z.literal("PRICE_NOT_CONFIGURED") }).strict(),
  z.object({ billingCycle: cycle, state: z.literal("UNAVAILABLE"), brackets: z.array(bracket).max(0), safeReasonCode: z.literal("PRICE_UNAVAILABLE") }).strict(),
]).refine((value) => value.state !== "CONFIGURED" || value.brackets.every((row, index, rows) =>
  row.minUsers === (index === 0 ? 1 : (rows[index - 1].maxUsers ?? 0) + 1)
  && (index === rows.length - 1 ? row.maxUsers === null : row.maxUsers !== null && row.maxUsers >= row.minUsers)));
const common = {
  application: z.object({ id: uuid, key, name: displayName(128), publicationVersionId: uuid, definitionRevision: revision }).strict(),
  ladders: z.tuple([ladder, ladder]).refine((value) => value[0].billingCycle === "MONTHLY" && value[1].billingCycle === "ANNUAL"),
  status: z.enum(["PARENT_REQUIRED", "INCOMPATIBLE", "UNAVAILABLE", "PREPARATION_REQUIRED"]),
  safeReasonCode: z.enum(["PARENT_REQUIRED", "PARENT_TIER_INCOMPATIBLE", "PRICE_UNAVAILABLE", "PREPARATION_REQUIRED"]),
};
const offerSchema = z.discriminatedUnion("sourceKind", [
  z.object({ ...common, sourceKind: z.literal("APPLICATION"), tier: z.object({ id: uuid, key, name: displayName(255), rank: z.number().int().min(-2_147_483_648).max(2_147_483_647) }).strict() }).strict(),
  z.object({ ...common, sourceKind: z.literal("ADDON"), addon: z.object({ id: uuid,
    key: z.string().regex(/^[a-z][a-z0-9_]{0,31}\.[a-z][a-z0-9_]{0,31}$/u), name: displayName(255),
    definitionVersionId: uuid, definitionVersion: revision, definitionRevision: revision, operationalRevision: revision,
    compatibility: z.object({ mode: z.enum(["ALL_ACTIVE", "ALLOWLIST"]), tierIds: z.array(uuid).max(100) }).strict()
      .refine((value) => (value.mode === "ALL_ACTIVE") === (value.tierIds.length === 0) && new Set(value.tierIds).size === value.tierIds.length),
  }).strict() }).strict(),
]).refine((offer) => {
  const expectedReason = { PARENT_REQUIRED: "PARENT_REQUIRED", INCOMPATIBLE: "PARENT_TIER_INCOMPATIBLE", UNAVAILABLE: "PRICE_UNAVAILABLE", PREPARATION_REQUIRED: "PREPARATION_REQUIRED" };
  if (offer.safeReasonCode !== expectedReason[offer.status]) return false;
  const priced = offer.ladders.some((value) => value.state === "CONFIGURED");
  if (offer.sourceKind === "APPLICATION") return offer.status === (priced ? "PREPARATION_REQUIRED" : "UNAVAILABLE");
  if (offer.addon.key.split(".")[0] !== offer.application.key || (offer.status === "INCOMPATIBLE" && offer.addon.compatibility.mode !== "ALLOWLIST")) return false;
  return offer.status === "PARENT_REQUIRED" || offer.status === "INCOMPATIBLE" || offer.status === (priced ? "PREPARATION_REQUIRED" : "UNAVAILABLE");
});
const pageInteger = z.number().int().min(1).max(1_000_000);
const limit = z.number().int().min(1).max(100);
const requestSchema = z.object({ page: pageInteger, limit, applicationKey: key.optional(), parentTierId: uuid.optional() }).strict()
  .refine((value) => value.parentTierId === undefined || value.applicationKey !== undefined);
const envelope = z.object({ success: z.literal(true), data: z.array(offerSchema).max(100),
  meta: z.object({ page: pageInteger, limit, total: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    totalPages: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), hasNext: z.boolean(), hasPrev: z.boolean() }).strict(),
  correlationId: z.string().max(128), timestamp: z.iso.datetime().max(30) }).strict();

export type SubscriptionOffer = z.infer<typeof offerSchema>;
export type SubscriptionOfferRequest = z.infer<typeof requestSchema>;
export type SubscriptionOfferPage = { items: SubscriptionOffer[]; meta: z.infer<typeof envelope>["meta"] };

export function parseSubscriptionOfferRequest(value: unknown): SubscriptionOfferRequest { return requestSchema.parse(value); }

export function parseSubscriptionOffers(body: unknown, request: SubscriptionOfferRequest): SubscriptionOfferPage {
  const input = requestSchema.parse(request);
  const parsed = envelope.safeParse(body);
  if (!parsed.success) invalidOffers();
  const { data, meta } = parsed.data;
  if (meta.page !== input.page || meta.limit !== input.limit || meta.totalPages !== Math.ceil(meta.total / meta.limit)
    || meta.hasNext !== (meta.page < meta.totalPages) || meta.hasPrev !== (meta.page > 1)
    || data.length !== Math.max(0, Math.min(meta.limit, meta.total - (meta.page - 1) * meta.limit))) invalidOffers();
  const seen = new Set<string>();
  const applications = new Map<string, SubscriptionOffer["application"]>();
  const keys = new Map<string, string>();
  for (const offer of data) {
    const source = offer.sourceKind === "APPLICATION" ? offer.tier : offer.addon;
    const identity = `${offer.sourceKind}:${source.id}`;
    const existing = applications.get(offer.application.id);
    if (seen.has(identity) || (input.applicationKey !== undefined && offer.application.key !== input.applicationKey)
      || (existing && JSON.stringify(existing) !== JSON.stringify(offer.application))
      || (keys.has(offer.application.key) && keys.get(offer.application.key) !== offer.application.id)) invalidOffers();
    if (input.parentTierId !== undefined) {
      if (offer.sourceKind === "APPLICATION" && offer.tier.id !== input.parentTierId) invalidOffers();
      if (offer.sourceKind === "ADDON") {
        const compatible = offer.addon.compatibility.mode === "ALL_ACTIVE" || offer.addon.compatibility.tierIds.includes(input.parentTierId);
        if (offer.status === "PARENT_REQUIRED" || (offer.status === "INCOMPATIBLE") === compatible) invalidOffers();
      }
    }
    seen.add(identity); applications.set(offer.application.id, offer.application); keys.set(offer.application.key, offer.application.id);
  }
  return { items: data, meta };
}

function invalidOffers(): never { throw new Error("The published subscription offers could not be verified."); }

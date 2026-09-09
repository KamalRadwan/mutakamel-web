import { describe, expect, it } from "vitest";
import { parseSubscriptionOfferRequest, parseSubscriptionOffers } from "./subscription-offers";
import { createSubscriptionOffersFixture } from "./subscription-offers.fixture";
const request = { page: 1, limit: 20 };

describe("published subscription offer boundary", () => {
  it("preserves independent dynamic ladders, explicit zero and exact revisions", () => {
    const body = createSubscriptionOffersFixture();
    expect(parseSubscriptionOffers(body, request)).toEqual({ items: body.data, meta: body.meta });
    expect(body.data[0].application.definitionRevision).toBe("9007199254740993");
  });
  it("preserves a non-example four-place price without substituting a default", () => {
    const body = createSubscriptionOffersFixture(); body.data[1].ladders[0].brackets[0].unitPrice = "37.0041";
    expect(parseSubscriptionOffers(body, request).items[1].ladders[0].brackets[0].unitPrice).toBe("37.0041");
  });
  it("supports the exact source-backed parent filter", () => {
    const body = createSubscriptionOffersFixture(); const base = body.data[0];
    if (base.sourceKind !== "APPLICATION") throw new Error("Invalid fixture");
    expect(parseSubscriptionOffers(body, { ...request, applicationKey: "crm", parentTierId: base.tier.id }).items).toHaveLength(2);
  });
  it.each(["gap", "overlap", "early-open", "bounded-final", "not-from-one", "raw-number", "decimal-scale", "negative", "extra-field", "duplicate-cycle", "third-cycle", "unconfigured-not-free", "reason", "grant", "wrong-parent", "revision", "unbounded-array", "wrong-filter", "duplicate-source", "metadata", "total", "extra-version", "extra-envelope-version"])("rejects %s", (kind) => {
    const body = createSubscriptionOffersFixture(); const offer = body.data[1], prices = offer.ladders[0].brackets;
    let input = request;
    if (kind === "gap") prices[1].minUsers = 12;
    if (kind === "overlap") prices[1].minUsers = 10;
    if (kind === "early-open") prices[0].maxUsers = null;
    if (kind === "bounded-final") prices[2].maxUsers = 100;
    if (kind === "not-from-one") prices[0].minUsers = 2;
    if (kind === "raw-number") Object.assign(prices[0], { unitPrice: 10 });
    if (kind === "decimal-scale") prices[0].unitPrice = "10.0";
    if (kind === "negative") prices[0].unitPrice = "-1.0000";
    if (kind === "extra-field") Object.assign(prices[0], { total: "100.0000" });
    if (kind === "duplicate-cycle") offer.ladders[1].billingCycle = "MONTHLY";
    if (kind === "third-cycle") Object.assign(offer, { ladders: [...offer.ladders, offer.ladders[1]] });
    if (kind === "unconfigured-not-free") Object.assign(offer.ladders[1], { brackets: [{ minUsers: 1, maxUsers: null, unitPrice: "0.0000" }] });
    if (kind === "reason") offer.safeReasonCode = "PRICE_UNAVAILABLE";
    if (kind === "grant") Object.assign(offer, { status: "ELIGIBLE" });
    if (kind === "wrong-parent" && offer.sourceKind === "ADDON") offer.addon.key = "trade.logistics";
    if (kind === "revision") offer.application.definitionRevision = "9223372036854775808";
    if (kind === "unbounded-array") offer.ladders[0].brackets = Array.from({ length: 101 }, () => prices[0]);
    if (kind === "wrong-filter") input = { ...request, ...{ applicationKey: "trade" } };
    if (kind === "duplicate-source") body.data[0] = body.data[1];
    if (kind === "metadata") Object.assign(body.meta, { cursor: "invented" });
    if (kind === "total") body.meta.total = 3;
    if (kind === "extra-version") Object.assign(offer, { contractVersion: 2 });
    if (kind === "extra-envelope-version") Object.assign(body, { contractVersion: 2 });
    expect(() => parseSubscriptionOffers(body, input)).toThrow("could not be verified");
  });
  it("keeps parent-required and incompatibility as observations, not readiness", () => {
    const body = createSubscriptionOffersFixture(), addon = body.data[1];
    if (addon.sourceKind !== "ADDON") throw new Error("Invalid fixture");
    addon.status = "PARENT_REQUIRED"; addon.safeReasonCode = "PARENT_REQUIRED";
    expect(parseSubscriptionOffers(body, request).items[1].status).toBe("PARENT_REQUIRED");
    addon.addon.compatibility = { mode: "ALLOWLIST", tierIds: ["018ef54e-2222-7777-8888-000000000009"] };
    addon.status = "INCOMPATIBLE"; addon.safeReasonCode = "PARENT_TIER_INCOMPATIBLE";
    expect(parseSubscriptionOffers(body, request).items[1].status).toBe("INCOMPATIBLE");
    addon.addon.compatibility.mode = "ALL_ACTIVE"; addon.addon.compatibility.tierIds = [];
    expect(() => parseSubscriptionOffers(body, request)).toThrow();
  });
  it("does not accept parent-required when an explicit current parent was requested", () => {
    const body = createSubscriptionOffersFixture(), addon = body.data[1];
    addon.status = "PARENT_REQUIRED"; addon.safeReasonCode = "PARENT_REQUIRED";
    expect(() => parseSubscriptionOffers(body, { ...request, applicationKey: "crm", parentTierId: "018ef54e-2222-7777-8888-000000000003" })).toThrow();
  });
  it("accepts honest empty/out-of-range pages", () => {
    const body = createSubscriptionOffersFixture(); body.data = []; body.meta.total = 0; body.meta.totalPages = 0;
    expect(parseSubscriptionOffers(body, request).items).toEqual([]);
    body.meta.page = 2; body.meta.hasPrev = true;
    expect(parseSubscriptionOffers(body, { ...request, page: 2 }).items).toEqual([]);
  });
  it.each([{ page: 0, limit: 20 }, { page: 1, limit: 101 }, { ...request, parentTierId: "018ef54e-2222-7777-8888-000000000003" },
    { ...request, applicationKey: "../crm" }, { ...request, companyId: "invented" }, { ...request, page: "1" }])("refuses unsupported request %o", (input) => {
    expect(() => parseSubscriptionOfferRequest(input)).toThrow();
  });
});

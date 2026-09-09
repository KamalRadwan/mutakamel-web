import { describe, expect, it } from "vitest";
import type { AxiosResponse } from "@/lib/api/axiosClient";
import type { AcceptedPricing } from "@/shared/api/accepted-pricing";
import { INITIAL_QUOTE_RESPONSE_MAX_BYTES, INITIAL_SEED_RESPONSE_MAX_BYTES, readInitialQuoteResponse, readInitialQuote,
  readInitialSeedResponse, readOriginalInitialSeedReceipt, type InitialQuoteView, type OriginalInitialSeedReceipt } from "./initial-commercial-readers";

const id = (n: number) => `019f0000-0000-7000-8000-${String(n).padStart(12, "0")}`;
const start = "2026-09-07T12:00:00.000Z";
function price(kind: "APPLICATION" | "ADDON"): AcceptedPricing {
  return { billingCycle: "MONTHLY", currencyCode: "USD", recurringAmountUsd: "118.0000", priceRevision: kind === "APPLICATION" ? "a".repeat(64) : id(99), 
    breakdown: [{ minUsers: 1, maxUsers: 10, chargedUsers: 10, unitPriceUsd: "10.0000", amountUsd: "100.0000" },
      { minUsers: 11, maxUsers: 25, chargedUsers: 2, unitPriceUsd: "9.0000", amountUsd: "18.0000" }] };
}
function item(n = 0): InitialQuoteView["items"][number] {
  return { selectionKey: id(3000 + n), applicationId: id(1000 + n), tierId: id(2000 + n), seats: 12, acceptedPricing: price("APPLICATION"),
    addons: [{ selectionKey: id(4000 + n), addonId: id(5000 + n), definitionVersionId: id(6000 + n), seats: 12, acceptedPricing: price("ADDON") }] };
}
/** Public fixtures follow Commercial's frozen projection; no private quote pins. */
function quoteFixture(): InitialQuoteView {
  return { quoteId: id(1), purpose: "TENANT_CREATION", targetTenantId: null, billingCycle: "MONTHLY", currencyCode: "USD", resolvedTrialDays: 7,
    items: [item()], totals: { baseRecurringUsd: "118.0000", addonRecurringUsd: "118.0000", combinedRecurringUsd: "236.0000" }, createdAt: start, expiresAt: "2026-09-07T12:15:00.000Z" };
}
function mapping(n = 0): OriginalInitialSeedReceipt["selections"][number] {
  return { selectionKey: id(3000 + n), itemId: id(7000 + n), applicationId: id(1000 + n),
    addons: [{ selectionKey: id(4000 + n), addonSelectionId: id(8000 + n), addonId: id(5000 + n), definitionVersionId: id(6000 + n) }] };
}
function receiptFixture(): OriginalInitialSeedReceipt {
  return { commandId: id(4), tenantId: id(2), subscriptionId: id(3), quoteId: id(1), subscriptionRevision: "1", status: "TRIAL",
    billingCycle: "MONTHLY", currencyCode: "USD", trialDays: 7, trialStartedAt: start, trialEndsAt: "2026-09-14T12:00:00.000Z",
    totals: { baseRecurringUsd: "100.0000", addonRecurringUsd: "6.3750", combinedRecurringUsd: "106.3750" }, selections: [mapping()], createdAt: "2026-09-07T11:59:59.000Z" };
}
function response(value: unknown): AxiosResponse<unknown> {
  return { status: 201, statusText: "Created", headers: new Headers(), data: { success: true, data: value, correlationId: "corr-initial", timestamp: start } };
}

describe("Staged public initial quote V2", () => {
  it("retains exact graduated App/Addon evidence without private pins or readiness inference", () => {
    const input = quoteFixture(), result = readInitialQuote(input);
    expect(Object.keys(result)).toHaveLength(10);
    expect(result.items[0].addons[0].acceptedPricing.breakdown?.[1].amountUsd).toBe("18.0000");
    expect(result.totals.combinedRecurringUsd).toBe("236.0000");
    expect(JSON.stringify(result)).not.toMatch(/requestHash|pricingRevision|provisioningIntent|canApply|readiness/);
    input.items[0].addons[0].seats = 1;
    expect(result.items[0].addons[0].seats).toBe(12);
  });
  it("accepts existing UUIDv4 application/tier/target references but not new Addon or selection identities", () => {
    const value = quoteFixture(); value.purpose = "INITIAL_SEED"; value.targetTenantId = id(2).replace("-7000-", "-4000-");
    value.items[0].applicationId = value.items[0].applicationId.replace("-7000-", "-4000-");
    value.items[0].tierId = value.items[0].tierId.replace("-7000-", "-4000-");
    expect(readInitialQuote(value).targetTenantId).toBe(value.targetTenantId);
    value.items[0].addons[0].addonId = id(5).replace("-7000-", "-4000-");
    expect(() => readInitialQuote(value)).toThrow();
  });
  it("retains configured zero and independent fractional annual evidence", () => {
    const value = quoteFixture(); value.billingCycle = "ANNUAL"; value.items[0].seats = 1; value.items[0].addons = [];
    value.items[0].acceptedPricing = { ...price("APPLICATION"), billingCycle: "ANNUAL", recurringAmountUsd: "73.1250", breakdown: [{ minUsers: 1, maxUsers: null, chargedUsers: 1, unitPriceUsd: "73.1250", amountUsd: "73.1250" }] };
    value.totals = { baseRecurringUsd: "73.1250", addonRecurringUsd: "0.0000", combinedRecurringUsd: "73.1250" };
    expect(readInitialQuote(value).totals.baseRecurringUsd).toBe("73.1250");
    const pricing = value.items[0].acceptedPricing;
    pricing.recurringAmountUsd = pricing.breakdown![0].unitPriceUsd = pricing.breakdown![0].amountUsd = "0.0000";
    value.totals.baseRecurringUsd = value.totals.combinedRecurringUsd = "0.0000";
    expect(readInitialQuote(value).totals.combinedRecurringUsd).toBe("0.0000");
  });
  it("handles100Apps +100Addons with100appliedbrackets each under4MiB", () => {
    const value = quoteFixture(); value.purpose = "INITIAL_SEED"; value.targetTenantId = id(2);
    value.items = Array.from({ length: 100 }, (_, n) => item(n));
    for (const selection of value.items.flatMap(item => [item, ...item.addons])) {
      selection.seats = 100; selection.acceptedPricing.recurringAmountUsd = "100.0000";
      selection.acceptedPricing.breakdown = Array.from({ length: 100 }, (_, n) => ({ minUsers: n + 1, maxUsers: n === 99 ? null : n + 1, chargedUsers: 1, unitPriceUsd: "1.0000", amountUsd: "1.0000" }));
    }
    value.totals = { baseRecurringUsd: "10000.0000", addonRecurringUsd: "10000.0000", combinedRecurringUsd: "20000.0000" };
    const result = readInitialQuoteResponse(response(value), { purpose: "INITIAL_SEED", targetTenantId: id(2) });
    expect(result.items).toHaveLength(100);
    expect(new TextEncoder().encode(JSON.stringify(response(value).data)).length).toBeLessThan(INITIAL_QUOTE_RESPONSE_MAX_BYTES);
    value.purpose = "TENANT_CREATION"; value.targetTenantId = null;
    expect(() => readInitialQuote(value)).toThrow();
  });
  it.each([
    ["missing seed target", (v: InitialQuoteView) => { v.purpose = "INITIAL_SEED"; }],
    ["creation target", (v: InitialQuoteView) => { v.targetTenantId = id(2); }],
    ["empty items", (v: InitialQuoteView) => { v.items = []; }],
    ["duplicate selection key", (v: InitialQuoteView) => { v.items[0].addons[0].selectionKey = v.items[0].selectionKey; }],
    ["duplicate application", (v: InitialQuoteView) => { const next = item(1); next.applicationId = v.items[0].applicationId; v.items.push(next); }],
    ["duplicate addon", (v: InitialQuoteView) => { const next = item(1); next.addons[0].addonId = v.items[0].addons[0].addonId; v.items.push(next); }],
    ["child exceeds parent", (v: InitialQuoteView) => { v.items[0].addons[0].seats = 13; }],
    ["wrong quote lifetime", (v: InitialQuoteView) => { v.expiresAt = "2026-09-07T12:16:00.000Z"; }],
    ["noncanonical timestamp", (v: InitialQuoteView) => { v.createdAt = "2026-09-07T14:00:00+02:00"; }],
    ["unknown pricing", (v: InitialQuoteView) => { Object.assign(v.items[0].acceptedPricing, { priceRevision: null, breakdown: null }); }],
    ["wrong cycle", (v: InitialQuoteView) => { v.items[0].addons[0].acceptedPricing.billingCycle = "ANNUAL"; }],
    ["wrong source revision", (v: InitialQuoteView) => { v.items[0].addons[0].acceptedPricing.priceRevision = "a".repeat(64); }],
    ["wrong brackets", (v: InitialQuoteView) => { v.items[0].acceptedPricing.breakdown![1].chargedUsers = 1; }],
    ["wrong totals", (v: InitialQuoteView) => { v.totals.combinedRecurringUsd = "235.9999"; }],
    ["trial bounds", (v: InitialQuoteView) => { v.resolvedTrialDays = 366; }],
  ])("rejects %s", (_name, mutate) => { const value = quoteFixture(); mutate(value); expect(() => readInitialQuote(value)).toThrow(); });
  it.each(["requestHash", "pricingRevision", "provisioningIntent", "canApply"])("rejects private/unsupported root field %s", field => {
    expect(() => readInitialQuote({ ...quoteFixture(), [field]: "not-public" })).toThrow();
  });
  it("rejects nested private fields and101aggregate children", () => {
    const nested = quoteFixture(); Object.assign(nested.items[0].acceptedPricing, { privateOwner: "hidden" });
    expect(() => readInitialQuote(nested)).toThrow();
    const value = quoteFixture(); value.items = [item(0), item(1)];
    value.items[0].addons = Array.from({ length: 100 }, (_, n) => item(n + 2).addons[0]);
    expect(() => readInitialQuote(value)).toThrow();
  });
});

describe("Staged ORIGINAL initial seed receipt", () => {
  it("preserves original TRIAL/revision1 and generated mappings without current-state adaptation", () => {
    const input = receiptFixture(), result = readOriginalInitialSeedReceipt(input);
    expect(Object.keys(result)).toHaveLength(14);
    expect(result.status).toBe("TRIAL"); expect(result.subscriptionRevision).toBe("1");
    expect(result.selections[0].itemId).not.toBe(result.selections[0].selectionKey);
    input.selections[0].addons[0].addonSelectionId = id(9999);
    expect(result.selections[0].addons[0].addonSelectionId).toBe(id(8000));
    expect(result).not.toHaveProperty("currentState");
    expect(result).not.toHaveProperty("acceptedPricing");
  });
  it("accepts100+100unique mappings and existing tenant/application UUIDv4", () => {
    const value = receiptFixture(); value.selections = Array.from({ length: 100 }, (_, n) => mapping(n));
    value.tenantId = value.tenantId.replace("-7000-", "-4000-");
    value.selections[0].applicationId = value.selections[0].applicationId.replace("-7000-", "-4000-");
    const result = readInitialSeedResponse(response(value), { tenantId: value.tenantId, quoteId: value.quoteId });
    expect(result.selections).toHaveLength(100);
    expect(new TextEncoder().encode(JSON.stringify(response(value).data)).length).toBeLessThan(INITIAL_SEED_RESPONSE_MAX_BYTES);
  });
  it.each([
    ["subscriptionRevision", "2"], ["status", "ACTIVE"], ["contractVersion", 1], ["currencyCode", "EGP"],
    ["trialDays", 0], ["trialDays", 366], ["trialDays", "7"], ["trialEndsAt", "2026-09-15T12:00:00.000Z"],
    ["trialStartedAt", "2026-09-07T12:00:00Z"], ["createdAt", "2026-02-30T12:00:00.000Z"],
    ["actorId", id(9)], ["provisioningIntent", {}], ["acceptedPricing", {}], ["requestHash", "a".repeat(64)],
  ])("rejects non-original or extra field %s=%s", (field, value) => {
    expect(() => readOriginalInitialSeedReceipt({ ...receiptFixture(), [field as string]: value })).toThrow();
  });
  it.each(["106.3749", "-1.0000", "100000000000000.0000", "106.375", "1.06375e2"])("rejects unsupported total %s", amount => {
    const value = receiptFixture(); value.totals.combinedRecurringUsd = amount;
    expect(() => readOriginalInitialSeedReceipt(value)).toThrow();
  });
  it("rejects duplicate keys, generated IDs, applications, addons, and keys-as-generated-IDs", () => {
    for (const mutate of [
      (v: OriginalInitialSeedReceipt) => { v.selections[0].addons[0].selectionKey = v.selections[0].selectionKey; },
      (v: OriginalInitialSeedReceipt) => { v.selections[0].addons[0].addonSelectionId = v.selections[0].itemId; },
      (v: OriginalInitialSeedReceipt) => { v.selections[0].itemId = v.selections[0].selectionKey; },
      (v: OriginalInitialSeedReceipt) => { const next = mapping(1); next.applicationId = v.selections[0].applicationId; v.selections.push(next); },
      (v: OriginalInitialSeedReceipt) => { const next = mapping(1); next.addons[0].addonId = v.selections[0].addons[0].addonId; v.selections.push(next); },
    ]) { const value = receiptFixture(); mutate(value); expect(() => readOriginalInitialSeedReceipt(value)).toThrow(); }
  });
  it("rejects empty or over-limit maps and nested unsupported fields", () => {
    expect(() => readOriginalInitialSeedReceipt({ ...receiptFixture(), selections: [] })).toThrow();
    expect(() => readOriginalInitialSeedReceipt({ ...receiptFixture(), selections: Array.from({ length: 101 }, (_, n) => mapping(n)) })).toThrow();
    const value = receiptFixture(); value.selections[0].addons = Array.from({ length: 101 }, (_, n) => mapping(n).addons[0]);
    expect(() => readOriginalInitialSeedReceipt(value)).toThrow();
    const extra = receiptFixture(); Object.assign(extra.selections[0], { currentSeats: 100 });
    expect(() => readOriginalInitialSeedReceipt(extra)).toThrow();
  });
});

describe("Initial response scope and negotiation boundaries", () => {
  it("rejects wrong purpose, tenant or quote while preserving correlation", () => {
    expect(() => readInitialQuoteResponse(response(quoteFixture()), { purpose: "INITIAL_SEED", targetTenantId: id(2) })).toThrow(expect.objectContaining({ correlationId: "corr-initial" }));
    expect(() => readInitialSeedResponse(response(receiptFixture()), { tenantId: id(99), quoteId: id(1) })).toThrow();
    expect(() => readInitialSeedResponse(response(receiptFixture()), { tenantId: id(2), quoteId: id(99) })).toThrow();
  });
  it("rejects obsolete payload versions and does not accept incomplete responses", () => {
    const value = response({ ...quoteFixture(), contractVersion: 2 });
    expect(() => readInitialQuoteResponse(value, { purpose: "TENANT_CREATION", targetTenantId: null })).toThrow();
    expect(() => readInitialSeedResponse(response({ contractVersion: 1 }), { tenantId: id(2), quoteId: id(1) })).toThrow();
  });
  it("bounds quote and seed full envelopes independently", () => {
    const quote = response(quoteFixture()); Object.assign(quote.data as object, { padding: "x".repeat(INITIAL_QUOTE_RESPONSE_MAX_BYTES) });
    expect(() => readInitialQuoteResponse(quote, { purpose: "TENANT_CREATION", targetTenantId: null })).toThrow();
    const seed = response(receiptFixture()); Object.assign(seed.data as object, { padding: "x".repeat(INITIAL_SEED_RESPONSE_MAX_BYTES) });
    expect(() => readInitialSeedResponse(seed, { tenantId: id(2), quoteId: id(1) })).toThrow();
  });
});

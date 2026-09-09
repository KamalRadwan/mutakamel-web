import { afterEach, describe, expect, it, vi } from "vitest";
import { axiosClient } from "@/lib/api/axiosClient";
import { parseSubscriptionItems, parseSubscriptionView, readSubscription } from "./subscription-read";
import { createSubscriptionFixture } from "./subscription-read.fixture";

const id = (suffix: number) => `018ef54e-2222-7777-8888-${String(suffix).padStart(12, "0")}`;
const headers = new Headers();
const fixture = createSubscriptionFixture;
afterEach(() => vi.restoreAllMocks());
describe("canonical accepted subscription display", () => {
  it("keeps retained Addon pricing evidence and base-only allowance", () => {
    const body = fixture();
    expect(parseSubscriptionView(body)).toEqual(body.data);
    expect(body.data.baseAllowance.effectiveAllowedUsers).toBe(10);
    expect(body.data.totals.combinedRecurringUsd).toBe("115.0000");
  });
  it("preserves the distinct four-field items response, never a mixed array", () => {
    const body = fixture();
    const data = {  subscriptionId: body.data.subscription.id, subscriptionRevision: body.data.subscriptionRevision,
      baseItems: body.data.baseItems, addonSelections: body.data.addonSelections };
    expect(parseSubscriptionItems({ ...body, data })).toEqual(data);
    expect(() => parseSubscriptionItems({ ...body, data: body.data.baseItems })).toThrow();
  });
  it("accepts actual arbitrary graduated bracket evidence without current ladder lookup", () => {
    const body = fixture();
    body.data.baseItems[0].acceptedPricing = {
      billingCycle: "MONTHLY", currencyCode: "USD", recurringAmountUsd: "100.0000", priceRevision: "a".repeat(64), 
      breakdown: [
        { minUsers: 1, maxUsers: 4, chargedUsers: 4, unitPriceUsd: "16.0000", amountUsd: "64.0000" },
        { minUsers: 5, maxUsers: null, chargedUsers: 6, unitPriceUsd: "6.0000", amountUsd: "36.0000" },
      ],
    };
    expect(parseSubscriptionView(body).baseItems[0].acceptedPricing).toEqual(body.data.baseItems[0].acceptedPricing);
  });
  it("accepts explicit zero Addon pricing and high exact amounts", () => {
    const body = fixture();
    body.data.baseItems[0].acceptedPricing.recurringAmountUsd = "90071992547409.9999";
    body.data.baseItems[0].acceptedPricing.breakdown = [
      { minUsers: 1, maxUsers: 1, chargedUsers: 1, unitPriceUsd: "90071992547409.9999", amountUsd: "90071992547409.9999" },
      { minUsers: 2, maxUsers: null, chargedUsers: 9, unitPriceUsd: "0.0000", amountUsd: "0.0000" },
    ];
    body.data.addonSelections[0].acceptedPricing.recurringAmountUsd = "0.0000";
    body.data.addonSelections[0].acceptedPricing.breakdown = [{ minUsers: 1, maxUsers: null, chargedUsers: 3, unitPriceUsd: "0.0000", amountUsd: "0.0000" }];
    body.data.subscription.totalPrice = "90071992547409.9999";
    body.data.totals = { baseRecurringUsd: "90071992547409.9999", addonRecurringUsd: "0.0000", combinedRecurringUsd: "90071992547409.9999" };
    expect(parseSubscriptionView(body).totals.combinedRecurringUsd).toBe("90071992547409.9999");
  });
  it.each([undefined, "1", "3", "2, 2"])("rejects the removed discriminator %s", (version) => {
    const body = fixture(); Object.assign(body.data, { contractVersion: version });
    expect(() => parseSubscriptionView(body)).toThrow();
  });
  it.each(["header", "base", "addon", "price", "projection", "totals"])("rejects an unknown field in %s", (where) => {
    const body = fixture();
    const target = { header: body.data.subscription, base: body.data.baseItems[0], addon: body.data.addonSelections[0], price: body.data.baseItems[0].acceptedPricing, projection: body.data.projection, totals: body.data.totals }[where];
    Object.assign(target!, { secret: "not displayed" });
    expect(() => parseSubscriptionView(body)).toThrow("could not be verified");
  });
  it.each(["parent", "owner", "seats", "cycle", "allowance", "total", "duplicate", "legacy", "grant"])("rejects inconsistent %s", (kind) => {
    const body = fixture();
    if (kind === "parent") body.data.addonSelections[0].parentItemId = id(999);
    if (kind === "owner") body.data.addonSelections[0].addonKey = "trade.logistics";
    if (kind === "seats") body.data.addonSelections[0].seats = 11;
    if (kind === "cycle") body.data.addonSelections[0].acceptedPricing.billingCycle = "ANNUAL";
    if (kind === "allowance") body.data.baseAllowance.effectiveAllowedUsers = 13;
    if (kind === "total") body.data.totals.combinedRecurringUsd = "100.0000";
    if (kind === "duplicate") body.data.addonSelections.push(body.data.addonSelections[0]);
    if (kind === "legacy") Object.assign(body.data.baseItems[0].acceptedPricing, { priceRevision: null, breakdown: null });
    if (kind === "grant") Object.assign(body.data.addonSelections[0].effectiveState, { operationalUse: "ALLOWED" });
    expect(() => parseSubscriptionView(body)).toThrow();
  });
  it.each(["abc", "1e5", "01.0000", "-1.0000", 15])("rejects malformed monetary evidence %s safely", (amount) => {
    const body = fixture();
    Object.assign(body.data.baseItems[0].acceptedPricing, {  priceRevision: "a".repeat(64),
      breakdown: [{ minUsers: 1, maxUsers: null, chargedUsers: 10, unitPriceUsd: amount, amountUsd: "100.0000" }] });
    expect(() => parseSubscriptionView(body)).toThrow("could not be verified");
  });
  it("uses the existing owner-only canonical read with no-store and byte bound", async () => {
    const body = fixture();
    const spy = vi.spyOn(axiosClient, "get").mockResolvedValue({ data: body, headers, status: 200, statusText: "OK" });
    await expect(readSubscription()).resolves.toEqual(body.data);
    expect(spy).toHaveBeenCalledExactlyOnceWith("/api/tenant/core/v1/subscription", {
      signal: undefined, cache: "no-store", maxResponseBytes: 4 * 1024 * 1024,
    });
  });
});

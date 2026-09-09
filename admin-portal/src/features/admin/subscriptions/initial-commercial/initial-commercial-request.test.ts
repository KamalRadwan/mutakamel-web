import { describe, expect, it } from "vitest";
import { assertQuoteMatchesRequest, assertSeedMatchesQuote, buildInitialSeedRequest, creationCommercialFields, readInitialQuoteRequest, readInitialSeedRequest } from "./initial-commercial-request";
import { initialId, initialQuoteFixture, initialReceiptFixture, initialRequestFixture } from "./initial-commercial.fixture";

describe("Closed initial commercial request identities", () => {
  it.each(["TENANT_CREATION", "INITIAL_SEED"] as const)("retains %s without private fields or substituted identities", purpose => {
    const request = initialRequestFixture(purpose);
    expect(readInitialQuoteRequest(request)).toEqual(request);
    expect(assertQuoteMatchesRequest(initialQuoteFixture(purpose), request).items[0].addons[0].seats).toBe(2);
    expect(JSON.stringify(request)).not.toMatch(/provisioningIntent|requestHash|pricingRevision|itemId|addonSelectionId/);
  });
  it("preserves omitted trialDays in exact seed terms instead of inserting the resolved default", () => {
    const request = initialRequestFixture(); delete request.trialDays;
    const body = buildInitialSeedRequest(initialQuoteFixture(), request);
    expect(body).not.toHaveProperty("trialDays");
    expect(body).not.toHaveProperty("purpose"); expect(body).not.toHaveProperty("targetTenantId");
    expect(readInitialSeedRequest(body)).toEqual(body);
  });
  it("creates only the commercial creation subshape and refuses a seed conversion", () => {
    const request = initialRequestFixture("TENANT_CREATION");
    expect(Object.keys(creationCommercialFields(initialQuoteFixture("TENANT_CREATION"), request))).toEqual(["quoteId", "subscription"]);
    expect(() => buildInitialSeedRequest(initialQuoteFixture("TENANT_CREATION"), request)).toThrow();
    expect(() => creationCommercialFields(initialQuoteFixture(), initialRequestFixture())).toThrow();
  });
  it.each([
    ["unknown root", (v: Record<string, unknown>) => { v.provisioningIntent = {}; }],
    ["missing seed target", (v: Record<string, unknown>) => { delete v.targetTenantId; }],
    ["unknown purpose", (v: Record<string, unknown>) => { v.purpose = "PURCHASE"; }],
    ["wrong version", (v: Record<string, unknown>) => { v.contractVersion = 1; }],
    ["wrong currency", (v: Record<string, unknown>) => { v.currencyCode = "EGP"; }],
    ["string trial", (v: Record<string, unknown>) => { v.trialDays = "7"; }],
  ])("rejects %s", (_name, mutate) => {
    const request = initialRequestFixture(); mutate(request);
    expect(() => readInitialQuoteRequest(request)).toThrow();
  });
  it("rejects a creation target and target selectors in a seed body", () => {
    expect(() => readInitialQuoteRequest({ ...initialRequestFixture("TENANT_CREATION"), targetTenantId: initialId(2) })).toThrow();
    expect(() => readInitialSeedRequest({ ...buildInitialSeedRequest(initialQuoteFixture(), initialRequestFixture()), targetTenantId: initialId(2) })).toThrow();
  });
  it.each([0, 1.5, 100001, "3", NaN])("rejects invalid parent seats %s", seats => {
    const request = initialRequestFixture(); Object.assign(request.applications[0], { seats });
    expect(() => readInitialQuoteRequest(request)).toThrow();
  });
  it("rejects a child above its parent and duplicate correlation or addon identities", () => {
    const request = initialRequestFixture(); request.applications[0].addons[0].seats = 4;
    expect(() => readInitialQuoteRequest(request)).toThrow();
    request.applications[0].addons[0].seats = 2; request.applications[0].addons[0].selectionKey = request.applications[0].selectionKey;
    expect(() => readInitialQuoteRequest(request)).toThrow();
    const duplicated = initialRequestFixture(); duplicated.applications[0].addons.push({ ...duplicated.applications[0].addons[0], selectionKey: initialId(80) });
    expect(() => readInitialQuoteRequest(duplicated)).toThrow();
  });
  it("applies the separate50/100App limit and total100child bound", () => {
    const request = initialRequestFixture(); const template = request.applications[0];
    request.applications = Array.from({ length: 100 }, (_, n) => ({ ...template, selectionKey: initialId(1000 + n), applicationId: initialId(2000 + n),
      addons: [{ ...template.addons[0], selectionKey: initialId(3000 + n), addonId: initialId(4000 + n) }] }));
    expect(readInitialQuoteRequest(request).applications).toHaveLength(100);
    expect(() => readInitialQuoteRequest({ ...request, purpose: "TENANT_CREATION", targetTenantId: undefined })).toThrow();
    const creation = { ...initialRequestFixture("TENANT_CREATION"), applications: request.applications.slice(0, 50) };
    expect(readInitialQuoteRequest(creation).applications).toHaveLength(50);
    expect(() => readInitialQuoteRequest({ ...creation, applications: request.applications.slice(0, 51) })).toThrow();
    request.applications[0].addons.push({ ...template.addons[0], selectionKey: initialId(5000), addonId: initialId(5001) });
    expect(() => readInitialQuoteRequest(request)).toThrow();
  });
  it.each(["applicationId", "tierId", "selectionKey", "seats"] as const)("rejects a quote for changed %s", field => {
    const request = initialRequestFixture(); Object.assign(request.applications[0], { [field]: field === "seats" ? 4 : initialId(70) });
    expect(() => assertQuoteMatchesRequest(initialQuoteFixture(), request)).toThrow();
  });
  it("rejects omitted/additional/foreign child evidence even when totals match", () => {
    const request = initialRequestFixture(); request.applications[0].addons[0].definitionVersionId = initialId(70);
    expect(() => assertQuoteMatchesRequest(initialQuoteFixture(), request)).toThrow();
    request.applications[0].addons = [];
    expect(() => assertQuoteMatchesRequest(initialQuoteFixture(), request)).toThrow();
  });
  it("binds original receipt totals and every parent/child mapping to the reviewed quote", () => {
    const quote = initialQuoteFixture(), receipt = initialReceiptFixture();
    expect(assertSeedMatchesQuote(receipt, quote)).toEqual(receipt);
    receipt.selections[0].addons[0].definitionVersionId = initialId(80);
    expect(() => assertSeedMatchesQuote(receipt, quote)).toThrow();
    const substituted = initialReceiptFixture(); substituted.totals.baseRecurringUsd = "7.3750"; substituted.totals.addonRecurringUsd = "9.5000";
    expect(() => assertSeedMatchesQuote(substituted, quote)).toThrow();
  });
});

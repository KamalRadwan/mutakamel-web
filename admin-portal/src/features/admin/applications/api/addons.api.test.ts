import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock("@/lib/api/axiosClient", () => ({ axiosClient: mocks }));
import { addonsApi } from "./addons.api";
import { addonEnvelope, addonFixture, addonIds, addonPageMeta, addonPricesFixture, addonReceiptFixture } from "../lib/addon-test-fixtures";
import { readAddonDetail, readBrackets, readPrices } from "../lib/addon-contract";
const owner = "crm"; const key = "crm.logistics"; const base = "/api/admin/core/v1/applications/crm/addons";
beforeEach(() => Object.values(mocks).forEach(mock => mock.mockReset()));

describe("Canonical Addon contract and transport", () => {
  it("reads bounded pages with no idempotency key or body", async () => {
    mocks.get.mockResolvedValue(addonEnvelope([], addonPageMeta));
    expect(await addonsApi.list(owner, { search: "a&b", page: 1 })).toEqual({ items: [], meta: addonPageMeta });
    expect(mocks.get).toHaveBeenCalledWith(`${base}?search=a%26b&page=1&limit=20`, { signal: undefined, cache: "no-store" });
  });
  it("retains large revisions as strings", async () => {
    mocks.get.mockResolvedValue(addonEnvelope(addonFixture()));
    expect((await addonsApi.get(owner, key)).catalogueRevision).toBe("9007199254740993");
  });
  it.each([1, 2, null])("rejects obsolete payload version %s with correlation", async version => {
    const response = addonEnvelope(addonFixture());
    Object.assign(response.data.data as object, { contractVersion: version });
    mocks.get.mockResolvedValue(response);
    await expect(addonsApi.get(owner, key)).rejects.toMatchObject({ errorCode: "COMMERCIAL_RESPONSE_UNAVAILABLE", correlationId: addonIds.key });
  });
  it.each([
    (value: Record<string, unknown>) => ({ ...value, secret: "not allowed" }),
    (value: Record<string, unknown>) => ({ ...value, applicationKey: "trade" }),
    (value: Record<string, unknown>) => ({ ...value, contractVersion: 1 }),
    (value: Record<string, unknown>) => ({ ...value, catalogueRevision: 9007199254740992 }),
    (value: Record<string, unknown>) => ({ ...value, lifecycleStatus: "NEW_STATE" }),
    (value: Record<string, unknown>) => ({ ...value, draftVersionId: null }),
  ])("fails closed on malformed/foreign/unknown detail", async mutate => {
    mocks.get.mockResolvedValue(addonEnvelope(mutate(addonFixture())));
    await expect(addonsApi.get(owner, key)).rejects.toMatchObject({ errorCode: "COMMERCIAL_RESPONSE_UNAVAILABLE" });
  });
  it("does not confuse revision zero with free pricing", () => {
    expect(readPrices(addonPricesFixture()).ladders[0].configured).toBe(false);
    const corrupt = addonPricesFixture(); corrupt.ladders[0].brackets = [{ minUsers: 1, maxUsers: null, unitPrice: "0" }];
    expect(() => readPrices(corrupt)).toThrow();
  });
  it("sends caller-owned create identity and only closed DTO keys", async () => {
    mocks.post.mockResolvedValue(addonEnvelope(addonReceiptFixture()));
    await addonsApi.command(owner, key, { kind: "CREATE", body: { key, name: "Logistics", description: undefined } }, addonIds.key);
    expect(mocks.post).toHaveBeenCalledWith(base, { key, name: "Logistics" }, { headers: { "x-idempotency-key": addonIds.key } });
  });
  it("DELETE is bodyless and fences its query", async () => {
    mocks.delete.mockResolvedValue(addonEnvelope(addonReceiptFixture("DELETE")));
    await addonsApi.command(owner, key, { kind: "DELETE", body: { expectedCatalogueRevision: "1", reason: "Unused & unpublished" } }, addonIds.key);
    expect(mocks.delete).toHaveBeenCalledWith(`${base}/${key}?expectedCatalogueRevision=1&reason=Unused+%26+unpublished`, { headers: { "x-idempotency-key": addonIds.key } });
  });
  it("rejects a receipt for a different command", async () => {
    mocks.post.mockResolvedValue(addonEnvelope(addonReceiptFixture("DISABLE")));
    await expect(addonsApi.command(owner, key, { kind: "DEPRECATE", body: { expectedCatalogueRevision: "1", reason: "Retire" } }, addonIds.key))
      .rejects.toMatchObject({ errorCode: "COMMERCIAL_RESPONSE_UNAVAILABLE" });
  });
  it("retains explicit zero and exact decimal strings in dynamic ladder writes", async () => {
    const brackets = [{ minUsers: 1, maxUsers: 10, unitPrice: "10.1234" }, { minUsers: 11, maxUsers: 25, unitPrice: "9" }, { minUsers: 26, maxUsers: null, unitPrice: "0" }];
    mocks.patch.mockResolvedValue(addonEnvelope({ ladderId: addonIds.key, addonId: addonIds.addon, billingCycle: "MONTHLY", revision: "1", revisionId: addonIds.price, noChange: false, brackets }));
    const result = await addonsApi.replacePrices(owner, key, addonIds.addon, { billingCycle: "MONTHLY", expectedLadderRevision: "0", brackets, reason: "New ladder" }, addonIds.key);
    expect(result.brackets).toEqual(brackets);
    expect(mocks.patch.mock.calls[0][1].expectedLadderRevision).toBe("0");
  });
});
describe("Graduated ladder validation", () => {
  it.each([
    [], [{ minUsers: 2, maxUsers: null, unitPrice: "8" }], [{ minUsers: 1, maxUsers: 10, unitPrice: "8" }],
    [{ minUsers: 1, maxUsers: 10, unitPrice: "8" }, { minUsers: 10, maxUsers: null, unitPrice: "7" }],
    [{ minUsers: 1, maxUsers: null, unitPrice: "8" }, { minUsers: 11, maxUsers: null, unitPrice: "7" }],
    [{ minUsers: 1, maxUsers: null, unitPrice: "-1" }], [{ minUsers: 1, maxUsers: null, unitPrice: "1e2" }],
    [{ minUsers: 1, maxUsers: null, unitPrice: "0.00001" }], [{ minUsers: 1, maxUsers: null, unitPrice: 10 }],
    [{ minUsers: 1, maxUsers: null, unitPrice: "100000000000000" }],
  ].map(value => ({ value })))("rejects invalid ladder %#", ({ value }) => expect(() => readBrackets(value)).toThrow());
  it("accepts the maximum 100 contiguous brackets", () => {
    const rows = Array.from({ length: 100 }, (_, index) => ({ minUsers: index + 1, maxUsers: index === 99 ? null : index + 1, unitPrice: "0.0000" }));
    expect(readBrackets(rows)).toHaveLength(100);
    expect(() => readBrackets([...rows, rows[99]])).toThrow();
  });
  it("checks snapshot same-owner identity", () => {
    const fixture = addonFixture(); fixture.draft!.addonId = addonIds.app;
    expect(() => readAddonDetail(fixture)).toThrow();
  });
});

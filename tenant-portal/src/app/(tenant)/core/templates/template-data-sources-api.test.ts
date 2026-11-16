// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import owners from "./template-owner-metadata.fixture.json";
import letter from "./letter-authoring.fixture.json";
import { fetchTemplateDataSources } from "./template-data-sources-api";
import { fetchTemplateDataSchema } from "./template-design-api";

afterEach(() => vi.unstubAllGlobals());
const companyId = "018f15f8-a6d3-7b8c-9a1b-2c3d4e5f6789";

it("carries the exact company scope through the real cookie transport and validates all nine owner schemas", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { items: owners } }), { status: 200 }));
  vi.stubGlobal("fetch", fetch);
  await expect(fetchTemplateDataSources({ type: "COMPANY", companyId })).resolves.toEqual(owners);
  const url = new URL(String(fetch.mock.calls[0][0]), window.location.origin);
  expect(url.pathname).toBe("/api/tenant/core/v1/templates/data-sources");
  expect(Object.fromEntries(url.searchParams)).toEqual({ scopeType: "COMPANY", companyId });
  expect(fetch.mock.calls[0][1]).toMatchObject({ credentials: "include", cache: "no-store" });
});

const fullCatalogue = [...owners, letter.owner].sort((a, b) => a.adapterKey.localeCompare(b.adapterKey));

it("accepts all ten exact sources for an authorized Company, including the Core Letter source", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    success: true, data: { items: fullCatalogue },
  }), { status: 200 }));
  vi.stubGlobal("fetch", fetch);
  expect(fullCatalogue).toHaveLength(10);
  await expect(fetchTemplateDataSources({ type: "COMPANY", companyId })).resolves.toEqual(fullCatalogue);
  const url = new URL(String(fetch.mock.calls[0][0]), window.location.origin);
  expect(url.pathname).toBe("/api/tenant/core/v1/templates/data-sources");
  expect(Object.fromEntries(url.searchParams)).toEqual({ scopeType: "COMPANY", companyId });
  expect(fetch.mock.calls[0][1]).toMatchObject({ credentials: "include", cache: "no-store" });
});

it.each([
  ["a duplicate adapter", { ...owners[0] }],
  ["an unknown adapter", { ...letter.owner, adapterKey: "CORE_UNKNOWN_PRINT_V1" }],
  ["a mismatched document type", { ...letter.owner, documentType: "CONTRACT" }],
  ["a malformed schema checksum", { ...letter.owner, schemaChecksum: "invalid" }],
  ["a repeated locale", { ...letter.owner, supportedLocales: ["en-US", "en-US"] }],
])("rejects %s inside an otherwise ten-row catalogue", async (_case, replacement) => {
  const items = fullCatalogue.map(source => source.adapterKey === letter.owner.adapterKey ? replacement : source);
  expect(items).toHaveLength(10);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
    success: true, data: { items },
  }), { status: 200 })));
  await expect(fetchTemplateDataSources({ type: "COMPANY", companyId })).rejects.toThrow();
});

it("rejects an eleventh row", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
    success: true, data: { items: [...fullCatalogue, owners[0]] },
  }), { status: 200 })));
  await expect(fetchTemplateDataSources({ type: "COMPANY", companyId })).rejects.toThrow();
});

it("preserves Company access denial even when the response includes ten catalogue rows", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
    errorCode: "ACCESS_POLICY_BLOCKED", data: { items: fullCatalogue },
  }), { status: 403 })));
  await expect(fetchTemplateDataSources({ type: "COMPANY", companyId })).rejects.toMatchObject({
    response: { status: 403 },
  });
});

it("fences a retired Company request before fetch", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const stale = new Error("Retired Company authority");
  await expect(fetchTemplateDataSources({ type: "COMPANY", companyId }, undefined, () => {
    throw stale;
  })).rejects.toThrow("Retired Company authority");
  expect(fetch).not.toHaveBeenCalled();
});

it("preserves an actual HTTP entitlement denial instead of treating it as an empty registry", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ errorCode: "ACCESS_POLICY_BLOCKED" }), { status: 403 })));
  await expect(fetchTemplateDataSources({ type: "TENANT" })).rejects.toMatchObject({ response: { status: 403 } });
});

it("refuses a false success wrapper even around a valid owner catalogue", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, data: { items: owners } }), { status: 200 })));
  await expect(fetchTemplateDataSources({ type: "TENANT" })).rejects.toThrow();
});

it("retains field/fixture data while admitting only the requested schema identity and actual allowed layouts", async () => {
  const body = { ...owners[4], allowedLayoutModes: ["FIXED_CANVAS"],
    fields: [{ path: "invoice.number", dataType: "TEXT", allowedFormats: ["TEXT"] }],
    syntheticFixtures: [{ fixtureKey: "synthetic.invoice", locale: "ar-EG" }] };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: body }), { status: 200 })));
  await expect(fetchTemplateDataSchema("TRADE_INVOICE_PRINT_V1", { type: "TENANT" })).resolves.toMatchObject({
    adapterKey: "TRADE_INVOICE_PRINT_V1", allowedLayoutModes: ["FIXED_CANVAS"], fields: body.fields, syntheticFixtures: body.syntheticFixtures,
  });
});

it.each([
  ["the exact company", { type: "COMPANY", companyId }, true],
  ["a different company", { type: "COMPANY", companyId: companyId.replace(/9$/u, "a") }, false],
  ["a case-only company mismatch", { type: "COMPANY", companyId: companyId.toUpperCase() }, false],
  ["tenant scope", { type: "TENANT" }, false],
] as const)("checks the Sales save capability advertised for %s", async (_label, scope, allowed) => {
  const body = { ...owners[0], fields: [], syntheticFixtures: [],
    capabilities: { draftSavePrecondition: { kind: "draft-schema", scope } } };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ success: true, data: body })));
  const schema = fetchTemplateDataSchema("TRADE_QUOTATION_PRINT_V1", { type: "COMPANY", companyId });
  if (allowed) await expect(schema).resolves.toMatchObject({ schemaChecksum: body.schemaChecksum, draftSavePrecondition: "draft-schema" });
  else await expect(schema).rejects.toThrow("Invalid Core identity response.");
});

it("rejects a different registered adapter returned from the exact schema endpoint", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: {
    ...owners[0], fields: [], syntheticFixtures: [],
  } }), { status: 200 })));
  await expect(fetchTemplateDataSchema("TRADE_INVOICE_PRINT_V1", { type: "TENANT" })).rejects.toThrow();
});

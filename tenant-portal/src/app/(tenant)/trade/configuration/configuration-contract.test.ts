import { describe, expect, it } from "vitest";
import {
  buildCreateDefinitionRequest,
  buildCreateVersionRequest,
  buildResolveRequest,
  defaultPriceBookPath,
  defaultPriceBookUpsertPath,
  EMPTY_DEFINITION_FORM,
  EMPTY_VERSION_FORM,
  parseDefinitionsResponse,
  parseTestReport,
} from "./configuration-contract";

const DEFINITION_ID = "01890a5d-ac96-774b-bcce-b302099a8057";
const VERSION_ID = "01890a5d-ac96-774b-bcce-b302099a8058";

describe("buildCreateDefinitionRequest", () => {
  it("enforces the trade-prefixed key pattern", () => {
    expect(() =>
      buildCreateDefinitionRequest({ ...EMPTY_DEFINITION_FORM, key: "pricing.rounding", valueSchema: "{}" }),
    ).toThrow("DEFINITION_FORM_KEY");
  });

  it("requires a JSON object schema", () => {
    expect(() =>
      buildCreateDefinitionRequest({
        ...EMPTY_DEFINITION_FORM,
        key: "trade.pricing.rounding",
        valueSchema: "[]",
      }),
    ).toThrow("DEFINITION_FORM_SCHEMA");
  });

  it("requires at least one allowed scope", () => {
    expect(() =>
      buildCreateDefinitionRequest({
        ...EMPTY_DEFINITION_FORM,
        key: "trade.pricing.rounding",
        valueSchema: "{}",
        allowedScopes: [],
      }),
    ).toThrow("DEFINITION_FORM_SCOPES");
  });

  it("de-duplicates the scopes, which the server bounds at three", () => {
    const request = buildCreateDefinitionRequest({
      ...EMPTY_DEFINITION_FORM,
      key: "trade.pricing.rounding",
      valueSchema: "{}",
      allowedScopes: ["TENANT", "TENANT", "COMPANY"],
    });
    expect(request.allowedScopes).toEqual(["TENANT", "COMPANY"]);
  });
});

describe("buildCreateVersionRequest", () => {
  it("sends any JSON value — `value` is @Allow() and is checked only by the schema", () => {
    const request = buildCreateVersionRequest({
      ...EMPTY_VERSION_FORM,
      value: '{"mode":"HALF_UP"}',
      effectiveFrom: "2026-09-01T00:00",
    });
    expect(request.value).toEqual({ mode: "HALF_UP" });
    expect(request.effectiveFrom).toMatch(/^\d{4}-\d{2}-\d{2}T/u);
    expect("effectiveTo" in request).toBe(false);
  });

  it("rejects an unparseable value before the request is made", () => {
    expect(() =>
      buildCreateVersionRequest({
        ...EMPTY_VERSION_FORM,
        value: "{not json",
        effectiveFrom: "2026-09-01T00:00",
      }),
    ).toThrow("VERSION_FORM_VALUE");
  });

  it("requires an effective-from date", () => {
    expect(() => buildCreateVersionRequest(EMPTY_VERSION_FORM)).toThrow("VERSION_FORM_DATE");
  });
});

describe("buildResolveRequest", () => {
  it("takes one key per line and lowercases them", () => {
    expect(buildResolveRequest("Trade.Pricing.Rounding\n\ntrade.tax.mode", "")).toEqual({
      keys: ["trade.pricing.rounding", "trade.tax.mode"],
    });
  });

  it("refuses an empty or malformed key set", () => {
    expect(() => buildResolveRequest("", "")).toThrow("RESOLVE_FORM_KEYS");
    expect(() => buildResolveRequest("pricing.rounding", "")).toThrow("RESOLVE_FORM_KEYS");
  });
});

describe("defaultPriceBookPath", () => {
  it("builds the purpose and currency path segments", () => {
    expect(defaultPriceBookPath("SALES", "EGP")).toBe(
      "/api/tenant/trade/v1/configuration/company-default-price-books/SALES/EGP",
    );
    expect(defaultPriceBookUpsertPath("PURCHASE", "USD")).toMatch(/\/PURCHASE\/USD\/upsert$/u);
  });

  it("refuses a currency the path DTO would reject", () => {
    expect(() => defaultPriceBookPath("SALES", "eg")).toThrow("PRICE_BOOK_FORM_CURRENCY");
  });
});

describe("parseDefinitionsResponse", () => {
  it("reads the versions the list embeds per definition", () => {
    const page = parseDefinitionsResponse({
      items: [
        {
          id: DEFINITION_ID,
          key: "trade.pricing.rounding",
          valueSchema: {},
          allowedScopes: ["TENANT"],
          mergeStrategy: "OVERRIDE",
          riskClass: "LOW",
          version: 1,
          versions: [
            {
              id: VERSION_ID,
              versionNumber: 1,
              version: 1,
              scopeTarget: "TENANT",
              value: { mode: "HALF_UP" },
              status: "DRAFT",
              effectiveFrom: "2026-09-01T00:00:00.000Z",
              effectiveTo: null,
              contentHash: "a".repeat(64),
            },
          ],
        },
      ],
      total: 1,
      page: 1,
      limit: 25,
    });
    expect(page.items[0].versions[0].status).toBe("DRAFT");
  });

  it("tolerates a definition with no versions at this scope", () => {
    const page = parseDefinitionsResponse({
      items: [
        {
          id: DEFINITION_ID,
          key: "trade.pricing.rounding",
          valueSchema: {},
          allowedScopes: ["TENANT"],
          mergeStrategy: "OVERRIDE",
          riskClass: "LOW",
          version: 1,
        },
      ],
      total: 1,
      page: 1,
      limit: 25,
    });
    expect(page.items[0].versions).toEqual([]);
  });
});

describe("parseTestReport", () => {
  it("reads the diagnostics a failed test reports", () => {
    const report = parseTestReport({
      evidenceId: VERSION_ID,
      passed: false,
      diagnostics: ["VALUE_INVALID"],
      mergeStrategy: "OVERRIDE",
      contentHash: "a".repeat(64),
      version: 1,
    });
    expect(report).toEqual({ evidenceId: VERSION_ID, passed: false, diagnostics: ["VALUE_INVALID"] });
  });
});

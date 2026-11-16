import { describe, expect, it } from "vitest";
import { resolveCatalogCost } from "./catalog-cost";

describe("cost currency and redaction", () => {
  it("uses the actual profile currency rather than assuming the book currency", () => {
    expect(resolveCatalogCost(true, { standardCost: "12.12345678" }, { standardCost: "11", currencyCode: "USD" }))
      .toEqual({ amount: "12.12345678", currencyCode: "USD" });
  });
  it("keeps a known zero distinct from unavailable cost", () => {
    expect(resolveCatalogCost(true, { standardCost: "0" }, { standardCost: null, currencyCode: "EGP" })?.amount).toBe("0");
    expect(resolveCatalogCost(true, { standardCost: null }, { standardCost: null, currencyCode: "EGP" })).toBeNull();
  });
  it("omits cost when the server redacts it or its currency cannot be established", () => {
    expect(resolveCatalogCost(false, { standardCost: "10" }, { standardCost: "10", currencyCode: "EGP" })).toBeNull();
    expect(resolveCatalogCost(undefined, { standardCost: "10" }, { standardCost: "10", currencyCode: "EGP" })).toBeNull();
    expect(resolveCatalogCost(true, { standardCost: "10" }, undefined)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  getUomCatalogueMetadata,
  inferUomCategory,
  STARTER_UOM_LIBRARY,
  suggestAlternativeUomCodes,
  suggestValidUomCodes,
  UOM_CATEGORIES,
} from "./uom-catalogue-metadata";

describe("STARTER_UOM_LIBRARY", () => {
  it("contains all 119 standard international and Egyptian starter units across 9 categories", () => {
    expect(STARTER_UOM_LIBRARY).toHaveLength(119);
    const categories = new Set(STARTER_UOM_LIBRARY.map((item) => item.category));
    expect(categories.size).toBe(UOM_CATEGORIES.length);
  });

  it("recognizes standard units and exposes their UN/ECE code and category", () => {
    const kg = getUomCatalogueMetadata("kg", "Kilogram");
    expect(kg.isStandard).toBe(true);
    expect(kg.category).toBe("MASS");
    expect(kg.unEceCode).toBe("KGM");

    const feddan = getUomCatalogueMetadata("FED", "Feddan");
    expect(feddan.isStandard).toBe(true);
    expect(feddan.category).toBe("AREA");
  });

  it("infers measurement category for custom packaging, mass, and volume units", () => {
    expect(inferUomCategory("CTN-24", "Carton of 24")).toBe("PACKAGING");
    expect(inferUomCategory("SACK-50KG", "50kg Sack")).toBe("PACKAGING");
    expect(inferUomCategory("TON-BULK", "Bulk Tonne")).toBe("MASS");
    expect(inferUomCategory("BBL-CRUDE", "Oil Barrel")).toBe("VOLUME");
    expect(inferUomCategory("CUSTOM-X", "Special Unit")).toBe("COUNT");
  });
});

describe("suggestValidUomCodes", () => {
  it("flips leading digits to the end and strips invalid characters", () => {
    const suggestions = suggestValidUomCodes("24 BOX#", "Carton of 24");
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions).toContain("BOX-24");
    for (const code of suggestions) {
      expect(code).toMatch(/^[A-Z][A-Z0-9._-]{0,31}$/u);
    }
  });
});

describe("suggestAlternativeUomCodes", () => {
  it("generates available variations excluding codes already in the workspace", () => {
    const existing = new Set(["CTN", "CTN-24"]);
    const suggestions = suggestAlternativeUomCodes("CTN", existing);
    expect(suggestions).not.toContain("CTN");
    expect(suggestions).not.toContain("CTN-24");
    expect(suggestions).toContain("CTN-12");
  });
});

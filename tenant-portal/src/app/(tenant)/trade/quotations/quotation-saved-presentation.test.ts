import { describe, expect, it } from "vitest";
import { quotationSavedLines } from "./quotation-saved-presentation";
import {
  CATALOG_ITEM,
  CATALOG_UNIT,
  DETAIL_WITH_REVISION,
  ITEM_ID,
  draftLine,
} from "./hooks/quotation-composer.test-fixtures";

describe("saved quotation presentation evidence", () => {
  it("joins catalogue metadata by client line identity and keeps server financial values intact", () => {
    const saved = DETAIL_WITH_REVISION.currentLines[0];
    const cache = {
      lines: [{ ...draftLine(), quantity: "999", unitPrice: "777" }],
      itemsById: { [CATALOG_ITEM.id]: { ...CATALOG_ITEM, localizedNames: { en: "Mutable Live Name" } } },
      uomsByItem: { [CATALOG_ITEM.id]: [CATALOG_UNIT] },
    };
    const result = quotationSavedLines([saved], cache)[0];
    expect(result.line).toBe(saved);
    expect(result.line.quantity).toBe("10");
    expect(result.line.unitPrice).toBe("3590.00");
    expect(result.line.lineTotal).toBe("35900.00");
    expect(result.description).toBe("Industrial Valve");
    expect(result.sku).toBe("VALVE-1");
    expect(result.itemName).toBeNull();
    expect(result.uomCode).toBe("EA");
    expect(result.item?.canonicalCode).toBe("VALVE-1");
    expect(result.unit?.displayName).toBe("Each");
  });

  it("does not infer an item from array position or an unrelated cached line", () => {
    const cache = {
      lines: [{ ...draftLine(), clientLineId: "different-line" }],
      itemsById: { [CATALOG_ITEM.id]: CATALOG_ITEM },
      uomsByItem: { [CATALOG_ITEM.id]: [CATALOG_UNIT] },
    };
    const result = quotationSavedLines(DETAIL_WITH_REVISION.currentLines, cache)[0];
    expect(result.item).toBeNull();
    expect(result.unit).toBeNull();
    expect(result.sku).toBeNull();
    expect(result.line.descriptionSnapshot).toBe("Industrial Valve");
  });

  it("uses the saved UOM identity and refuses ambiguous duplicate cache identities", () => {
    const cache = {
      lines: [draftLine()],
      itemsById: { [CATALOG_ITEM.id]: CATALOG_ITEM },
      uomsByItem: { [CATALOG_ITEM.id]: [{ ...CATALOG_UNIT, id: "different-unit" }] },
    };
    expect(quotationSavedLines(DETAIL_WITH_REVISION.currentLines, cache)[0].unit).toBeNull();
    expect(
      quotationSavedLines(DETAIL_WITH_REVISION.currentLines, {
        ...cache,
        lines: [draftLine(), draftLine()],
      })[0].item,
    ).toBeNull();
  });

  it("resolves persisted discountSnapshot.itemId and frozen taxSnapshot metadata without draft lines", () => {
    const imageId = "01890000-0000-7000-8000-000000000077";
    const saved = {
      ...DETAIL_WITH_REVISION.currentLines[0],
      descriptionSnapshot: "Frozen Revision Description",
      discountSnapshot: { itemId: ITEM_ID },
      itemImageId: imageId,
      taxSnapshot: { sku: "SNAP-SKU-9", uomCode: "BOX" },
    };
    const withoutCatalog = quotationSavedLines([saved])[0];
    expect(withoutCatalog.item).toBeNull();
    expect(withoutCatalog.description).toBe("Frozen Revision Description");
    expect(withoutCatalog.sku).toBe("SNAP-SKU-9");
    expect(withoutCatalog.uomCode).toBe("BOX");
    expect(withoutCatalog.imageItemId).toBe(ITEM_ID);
    expect(withoutCatalog.imageId).toBe(imageId);

    const withCatalog = quotationSavedLines([saved], {
      itemsById: {
        [ITEM_ID]: {
          ...CATALOG_ITEM,
          canonicalCode: "LIVE-SKU",
          quotationDescription: "Mutable Catalogue Description",
        },
      },
      uomsByItem: { [ITEM_ID]: [CATALOG_UNIT] },
    })[0];
    expect(withCatalog.item?.id).toBe(ITEM_ID);
    expect(withCatalog.unit?.displayName).toBe("Each");
    expect(withCatalog.description).toBe("Frozen Revision Description");
    expect(withCatalog.sku).toBe("SNAP-SKU-9");
  });

  it("rejects catalogue items whose companyProfileId conflicts with the saved line snapshot", () => {
    const saved = {
      ...DETAIL_WITH_REVISION.currentLines[0],
      discountSnapshot: { itemId: ITEM_ID },
      itemCompanyProfileId: "01890000-0000-7000-8000-000000000098",
      itemImageId: "01890000-0000-7000-8000-000000000077",
    };
    const result = quotationSavedLines([saved], {
      itemsById: { [ITEM_ID]: CATALOG_ITEM },
      uomsByItem: { [ITEM_ID]: [CATALOG_UNIT] },
    })[0];
    expect(result.item).toBeNull();
    expect(result.unit).toBeNull();
    expect(result.sku).toBeNull();
    expect(result.imageItemId).toBeNull();
    expect(result.imageId).toBeNull();
  });

  it("accepts explicit read-only lineDisplayById enrichment without mutating server description or money", () => {
    const saved = DETAIL_WITH_REVISION.currentLines[0];
    const result = quotationSavedLines([saved], undefined, {
      [saved.clientLineId]: {
        description: "Ignored Mutable Override",
        itemName: "Authorized Item Title",
        sku: "AUTH-01",
        uomCode: "PCS",
        unavailable: true,
      },
    })[0];
    expect(result.description).toBe("Industrial Valve");
    expect(result.itemName).toBe("Authorized Item Title");
    expect(result.sku).toBe("AUTH-01");
    expect(result.uomCode).toBe("PCS");
    expect(result.unavailable).toBe(true);
    expect(result.line.lineTotal).toBe("35900.00");
  });
});

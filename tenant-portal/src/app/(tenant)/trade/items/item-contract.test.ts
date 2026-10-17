import { describe, expect, it } from "vitest";
import {
  buildCreateItemRequest,
  buildItemReferenceSearchRequest,
  buildItemSearchRequest,
  buildUpdateItemRequest,
  EMPTY_ITEM_FORM,
  formatTradeDecimal,
  parseItemDetailResponse,
  parseItemResponse,
  toItemForm,
  type Item,
} from "./item-contract";
import { itemReferenceDataPath, parseItemReferenceData } from "./item-reference-data-contract";
import {
  buildCompanyProfileRequest,
  buildListingRequest,
  EMPTY_COMPANY_PROFILE_FORM,
  EMPTY_LISTING_FORM,
} from "./item-profile-contract";
import {
  buildStandardCostRequest,
  parseStandardCostResponse,
} from "./item-standard-cost-contract";

const ITEM_ID = "01890a5d-ac96-774b-bcce-b302099a8057";
const UOM_ID = "01890a5d-ac96-774b-bcce-b302099a8058";
const CHANNEL_ID = "01890a5d-ac96-774b-bcce-b302099a8059";
const CATEGORY_CHOSEN_FORM = { ...EMPTY_ITEM_FORM, category: { kind: "none" } as const };

const stored: Item = {
  id: ITEM_ID,
  canonicalCode: "SKU-1",
  itemKind: "PRODUCT",
  baseUomId: UOM_ID,
  localizedNames: { en: "Widget" },
  categoryId: null,
  categorySummary: null,
  variantIdentity: null,
  barcode: null,
  notes: null,
  ownerUserId: null,
  weightKg: null,
  volumeM3: null,
  quotationDescription: null,
  salesOrderDescription: null,
  receiptDescription: null,
  deliveryOrderDescription: null,
  comboComponents: [],
  optionalProducts: [],
  status: "DRAFT",
  version: 2,
  updatedAt: "2026-08-31T09:00:00.000Z",
  eligibility: null,
  image: null,
};

describe("buildCreateItemRequest", () => {
  it("requires explicit category intent instead of silently creating an uncategorized item", () => {
    const draft = { ...EMPTY_ITEM_FORM, canonicalCode: "SKU1", nameEn: "Widget", baseUomId: UOM_ID };
    expect(() => buildCreateItemRequest(draft)).toThrow("ITEM_FORM_CATEGORY");
    expect(buildCreateItemRequest({ ...draft, category: { kind: "none" } }).categoryId).toBeNull();
  });
  it("enforces the code pattern the server enforces with a 500, not a 422", () => {
    // `CreateItemDto.canonicalCode` has no pattern; `normalizeTradeCode` then
    // throws a bare TypeError for anything outside it. Q72.
    expect(() =>
      buildCreateItemRequest({ ...CATEGORY_CHOSEN_FORM, canonicalCode: "SKU 1", nameEn: "x", baseUomId: UOM_ID }),
    ).toThrow("ITEM_FORM_CODE");
  });

  it("requires a base UOM id", () => {
    expect(() =>
      buildCreateItemRequest({ ...CATEGORY_CHOSEN_FORM, canonicalCode: "SKU1", nameEn: "x" }),
    ).toThrow("ITEM_FORM_UOM");
  });

  it("matches the item service's 200-character localized-name bound", () => {
    expect(buildCreateItemRequest({
      ...CATEGORY_CHOSEN_FORM,
      canonicalCode: "SKU-NAME",
      nameEn: "x".repeat(200),
      baseUomId: UOM_ID,
    }).localizedNames.en).toHaveLength(200);
    expect(() => buildCreateItemRequest({
      ...CATEGORY_CHOSEN_FORM,
      canonicalCode: "SKU-NAME-2",
      nameEn: "x".repeat(201),
      baseUomId: UOM_ID,
    })).toThrow("ITEM_FORM_NAMES");
  });

  it("omits an empty variant identity rather than sending null", () => {
    const request = buildCreateItemRequest({
      ...CATEGORY_CHOSEN_FORM,
      canonicalCode: "sku1",
      nameEn: "Widget",
      baseUomId: UOM_ID,
    });
    expect(request.canonicalCode).toBe("SKU1");
    expect("variantIdentity" in request).toBe(false);
  });

  it("rejects a variant identity that is not a JSON object", () => {
    expect(() =>
      buildCreateItemRequest({
        ...CATEGORY_CHOSEN_FORM,
        canonicalCode: "SKU1",
        nameEn: "x",
        baseUomId: UOM_ID,
        variantIdentity: "[1,2]",
      }),
    ).toThrow("ITEM_FORM_VARIANT");
  });

  it("reports an invalid optional category separately from the required UOM", () => {
    expect(() =>
      buildCreateItemRequest({
        ...CATEGORY_CHOSEN_FORM,
        canonicalCode: "SKU1",
        nameEn: "Widget",
        baseUomId: UOM_ID,
        category: { kind: "selected", id: "not-a-category-id" },
      }),
    ).toThrow("ITEM_FORM_CATEGORY");
  });

  it("keeps combo components and cross-sell products as separate wire collections", () => {
    const componentItemId = "01890a5d-ac96-774b-bcce-b302099a8060";
    const optionalProductItemId = "01890a5d-ac96-774b-bcce-b302099a8061";
    const request = buildCreateItemRequest({
      ...CATEGORY_CHOSEN_FORM,
      canonicalCode: "BUNDLE-1",
      nameEn: "Bundle",
      baseUomId: UOM_ID,
      itemKind: "COMBO",
      comboComponents: [{ key: "component-1", itemId: componentItemId, quantity: "2" }],
      optionalProducts: [{ key: "optional-1", itemId: optionalProductItemId }],
    });
    expect(request.comboComponents).toEqual([
      { componentItemId, quantity: "2", sortOrder: 0 },
    ]);
    expect(request.optionalProducts).toEqual([{ optionalProductItemId, sortOrder: 0 }]);
  });

  it("omits comboComponents for products while retaining nullable identity fields", () => {
    const request = buildCreateItemRequest({
      ...CATEGORY_CHOSEN_FORM,
      canonicalCode: "SKU2",
      nameEn: "Widget",
      baseUomId: UOM_ID,
      barcode: "ABC-123",
    });
    expect("comboComponents" in request).toBe(false);
    expect(request.barcode).toBe("ABC-123");
    expect(request.quotationDescription).toBeNull();
  });

  it("rejects numeric(24,8) values with more than 16 integer digits", () => {
    expect(() => buildCreateItemRequest({
      ...CATEGORY_CHOSEN_FORM,
      canonicalCode: "SKU3",
      nameEn: "Widget",
      baseUomId: UOM_ID,
      weightKg: "12345678901234567",
    })).toThrow("ITEM_FORM_DECIMAL");
  });
});

describe("buildUpdateItemRequest", () => {
  it("omits a retained assignment when options cannot be resolved", () => {
    expect(buildUpdateItemRequest({ ...stored, categoryId: UOM_ID }, {
      ...toItemForm(stored), category: { kind: "unresolved" },
    })).not.toHaveProperty("categoryId");
  });
  it("clears a category with an explicit null, not by omission", () => {
    const request = buildUpdateItemRequest(
      { ...stored, categoryId: UOM_ID },
      { ...toItemForm({ ...stored, categoryId: UOM_ID }), category: { kind: "none" } },
    );
    expect(request.categoryId).toBeNull();
  });

  it("emits nothing when nothing moved", () => {
    expect(buildUpdateItemRequest(stored, toItemForm(stored))).toEqual({});
  });

  it("sends only the status for a board move", () => {
    expect(buildUpdateItemRequest(stored, { ...toItemForm(stored), status: "ACTIVE" })).toEqual({
      status: "ACTIVE",
    });
  });
});

describe("buildItemSearchRequest", () => {
  it("builds text search across name, code and barcode with top-level filters", () => {
    expect(buildItemSearchRequest(2, " sku1 ", "PRODUCT", "ACTIVE")).toEqual({
      page: 2,
      limit: 25,
      itemKind: "PRODUCT",
      status: "ACTIVE",
      search: "sku1",
      filters: [],
    });
  });

  it("builds the active-product selector search with the canonical wire fields", () => {
    expect(buildItemReferenceSearchRequest("  bolt  ")).toEqual({
      page: 1,
      limit: 25,
      itemKind: "PRODUCT",
      status: "ACTIVE",
      search: "bolt",
      filters: [],
    });
  });

  it("does not rewrite untouched relations merely to normalize stored sort-order gaps", () => {
    const componentItemId = "01890a5d-ac96-774b-bcce-b302099a8060";
    const optionalProductItemId = "01890a5d-ac96-774b-bcce-b302099a8061";
    const combo: Item = {
      ...stored,
      itemKind: "COMBO",
      comboComponents: [{ componentItemId, quantity: "2", sortOrder: 10 }],
      optionalProducts: [{ optionalProductItemId, sortOrder: 20 }],
    };
    expect(buildUpdateItemRequest(combo, toItemForm(combo))).toEqual({});
  });
});

describe("buildCompanyProfileRequest", () => {
  it("always sends the four required fields plus capabilitySet", () => {
    // The body is a FULL upsert even on PATCH: an omitted `capabilitySet`
    // clears the stored one to [].
    const request = buildCompanyProfileRequest(EMPTY_COMPANY_PROFILE_FORM);
    expect(request).toMatchObject({
      canSell: false,
      canPurchase: false,
      canPos: false,
      trackInventory: false,
      trackingMode: "NONE",
      salesPrice: null,
      currencyCode: null,
      salesTaxId: null,
      purchaseTaxId: null,
      capabilitySet: [],
    });
  });

  it("rejects a capability set that is not a JSON array", () => {
    expect(() =>
      buildCompanyProfileRequest({ ...EMPTY_COMPANY_PROFILE_FORM, capabilitySet: "{}" }),
    ).toThrow("PROFILE_FORM_CAPABILITY");
  });

  it("stores commercial selections by id and enforces POS eligibility", () => {
    const request = buildCompanyProfileRequest({
      ...EMPTY_COMPANY_PROFILE_FORM,
      canSell: true,
      canPos: true,
      salesPrice: "19.95",
      currencyCode: "egp",
      salesTaxId: ITEM_ID,
      purchaseTaxId: UOM_ID,
    });
    expect(request).toMatchObject({
      canSell: true,
      canPos: true,
      salesPrice: "19.95",
      currencyCode: "EGP",
      salesTaxId: ITEM_ID,
      purchaseTaxId: UOM_ID,
    });
    expect(() => buildCompanyProfileRequest({
      ...EMPTY_COMPANY_PROFILE_FORM,
      canPos: true,
    })).toThrow("PROFILE_FORM_POS_REQUIRES_SALES");
    expect(() => buildCompanyProfileRequest({
      ...EMPTY_COMPANY_PROFILE_FORM,
      salesPrice: "12345678901234567",
      currencyCode: "EGP",
    })).toThrow("PROFILE_FORM_PRICE");
    expect(() => buildCompanyProfileRequest({
      ...EMPTY_COMPANY_PROFILE_FORM,
      trackingMode: "LOT",
    })).toThrow("PROFILE_FORM_TRACKING_REQUIRES_INVENTORY");
  });
});

describe("protected standard cost and reference data", () => {
  it("keeps cost in its dedicated contract and requires a company currency", () => {
    expect(buildStandardCostRequest(" 12.50 ", "EGP")).toEqual({ standardCost: "12.50" });
    expect(buildStandardCostRequest("", null)).toEqual({ standardCost: null });
    expect(() => buildStandardCostRequest("12.50", null)).toThrow(
      "STANDARD_COST_CURRENCY_REQUIRED",
    );
    expect(() => buildStandardCostRequest("12345678901234567", "EGP")).toThrow(
      "STANDARD_COST_FORM_VALUE",
    );
    expect(parseStandardCostResponse({
      itemId: ITEM_ID,
      companyProfileId: UOM_ID,
      standardCost: "12.50",
      currencyCode: "EGP",
      version: 3,
    })).toMatchObject({ standardCost: "12.50", currencyCode: "EGP", version: 3 });
  });

  it("formats integer and zero-padded decimals to 2 decimal places while preserving >2 significant fractional digits", () => {
    expect(formatTradeDecimal("6000")).toBe("6000.00");
    expect(formatTradeDecimal("6000.00")).toBe("6000.00");
    expect(formatTradeDecimal("6000.00000000")).toBe("6000.00");
    expect(formatTradeDecimal("6000.5")).toBe("6000.50");
    expect(formatTradeDecimal("6000.458011")).toBe("6000.458011");
    expect(formatTradeDecimal("6000.45801100")).toBe("6000.458011");
    expect(buildStandardCostRequest("6000", "EGP")).toEqual({ standardCost: "6000.00" });
    expect(buildStandardCostRequest("6000.00000000", "EGP")).toEqual({ standardCost: "6000.00" });
    expect(buildStandardCostRequest("6000.458011", "EGP")).toEqual({ standardCost: "6000.458011" });
  });

  it("parses owner and tax references while preserving their ids", () => {
    expect(parseItemReferenceData({
      owners: [{ id: ITEM_ID, name: "Catalog owner" }],
      taxes: [{
        id: UOM_ID,
        code: "VAT14",
        name: "VAT",
        rate: "14",
        isInclusive: false,
        companyId: null,
      }],
      companyCurrencyCode: "EGP",
    })).toEqual({
      owners: [{ id: ITEM_ID, name: "Catalog owner" }],
      taxes: [{
        id: UOM_ID,
        code: "VAT14",
        name: "VAT",
        rate: "14",
        isInclusive: false,
        companyId: null,
      }],
      companyCurrencyCode: "EGP",
    });
    expect(itemReferenceDataPath("  vat 14  ")).toBe(
      "/api/tenant/trade/v1/items/reference-data?search=vat+14&limit=50",
    );
    expect(new URL(itemReferenceDataPath("x".repeat(121)), "https://example.test")
      .searchParams.get("search")).toHaveLength(120);
    expect(parseItemReferenceData({
      owners: [{ id: ITEM_ID, name: "x".repeat(161) }],
      taxes: [],
      companyCurrencyCode: null,
    }).owners[0]?.name).toHaveLength(161);
    expect(() => parseItemReferenceData({
      owners: [{ id: ITEM_ID, name: "x".repeat(256) }],
      taxes: [],
      companyCurrencyCode: null,
    })).toThrow("Invalid Trade item reference-data response.");
  });
});

describe("buildListingRequest", () => {
  it("always sends publicationStatus, which otherwise resets to DRAFT", () => {
    const request = buildListingRequest(
      { ...EMPTY_LISTING_FORM, channelId: CHANNEL_ID, publicationStatus: "" },
      true,
    );
    expect(request).toEqual({
      channelId: CHANNEL_ID,
      publicationStatus: "DRAFT",
      saleConstraints: {},
    });
  });

  it("omits the channel on an update — it is a path parameter there", () => {
    const request = buildListingRequest({ ...EMPTY_LISTING_FORM, channelId: "" }, false);
    expect("channelId" in request).toBe(false);
  });
});

describe("parseItemResponse", () => {
  it("reads the eligibility projection the company-scoped list adds", () => {
    const parsed = parseItemResponse({
      ...stored,
      eligibility: {
        companyProfileId: ITEM_ID,
        companyProfileVersion: 1,
        companyProfileStatus: "DRAFT",
        canSell: true,
        canPurchase: false,
        canPos: true,
        baseUomId: UOM_ID,
        defaultSalesUomId: UOM_ID,
        defaultPurchaseUomId: UOM_ID,
        branchProfileId: null,
        branchProfileVersion: null,
        isAssorted: null,
      },
    });
    expect(parsed.eligibility?.canSell).toBe(true);
    expect(parsed.eligibility?.isAssorted).toBeNull();
  });

  it("reads a tenant-wide row, where eligibility is absent entirely", () => {
    expect(parseItemResponse(stored).eligibility).toBeNull();
  });

  it("parses relation wire keys on detail responses and accepts their absence on list rows", () => {
    const componentItemId = "01890a5d-ac96-774b-bcce-b302099a8060";
    const optionalProductItemId = "01890a5d-ac96-774b-bcce-b302099a8061";
    expect(parseItemResponse({
      ...stored,
      itemKind: "COMBO",
      comboComponents: [{ componentItemId, quantity: "2", sortOrder: 0 }],
      optionalProducts: [{ optionalProductItemId, sortOrder: 0 }],
    })).toMatchObject({
      comboComponents: [{ componentItemId, quantity: "2", sortOrder: 0 }],
      optionalProducts: [{ optionalProductItemId, sortOrder: 0 }],
    });
    const { comboComponents: _combo, optionalProducts: _optional, ...listRow } = stored;
    expect(parseItemResponse(listRow)).toMatchObject({ comboComponents: [], optionalProducts: [] });
    expect(() => parseItemDetailResponse(listRow)).toThrow("Invalid Trade items response.");
  });

  it("accepts the backend contract maximum instead of failing on valid large relation sets", () => {
    const comboComponents = Array.from({ length: 101 }, (_, index) => ({
      componentItemId: `01890a5d-ac96-774b-bcce-${(index + 1).toString(16).padStart(12, "0")}`,
      quantity: "1",
      sortOrder: index,
    }));

    expect(parseItemResponse({
      ...stored,
      itemKind: "COMBO",
      comboComponents,
      optionalProducts: [],
    }).comboComponents).toHaveLength(101);
  });

  it("rejects item kinds outside the supported product, service and combo set", () => {
    expect(() => parseItemResponse({ ...stored, itemKind: "UNKNOWN" })).toThrow(
      "Invalid Trade items response.",
    );
  });
});

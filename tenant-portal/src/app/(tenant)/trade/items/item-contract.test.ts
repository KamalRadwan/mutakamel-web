import { describe, expect, it } from "vitest";
import {
  buildCreateItemRequest,
  buildItemSearchRequest,
  buildUpdateItemRequest,
  EMPTY_ITEM_FORM,
  parseItemResponse,
  toItemForm,
  type Item,
} from "./item-contract";
import {
  buildCompanyProfileRequest,
  buildListingRequest,
  EMPTY_COMPANY_PROFILE_FORM,
  EMPTY_LISTING_FORM,
} from "./item-profile-contract";

const ITEM_ID = "01890a5d-ac96-774b-bcce-b302099a8057";
const UOM_ID = "01890a5d-ac96-774b-bcce-b302099a8058";
const CHANNEL_ID = "01890a5d-ac96-774b-bcce-b302099a8059";

const stored: Item = {
  id: ITEM_ID,
  canonicalCode: "SKU-1",
  itemKind: "PRODUCT",
  baseUomId: UOM_ID,
  localizedNames: { en: "Widget" },
  categoryId: null,
  variantIdentity: null,
  status: "DRAFT",
  version: 2,
  updatedAt: "2026-08-31T09:00:00.000Z",
  eligibility: null,
};

describe("buildCreateItemRequest", () => {
  it("enforces the code pattern the server enforces with a 500, not a 422", () => {
    // `CreateItemDto.canonicalCode` has no pattern; `normalizeTradeCode` then
    // throws a bare TypeError for anything outside it. Q72.
    expect(() =>
      buildCreateItemRequest({ ...EMPTY_ITEM_FORM, canonicalCode: "SKU 1", nameEn: "x", baseUomId: UOM_ID }),
    ).toThrow("ITEM_FORM_CODE");
  });

  it("requires a base UOM id", () => {
    expect(() =>
      buildCreateItemRequest({ ...EMPTY_ITEM_FORM, canonicalCode: "SKU1", nameEn: "x" }),
    ).toThrow("ITEM_FORM_UOM");
  });

  it("omits an empty variant identity rather than sending null", () => {
    const request = buildCreateItemRequest({
      ...EMPTY_ITEM_FORM,
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
        ...EMPTY_ITEM_FORM,
        canonicalCode: "SKU1",
        nameEn: "x",
        baseUomId: UOM_ID,
        variantIdentity: "[1,2]",
      }),
    ).toThrow("ITEM_FORM_VARIANT");
  });
});

describe("buildUpdateItemRequest", () => {
  it("clears a category with an explicit null, not by omission", () => {
    const request = buildUpdateItemRequest(
      { ...stored, categoryId: UOM_ID },
      { ...toItemForm({ ...stored, categoryId: UOM_ID }), categoryId: "" },
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
  it("builds equality filters only — there is no partial match on this route", () => {
    expect(buildItemSearchRequest(2, " sku1 ", "PRODUCT", "ACTIVE")).toEqual({
      page: 2,
      limit: 25,
      filters: [
        { field: "canonicalCode", value: "SKU1" },
        { field: "itemKind", value: "PRODUCT" },
        { field: "status", value: "ACTIVE" },
      ],
    });
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
      trackInventory: false,
      trackingMode: "NONE",
      capabilitySet: [],
    });
  });

  it("rejects a capability set that is not a JSON array", () => {
    expect(() =>
      buildCompanyProfileRequest({ ...EMPTY_COMPANY_PROFILE_FORM, capabilitySet: "{}" }),
    ).toThrow("PROFILE_FORM_CAPABILITY");
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
});

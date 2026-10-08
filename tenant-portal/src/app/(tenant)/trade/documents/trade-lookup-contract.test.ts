import { describe, expect, it } from "vitest";
import {
  itemDescriptionPreview,
  parseTradeItems,
  tradeItemsPath,
  type TradeItemOption,
} from "./trade-lookup-contract";

const ITEM_ID = "0192f3a0-0000-7000-8000-000000000001";
const PROFILE_ID = "0192f3a0-0000-7000-8000-000000000002";
const UOM_ID = "0192f3a0-0000-7000-8000-000000000003";
const BRANCH_PROFILE_ID = "0192f3a0-0000-7000-8000-000000000009";

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: ITEM_ID,
    canonicalCode: "SKU-001",
    barcode: "6221234567890",
    localizedNames: { en: "Blue widget", ar: "أداة زرقاء" },
    quotationDescription: "Blue widget with quotation copy",
    salesOrderDescription: null,
    receiptDescription: null,
    deliveryOrderDescription: null,
    status: "ACTIVE",
    eligibility: {
      companyProfileId: PROFILE_ID,
      companyProfileVersion: 2,
      companyProfileStatus: "ACTIVE",
      canSell: true,
      canPurchase: false,
      canPos: false,
      baseUomId: UOM_ID,
      defaultSalesUomId: UOM_ID,
      defaultPurchaseUomId: UOM_ID,
      branchProfileId: BRANCH_PROFILE_ID,
      branchProfileVersion: 1,
      isAssorted: true,
    },
    ...overrides,
  };
}

function page(items: unknown[]) {
  return { items, total: items.length, page: 1, limit: 100 };
}

describe("trade item lookup contract", () => {
  it("builds a purpose-aware server search over names, codes, and barcodes", () => {
    expect(tradeItemsPath(1, "SALES", "  blue widget  ")).toBe(
      "/api/tenant/trade/v1/items?page=1&limit=100&purpose=SALES&search=blue+widget",
    );
  });

  it("parses catalogue metadata and fails closed by filtering ineligible rows", () => {
    const parsed = parseTradeItems(
      page([
        item(),
        item({
          id: "0192f3a0-0000-7000-8000-000000000004",
          eligibility: { ...item().eligibility, canSell: false },
        }),
      ]),
      "SALES",
    );

    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]).toMatchObject({
      canonicalCode: "SKU-001",
      barcode: "6221234567890",
      quotationDescription: "Blue widget with quotation copy",
      eligibility: { canSell: true, canPurchase: false, canPos: false },
    });
  });

  it("rejects a response that omits company eligibility", () => {
    const { eligibility: _eligibility, ...withoutEligibility } = item();
    expect(() => parseTradeItems(page([withoutEligibility]), "SALES")).toThrow(
      "Invalid Trade document response.",
    );
  });

  it("fails closed when the branch has not assorted the item", () => {
    const parsed = parseTradeItems(page([
      item(),
      item({
        id: "0192f3a0-0000-7000-8000-000000000005",
        eligibility: {
          ...item().eligibility,
          branchProfileId: null,
          branchProfileVersion: null,
          isAssorted: null,
        },
      }),
    ]), "SALES");
    expect(parsed.items).toHaveLength(1);
  });

  it("previews quotation copy and uses the server-stable description fallback", () => {
    const parsed = parseTradeItems(page([item()]), "SALES").items[0] as TradeItemOption;
    expect(itemDescriptionPreview(parsed, "en", "SALES")).toBe(
      "Blue widget with quotation copy",
    );
    expect(itemDescriptionPreview(parsed, "ar", "PURCHASE")).toBe("Blue widget");
    expect(itemDescriptionPreview({ ...parsed, quotationDescription: null }, "ar", "SALES"))
      .toBe("Blue widget");
  });
});

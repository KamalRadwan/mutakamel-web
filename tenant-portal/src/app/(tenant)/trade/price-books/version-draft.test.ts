import { describe, expect, it } from "vitest";
import {
  EMPTY_PRICE_ENTRY_DRAFT,
  EMPTY_PROMOTION_DRAFT,
  buildCreateVersionRequest,
  detectVersionDraftConflicts,
  type VersionDraft,
} from "./version-draft";

const VALID_ITEM_ID = "0195b5d0-1234-7000-8000-000000000010";
const VALID_UOM_ID = "0195b5d0-1234-7000-8000-000000000011";
const VALID_BRANCH_ID = "0195b5d0-1234-7000-8000-000000000012";

describe("version-draft", () => {
  it("detects overlapping quantity tiers, currency mismatch, floor > unit price, invalid qty range, and >100% promo", () => {
    const draft: VersionDraft = {
      effectiveFrom: "2026-05-01T00:00:00.000Z",
      effectiveTo: "",
      entries: [
        {
          ...EMPTY_PRICE_ENTRY_DRAFT,
          itemId: VALID_ITEM_ID,
          uomId: VALID_UOM_ID,
          currencyCode: "USD",
          minimumQuantity: "10",
          maximumQuantity: "50",
          unitPrice: "100.00",
          minimumAllowedPrice: "120.00",
          priority: "100",
        },
        {
          ...EMPTY_PRICE_ENTRY_DRAFT,
          itemId: VALID_ITEM_ID,
          uomId: VALID_UOM_ID,
          currencyCode: "SAR",
          minimumQuantity: "40",
          maximumQuantity: "20",
          unitPrice: "90.00",
          minimumAllowedPrice: "80.00",
          priority: "200",
        },
      ],
      promotions: [
        {
          ...EMPTY_PROMOTION_DRAFT,
          code: "PROMO-OVER-100",
          name: "Excessive Percentage",
          benefitType: "PERCENTAGE",
          discountValue: "125",
        },
      ],
    };

    const report = detectVersionDraftConflicts(draft, "SAR");
    expect(report.hasConflicts).toBe(true);
    expect(report.currencyMismatchIndices).toEqual([0]);
    expect(report.floorAboveUnitIndices).toEqual([0]);
    expect(report.invalidQtyRangeIndices).toEqual([1]);
    expect(report.percentageOver100PromotionIndices).toEqual([0]);
  });

  it("builds a clean CreatePriceBookVersionDto request with optional promotion scoping fields", () => {
    const draft: VersionDraft = {
      effectiveFrom: "2026-05-01T00:00:00.000Z",
      effectiveTo: "2026-12-31T23:59:59.000Z",
      entries: [
        {
          itemId: VALID_ITEM_ID,
          uomId: VALID_UOM_ID,
          currencyCode: "sar",
          minimumQuantity: "1",
          maximumQuantity: "99",
          unitPrice: "250.50",
          minimumAllowedPrice: "200.00",
          priority: "100",
        },
      ],
      promotions: [
        {
          ...EMPTY_PROMOTION_DRAFT,
          code: "RAMADAN-10",
          name: "Ramadan 10% Off",
          benefitType: "PERCENTAGE",
          discountValue: "10",
          priority: "50",
          stackGroup: "SEASONAL",
          exclusive: true,
          itemId: VALID_ITEM_ID,
          uomId: VALID_UOM_ID,
          branchId: VALID_BRANCH_ID,
          minimumQuantity: "5",
          maximumQuantity: "50",
        },
      ],
    };

    const req = buildCreateVersionRequest(draft);
    expect(req.entries).toHaveLength(1);
    expect(req.entries[0]?.currencyCode).toBe("SAR");
    expect(req.entries[0]?.maximumQuantity).toBe("99");
    expect(req.entries[0]?.minimumAllowedPrice).toBe("200.00");
    expect(req.promotions).toHaveLength(1);
    expect(req.promotions[0]?.branchId).toBe(VALID_BRANCH_ID);
    expect(req.promotions[0]?.minimumQuantity).toBe("5");
    expect(req.promotions[0]?.maximumQuantity).toBe("50");
  });
});

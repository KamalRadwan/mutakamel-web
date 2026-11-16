import { describe, expect, it } from "vitest";
import {
  EMPTY_PRICE_ENTRY_DRAFT,
  EMPTY_PROMOTION_DRAFT,
  applyBulkFormulaToDraftEntries,
  applyPriceFormulaBigInt,
  buildCreateVersionRequest,
  buildUpdatePriceBookVersionRequest,
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
    expect(req.promotions?.[0]?.branchId).toBe(VALID_BRANCH_ID);
    expect(req.promotions?.[0]?.minimumQuantity).toBe("5");
    expect(req.promotions?.[0]?.maximumQuantity).toBe("50");
  });

  it("allows empty entries on PATCH update while rejecting empty entries on POST create", () => {
    const emptyDraft: VersionDraft = {
      effectiveFrom: "2026-06-01T00:00:00.000Z",
      effectiveTo: "",
      notes: "   ",
      entries: [],
      promotions: [],
    };
    const updatePayload = buildUpdatePriceBookVersionRequest(emptyDraft);
    expect(updatePayload.entries).toEqual([]);
    expect(updatePayload.promotions).toEqual([]);
    expect(updatePayload.effectiveTo).toBeNull();
    expect(updatePayload.notes).toBeNull();
    expect(() => buildCreateVersionRequest(emptyDraft)).toThrow("PRICING_FORM_ENTRIES");
  });

  it("preserves exact 8-decimal strings and distinguishes explicit 0 floor from empty/no floor", () => {
    const draft: VersionDraft = {
      effectiveFrom: "2026-06-01T00:00:00.000Z",
      effectiveTo: "",
      entries: [
        {
          itemId: VALID_ITEM_ID,
          uomId: VALID_UOM_ID,
          currencyCode: "SAR",
          minimumQuantity: "1",
          maximumQuantity: "10",
          unitPrice: "12.34567891",
          minimumAllowedPrice: "0",
          priority: "100",
        },
        {
          itemId: VALID_ITEM_ID,
          uomId: VALID_UOM_ID,
          currencyCode: "SAR",
          minimumQuantity: "10",
          maximumQuantity: "",
          unitPrice: "9.87654321",
          minimumAllowedPrice: "",
          priority: "100",
        },
      ],
      promotions: [],
    };
    const payload = buildUpdatePriceBookVersionRequest(draft);
    expect(payload.entries[0]?.unitPrice).toBe("12.34567891");
    expect(payload.entries[0]?.minimumAllowedPrice).toBe("0");
    expect(payload.entries[1]?.unitPrice).toBe("9.87654321");
    expect("minimumAllowedPrice" in (payload.entries[1] ?? {})).toBe(false);
    expect("maximumQuantity" in (payload.entries[1] ?? {})).toBe(false);
  });

  it("detects equal-precedence promotions in the same stackGroup and rejects effectiveTo <= effectiveFrom", () => {
    const draft: VersionDraft = {
      effectiveFrom: "2026-07-10T10:00:00.000Z",
      effectiveTo: "2026-07-10T10:00:00.000Z",
      entries: [],
      promotions: [
        {
          ...EMPTY_PROMOTION_DRAFT,
          code: "VIP-A",
          name: "VIP Tier A",
          benefitType: "FIXED_AMOUNT",
          discountValue: "15.00",
          stackGroup: "TIER_1",
          priority: "50",
        },
        {
          ...EMPTY_PROMOTION_DRAFT,
          code: "VIP-B",
          name: "VIP Tier B",
          benefitType: "PERCENTAGE",
          discountValue: "5",
          stackGroup: "TIER_1",
          priority: "50",
        },
      ],
    };
    const report = detectVersionDraftConflicts(draft, "SAR");
    expect(report.issues.some((i) => i.code === "EFFECTIVE_TO_INVALID")).toBe(true);
    expect(report.promotionConflicts.some((c) => c.kind === "EQUAL_PRECEDENCE")).toBe(true);
    expect(() => buildUpdatePriceBookVersionRequest(draft)).toThrow("PRICING_FORM_DATE");
  });

  it("applies BigInt bulk price adjustments and commercial rounding without floating-point drift", () => {
    expect(applyPriceFormulaBigInt("100.00", 2, "PERCENTAGE", "7.5", "NONE")).toBe("107.5");
    expect(applyPriceFormulaBigInt("107.30", 2, "NONE", "0", "NEAREST_0_50")).toBe("107.5");
    expect(applyPriceFormulaBigInt("107.30", 2, "NONE", "0", "NEAREST_1")).toBe("107");
    expect(applyPriceFormulaBigInt("107.60", 2, "NONE", "0", "END_95")).toBe("107.95");

    const updated = applyBulkFormulaToDraftEntries(
      [
        {
          ...EMPTY_PRICE_ENTRY_DRAFT,
          itemId: VALID_ITEM_ID,
          uomId: VALID_UOM_ID,
          currencyCode: "SAR",
          unitPrice: "100.00",
          minimumAllowedPrice: "98.00",
        },
      ],
      "FIXED_DELTA",
      "-10",
      "NONE",
      2,
    );
    expect(updated[0]?.unitPrice).toBe("90");
    // Floor above reduced unitPrice clamps safely down to the new unitPrice
    expect(updated[0]?.minimumAllowedPrice).toBe("90");
  });
});

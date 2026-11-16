import { describe, expect, it } from "vitest";
import {
  buildUpdatePriceBookVersionRequest,
  detectVersionDraftConflicts,
  type PriceBookVersionDraft,
  type PriceEntryDraft,
  type PromotionRuleDraft,
} from "./version-draft";
import { applyPriceFormulaBigInt, applyBulkFormulaToDraftEntries } from "./version-formula";

const ITEM = "0195b5d0-1234-7000-8000-000000000010";
const UOM = "0195b5d0-1234-7000-8000-000000000011";
function entry(overrides: Partial<PriceEntryDraft> = {}): PriceEntryDraft {
  return { key: "row-1", itemId: ITEM, uomId: UOM, currencyCode: "EGP", minimumQuantity: "0",
    maximumQuantity: "", unitPrice: "0", minimumAllowedPrice: "0", priority: "100", ...overrides };
}
function draft(entries: PriceEntryDraft[], promotions: PromotionRuleDraft[] = []): PriceBookVersionDraft {
  return { effectiveFrom: "2026-01-01T12:34:56.789Z", effectiveTo: "", notes: "", entries, promotions };
}
function promo(overrides: Partial<PromotionRuleDraft> = {}): PromotionRuleDraft {
  return { key: "promo-1", code: "SUMMER", name: "Summer", benefitType: "PERCENTAGE", discountValue: "10",
    priority: "100", stackGroup: "SEASONAL", exclusive: false, itemId: "", uomId: "", branchId: "",
    channelId: "", partyId: "", minimumQuantity: "0", maximumQuantity: "", ...overrides };
}

describe("price book decimal and quantity contract regression", () => {
  it("accepts a zero price and floor and preserves all eight digits above Number precision", () => {
    const input = draft([entry(), entry({ key: "row-2", priority: "200", unitPrice: "9999999999999999.12345678", minimumAllowedPrice: "9999999999999999.12345677" })]);
    expect(detectVersionDraftConflicts(input, "EGP").hasBlockingErrors).toBe(false);
    const body = buildUpdatePriceBookVersionRequest(input);
    expect(body.entries[0]).toMatchObject({ unitPrice: "0", minimumAllowedPrice: "0", minimumQuantity: "0" });
    expect(body.entries[1]?.unitPrice).toBe("9999999999999999.12345678");
  });
  it("distinguishes an omitted floor from an explicit zero", () => {
    const body = buildUpdatePriceBookVersionRequest(draft([entry({ minimumAllowedPrice: "" })]));
    expect(body.entries[0]).not.toHaveProperty("minimumAllowedPrice");
    expect(body.effectiveTo).toBeNull();
    expect(body.notes).toBeNull();
    expect(body.promotions).toEqual([]);
    expect(body.effectiveFrom).toBe("2026-01-01T12:34:56.789Z");
  });
  it("allows touching exclusive quantity boundaries and overlapping different priorities", () => {
    const first = entry({ maximumQuantity: "10" });
    const second = entry({ key: "row-2", minimumQuantity: "10", maximumQuantity: "20" });
    expect(detectVersionDraftConflicts(draft([first, second]), "EGP").entryConflicts).toEqual([]);
    expect(detectVersionDraftConflicts(draft([first, entry({ key: "row-2", priority: "200" })]), "EGP").entryConflicts).toEqual([]);
  });
  it("detects a same-priority overlap of one eight-decimal quantum", () => {
    const input = draft([entry({ maximumQuantity: "10.00000001" }), entry({ key: "row-2", minimumQuantity: "10", maximumQuantity: "20" })]);
    expect(detectVersionDraftConflicts(input, "EGP").entryConflicts).toContainEqual(expect.objectContaining({ kind: "TIER_OVERLAP", rowIndexes: [0, 1] }));
  });
  it("links precise floor, currency and exclusive bound failures to stable row keys", () => {
    const input = draft([entry({ key: "stable-row", currencyCode: "USD", unitPrice: "1.00000000", minimumAllowedPrice: "1.00000001", minimumQuantity: "10", maximumQuantity: "10" })]);
    const report = detectVersionDraftConflicts(input, "EGP");
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "ENTRY_CURRENCY_MISMATCH", rowKey: "stable-row", params: expect.objectContaining({ currency: "EGP" }) }),
      expect.objectContaining({ code: "ENTRY_FLOOR_ABOVE_UNIT", targetDomId: "entry-stable-row-minimumAllowedPrice" }),
      expect.objectContaining({ code: "ENTRY_MIN_ABOVE_MAX" }),
    ]));
  });
  it.each(["-1", "0.000000001", "10000000000000000", "1e3"])("rejects unsupported exact price %s", unitPrice => {
    expect(() => buildUpdatePriceBookVersionRequest(draft([entry({ unitPrice, minimumAllowedPrice: "" })]))).toThrow();
  });
  it("reports promotion conflicts even for disjoint selectors at equal group and priority", () => {
    const input = draft([entry()], [promo(), promo({ key: "promo-2", code: "WINTER", itemId: ITEM })]);
    expect(detectVersionDraftConflicts(input, "EGP").promotionConflicts).toContainEqual(expect.objectContaining({ kind: "EQUAL_PRECEDENCE" }));
  });
  it("accepts 100 percent but rejects zero, above 100 and duplicate codes", () => {
    expect(() => buildUpdatePriceBookVersionRequest(draft([entry()], [promo({ discountValue: "100" })]))).not.toThrow();
    for (const discountValue of ["0", "100.00000001"]) {
      expect(() => buildUpdatePriceBookVersionRequest(draft([entry()], [promo({ discountValue })]))).toThrow();
    }
    expect(() => buildUpdatePriceBookVersionRequest(draft([entry()], [promo(), promo({ key: "promo-2", code: "summer", priority: "200" })]))).toThrow();
  });
  it("permits saving an empty draft while leaving testing to the server", () => {
    expect(buildUpdatePriceBookVersionRequest(draft([])).entries).toEqual([]);
  });
  it("validates ten thousand adjacent tiers at the supported entry limit", () => {
    const tiers = Array.from({ length: 10_000 }, (_, index) => entry({ key: `tier-${index}`, minimumQuantity: String(index), maximumQuantity: String(index + 1) }));
    expect(detectVersionDraftConflicts(draft(tiers), "EGP").hasBlockingErrors).toBe(false);
  });
});

describe("exact pricing formula parity", () => {
  it("changes only rows matching the matrix filter", () => {
    const first = entry({ key: "first", unitPrice: "100" });
    const second = entry({ key: "second", unitPrice: "200" });
    const updated = applyBulkFormulaToDraftEntries([first, second], "FIXED_DELTA", "10", "NONE", 2, new Set(["second"]));
    expect(updated[0]).toBe(first);
    expect(updated[1]?.unitPrice).toBe("210");
  });
  it.each([
    ["9999999999999999.12345678", 8, "NONE", "0", "NONE", "9999999999999999.12345678"],
    ["100.12345678", 8, "PERCENTAGE", "10", "NONE", "110.13580246"],
    ["1", 8, "FIXED_DELTA", "-2", "NONE", "0"],
    ["10.25", 2, "NONE", "0", "NEAREST_0_50", "10.5"],
    ["10.2", 2, "NONE", "0", "END_95", "9.95"],
  ] as const)("uses backend arithmetic for %s", (price, places, mode, adjustment, rounding, expected) => {
    expect(applyPriceFormulaBigInt(price, places, mode, adjustment, rounding)).toBe(expected);
  });
});

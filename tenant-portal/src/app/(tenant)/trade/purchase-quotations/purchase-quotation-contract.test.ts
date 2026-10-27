import { describe, expect, it } from "vitest";
import {
  buildCreatePurchaseQuotation,
  buildUpdatePurchaseQuotation,
  parsePurchaseQuotationDetail,
} from "./purchase-quotation-contract";
import { purchaseQuotationFixture } from "./purchase-quotation.fixture";

function formInput() {
  const existing = purchaseQuotationFixture();
  return {
    supplierPartyId: existing.partyId,
    currencyCode: existing.currencyCode,
    validUntil: existing.validUntil!,
    reference: existing.reference!,
    notes: existing.notes!,
    lines: existing.lines.map(({ clientLineId, itemId, uomId, quantity }) => ({
      clientLineId, itemId, uomId, quantity,
    })),
  };
}

describe("purchase quotation detail and replacement contract", () => {
  it("retains resolved item IDs, persisted identities and exact decimals", () => {
    const existing = purchaseQuotationFixture();
    expect(parsePurchaseQuotationDetail(existing).lines).toEqual(existing.lines);
  });

  it.each([undefined, null, "not-an-item-id"])("rejects an unresolved item ID: %s", (itemId) => {
    const existing = purchaseQuotationFixture();
    expect(() => parsePurchaseQuotationDetail({
      ...existing, lines: [{ ...existing.lines[0], itemId }],
    })).toThrow();
  });

  it("omits replacement lines for a header-only edit", () => {
    const input = { ...formInput(), reference: "Changed reference", notes: "Changed notes" };
    const request = buildUpdatePurchaseQuotation(input, purchaseQuotationFixture());
    expect(request).toMatchObject({ reference: input.reference, notes: input.notes });
    expect(request).not.toHaveProperty("lines");
  });

  it.each(["supplier", "currency", "quantity", "item", "uom", "identity", "remove", "add"])(
    "sends the complete line set when %s changes",
    (change) => {
      const input = formInput();
      const otherId = "019f0000-0000-7000-8000-000000000099";
      if (change === "supplier") input.supplierPartyId = otherId;
      if (change === "currency") input.currencyCode = "USD";
      if (change === "quantity") input.lines[0]!.quantity = "4";
      if (change === "item") input.lines[0]!.itemId = otherId;
      if (change === "uom") input.lines[0]!.uomId = otherId;
      if (change === "identity") input.lines[0]!.clientLineId = otherId;
      if (change === "remove") input.lines.splice(0, 1);
      if (change === "add") input.lines.push({ ...input.lines[0]!, clientLineId: otherId });
      expect(buildUpdatePurchaseQuotation(input, purchaseQuotationFixture()).lines).toEqual(input.lines);
    },
  );

  it("always includes lines when creating a document", () => {
    const input = formInput();
    expect(buildCreatePurchaseQuotation(input).lines).toEqual(input.lines);
  });
});

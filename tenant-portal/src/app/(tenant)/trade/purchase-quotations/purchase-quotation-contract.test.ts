import { describe, expect, it } from "vitest";
import {
  buildCreatePurchaseQuotation,
  buildUpdatePurchaseQuotation,
  parsePurchaseQuotationDetail,
  parseSupplierAccounts,
  supplierAccountsPath,
} from "./purchase-quotation-contract";
import { purchaseQuotationFixture } from "./purchase-quotation.fixture";
import { parseTradeFinalizedDocument } from "../documents/trade-document-contract";

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
  it("uses the dedicated bounded name search, without commercial account paging", () => {
    const url = new URL(supplierAccountsPath("  Supplier 101 & Co  "), "http://portal.test");
    expect(url.pathname).toBe("/api/tenant/trade/v1/purchase-quotations/supplier-options");
    expect(Object.fromEntries(url.searchParams)).toEqual({ limit: "50", search: "Supplier 101 & Co" });
  });

  it("accepts supplier names and rejects the old UUID-only account shape", () => {
    const partyId = purchaseQuotationFixture().partyId;
    expect(parseSupplierAccounts({ items: [{ partyId, displayName: "Supplier 101" }] }))
      .toEqual([{ partyId, displayName: "Supplier 101" }]);
    for (const item of [{ id: partyId, partyId, status: "ACTIVE" },
      { partyId, displayName: " " }, { partyId: "bad", displayName: "Supplier" }]) {
      expect(() => parseSupplierAccounts({ items: [item] })).toThrow();
    }
  });
  it("accepts an unnumbered draft while preserving every other field", () => {
    const draft = { ...purchaseQuotationFixture(), documentNumber: null };
    expect(parsePurchaseQuotationDetail(draft)).toEqual(draft);
  });

  it("requires a number after issue and preserves the issued number and date", () => {
    const issued = {
      ...purchaseQuotationFixture(), lifecycleStatus: "ISSUED",
      documentNumber: "PQ-0000001", businessDate: "2026-10-29",
      finalizedAt: "2026-10-29T12:00:00.000Z",
    };
    expect(parsePurchaseQuotationDetail(issued)).toEqual(issued);
    expect(() => parsePurchaseQuotationDetail({ ...issued, documentNumber: null })).toThrow();
  });

  it.each([undefined, "", 1])("rejects a malformed draft number: %s", (documentNumber) => {
    expect(() => parsePurchaseQuotationDetail({ ...purchaseQuotationFixture(), documentNumber })).toThrow();
  });

  it("does not permit null numbers in the invoice/contract parser", () => {
    expect(() => parseTradeFinalizedDocument({ ...purchaseQuotationFixture(), documentNumber: null })).toThrow();
  });

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

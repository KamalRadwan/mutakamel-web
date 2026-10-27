import { describe, expect, it } from "vitest";
import {
  buildInvoiceDraftContent,
  buildInvoiceDraftUpdate,
  parseInvoiceDetail,
} from "./invoice-contract";
import { invoiceResponse, ITEM_ID, PROFILE_ID } from "../documents/financial-document.test-fixtures";
import { invoiceEditFinancialContent, invoiceLineDraft } from "./invoice-edit-content";

const UUID = "01890000-0000-7000-8000-000000000001";
const OTHER = "01890000-0000-7000-8000-000000000002";

describe("invoice-contract", () => {
  it("parses an invoice detail response with lines and dueDate", () => {
    const parsed = parseInvoiceDetail({
      id: UUID,
      version: 2,
      companyId: OTHER,
      branchId: UUID,
      partyId: OTHER,
      currencyCode: "SAR",
      businessDate: "2026-10-01",
      lifecycleStatus: "ISSUED",
      documentNumber: "INV-2026-0001",
      reference: "PO-99",
      notes: "Net 30",
      partySnapshot: { displayName: "Al-Noor Co." },
      termsSnapshot: { paymentTermDays: 30 },
      totalsSnapshot: { subtotal: "100", discountTotal: "0", chargeTotal: "0", taxTotal: "15",
        roundingTotal: "0", grandTotal: "115", amountPaid: "0", amountDue: "115" },
      createdBy: null,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
      dueDate: "2026-10-31",
      sourceSalesOrderId: null,
      lines: [
        {
          id: UUID,
          clientLineId: OTHER,
          uomId: UUID,
          quantity: "1",
          unitPrice: "100",
          lineTotal: "115",
          descriptionSnapshot: "Turbine Filter",
          printSnapshot: {
            item: { id: UUID },
            financial: { unitPrice: "100", lineTotal: "115", discountTotal: "0", chargeTotal: "0", taxTotal: "15",
              priceEvidence: { unitPrice: "100" }, taxEvidence: { taxCode: "VAT-15" } },
          },
        },
      ],
    });

    expect(parsed.documentNumber).toBe("INV-2026-0001");
    expect(parsed.dueDate).toBe("2026-10-31");
    expect(parsed.lines).toHaveLength(1);
    expect(parsed.lines[0].lineTotal).toBe("115");
  });

  it("round-trips persisted evidence through a notes-only update without create fields", () => {
    const invoice = parseInvoiceDetail(invoiceResponse);
    expect(invoice.lines[0]!.itemId).toBe(ITEM_ID);
    expect(invoice.lines[0]!.itemId).not.toBe(PROFILE_ID);
    const financial = invoiceEditFinancialContent(invoice, invoice.lines.map(invoiceLineDraft), invoice.totalsSnapshot.roundingTotal)!;
    const payload = buildInvoiceDraftUpdate({
      ...financial, termsSnapshot: invoice.termsSnapshot, notes: "Updated notes",
    });
    expect(JSON.parse(JSON.stringify(payload))).toEqual({
      lines: invoice.lines.map(invoiceLineDraft), notes: "Updated notes",
      termsSnapshot: invoiceResponse.termsSnapshot, totalsSnapshot: invoiceResponse.totalsSnapshot,
    });
    expect(payload.lines[0]!.priceSnapshot).toEqual(invoiceResponse.lines[0]!.printSnapshot.financial.priceEvidence);
    expect(payload.lines[0]!.taxSnapshot).toEqual(invoiceResponse.lines[0]!.printSnapshot.financial.taxEvidence);
    expect(payload.lines[0]!.unitPrice).toBe(invoiceResponse.lines[0]!.printSnapshot.financial.unitPrice);
    expect(payload.lines[0]!.lineTotal).toBe(invoiceResponse.lines[0]!.printSnapshot.financial.lineTotal);
    expect(payload.lines[0]!.quantity).toBe(invoiceResponse.lines[0]!.quantity);
  });

  it("rejects missing identity or incomplete evidence instead of applying defaults", () => {
    for (const printSnapshot of [{ financial: invoiceResponse.lines[0]!.printSnapshot.financial },
      { item: { id: ITEM_ID }, financial: {} }]) {
      expect(() => parseInvoiceDetail({ ...invoiceResponse,
        lines: [{ ...invoiceResponse.lines[0], printSnapshot }] })).toThrow();
    }
    expect(() => parseInvoiceDetail({ ...invoiceResponse, totalsSnapshot: { grandTotal: "200.3" } })).toThrow();
  });

  it.each(["unitPrice", "lineTotal"])("rejects missing snapshot %s even with a numeric column value", (key) => {
    const source = invoiceResponse.lines[0]!;
    expect(() => parseInvoiceDetail({
      ...invoiceResponse,
      lines: [{ ...source, printSnapshot: {
        ...source.printSnapshot, financial: { ...source.printSnapshot.financial, [key]: undefined },
      } }],
    })).toThrow();
  });

  it("recalculates edited amounts without replacing untouched line evidence", () => {
    const invoice = parseInvoiceDetail(invoiceResponse);
    const original = invoiceLineDraft(invoice.lines[0]!);
    const added = { ...original, clientLineId: UUID, unitPrice: "50", quantity: "1", discountTotal: "0", chargeTotal: "0", taxTotal: "2.5" };
    const edited = invoiceEditFinancialContent(invoice, [original, added], "0.0125")!;
    expect(edited.lines[0]).toEqual(original);
    expect(edited.lines[1]!.lineTotal).toBe("52.5");
    expect(edited.totalsSnapshot.grandTotal).toBe("252.8");
    expect(invoiceEditFinancialContent(invoice, [{ ...original, taxTotal: "bad" }], "0.0125")).toBeNull();
  });

  it("builds a valid InvoiceDraftContentRequest with amountPaid pinned to 0", () => {
    const built = buildInvoiceDraftContent({
      partyId: UUID,
      currencyCode: "sar",
      dueDate: "2026-11-15",
      reference: " INV-REF ",
      notes: "Prompt settlement",
      totalsSnapshot: {
        subtotal: "100",
        discountTotal: "0",
        chargeTotal: "0",
        taxTotal: "15",
        roundingTotal: "0",
        grandTotal: "115",
        amountPaid: "50",
        amountDue: "65",
      },
      lines: [
        {
          clientLineId: OTHER,
          itemId: UUID,
          uomId: OTHER,
          quantity: "1",
          unitPrice: "100",
          discountTotal: "0",
          chargeTotal: "0",
          taxTotal: "15",
          lineTotal: "115",
          priceSnapshot: { unitPrice: "100" },
          taxSnapshot: { taxCode: "VAT-15" },
          description: "Item 1",
        },
      ],
    });

    expect(built.currencyCode).toBe("SAR");
    expect(built.reference).toBe("INV-REF");
    expect(built.totalsSnapshot.amountPaid).toBe("0");
    expect(built.totalsSnapshot.amountDue).toBe("115");

    // A create-shaped variable can reach the update builder despite Omit.
    const updated = buildInvoiceDraftUpdate({ ...built, notes: "Updated notes", reference: "UPDATED-REF" });
    expect(Object.keys(JSON.parse(JSON.stringify(updated))).sort()).toEqual([
      "dueDate", "lines", "notes", "reference", "termsSnapshot", "totalsSnapshot",
    ]);
    expect(updated.notes).toBe("Updated notes");
    expect(updated.reference).toBe("UPDATED-REF");
    expect(updated.lines).toEqual(built.lines);
    expect(updated.totalsSnapshot).toEqual(built.totalsSnapshot);
    expect(built.partyId).toBe(UUID);
    expect(built.currencyCode).toBe("SAR");
  });
});

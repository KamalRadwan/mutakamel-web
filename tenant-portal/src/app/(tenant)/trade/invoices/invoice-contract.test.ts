import { describe, expect, it } from "vitest";
import {
  buildInvoiceDraftContent,
  parseInvoiceDetail,
} from "./invoice-contract";

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
      totalsSnapshot: { grandTotal: "115" },
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
        },
      ],
    });

    expect(parsed.documentNumber).toBe("INV-2026-0001");
    expect(parsed.dueDate).toBe("2026-10-31");
    expect(parsed.lines).toHaveLength(1);
    expect(parsed.lines[0].lineTotal).toBe("115");
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
  });
});

import { describe, expect, it } from "vitest";
import { acceptedInvoiceFixture, invoiceCommercialId, invoiceCommercialResponse, manualInvoiceFixture } from "./invoice-commercial-fixtures";
import { adaptInvoiceCommercial, INVOICE_DETAIL_MAX_BYTES, readInvoiceCommercialSnapshot, readInvoiceCommercial } from "./invoice-commercial";

describe("Canonical retained invoice detail", () => {
  it("preserves seats independently of line quantity and recorded graduated prices", () => {
    const value = readInvoiceCommercial(acceptedInvoiceFixture());
    expect(value.lines[1].acceptedSeats).toBe(30);
    expect(value.lines[1].quantity).toBe("1.00");
    expect(value.lines[1].acceptedPricingSnapshot?.breakdown?.map(row => row.amountUsd)).toEqual(["100.0000", "135.0000", "40.0000"]);
    const adapted = adaptInvoiceCommercial(value);
    expect(adapted.commercial).toEqual(value);
    expect(adapted.lines?.[0].descriptionI18n).toBeUndefined();
    expect(adapted.fxUnitsPerUsd).toBeNull();
    expect(adapted.tenant).toBeNull();
  });
  it("keeps custom manual attribution null without interpreting description text", () => {
    const fixture = manualInvoiceFixture(); fixture.lines[0].description = "Addon: crm.logistics — 999 seats";
    const value = readInvoiceCommercial(fixture);
    expect(value.lines[0].acceptedSeats).toBeNull();
    expect(value.lines[0].sourceKind).toBeNull();
    expect(value.lines[0].acceptedPricingSnapshot).toBeNull();
  });
  it("rejects incomplete accepted pricing instead of accepting legacy evidence", () => {
    const value = acceptedInvoiceFixture();
    Object.assign(value.lines[0].acceptedPricingSnapshot, { priceRevision: null, breakdown: null });
    expect(() => readInvoiceCommercial(value)).toThrow();
  });
  it("retains exact zero amounts and arbitrary annual fractional prices", () => {
    const value = acceptedInvoiceFixture();
    value.invoice.purpose = "PRORATION";
    value.lines = [value.lines[0]];
    const line = value.lines[0];
    line.acceptedSeats = 1; line.unitPrice = line.lineTotal = "73.1250";
    line.acceptedPricingSnapshot = { ...line.acceptedPricingSnapshot, billingCycle: "ANNUAL", recurringAmountUsd: "73.1250", breakdown: [{ minUsers: 1, maxUsers: null, chargedUsers: 1, unitPriceUsd: "73.1250", amountUsd: "73.1250" }] };
    value.invoice.subtotal = value.invoice.total = value.invoice.settlementSubtotalUsd = value.invoice.settlementTotalUsd = "73.1250";
    expect(readInvoiceCommercial(value).invoice.total).toBe("73.1250");
    value.invoice.purpose = "MANUAL";
    line.unitPrice = line.lineTotal = line.acceptedPricingSnapshot.recurringAmountUsd = "0.0000";
    line.acceptedPricingSnapshot.breakdown![0].unitPriceUsd = line.acceptedPricingSnapshot.breakdown![0].amountUsd = "0.0000";
    value.invoice.subtotal = value.invoice.total = value.invoice.settlementSubtotalUsd = value.invoice.settlementTotalUsd = "0.0000";
    expect(readInvoiceCommercial(value).invoice.total).toBe("0.0000");
  });
  it("uses exact half-up custom manual line arithmetic", () => {
    const value = manualInvoiceFixture(); value.lines = [value.lines[0]];
    value.lines[0].quantity = "0.50"; value.lines[0].unitPrice = value.lines[0].lineTotal = "0.0001";
    value.invoice.subtotal = value.invoice.total = "0.0001";
    value.invoice.settlementSubtotalUsd = value.invoice.settlementTaxTotalUsd = value.invoice.settlementTotalUsd = null;
    expect(readInvoiceCommercial(value).invoice.total).toBe("0.0001");
  });
  it.each([
    ["parent missing", (v: ReturnType<typeof acceptedInvoiceFixture>) => { v.lines[1].baseItemId = invoiceCommercialId(99); }],
    ["child exceeds seats", (v: ReturnType<typeof acceptedInvoiceFixture>) => { v.lines[1].acceptedSeats = 31; }],
    ["zero seats", (v: ReturnType<typeof acceptedInvoiceFixture>) => { v.lines[0].acceptedSeats = 0; }],
    ["line quantity is not seats", (v: ReturnType<typeof acceptedInvoiceFixture>) => { Object.assign(v.lines[0], { quantity: "30.00" }); }],
    ["wrong invoice", (v: ReturnType<typeof acceptedInvoiceFixture>) => { v.lines[0].invoiceId = invoiceCommercialId(99); }],
    ["duplicate line", (v: ReturnType<typeof acceptedInvoiceFixture>) => { v.lines[1].id = v.lines[0].id; }],
    ["duplicate base", (v: ReturnType<typeof acceptedInvoiceFixture>) => { v.lines.push({ ...v.lines[0], id: invoiceCommercialId(99) }); }],
    ["invalid purpose", (v: ReturnType<typeof acceptedInvoiceFixture>) => { Object.assign(v.invoice, { purpose: "UNKNOWN" }); }],
    ["wrong currency", (v: ReturnType<typeof acceptedInvoiceFixture>) => { v.invoice.currencyCode = "EGP"; }],
    ["mixed cycles", (v: ReturnType<typeof acceptedInvoiceFixture>) => { v.lines[1].acceptedPricingSnapshot.billingCycle = "ANNUAL"; }],
    ["invalid price revision", (v: ReturnType<typeof acceptedInvoiceFixture>) => { v.lines[0].acceptedPricingSnapshot.priceRevision = invoiceCommercialId(99); }],
    ["price amount mismatch", (v: ReturnType<typeof acceptedInvoiceFixture>) => { v.lines[1].acceptedPricingSnapshot.recurringAmountUsd = "999.0000"; }],
    ["bracket mismatch", (v: ReturnType<typeof acceptedInvoiceFixture>) => { v.lines[1].acceptedPricingSnapshot.breakdown![0].amountUsd = "99.0000"; }],
    ["bracket gap", (v: ReturnType<typeof acceptedInvoiceFixture>) => { v.lines[1].acceptedPricingSnapshot.breakdown![1].minUsers = 12; }],
    ["header total mismatch", (v: ReturnType<typeof acceptedInvoiceFixture>) => { v.invoice.total = "0.0000"; }],
    ["partial settlement", (v: ReturnType<typeof acceptedInvoiceFixture>) => { v.invoice.settlementSubtotalUsd = null; }],
    ["period reversed", (v: ReturnType<typeof acceptedInvoiceFixture>) => { v.invoice.periodEnd = v.invoice.periodStart; }],
    ["noncanonical money", (v: ReturnType<typeof acceptedInvoiceFixture>) => { v.invoice.total = "575"; }],
    ["oversized description", (v: ReturnType<typeof acceptedInvoiceFixture>) => { v.lines[0].description = "x".repeat(256); }],
    ["no lines", (v: ReturnType<typeof acceptedInvoiceFixture>) => { v.lines = []; }],
    ["201 lines", (v: ReturnType<typeof acceptedInvoiceFixture>) => { v.lines = Array.from({ length: 201 }, () => v.lines[0]); }],
  ])("rejects %s", (_name, mutate) => { const value = acceptedInvoiceFixture(); mutate(value); expect(() => readInvoiceCommercial(value)).toThrow(); });
  it("rejects unknown fields, mixed evidence and fabricated legacy seats", () => {
    const value = acceptedInvoiceFixture();
    expect(() => readInvoiceCommercial({ ...value, currentCataloguePrice: "10" })).toThrow();
    expect(() => readInvoiceCommercial({ ...value, invoice: { ...value.invoice, fxUnitsPerUsd: "1" } })).toThrow();
    expect(() => readInvoiceCommercial({ ...value, lines: [value.lines[0], manualInvoiceFixture().lines[1]] })).toThrow();
    const legacy = manualInvoiceFixture(); Object.assign(legacy.lines[0], { acceptedSeats: 30 });
    expect(() => readInvoiceCommercial(legacy)).toThrow();
  });
  it("preserves envelope correlation and rejects wrong selectors or unacknowledged versions", () => {
    expect(readInvoiceCommercialSnapshot(invoiceCommercialResponse(), invoiceCommercialId(1))).toMatchObject({ correlationId: "corr-retained-invoice", responseTimestamp: "2026-09-07T18:00:00.000Z" });
    expect(() => readInvoiceCommercialSnapshot(invoiceCommercialResponse(), invoiceCommercialId(99))).toThrow();
    const response = invoiceCommercialResponse({ ...acceptedInvoiceFixture(), contractVersion: 2 });
    expect(() => readInvoiceCommercialSnapshot(response, invoiceCommercialId(1))).toThrow(expect.objectContaining({ errorCode: "COMMERCIAL_RESPONSE_UNAVAILABLE", correlationId: "corr-retained-invoice" }));
  });
  it("bounds the full success envelope to4MiB and fails closed", () => {
    const response = invoiceCommercialResponse();
    Object.assign(response.data as object, { padding: "x".repeat(INVOICE_DETAIL_MAX_BYTES) });
    expect(() => readInvoiceCommercialSnapshot(response, invoiceCommercialId(1))).toThrow();
  });
});

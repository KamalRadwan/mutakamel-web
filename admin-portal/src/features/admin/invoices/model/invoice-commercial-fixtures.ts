import type { AxiosResponse } from "@/lib/api/axiosClient";
import type { RetainedInvoice, ManualInvoice } from "./invoice-commercial";

export const invoiceCommercialId = (last: number) => `019f0000-0000-7000-8000-${String(last).padStart(12, "0")}`;
/** Test-only retained shapes mirror Core invoice-commercial-read and accepted-invoice-source. */
export function acceptedInvoiceFixture(): RetainedInvoice {
  const stamp = "2026-09-07T18:00:00.000Z";
  return { invoice: {
    id: invoiceCommercialId(1), subscriptionId: invoiceCommercialId(2), tenantId: invoiceCommercialId(3), number: "QA-INVOICE-ACCEPTED",
    status: "ISSUED", purpose: "RENEWAL", currencyCode: "USD", subtotal: "575.0000", taxTotal: "0.0000", total: "575.0000",
    settlementCurrencyCode: "USD", settlementSubtotalUsd: "575.0000", settlementTaxTotalUsd: "0.0000", settlementTotalUsd: "575.0000", amountPaidUsd: "0.0000",
    periodStart: stamp, periodEnd: "2026-10-07T18:00:00.000Z", issuedAt: stamp, dueAt: "2026-09-10T18:00:00.000Z", paidAt: null, createdAt: stamp, updatedAt: stamp,
  }, lines: [
    { id: invoiceCommercialId(4), invoiceId: invoiceCommercialId(1), description: "Retained base subscription line", quantity: "1.00", unitPrice: "300.0000", lineTotal: "300.0000",
      sourceKind: "APPLICATION", baseItemId: invoiceCommercialId(6), addonSelectionId: null, addonDefinitionVersionId: null, acceptedSeats: 30,
      acceptedPricingSnapshot: { billingCycle: "MONTHLY", currencyCode: "USD", recurringAmountUsd: "300.0000", priceRevision: "a".repeat(64), 
        breakdown: [{ minUsers: 1, maxUsers: null, chargedUsers: 30, unitPriceUsd: "10.0000", amountUsd: "300.0000" }] } },
    { id: invoiceCommercialId(5), invoiceId: invoiceCommercialId(1), description: "Retained addon subscription line", quantity: "1.00", unitPrice: "275.0000", lineTotal: "275.0000",
      sourceKind: "ADDON", baseItemId: invoiceCommercialId(6), addonSelectionId: invoiceCommercialId(7), addonDefinitionVersionId: invoiceCommercialId(8), acceptedSeats: 30,
      acceptedPricingSnapshot: { billingCycle: "MONTHLY", currencyCode: "USD", recurringAmountUsd: "275.0000", priceRevision: invoiceCommercialId(9), breakdown: [
        { minUsers: 1, maxUsers: 10, chargedUsers: 10, unitPriceUsd: "10.0000", amountUsd: "100.0000" },
        { minUsers: 11, maxUsers: 25, chargedUsers: 15, unitPriceUsd: "9.0000", amountUsd: "135.0000" },
        { minUsers: 26, maxUsers: null, chargedUsers: 5, unitPriceUsd: "8.0000", amountUsd: "40.0000" },
      ] } },
  ] };
}
export function manualInvoiceFixture(): ManualInvoice {
  const value = acceptedInvoiceFixture();
  return { ...value, invoice: { ...value.invoice, purpose: "MANUAL" }, lines: value.lines.map(line => ({
    id: line.id, invoiceId: line.invoiceId, description: line.description, quantity: line.quantity, unitPrice: line.unitPrice, lineTotal: line.lineTotal,
    sourceKind: null, baseItemId: null, addonSelectionId: null, addonDefinitionVersionId: null, acceptedSeats: null, acceptedPricingSnapshot: null,
  })) };
}
export function invoiceCommercialResponse(value: unknown = acceptedInvoiceFixture()): AxiosResponse<unknown> {
  return { status: 200, statusText: "OK", headers: new Headers(),
    data: { success: true, data: value, correlationId: "corr-retained-invoice", timestamp: "2026-09-07T18:00:00.000Z" } };
}

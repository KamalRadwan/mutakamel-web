// Test-only retained records, never a runtime fallback or current catalogue price.
const id = (suffix: string) => `01a0793f-1c93-7ae2-ae43-${suffix.padStart(12, "0")}`;
const timestamp = "2026-09-08T10:00:00.000Z";
const price = (addon: boolean) => ({ billingCycle: "MONTHLY" as const, currencyCode: "USD" as const,
  recurringAmountUsd: addon ? "21.2340" : "74.3210", 
  priceRevision: addon ? id("8") : "a".repeat(64),
  breakdown: [{ minUsers: 1, maxUsers: null as number | null, chargedUsers: 10, unitPriceUsd: addon ? "2.1234" : "7.4321", amountUsd: addon ? "21.2340" : "74.3210" }],
});
export function createInvoiceReadFixture() {
  const base = { id: id("4"), invoiceId: id("1"), description: "Retained application", quantity: "1.00", unitPrice: "74.3210", lineTotal: "74.3210",
     sourceKind: "APPLICATION" as const, baseItemId: id("5"), addonSelectionId: null,
    addonDefinitionVersionId: null, acceptedSeats: 10, acceptedPricingSnapshot: price(false) };
  const addon = { ...base, id: id("6"), description: "Retained addon", unitPrice: "21.2340", lineTotal: "21.2340", sourceKind: "ADDON" as const,
    addonSelectionId: id("7"), addonDefinitionVersionId: id("9"), acceptedPricingSnapshot: price(true) };
  return { success: true as const, correlationId: "invoice-test-correlation", timestamp, data: {
     
    invoice: { id: id("1"), subscriptionId: id("2"), tenantId: id("3"), number: "INV-TEST-1", status: "ISSUED" as const, purpose: "RENEWAL" as const,
      currencyCode: "USD", subtotal: "95.5550", taxTotal: "1.0000", total: "96.5550", settlementCurrencyCode: "USD",
      settlementSubtotalUsd: "95.5550", settlementTaxTotalUsd: "1.0000", settlementTotalUsd: "96.5550", amountPaidUsd: "0.0000",
      periodStart: "2026-09-01T00:00:00.000Z", periodEnd: "2026-10-01T00:00:00.000Z", issuedAt: timestamp, dueAt: null, paidAt: null, createdAt: timestamp, updatedAt: timestamp },
    lines: [base, addon],
  } };
}
export function createManualInvoiceReadFixture() {
  const complete = createInvoiceReadFixture();
  return { ...complete, data: { ...complete.data, 
    invoice: { ...complete.data.invoice, purpose: "MANUAL" as const, currencyCode: "EGP", subtotal: "0.0001", taxTotal: "0.0000", total: "0.0001",
      settlementSubtotalUsd: null, settlementTaxTotalUsd: null, settlementTotalUsd: null },
    lines: [{ ...complete.data.lines[0], description: "Historical manual item", quantity: "0.50", unitPrice: "0.0001", lineTotal: "0.0001",
       sourceKind: null, baseItemId: null, addonSelectionId: null,
      addonDefinitionVersionId: null, acceptedSeats: null, acceptedPricingSnapshot: null }],
  } };
}

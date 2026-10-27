export const DOCUMENT_ID = "01890000-0000-7000-8000-000000000001";
export const PARTY_ID = "01890000-0000-7000-8000-000000000002";
export const ITEM_ID = "01890000-0000-7000-8000-000000000003";
export const PROFILE_ID = "01890000-0000-7000-8000-000000000004";

const header = {
  id: DOCUMENT_ID, version: 2, companyId: DOCUMENT_ID, branchId: PARTY_ID,
  partyId: PARTY_ID, currencyCode: "EGP", businessDate: "2026-10-01",
  lifecycleStatus: "DRAFT", documentNumber: "DOC-1", reference: "REF-1", notes: "Original",
  partySnapshot: { displayName: "Customer" },
  createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z",
};

export const invoiceResponse = {
  ...header, dueDate: "2026-11-15", sourceSalesOrderId: null,
  termsSnapshot: { paymentTermDays: 45, paymentMethodHint: "CASH", negotiated: { retain: true } },
  totalsSnapshot: {
    subtotal: "200", discountTotal: "12.5", chargeTotal: "3.25", taxTotal: "9.5375",
    roundingTotal: "0.0125", grandTotal: "200.3", amountPaid: "0", amountDue: "200.3",
  },
  lines: [{
    id: DOCUMENT_ID, clientLineId: PARTY_ID, itemCompanyProfileId: PROFILE_ID,
    uomId: DOCUMENT_ID, quantity: "2.00000000", unitPrice: "100.00000000", lineTotal: "200.28750000",
    descriptionSnapshot: "Item",
    printSnapshot: {
      item: { id: ITEM_ID, companyProfileId: PROFILE_ID },
      financial: {
        unitPrice: "100", discountTotal: "12.5", chargeTotal: "3.25", taxTotal: "9.5375", lineTotal: "200.2875",
        priceEvidence: { source: "NEGOTIATED", approval: { code: "SPECIAL-1" } },
        taxEvidence: { scheme: "SPECIAL", taxAmount: "9.5375", exemption: { basis: "AGREEMENT" } },
      },
    },
  }],
};

export const contractResponse = {
  ...header, effectiveFrom: "2026-10-01", effectiveTo: "2027-10-01",
  termsSnapshot: {
    governingLawCountry: "EG", terminationNoticeDays: 75,
    custom: { jurisdiction: "Cairo", negotiated: true },
    financial: { mode: "FINANCIAL", sourceEvidence: { origin: "NEGOTIATED", quote: { id: ITEM_ID, revision: 3 } } },
  },
  totalsSnapshot: {
    subtotal: "1000.00000000", discountTotal: "10", chargeTotal: "5", taxTotal: "49.75",
    roundingTotal: "0.25", grandTotal: "1045", amountPaid: "0.00000000", amountDue: "1045",
  },
  clauses: [{ id: DOCUMENT_ID, clauseOrder: 1, title: "Term", body: "Negotiated agreement." }],
};

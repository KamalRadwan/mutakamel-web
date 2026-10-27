import type { PurchaseQuotationDetail } from "./purchase-quotation-contract";

export function purchaseQuotationFixture(): PurchaseQuotationDetail {
  return {
    id: "019f0000-0000-7000-8000-000000000001",
    version: 3,
    companyId: "019f0000-0000-7000-8000-000000000002",
    branchId: "019f0000-0000-7000-8000-000000000003",
    partyId: "019f0000-0000-7000-8000-000000000004",
    currencyCode: "EGP",
    businessDate: "2026-10-17",
    documentNumber: "PQ-0000001",
    lifecycleStatus: "DRAFT",
    validUntil: "2099-12-31",
    reference: "Supplier reference",
    notes: "Keep dry",
    partySnapshot: {},
    termsSnapshot: {},
    totalsSnapshot: {},
    finalizedAt: null,
    createdAt: "2026-10-17T00:00:00.000Z",
    updatedAt: "2026-10-17T00:00:00.000Z",
    lines: [
      {
        id: "019f0000-0000-7000-8000-000000000010",
        clientLineId: "019f0000-0000-7000-8000-000000000011",
        itemId: "019f0000-0000-7000-8000-000000000012",
        uomId: "019f0000-0000-7000-8000-000000000013",
        quantity: "1.12345678",
        unitPrice: "25.00000000",
        lineTotal: "28.0864195",
        descriptionSnapshot: "Paper",
      },
      {
        id: "019f0000-0000-7000-8000-000000000020",
        clientLineId: "019f0000-0000-7000-8000-000000000021",
        itemId: "019f0000-0000-7000-8000-000000000022",
        uomId: "019f0000-0000-7000-8000-000000000023",
        quantity: "2",
        unitPrice: "10",
        lineTotal: "20",
        descriptionSnapshot: null,
      },
    ],
  };
}

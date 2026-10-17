import { describe, expect, it } from "vitest";
import {
  buildContractDraftContent,
  contractFinancialMode,
  parseContractDetail,
} from "./contract-contract";

const UUID = "01890000-0000-7000-8000-000000000001";
const OTHER = "01890000-0000-7000-8000-000000000002";

describe("contract-contract", () => {
  it("parses a contract detail with ordered clauses and financial mode", () => {
    const parsed = parseContractDetail({
      id: UUID,
      version: 1,
      companyId: OTHER,
      branchId: UUID,
      partyId: OTHER,
      currencyCode: "SAR",
      businessDate: "2026-10-01",
      lifecycleStatus: "ACTIVE",
      documentNumber: "CON-2026-0001",
      reference: "MSA-01",
      notes: null,
      partySnapshot: { displayName: "Red Sea Logistics" },
      termsSnapshot: { financial: { mode: "FINANCIAL" } },
      totalsSnapshot: { grandTotal: "50000" },
      createdBy: null,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
      effectiveFrom: "2026-10-01",
      effectiveTo: "2027-09-30",
      clauses: [
        {
          id: OTHER,
          clauseOrder: 1,
          title: "Scope of Supply",
          body: "Annual spare parts supply.",
        },
      ],
    });

    expect(contractFinancialMode(parsed)).toBe("FINANCIAL");
    expect(parsed.clauses).toHaveLength(1);
    expect(parsed.clauses[0].title).toBe("Scope of Supply");
  });

  it("pins all totals to 0 when building NON_FINANCIAL contract content", () => {
    const payload = buildContractDraftContent({
      partyId: UUID,
      currencyCode: "sar",
      effectiveFrom: "2026-10-01",
      effectiveTo: "2027-10-01",
      mode: "NON_FINANCIAL",
      totalsSnapshot: {
        subtotal: "100",
        discountTotal: "0",
        chargeTotal: "0",
        taxTotal: "15",
        roundingTotal: "0",
        grandTotal: "115",
        amountPaid: "0",
        amountDue: "115",
      },
      clauses: [
        {
          clientClauseId: OTHER,
          title: "Confidentiality",
          body: "Both parties agree to keep terms confidential.",
        },
      ],
    });

    expect(payload.financialTerms.mode).toBe("NON_FINANCIAL");
    expect(payload.financialTerms.totalsSnapshot.grandTotal).toBe("0");
    expect(payload.financialTerms.totalsSnapshot.subtotal).toBe("0");
  });

  it("refuses an effectiveTo date earlier than effectiveFrom", () => {
    expect(() =>
      buildContractDraftContent({
        partyId: UUID,
        currencyCode: "SAR",
        effectiveFrom: "2026-10-10",
        effectiveTo: "2026-10-01",
        mode: "NON_FINANCIAL",
        totalsSnapshot: {
          subtotal: "0",
          discountTotal: "0",
          chargeTotal: "0",
          taxTotal: "0",
          roundingTotal: "0",
          grandTotal: "0",
          amountPaid: "0",
          amountDue: "0",
        },
        clauses: [
          {
            clientClauseId: OTHER,
            title: "Term",
            body: "Invalid window.",
          },
        ],
      }),
    ).toThrow("CONTRACT_FORM_EFFECTIVE_WINDOW");
  });
});

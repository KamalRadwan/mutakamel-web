// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { QuotationDetail } from "../quotation-contract";
import { QuotationRevisionsPanel } from "./QuotationRevisionsPanel";

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));

afterEach(cleanup);

const QUOTATION: QuotationDetail = {
  id: "01900100-0000-7000-8000-000000000001",
  version: 2,
  companyId: "01900100-0000-7000-8000-000000000002",
  branchId: "01900100-0000-7000-8000-000000000003",
  partyId: "01900100-0000-7000-8000-000000000004",
  contactPartyId: null,
  currencyCode: "SAR",
  businessDate: "2026-10-01",
  lifecycleStatus: "ACCEPTED",
  approvalStatus: "APPROVED",
  fulfillmentStatus: "NOT_APPLICABLE",
  billingStatus: "NOT_APPLICABLE",
  grandTotal: "1500.00",
  documentNumber: "QT-2026-0099",
  draftReference: null,
  partySnapshot: {},
  createdBy: null,
  createdAt: "2026-10-01T10:00:00Z",
  updatedAt: "2026-10-02T12:00:00Z",
  currentRevisionId: "01900100-0000-7000-8000-000000000012",
  acceptedRevisionId: "01900100-0000-7000-8000-000000000012",
  crmCustomerProfileId: null,
  customerEligibilitySource: "CRM",
  currentLines: [],
  revisions: [
    {
      id: "01900100-0000-7000-8000-000000000011",
      revisionNumber: 1,
      status: "SENT",
      validUntil: "2026-11-01",
      grandTotal: "1000.00",
      subtotal: "1000.00", discountTotal: "0", pricingMode: "PROMOTIONS", discountSnapshot: {},
      termsSnapshot: {},
      sentAt: "2026-10-01T11:00:00Z",
      acceptedAt: null,
      rejectedAt: null,
      priceLockExpiresAt: null,
    },
    {
      id: "01900100-0000-7000-8000-000000000012",
      revisionNumber: 2,
      status: "ACCEPTED",
      validUntil: "2026-11-15",
      grandTotal: "1500.00",
      subtotal: "1500.00", discountTotal: "0", pricingMode: "PROMOTIONS", discountSnapshot: {},
      termsSnapshot: {},
      sentAt: "2026-10-02T11:00:00Z",
      acceptedAt: "2026-10-02T12:00:00Z",
      rejectedAt: null,
      priceLockExpiresAt: null,
    },
  ],
};

describe("QuotationRevisionsPanel", () => {
  it("renders revisions inside the reusable 3-level HistorySection template with Expand all and before/after diffs", () => {
    render(<QuotationRevisionsPanel quotation={QUOTATION} />);

    expect(
      screen.getByRole("heading", { name: en.tradeDocuments.quotations.revisions }),
    ).toBeInTheDocument();
    expect(screen.getByText("Revision 2")).toBeInTheDocument();
    expect(screen.getByText("Revision 1")).toBeInTheDocument();
    expect(screen.getByText(en.tradeDocuments.quotations.acceptedRevision)).toBeInTheDocument();
    expect(screen.getByText(en.tradeDocuments.quotations.currentRevision)).toBeInTheDocument();

    // Expand all reveals revision-over-revision diff transitions
    fireEvent.click(screen.getByRole("button", { name: en.audit.expandAll }));
    expect(screen.getAllByText(`${en.tradeDocuments.totals.grandTotal}:`)).toHaveLength(2);
    expect(screen.getByRole("button", { name: en.audit.collapseAll })).toBeInTheDocument();
  });
});

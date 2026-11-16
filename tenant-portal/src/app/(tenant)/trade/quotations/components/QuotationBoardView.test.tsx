// @vitest-environment jsdom

import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Money } from "@/design-system";
import { en } from "@/i18n/dictionaries/en";
import { parseQuotation } from "../quotation-contract";
import { QuotationBoardView } from "./QuotationBoardView";

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));

vi.mock("@/i18n/useLanguage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/useLanguage")>()),
  useLanguage: () => "en",
}));

vi.mock("@/design-system", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/design-system")>();
  const passthrough = ({ children }: { children: ReactNode }) => <>{children}</>;
  return {
    ...actual,
    Money: vi.fn(actual.Money),
    Tooltip: passthrough,
    TooltipTrigger: passthrough,
    TooltipContent: () => null,
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function quotation(id: string, grandTotal: string, currencyCode: string) {
  return parseQuotation({
    id,
    version: 1,
    companyId: "01900100-0000-7000-8000-000000000002",
    branchId: "01900100-0000-7000-8000-000000000003",
    partyId: "01900100-0000-7000-8000-000000000004",
    contactPartyId: null,
    currencyCode,
    businessDate: "2026-10-31",
    lifecycleStatus: "DRAFT",
    approvalStatus: "NOT_REQUIRED",
    fulfillmentStatus: "UNPLANNED",
    billingStatus: "NOT_BILLED",
    grandTotal,
    documentNumber: null,
    draftReference: null,
    partySnapshot: {},
    createdBy: null,
    createdAt: "2026-10-31T00:00:00.000Z",
    updatedAt: "2026-10-31T00:00:00.000Z",
    currentRevisionId: null,
    acceptedRevisionId: null,
    crmCustomerProfileId: null,
    customerEligibilitySource: "ACTIVE_COMMERCIAL_ACCOUNT",
  });
}

describe("quotation board totals", () => {
  it("renders expired quotations in their own localized column", () => {
    const expired = {
      ...quotation("01900100-0000-7000-8000-000000000011", "1", "USD"),
      lifecycleStatus: "EXPIRED", documentNumber: "EXPIRED-001",
    };
    render(
      <QuotationBoardView items={[expired]} onQuickInspect={vi.fn()} onRequestDelete={vi.fn()} />,
    );
    expect(screen.getByText(en.statusValues["TradeQuotationStatus.EXPIRED"])).toBeInTheDocument();
    expect(screen.getByText("EXPIRED-001")).toBeInTheDocument();
  });

  it.each([
    ["USD", "0.1", "0.2", "0.3", "0.30"],
    ["KWD", "0.101", "0.202", "0.303", "0.303"],
    ["OMR", "0.101", "0.202", "0.303", "0.303"],
    ["BHD", "0.101", "0.202", "0.303", "0.303"],
  ])("sums exact strings and uses %s fraction digits", (currency, left, right, total, formatted) => {
    render(
      <QuotationBoardView
        items={[
          quotation("01900100-0000-7000-8000-000000000011", left, currency),
          quotation("01900100-0000-7000-8000-000000000012", right, currency),
          quotation("01900100-0000-7000-8000-000000000013", "999", "EUR"),
        ]}
        onQuickInspect={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );

    const columnMoney = vi.mocked(Money).mock.calls.find(
      ([props]) => props.value === total && props.currency === currency,
    )?.[0];
    expect(columnMoney).toBeDefined();
    expect(columnMoney?.minimumFractionDigits).toBeUndefined();
    expect(columnMoney?.maximumFractionDigits).toBeUndefined();
    const header = screen.getAllByText(en.tradeDocuments.quotations.stagePipelineTotal)[0].parentElement;
    expect(header).toHaveTextContent(formatted);
  });
});

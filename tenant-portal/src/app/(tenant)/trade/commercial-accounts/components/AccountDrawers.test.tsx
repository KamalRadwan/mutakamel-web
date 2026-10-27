// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import type { CommercialAccount } from "../commercial-account-contract";
import { ACCOUNT_UI_COPY } from "../commercial-account-metadata";

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const mocks = vi.hoisted(() => ({ lang: "en" as "en" | "ar" }));
const dictionaries = { en, ar };
const directions = { en: "ltr", ar: "rtl" };

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    t: dictionaries[mocks.lang],
    lang: mocks.lang,
    dir: directions[mocks.lang],
  }),
}));

vi.mock("../hooks/useCommercialAccountLookups", () => ({
  useCommercialAccountLookups: () => ({
    lookups: {
      paymentTerms: [{ id: "11111111-2222-3333-4444-555555555555", source: "existing" }],
      creditPolicies: [
        {
          id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
          code: "CP-STRICT-01",
          versionNumber: 2,
          scopeTarget: "COMPANY",
          status: "PUBLISHED",
          effectiveFrom: "2026-01-01T00:00:00Z",
          effectiveTo: null,
        },
      ],
    },
    isLoadingLookups: false,
    reloadLookups: vi.fn(),
  }),
}));

vi.mock("../hooks/useAccountPriceBooks", () => ({
  useAccountPriceBooks: (role: string) => ({
    books: [{ id: "book", code: role === "SUPPLIER" ? "PURCHASE-BOOK" : "SALES-BOOK", currencyCode: "EGP" }],
    unavailable: false,
  }),
}));

const { AccountInspectModal, CreateAccountDrawer, EditAccountDrawer } = await import(
  "./AccountDrawers"
);

const SAMPLE_ACCOUNT: CommercialAccount = {
  id: "acc-1",
  companyId: "comp-1",
  partyId: "99999999-8888-7777-6666-555555555555",
  accountRole: "CUSTOMER",
  status: "BLOCKED",
  paymentTermsId: null,
  priceBookId: null,
  creditLimit: "250000",
  creditCurrencyCode: "EGP",
  creditPolicyVersionId: null,
  blockReasonCode: "CREDIT_OVERDUE_90D",
  terms: { orderingHold: true, allowedCurrencies: ["EGP", "USD"] },
  version: 4,
  updatedAt: "2026-01-02T00:00:00Z",
};

beforeEach(() => {
  mocks.lang = "en";
});
afterEach(cleanup);

describe("AccountDrawers UI component suite", () => {
  it("updates role-filtered suggestions without replacing the entered assignment", () => {
    render(
      <CreateAccountDrawer isOpen isSubmitting={false} error={null} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "SALES-BOOK (EGP)" }));
    const input = screen.getByPlaceholderText(en.trade.accountPriceBook);
    expect(input).toHaveValue("book");
    fireEvent.click(screen.getAllByRole("button", { name: new RegExp(en.trade.accountRole_SUPPLIER, "i") })[0]);
    expect(screen.queryByRole("button", { name: "SALES-BOOK (EGP)" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PURCHASE-BOOK (EGP)" })).toBeInTheDocument();
    expect(input).toHaveValue("book");
  });

  it("locks creditLimit automatically when SUPPLIER role is selected in CreateAccountDrawer", () => {
    render(
      <CreateAccountDrawer
        isOpen
        isSubmitting={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(true)}
      />,
    );

    const supplierBtns = screen.getAllByRole("button", {
      name: new RegExp(en.trade.accountRole_SUPPLIER, "i"),
    });
    fireEvent.click(supplierBtns[0]);

    expect(
      screen.getByText(ACCOUNT_UI_COPY.en.supplierCreditLockNotice),
    ).toBeInTheDocument();
  });

  it("renders lookup quick-select pills and visual currency chips in EditAccountDrawer", () => {
    render(
      <EditAccountDrawer
        account={SAMPLE_ACCOUNT}
        isSubmitting={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(true)}
      />,
    );

    expect(screen.getByRole("button", { name: /CP-STRICT-01/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /11111111/i })).toBeInTheDocument();
  });

  it("renders AccountInspectModal with block reason banner for BLOCKED accounts", () => {
    render(
      <AccountInspectModal
        account={SAMPLE_ACCOUNT}
        canManage
        onClose={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByText("CREDIT_OVERDUE_90D")).toBeInTheDocument();
    expect(screen.getAllByText(SAMPLE_ACCOUNT.partyId).length).toBeGreaterThan(0);
  });
});

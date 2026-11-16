// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import type { QuotationComposerState } from "../hooks/useQuotationComposer";
import { defaultQuotationDiscount } from "../quotation-discount-draft";
import {
  CONTACT_OPTION,
  CUSTOMER_OPTION,
  DETAIL_WITH_REVISION,
  HEADERS,
  PARTY_ID,
  WORKSPACE_CURRENCIES,
  draftLine,
} from "../hooks/quotation-composer.test-fixtures";
import { QuotationComposerBody } from "./QuotationComposerBody";
import type { QuotationLineDisplayMap } from "./QuotationLineWorkspace";
import { QuotationPricingTotals } from "./QuotationPricingTotals";

const mocks = vi.hoisted(() => ({
  lang: "en" as "en" | "ar",
  lastLineWorkspaceProps: null as {
    partyId: string | null;
    disabled?: boolean;
    compact?: boolean;
    lineDisplayById?: QuotationLineDisplayMap;
  } | null,
}));

const DICTIONARIES = { en, ar } as const;
const DIRECTIONS = { en: "ltr", ar: "rtl" } as const;

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    t: DICTIONARIES[mocks.lang],
    lang: mocks.lang,
    dir: DIRECTIONS[mocks.lang],
  }),
}));

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({
    user: { id: "01890000-0000-7000-8000-000000000099", permissions: ["trade.quotations.create", "trade.quotations.update"] },
    realtimeAuthGeneration: "tenant:s1:u1",
  }),
}));

vi.mock("../../useTradeScope", () => ({
  useTradeScope: () => ({
    context: {
      companyId: "01890000-0000-7000-8000-000000000001",
      branchId: "01890000-0000-7000-8000-000000000002",
      channelId: undefined,
    },
    companyIds: ["01890000-0000-7000-8000-000000000001", "01890000-0000-7000-8000-000000000041"],
    branchIds: ["01890000-0000-7000-8000-000000000002", "01890000-0000-7000-8000-000000000042"],
    channels: [{ id: "01890000-0000-7000-8000-000000000090", name: "B2B Direct" }],
    channelsLoading: false,
    contextLocked: false,
    setCompanyId: vi.fn(),
    setBranchId: vi.fn(),
    setChannelId: vi.fn(),
    setScope: vi.fn(),
  }),
}));

vi.mock("@/hooks/useTenantOrganizationOptions", () => ({
  useTenantOrganizationOptions: (kind: "company" | "branch") =>
    kind === "company"
      ? [{ value: "01890000-0000-7000-8000-000000000001", label: "Mersany Telecom" }]
      : [{ value: "01890000-0000-7000-8000-000000000002", label: "Cairo HQ" }],
}));

vi.mock("./QuotationPricingControls", () => ({
  QuotationPricingControls: ({ requiredPermission }: { requiredPermission?: string }) => (
    <div data-testid="pricing-controls" data-permission={requiredPermission} />
  ),
}));

vi.mock("./QuotationLineWorkspace", () => ({
  QuotationLineWorkspace: (props: {
    partyId: string | null;
    disabled?: boolean;
    compact?: boolean;
    lineDisplayById?: QuotationLineDisplayMap;
  }) => {
    mocks.lastLineWorkspaceProps = props;
    return <div data-testid="line-workspace" />;
  },
}));

function buildMockComposer(overrides: Partial<QuotationComposerState> = {}): QuotationComposerState {
  const base = {
    selected: CUSTOMER_OPTION,
    currencyCode: "EGP",
    draftReference: "RFQ-100",
    contactPartyId: CONTACT_OPTION.partyId,
    selectedContact: { ...CONTACT_OPTION, customerPartyId: PARTY_ID },
    validUntil: "2099-11-15",
    paymentTermCode: "NET_30",
    incotermCode: "EXW",
    deliveryDays: "14",
    warrantyMonths: "12",
    discount: defaultQuotationDiscount(),
    partialHeader: null,
    savedQuotation: null,
    lockedHeaders: null,
    detailsError: false,
    isDetailsCurrent: true,
    replacementStorageError: false,
    replacementReconciliation: null,
    replacementRetryBlocked: false,
    partialHeaderConflict: false,
    isReloadingDetails: false,
    savingStep: "idle" as const,
    write: {
      isWriting: false,
      isBlocked: false,
      ambiguous: null,
      writeError: null,
      runWrite: vi.fn(),
      clearWriteError: vi.fn(),
      reset: vi.fn(),
    },
    save: vi.fn(),
    canSendSaved: false,
    sendSaved: vi.fn(),
    reloadSavedDetails: vi.fn(),
    restoreHeader: vi.fn(),
    reset: vi.fn(),
    isEditMode: false,
    existingQuotation: null,
    headerLocked: false,
    headerFieldsLocked: false,
    hasOrganizationCustomer: true,
    headerDirty: false,
    commercialDirty: false,
    lineDisplayById: undefined,
    hasUnavailableLines: false,
    canPrepareReplacement: false,
    prepareReplacement: vi.fn(),
    replacementHandoffFailed: false,
    mode: "editing" as const,
    customers: {
      search: "",
      setSearch: vi.fn(),
      options: [CUSTOMER_OPTION],
      isLoading: false,
      error: null,
      canRead: true,
      retry: vi.fn(),
    },
    contacts: {
      enabled: true,
      options: [CONTACT_OPTION],
      search: "",
      isLoading: false,
      partyType: "ORGANIZATION" as const,
      error: null,
      hasMore: false,
      setSearch: vi.fn(),
      loadMore: vi.fn(),
      retry: vi.fn(),
    },
    currencies: {
      currencies: WORKSPACE_CURRENCIES,
      options: WORKSPACE_CURRENCIES.map((item) => ({ value: item.code, label: `${item.code} — ${item.name}` })),
      defaultCode: "EGP",
      loading: false,
      error: null,
      canRead: true,
      retry: vi.fn(),
    },
    currencyUnavailable: false,
    lineDraft: {
      purpose: "SALES" as const,
      lines: [draftLine()],
      itemsById: {},
      uomsByItem: {},
      items: [],
      isLoadingItems: false,
      itemError: null,
      invalidLineIndex: null,
      setItem: vi.fn(),
      setUom: vi.fn(),
      setQuantity: vi.fn(),
      commitQuantity: vi.fn(),
      addLine: vi.fn(),
      removeLine: vi.fn(),
      reset: vi.fn(),
      restore: vi.fn(),
      retryItems: vi.fn(),
    },
    pricing: {} as QuotationComposerState["pricing"],
    hasPopulatedLines: true,
    isDirty: false,
    canSubmit: true,
    canSubmitHeaderOnly: true,
    formError: null,
    resetComposer: vi.fn(),
    submit: vi.fn(),
    saveHandoffSnapshot: vi.fn(),
    replacementSource: undefined,
    replacementUnavailable: false,
    replacementCreateKey: undefined,
    scopeChangePending: null,
    isChangingScope: false,
    confirmScopeChange: vi.fn(),
    cancelScopeChange: vi.fn(),
    contactPartyError: undefined,
    validUntilError: undefined,
    deliveryDaysError: undefined,
    warrantyMonthsError: undefined,
    selectCustomer: vi.fn(),
    selectContact: vi.fn(),
    setCurrencyCode: vi.fn(),
    setDraftReference: vi.fn(),
    setContactPartyId: vi.fn(),
    setValidUntil: vi.fn(),
    setPaymentTermCode: vi.fn(),
    setIncotermCode: vi.fn(),
    setDeliveryDays: vi.fn(),
    setWarrantyMonths: vi.fn(),
  };
  return { ...base, ...overrides } as unknown as QuotationComposerState;
}

afterEach(cleanup);
beforeEach(() => {
  mocks.lang = "en";
  mocks.lastLineWorkspaceProps = null;
});

describe("QuotationPricingTotals", () => {
  it("renders em-dash placeholders whenever authoritative totals are null", () => {
    render(<QuotationPricingTotals totals={null} mode="PROMOTIONS" currencyCode="EGP" />);
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBe(3);
  });

  it.each(["en", "ar"] as const)("formats signed deductions with ltr numeric isolation in %s", (lang) => {
    mocks.lang = lang;
    const { container } = render(
      <QuotationPricingTotals
        totals={{
          subtotal: "1000.00",
          discountTotal: "150.00",
          grandTotal: "850.00",
          baseSubtotal: "1000.00",
          promotionSavings: "0",
        }}
        mode="DISCOUNT"
        currencyCode="EGP"
      />,
    );
    const definitions = Array.from(container.querySelectorAll("dd"));
    expect(definitions).toHaveLength(3);
    definitions.forEach((node) => expect(node).toHaveAttribute("dir", "ltr"));
    expect(definitions[1]?.textContent).toContain("-");
  });
});

describe("QuotationComposerBody compact chrome and mode locks", () => {
  it("renders inline context triggers and conditional organization contact in create mode, hiding contact for PERSON", () => {
    const composer = buildMockComposer();
    const { rerender } = render(<QuotationComposerBody composer={composer} headers={HEADERS} canUpdate />);
    expect(screen.getByRole("combobox", { name: `${en.trade.scopeCompany}: Mersany Telecom` })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: `${en.trade.scopeBranch}: Cairo HQ` })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: en.quotationFlow.documentReference })).toHaveAttribute("dir", "ltr");
    expect(screen.getByText(en.quotationExperience.contactLabel)).toBeTruthy();
    expect(screen.getByTestId("pricing-controls")).toHaveAttribute("data-permission", "trade.quotations.create");

    const personComposer = buildMockComposer({
      selected: { ...CUSTOMER_OPTION, partyType: "PERSON" },
      hasOrganizationCustomer: false,
      contacts: { ...composer.contacts, partyType: "PERSON" },
    });
    rerender(<QuotationComposerBody composer={personComposer} headers={HEADERS} canUpdate />);
    expect(screen.queryByText(en.quotationExperience.contactLabel)).toBeNull();
  });

  it("supports unresolved branch recovery without mounting the line editor", () => {
    const composer = buildMockComposer();
    render(<QuotationComposerBody composer={composer} headers={{}} canUpdate compact isResolved={false} />);
    expect(screen.getByRole("combobox", { name: `${en.trade.scopeCompany}: Mersany Telecom` })).toBeTruthy();
    expect(screen.queryByTestId("line-workspace")).toBeNull();
  });

  it("locks context/customer/currency in edit mode while keeping contact/reference editable, and locks all in supersede mode", () => {
    const editComposer = buildMockComposer({
      isEditMode: true,
      existingQuotation: DETAIL_WITH_REVISION,
      headerLocked: true,
      headerFieldsLocked: false,
      selected: null,
    });
    const { rerender } = render(
      <QuotationComposerBody
        composer={editComposer}
        headers={HEADERS}
        canUpdate
        workspaceMode="edit"
        customerLabel="Delta Industrial Corp"
        lineDisplayById={{
          [draftLine().clientLineId]: {
            description: "Frozen Industrial Valve",
            itemName: null,
            sku: "VALVE-1",
            uomCode: "EA",
            unavailable: true,
          },
        }}
      />,
    );

    expect(screen.getByLabelText(`${en.trade.scopeCompany}: Mersany Telecom`)).toHaveAttribute("aria-readonly", "true");
    expect(screen.getByLabelText(en.tradeDocuments.customer)).toHaveAttribute("aria-readonly", "true");
    expect(screen.getByRole("textbox", { name: en.tradeDocuments.currency })).toHaveAttribute("readonly");
    expect(screen.getByRole("textbox", { name: en.quotationFlow.documentReference })).not.toHaveAttribute("readonly");
    expect(screen.getByTestId("pricing-controls")).toHaveAttribute("data-permission", "trade.quotations.update");
    expect(mocks.lastLineWorkspaceProps?.partyId).toBe(PARTY_ID);
    expect(mocks.lastLineWorkspaceProps?.lineDisplayById?.[draftLine().clientLineId]).toEqual({
      description: "Frozen Industrial Valve",
      sku: "VALVE-1",
      uomCode: "EA",
      unavailable: true,
    });

    rerender(
      <QuotationComposerBody
        composer={{ ...editComposer, headerFieldsLocked: true }}
        headers={HEADERS}
        canUpdate
        workspaceMode="supersede"
        customerLabel="Delta Industrial Corp"
      />,
    );
    expect(screen.getByRole("textbox", { name: en.quotationFlow.documentReference })).toHaveAttribute("readonly");
    expect(screen.getByLabelText(en.quotationExperience.contactLabel)).toHaveAttribute("aria-readonly", "true");
  });

  it("preserves local draft cancel and explicit apply in the collapsible Commercial Terms accordion", () => {
    function TermsHarness() {
      const [paymentTermCode, setPaymentTermCode] = useState("NET_30");
      const composer = buildMockComposer({ paymentTermCode, setPaymentTermCode });
      return <QuotationComposerBody composer={composer} headers={HEADERS} canUpdate />;
    }

    render(<TermsHarness />);
    const trigger = screen.getByRole("button", { name: new RegExp(en.quotationExperience.termsSection) });
    expect(trigger).toHaveTextContent("NET_30");
    fireEvent.click(trigger);

    const paymentInput = screen.getByRole("textbox", { name: en.quotationExperience.paymentTerm });
    fireEvent.change(paymentInput, { target: { value: "NET_60" } });
    fireEvent.click(screen.getByRole("button", { name: en.common.cancel }));
    expect(trigger).toHaveTextContent("NET_30");

    fireEvent.click(trigger);
    fireEvent.change(screen.getByRole("textbox", { name: en.quotationExperience.paymentTerm }), {
      target: { value: "NET_45" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.quotationFlow.applyChanges }));
    expect(trigger).toHaveTextContent("NET_45");
  });

  it("maps TRADE.PRICE.MARGIN_GUARD and surfaces 403 TRADE.PRICE.BOOK_OVERRIDE_FORBIDDEN on write feedback", () => {
    const marginGuardComposer = buildMockComposer({
      write: {
        isWriting: false,
        isBlocked: false,
        ambiguous: null,
        writeError: {
          status: 409,
          code: "TRADE.PRICE.MARGIN_GUARD",
          message: "Below floor",
          correlationId: "corr-margin-409",
        },
        runWrite: vi.fn(),
        clearWriteError: vi.fn(),
      },
    });
    const { rerender } = render(<QuotationComposerBody composer={marginGuardComposer} headers={HEADERS} canUpdate />);
    expect(screen.getByText(en.tradeDocuments.errors.priceMarginGuard)).toBeTruthy();
    expect(screen.getByText("TRADE.PRICE.MARGIN_GUARD")).toBeTruthy();

    const forbiddenBookComposer = buildMockComposer({
      write: {
        isWriting: false,
        isBlocked: false,
        ambiguous: null,
        writeError: {
          status: 403,
          code: "TRADE.PRICE.BOOK_OVERRIDE_FORBIDDEN",
          message: "Price book override denied",
          correlationId: "corr-book-403",
        },
        runWrite: vi.fn(),
        clearWriteError: vi.fn(),
      },
    });
    rerender(<QuotationComposerBody composer={forbiddenBookComposer} headers={HEADERS} canUpdate />);
    expect(screen.getByText(en.quotationExperience.writePermission)).toBeTruthy();
    expect(screen.getByText("TRADE.PRICE.BOOK_OVERRIDE_FORBIDDEN")).toBeTruthy();
  });
});

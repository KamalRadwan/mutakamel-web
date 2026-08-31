// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Invoice } from "../types/invoices";

const { languageMock, listMock } = vi.hoisted(() => ({
  languageMock: { lang: "en" as "en" | "ar", dir: "ltr" as "ltr" | "rtl" },
  listMock: {} as Record<string, unknown>,
}));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => languageMock,
}));
vi.mock("../hooks/use-invoices-list", () => ({
  useInvoicesList: () => listMock,
}));

import { InvoicesListScreen } from "./invoices-list-screen";

const INVOICE_ID = "019f0000-0000-7000-8000-000000000001";
const TENANT_ID = "019f0000-0000-7000-8000-000000000003";
const ORPHAN_ID = "019f0000-0000-7000-8000-0000000000aa";

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: INVOICE_ID,
    subscriptionId: "019f0000-0000-7000-8000-000000000002",
    tenantId: TENANT_ID,
    tenant: {
      id: TENANT_ID,
      name: "acme-retail",
      companyName: "Acme Retail LLC",
      status: "ACTIVE",
    },
    number: "INV-2026-0001",
    status: "ISSUED",
    purpose: "TRIAL_ACTIVATION",
    currencyCode: "USD",
    subtotal: "299.0000",
    taxTotal: "0.0000",
    total: "299.0000",
    settlementCurrencyCode: "USD",
    settlementSubtotalUsd: null,
    settlementTaxTotalUsd: null,
    settlementTotalUsd: null,
    amountPaidUsd: "0.0000",
    fxUnitsPerUsd: null,
    fxRateRevisionId: null,
    fxObservedAt: null,
    settlementLockedAt: null,
    periodStart: "2026-03-09T00:00:00.000Z",
    periodEnd: "2026-04-08T23:59:59.000Z",
    issuedAt: null,
    dueAt: null,
    paidAt: null,
    createdAt: "2026-03-09T00:00:00.000Z",
    updatedAt: "2026-03-09T00:00:00.000Z",
    ...overrides,
  };
}

function baseList(items: Invoice[]) {
  return {
    permissions: {
      canRead: true,
      canCreate: true,
      canUpdate: true,
      canIssue: true,
      canVoid: true,
      canRecordOfflinePayment: true,
    },
    draft: {
      search: "",
      tenantId: "",
      status: "",
      sortBy: "createdAt",
      sortDir: "DESC",
      limit: "20",
    },
    validationErrors: {},
    page: 1,
    state: "READY",
    snapshot: {
      data: {
        items,
        page: 1,
        limit: 20,
        total: items.length,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
      correlationId: "corr-invoice",
      responseTimestamp: "2026-03-09T00:00:00.000Z",
    },
    error: null,
    isRefreshing: false,
    updateFilter: vi.fn(),
    submitFilters: vi.fn((event: { preventDefault: () => void }) => event.preventDefault()),
    clearFilters: vi.fn(),
    refresh: vi.fn(),
    previousPage: vi.fn(),
    nextPage: vi.fn(),
    goToPage: vi.fn(),
  };
}

function invoiceRow() {
  return screen.getAllByRole("row").find((row) => within(row).queryByText("INV-2026-0001"))!;
}

describe("InvoicesListScreen", () => {
  beforeEach(() => {
    languageMock.lang = "en";
    languageMock.dir = "ltr";
    for (const key of Object.keys(listMock)) delete listMock[key];
    Object.assign(listMock, baseList([invoice()]));
  });

  it("identifies an invoice by its number without the raw UUID", () => {
    render(<InvoicesListScreen />);

    const row = invoiceRow();
    expect(within(row).getByRole("link", { name: "INV-2026-0001" })).toBeTruthy();
    expect(row.textContent).not.toContain(INVOICE_ID);
  });

  it("writes out purpose and status instead of their wire codes", () => {
    render(<InvoicesListScreen />);

    const row = invoiceRow();
    expect(within(row).getByText("Trial activation")).toBeTruthy();
    expect(within(row).getByText("Issued")).toBeTruthy();
    expect(row.textContent).not.toContain("TRIAL_ACTIVATION");
    expect(row.textContent).not.toContain("ISSUED");
  });

  it("writes out purpose and status in Arabic", () => {
    languageMock.lang = "ar";
    languageMock.dir = "rtl";
    render(<InvoicesListScreen />);

    const row = invoiceRow();
    expect(within(row).getByText("تفعيل التجربة")).toBeTruthy();
    expect(within(row).getByText("صادر")).toBeTruthy();
    expect(row.textContent).not.toContain("TRIAL_ACTIVATION");
  });

  it("names the billed tenant by its company name", () => {
    render(<InvoicesListScreen />);

    const row = invoiceRow();
    const tenantLink = within(row).getByRole("link", { name: "Acme Retail LLC" });
    expect(tenantLink.getAttribute("href")).toBe(`/tenants/${TENANT_ID}`);
    expect(within(row).getByText("acme-retail")).toBeTruthy();
  });

  it("falls back to the tenant UUID once the tenant is gone", () => {
    Object.assign(listMock, baseList([invoice({ tenantId: ORPHAN_ID, tenant: null })]));
    render(<InvoicesListScreen />);

    const row = invoiceRow();
    expect(within(row).getByRole("link", { name: ORPHAN_ID })).toBeTruthy();
    expect(within(row).getByText("Tenant no longer exists")).toBeTruthy();
  });

  it("renders the service period as dates without a clock", () => {
    render(<InvoicesListScreen />);

    expect(within(invoiceRow()).getByText("09/03/2026 → 08/04/2026")).toBeTruthy();
  });

  it("offers written status labels in the filter", () => {
    render(<InvoicesListScreen />);

    fireEvent.click(screen.getByLabelText("Status"));
    expect(screen.getByRole("option", { name: "Partially paid" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "PARTIALLY_PAID" })).toBeNull();
    // The filter must speak the same vocabulary as the badges it returns.
    expect(screen.getByRole("option", { name: "Issued" })).toBeTruthy();
  });
});

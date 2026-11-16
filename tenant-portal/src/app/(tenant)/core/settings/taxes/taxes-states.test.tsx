// @vitest-environment jsdom

import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { axiosClient, type AxiosResponse } from "@/lib/api/axiosClient";
import {
  TAXES_COMPANIES_PATH,
  installTaxesTestPolyfills,
  renderTaxesScreen,
  taxesApiError,
  taxesPageEnvelope,
  taxesProvidersUi,
  taxesRowEnvelope,
  type MockTaxesAuthUser,
} from "./taxes-test-helpers";

installTaxesTestPolyfills();

let currentUser: MockTaxesAuthUser;
let currentGeneration = "gen-1";

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({
    user: currentUser,
    realtimeAuthGeneration: currentGeneration,
    isAuthenticated: true,
    isLoading: false,
  }),
}));

const knownCompanyId = "01902001-3000-7000-8000-0000000000c1";
const unknownCompanyId = "01902001-3000-7000-8000-000000000999";
const taxOneId = "01902001-3000-7000-8000-000000000031";
const taxTwoId = "01902001-3000-7000-8000-000000000032";

const knownCompany = { id: knownCompanyId, code: "ACME", name: "Acme Retail", status: "ACTIVE" };

const knownTax = {
  id: taxOneId,
  code: "VAT15",
  name: "Standard VAT",
  rate: "15.0000",
  isInclusive: false,
  companyId: knownCompanyId,
  status: "ACTIVE",
  updatedAt: "2026-08-25T10:00:00.000Z",
};

const unknownCompanyTax = {
  id: taxTwoId,
  code: "REG7",
  name: "Unresolved Company Tax",
  rate: "7.0000",
  isInclusive: true,
  companyId: unknownCompanyId,
  status: "ACTIVE",
  updatedAt: "2026-08-25T10:05:00.000Z",
};

beforeEach(() => {
  currentGeneration = "gen-1";
  currentUser = {
    id: "01902001-3000-7000-8000-000000000001",
    isTenantOwner: false,
    permissions: ["taxes.tax.read", "taxes.tax.manage"],
    accessibleCompanies: [knownCompanyId, unknownCompanyId],
    permissionScopes: {
      "taxes.tax.manage": {
        tenantWide: false,
        companyIds: [knownCompanyId, unknownCompanyId],
        branchIds: [],
      },
    },
  };
});

afterEach(() => {
  cleanup();
  window.localStorage.removeItem("tenant_lang");
  vi.restoreAllMocks();
});

describe("TaxesPage dependency fallback, query failure retention, read-only, and scope fencing", () => {
  it("renders unknown company label without UUID and retains rows and scoped permissions on partial company lookup failure", async () => {
    vi.spyOn(axiosClient, "get").mockImplementation(async (url) => {
      if (url.startsWith(TAXES_COMPANIES_PATH)) {
        throw taxesApiError(503, "UPSTREAM_UNAVAILABLE", "Company directory unavailable");
      }
      return taxesPageEnvelope([knownTax, unknownCompanyTax]);
    });

    const { container, unmount } = await renderTaxesScreen("en");
    expect(await screen.findByText("Standard VAT")).toBeInTheDocument();
    expect(screen.getByText("Unresolved Company Tax")).toBeInTheDocument();
    expect(screen.getAllByText(en.coreSettings.unknownCompany)).toHaveLength(2);
    expect(container.textContent).not.toContain(knownCompanyId);
    expect(container.textContent).not.toContain(unknownCompanyId);

    const companyAlert = await screen.findByRole("alert");
    expect(within(companyAlert).getByText(en.coreSettings.companyOptionsLoadFailed)).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: `${en.coreSettings.taxEditTitle}: Unresolved Company Tax (REG7)`,
      }),
    ).toBeInTheDocument();

    unmount();
    const { container: arContainer } = await renderTaxesScreen("ar");
    expect(await screen.findByText("Unresolved Company Tax")).toBeInTheDocument();
    expect(screen.getAllByText(ar.coreSettings.unknownCompany)).toHaveLength(2);
    expect(arContainer.textContent).not.toContain(unknownCompanyId);
  });

  it("retains loaded rows on same-query refresh failure and offers Add tax on writable unfiltered EmptyState", async () => {
    let taxCall = 0;
    vi.spyOn(axiosClient, "get").mockImplementation(async (url) => {
      if (url.startsWith(TAXES_COMPANIES_PATH)) return taxesPageEnvelope([knownCompany], 100);
      taxCall += 1;
      if (taxCall === 1) return taxesPageEnvelope([knownTax]);
      if (taxCall === 2) throw taxesApiError(500, "INTERNAL_ERROR", "Transient refresh error");
      return taxesPageEnvelope([]);
    });

    await renderTaxesScreen("en");
    expect(await screen.findByText("Standard VAT")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: en.coreSettings.reload }));
    expect(await screen.findByText(en.coreSettings.taxLoadFailed)).toBeInTheDocument();
    expect(screen.getByText("Standard VAT")).toBeInTheDocument();
    expect(screen.queryByText(en.coreSettings.taxEmpty)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: en.common.retry }));
    expect(await screen.findByText(en.coreSettings.taxEmpty)).toBeInTheDocument();
    expect(screen.queryByText(en.coreSettings.taxLoadFailed)).toBeNull();
    expect(screen.queryByRole("button", { name: en.coreSettings.clearFilters })).toBeNull();
    const createButtons = screen.getAllByRole("button", { name: en.coreSettings.taxCreate });
    expect(createButtons).toHaveLength(2);
    fireEvent.click(createButtons[1]!);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: en.common.cancel }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.click(screen.getByRole("combobox", { name: en.common.status }));
    fireEvent.click(await screen.findByRole("option", { name: en.common.inactive }));
    expect(await screen.findByText(en.coreIdentity.picker.empty)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: en.coreSettings.clearFilters }).length).toBeGreaterThan(0);
  });

  it("renders readable read-only grids without write actions for permission-only and subscription READ_ONLY actors", async () => {
    currentUser = {
      id: "01902001-3000-7000-8000-000000000001",
      isTenantOwner: false,
      permissions: ["taxes.tax.read"],
    };
    vi.spyOn(axiosClient, "get").mockImplementation(async (url) => {
      if (url.startsWith(TAXES_COMPANIES_PATH)) return taxesPageEnvelope([knownCompany], 100);
      return taxesPageEnvelope([knownTax]);
    });

    const { unmount } = await renderTaxesScreen("en");
    expect(await screen.findByText("Standard VAT")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(en.common.readOnly);
    expect(screen.queryByRole("button", { name: en.coreSettings.taxCreate })).toBeNull();
    unmount();

    currentUser = {
      id: "01902001-3000-7000-8000-000000000001",
      isTenantOwner: true,
      permissions: ["taxes.tax.read", "taxes.tax.manage"],
      permissionScopes: { "taxes.tax.manage": { tenantWide: true, companyIds: [], branchIds: [] } },
      accessMode: "READ_ONLY",
    };
    await renderTaxesScreen("en");
    expect(await screen.findByText("Standard VAT")).toBeInTheDocument();
    expect(screen.getByText(en.coreBilling.accessReadOnlyNotice)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.coreSettings.taxCreate })).toBeNull();
  });

  it("fences stale read and write completions across same-actor scope and generation changes", async () => {
    currentGeneration = "gen-before";
    currentUser = {
      id: "01902001-3000-7000-8000-000000000001",
      isTenantOwner: false,
      permissions: ["taxes.tax.read", "taxes.tax.manage"],
      accessibleCompanies: [knownCompanyId],
      permissionScopes: {
        "taxes.tax.manage": { tenantWide: false, companyIds: [knownCompanyId], branchIds: [] },
      },
    };
    let taxCall = 0;
    let resolveStaleRead: ((value: AxiosResponse<unknown>) => void) | undefined;
    let resolveStalePost: ((value: AxiosResponse<unknown>) => void) | undefined;
    vi.spyOn(axiosClient, "get").mockImplementation((url) => {
      if (url.startsWith(TAXES_COMPANIES_PATH)) return Promise.resolve(taxesPageEnvelope([knownCompany], 100));
      taxCall += 1;
      if (taxCall === 2) {
        return new Promise<AxiosResponse<unknown>>((resolve) => {
          resolveStaleRead = resolve;
        });
      }
      return Promise.resolve(taxesPageEnvelope(taxCall === 1 ? [knownTax] : []));
    });
    vi.spyOn(axiosClient, "post").mockImplementation(
      () =>
        new Promise<AxiosResponse<unknown>>((resolve) => {
          resolveStalePost = resolve;
        }),
    );

    const { rerender } = await renderTaxesScreen("en");
    expect(await screen.findByText("Standard VAT")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: en.coreSettings.reload }));
    await waitFor(() => expect(taxCall).toBe(2));

    fireEvent.click(screen.getByRole("button", { name: en.coreSettings.taxCreate }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(new RegExp(`^${en.coreSettings.taxCode}`)), {
      target: { value: "STALE1" },
    });
    fireEvent.change(within(dialog).getByLabelText(new RegExp(`^${en.coreSettings.taxName}`)), {
      target: { value: "Stale Write" },
    });
    fireEvent.change(within(dialog).getByLabelText(new RegExp(`^${en.coreSettings.taxRate}`)), {
      target: { value: "5" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: en.coreSettings.taxCreateSubmit }));

    currentGeneration = "gen-after";
    currentUser = {
      ...currentUser,
      accessibleCompanies: [],
      permissions: ["taxes.tax.read"],
      permissionScopes: {},
    };
    rerender(taxesProvidersUi("en"));

    expect(await screen.findByText(en.coreSettings.taxEmpty)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();

    await act(async () => {
      resolveStaleRead?.(taxesPageEnvelope([unknownCompanyTax]));
      resolveStalePost?.(taxesRowEnvelope(knownTax, 201));
    });

    expect(screen.queryByText("Unresolved Company Tax")).toBeNull();
    expect(screen.queryByText(en.coreSettings.taxCreated)).toBeNull();
  });

  it("hides old rows immediately on deferred pageSize change, settles to ErrorState + Retry on failure, and retains rows on same-query reload failure", async () => {
    let rejectLimit50!: (reason: unknown) => void;
    const limit50Deferred = new Promise<AxiosResponse<unknown>>((_resolve, reject) => {
      rejectLimit50 = reject;
    });
    let limit50Calls = 0;
    const taxUrls: string[] = [];

    vi.spyOn(axiosClient, "get").mockImplementation((url) => {
      if (url.startsWith(TAXES_COMPANIES_PATH)) {
        return Promise.resolve(taxesPageEnvelope([knownCompany], 100));
      }
      taxUrls.push(url);
      const limit = Number(new URL(url, "https://tenant.test").searchParams.get("limit") ?? "20");
      if (limit === 50) {
        limit50Calls += 1;
        if (limit50Calls === 1) return limit50Deferred;
        if (limit50Calls === 2) return Promise.resolve(taxesPageEnvelope([unknownCompanyTax], 50));
        return Promise.reject(taxesApiError(500, "INTERNAL_ERROR", "Raw same-limit refresh crash"));
      }
      return Promise.resolve(taxesPageEnvelope([knownTax], 20));
    });

    await renderTaxesScreen("en");
    expect(await screen.findByText("Standard VAT")).toBeInTheDocument();

    const rowsPerPageSelect = screen.getByRole("combobox", { name: en.common.rowsPerPage });
    fireEvent.click(rowsPerPageSelect);
    fireEvent.click(await screen.findByRole("option", { name: "50" }));

    await waitFor(() => expect(limit50Calls).toBe(1));
    expect(taxUrls.at(-1)).toBe("/api/tenant/core/v1/taxes?page=1&limit=50&sortBy=code&sortDir=ASC");
    expect(screen.queryByText("Standard VAT")).toBeNull();
    expect(screen.queryByText(en.coreSettings.taxEmpty)).toBeNull();
    expect(screen.getByRole("button", { name: en.coreSettings.reload })).toBeDisabled();

    await act(async () => {
      rejectLimit50(taxesApiError(500, "INTERNAL_ERROR", "Raw limit 50 SQL crash"));
    });
    expect(await screen.findByText(en.coreSettings.taxLoadFailed)).toBeInTheDocument();
    expect(screen.queryByText("Raw limit 50 SQL crash")).toBeNull();
    expect(screen.queryByText("Standard VAT")).toBeNull();
    expect(screen.queryByText(en.coreSettings.taxEmpty)).toBeNull();
    expect(screen.getByRole("button", { name: en.coreSettings.reload })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: en.common.retry }));
    expect(await screen.findByText("Unresolved Company Tax")).toBeInTheDocument();
    expect(screen.queryByText(en.coreSettings.taxLoadFailed)).toBeNull();

    // Same-query refresh failure on limit=50 retains the loaded limit=50 rows.
    fireEvent.click(screen.getByRole("button", { name: en.coreSettings.reload }));
    expect(await screen.findByText(en.coreSettings.taxLoadFailed)).toBeInTheDocument();
    expect(screen.getByText("Unresolved Company Tax")).toBeInTheDocument();
    expect(screen.queryByText("Raw same-limit refresh crash")).toBeNull();
  });
});

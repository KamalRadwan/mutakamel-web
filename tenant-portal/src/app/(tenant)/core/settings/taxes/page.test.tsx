// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, TooltipProvider } from "@/design-system";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { I18nProvider, type Language } from "@/i18n/I18nContext";
import { setLanguage } from "@/i18n/useLanguage";
import {
  axiosClient,
  TenantApiClientError,
  type AxiosResponse,
  type TenantApiRequestConfig,
} from "@/lib/api/axiosClient";
import type { PermissionScope } from "@/lib/auth/permission-scope";
import { formatDecimalString } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import TaxesPage from "./page";
import { TAXES_PATH, TAX_CODE_TAKEN_CODE } from "./tax-contract";

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
if (typeof HTMLElement.prototype.hasPointerCapture === "undefined") {
  HTMLElement.prototype.hasPointerCapture = () => false;
}
if (typeof HTMLElement.prototype.setPointerCapture === "undefined") {
  HTMLElement.prototype.setPointerCapture = () => {};
}
if (typeof HTMLElement.prototype.releasePointerCapture === "undefined") {
  HTMLElement.prototype.releasePointerCapture = () => {};
}
if (typeof Element.prototype.scrollIntoView === "undefined") {
  Element.prototype.scrollIntoView = () => {};
}

interface MockAuthUser {
  id: string;
  isTenantOwner: boolean;
  permissions: string[];
  permissionScopes?: Record<string, PermissionScope>;
}

let currentUser: MockAuthUser;

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({
    user: currentUser,
    isAuthenticated: true,
    isLoading: false,
  }),
}));

const companyAId = "01902001-3000-7000-8000-0000000000c1";
const companyBId = "01902001-3000-7000-8000-0000000000c2";
const tenantTaxId = "01902001-3000-7000-8000-000000000011";
const companyATaxId = "01902001-3000-7000-8000-000000000012";
const companyBTaxId = "01902001-3000-7000-8000-000000000013";
const createdTaxId = "01902001-3000-7000-8000-000000000014";

const companyA = {
  id: companyAId,
  code: "ACME",
  name: "Acme Retail",
  status: "ACTIVE",
};

const companyB = {
  id: companyBId,
  code: "GLOBEX",
  name: "Globex Logistics",
  status: "ACTIVE",
};

const tenantWideTax = {
  id: tenantTaxId,
  code: "VAT15",
  name: "Standard VAT",
  rate: "15.0000",
  isInclusive: false,
  companyId: null,
  status: "ACTIVE",
  updatedAt: "2026-08-25T10:00:00.000Z",
};

const companyATax = {
  id: companyATaxId,
  code: "MUN25",
  name: "Municipality Levy",
  rate: "2.5000",
  isInclusive: true,
  companyId: companyAId,
  status: "ACTIVE",
  updatedAt: "2026-08-25T10:05:00.000Z",
};

const companyBTax = {
  id: companyBTaxId,
  code: "PORT1",
  name: "Port Duty",
  rate: "1.2500",
  isInclusive: false,
  companyId: companyBId,
  status: "INACTIVE",
  updatedAt: "2026-08-25T10:10:00.000Z",
};

const COMPANIES_PATH = "/api/tenant/core/v1/organization/companies";

function pageEnvelope(
  rows: unknown[],
  overrides: Partial<{
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  }> = {},
): AxiosResponse<unknown> {
  const page = overrides.page ?? 1;
  const limit = overrides.limit ?? 20;
  const total = overrides.total ?? rows.length;
  const totalPages = overrides.totalPages ?? (total === 0 ? 0 : Math.ceil(total / limit));
  return {
    status: 200,
    statusText: "OK",
    headers: new Headers(),
    data: {
      success: true,
      status: "SUCCESS",
      statusCode: 200,
      data: rows,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNext: overrides.hasNext ?? page < totalPages,
        hasPrev: overrides.hasPrev ?? page > 1,
      },
    },
  };
}

function companiesEnvelope(rows: unknown[] = [companyA, companyB], page = 1, total = rows.length) {
  return pageEnvelope(rows, { page, limit: 100, total });
}

function rowEnvelope(data: unknown, status = 200): AxiosResponse<unknown> {
  return {
    status,
    statusText: "OK",
    headers: new Headers(),
    data: { success: true, status: "SUCCESS", statusCode: status, data },
  };
}

function apiError(status: number, errorCode: string, message: string, correlationId?: string) {
  return new TenantApiClientError(message, {
    status,
    statusText: "Error",
    headers: new Headers(),
    data: {
      success: false,
      status: "ERROR",
      statusCode: status,
      errorCode,
      message,
      ...(correlationId ? { correlationId } : {}),
    },
  });
}

async function renderTaxesPage(lang: Language = "en") {
  let view!: ReturnType<typeof render>;
  await act(async () => {
    await setLanguage(lang);
    view = render(
      <I18nProvider initialLanguage={lang}>
        <TooltipProvider>
          <ToastProvider>
            <TaxesPage />
          </ToastProvider>
        </TooltipProvider>
      </I18nProvider>,
    );
  });
  return view;
}

async function selectRadixOption(trigger: HTMLElement, optionName: string) {
  fireEvent.click(trigger);
  const listbox = await screen.findByRole("listbox");
  const option = within(listbox).getByRole("option", { name: optionName });
  fireEvent.click(option);
}

async function applyActiveTaxQuery(
  taxUrls: string[],
  sortDirection: "ASC" | "DESC" = "ASC",
  isInclusive = true,
) {
  const statusTrigger = screen.getByRole("combobox", { name: en.common.status });
  const scopeTrigger = screen.getByRole("combobox", { name: en.coreSettings.taxCompany });
  const inclusiveTrigger = screen.getByRole("combobox", { name: en.coreSettings.taxInclusive });
  await selectRadixOption(statusTrigger, en.common.active);
  await selectRadixOption(scopeTrigger, "Acme Retail");
  await selectRadixOption(inclusiveTrigger, isInclusive ? en.coreSettings.taxInclusiveYes : en.coreSettings.taxInclusiveNo);
  fireEvent.change(screen.getByPlaceholderText(en.coreSettings.taxSearch), { target: { value: "levy" } });
  await waitFor(() => expect(taxUrls.at(-1)).toBe(
    `${TAXES_PATH}?page=1&limit=20&sortBy=code&sortDir=ASC&search=levy&status=ACTIVE&companyId=${companyAId}&isInclusive=${isInclusive}`,
  ), { timeout: 1_500 });
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${en.coreSettings.taxRate}`) }));
  await waitFor(() => expect(taxUrls.at(-1)).toBe(
    `${TAXES_PATH}?page=1&limit=20&sortBy=rate&sortDir=ASC&search=levy&status=ACTIVE&companyId=${companyAId}&isInclusive=${isInclusive}`,
  ));
  if (sortDirection === "DESC") {
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${en.coreSettings.taxRate}`) }));
    await waitFor(() => expect(taxUrls.at(-1)).toBe(
      `${TAXES_PATH}?page=1&limit=20&sortBy=rate&sortDir=DESC&search=levy&status=ACTIVE&companyId=${companyAId}&isInclusive=${isInclusive}`,
    ));
  }
  return { scopeTrigger, inclusiveTrigger };
}

function mockRowsPerPageTaxList(taxUrls: string[], deactivated = () => false) {
  vi.spyOn(axiosClient, "get").mockImplementation(async (url) => {
    if (url.startsWith(COMPANIES_PATH)) return companiesEnvelope();
    taxUrls.push(url);
    const searchParams = new URL(url, "https://tenant.test").searchParams;
    const page = Number(searchParams.get("page") ?? "1");
    const limit = Number(searchParams.get("limit") ?? "20");
    if (limit === 100) return pageEnvelope([tenantWideTax, companyATax], { page: 1, limit: 100, total: 50 });
    if (limit === 50) {
      if (deactivated()) return page === 2
        ? pageEnvelope([], { page: 2, limit: 50, total: 50, totalPages: 1, hasPrev: true })
        : pageEnvelope([tenantWideTax], { page: 1, limit: 50, total: 50, totalPages: 1 });
      return page === 2
        ? pageEnvelope([companyATax], { page: 2, limit: 50, total: 51, totalPages: 2, hasPrev: true })
        : pageEnvelope([tenantWideTax], { page: 1, limit: 50, total: 51, totalPages: 2, hasNext: true });
    }
    return page === 2
      ? pageEnvelope([companyATax], { page: 2, limit: 20, total: 45, totalPages: 3, hasPrev: true, hasNext: true })
      : pageEnvelope([tenantWideTax], { page: 1, limit: 20, total: 45, totalPages: 3, hasNext: true });
  });
}

function formatExpectedRate(rate: string, dict: typeof ar, localeLang: Language) {
  return formatTemplate(dict.coreSettings.taxRateValue, {
    rate: formatDecimalString(rate, localeLang, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    }),
  });
}

beforeEach(() => {
  currentUser = {
    id: "01902001-3000-7000-8000-000000000001",
    isTenantOwner: false,
    permissions: ["taxes.tax.read", "taxes.tax.manage"],
    permissionScopes: {
      "taxes.tax.manage": { tenantWide: true, companyIds: [], branchIds: [] },
    },
  };
});

afterEach(() => {
  cleanup();
  window.localStorage.removeItem("tenant_lang");
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("TaxesPage transport, scope, and recovery behavior", () => {
  it("renders canonical { data, meta } rows with tax and company names, preserves codes and decimal rates, and omits repeated SubNav and redundant descriptions in EN and AR", async () => {
    const taxUrls: string[] = [];
    vi.spyOn(axiosClient, "get").mockImplementation(async (url) => {
      if (url.startsWith(COMPANIES_PATH)) return companiesEnvelope();
      taxUrls.push(url);
      return pageEnvelope([tenantWideTax, companyATax]);
    });

    const { container, unmount } = await renderTaxesPage("en");

    expect(await screen.findByText("Standard VAT")).toBeInTheDocument();
    expect(await screen.findByText("Acme Retail")).toBeInTheDocument();
    expect(taxUrls).toEqual([`${TAXES_PATH}?page=1&limit=20&sortBy=code&sortDir=ASC`]);
    expect(screen.getByText("VAT15")).toBeInTheDocument();
    expect(screen.getByText("MUN25")).toBeInTheDocument();
    expect(screen.getByText("15%")).toBeInTheDocument();
    expect(screen.getByText("2.5%")).toBeInTheDocument();
    expect(screen.getByText(en.coreSettings.taxTenantWide)).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: en.coreSettings.taxCompany }),
    ).toHaveTextContent(en.coreIdentity.filters.allCompanies);
    expect(screen.queryByText(en.coreSettings.taxScopeAny)).toBeNull();

    expect(container.querySelector("nav")).toBeNull();
    expect(
      screen.getByRole("heading", { level: 1, name: en.coreSettings.taxesTitle }),
    ).toBeInTheDocument();
    expect(screen.queryByText(en.coreSettings.taxesSubtitle)).toBeNull();
    expect(container.textContent).not.toContain(companyAId);
    expect(container.textContent).not.toContain(tenantTaxId);

    unmount();
    await renderTaxesPage("ar");
    expect(await screen.findByText("Standard VAT")).toBeInTheDocument();
    expect(await screen.findByText("Acme Retail")).toBeInTheDocument();
    expect(screen.getByText(ar.coreSettings.taxTenantWide)).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: ar.coreSettings.taxCompany }),
    ).toHaveTextContent(ar.coreIdentity.filters.allCompanies);
    expect(screen.queryByText(ar.coreSettings.taxScopeAny)).toBeNull();
    expect(screen.getByText(formatExpectedRate(tenantWideTax.rate, ar, "ar"))).toBeInTheDocument();
    expect(screen.getByText(formatExpectedRate(companyATax.rate, ar, "ar"))).toBeInTheDocument();
  });

  it("renders PermissionGate when read permission is absent or when GET /taxes returns 403", async () => {
    currentUser = {
      ...currentUser,
      permissions: [],
    };
    const deniedTaxCalls: string[] = [];
    vi.spyOn(axiosClient, "get").mockImplementation(async (url) => {
      if (url.startsWith(COMPANIES_PATH)) return companiesEnvelope([]);
      deniedTaxCalls.push(url);
      return pageEnvelope([]);
    });

    const { unmount: unmountMissingPerm } = await renderTaxesPage("en");
    expect(await screen.findByText(en.permissionGate.title)).toBeInTheDocument();
    expect(deniedTaxCalls).toEqual([]);
    unmountMissingPerm();

    currentUser = {
      id: "01902001-3000-7000-8000-000000000001",
      isTenantOwner: false,
      permissions: ["taxes.tax.read", "taxes.tax.manage"],
      permissionScopes: {
        "taxes.tax.manage": { tenantWide: true, companyIds: [], branchIds: [] },
      },
    };
    vi.restoreAllMocks();
    vi.spyOn(axiosClient, "get").mockImplementation(async (url) => {
      if (url.startsWith(COMPANIES_PATH)) return companiesEnvelope();
      throw apiError(403, "FORBIDDEN", "Raw forbidden wire text");
    });

    await renderTaxesPage("en");
    expect(await screen.findByText(en.permissionGate.title)).toBeInTheDocument();
    expect(screen.queryByText("Raw forbidden wire text")).toBeNull();
    expect(screen.queryByText(en.coreSettings.taxEmpty)).toBeNull();
  });

  it("renders localized error and company-lookup states without leaking wire text", async () => {
    const companyDeniedCorrId = "01902001-3000-7000-8000-000000000087";
    vi.spyOn(axiosClient, "get").mockImplementation(async (url) => {
      if (url.startsWith(COMPANIES_PATH)) {
        throw apiError(
          403,
          "MISSING_REQUIRED_PERMISSIONS",
          "Raw missing organization.read wire text",
          companyDeniedCorrId,
        );
      }
      return pageEnvelope([tenantWideTax]);
    });

    const { unmount: unmountCompany403En } = await renderTaxesPage("en");
    expect(await screen.findByText("Standard VAT")).toBeInTheDocument();
    const companyDeniedAlertEn = await screen.findByRole("alert");
    expect(within(companyDeniedAlertEn).getByText(en.coreSettings.companyOptionsLoadFailed)).toBeInTheDocument();
    expect(
      within(companyDeniedAlertEn).getByText((text) =>
        text.includes(en.coreIdentity.errors.MISSING_REQUIRED_PERMISSIONS) &&
        text.includes(companyDeniedCorrId),
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Raw missing organization.read wire text")).toBeNull();
    expect(screen.queryByText(en.coreSettings.companyOptionsLoadFailedDescription)).toBeNull();
    expect(within(companyDeniedAlertEn).queryByRole("button", { name: en.common.retry })).toBeNull();
    expect(screen.queryByRole("button", { name: en.common.retry })).toBeNull();
    expect(screen.getByRole("button", { name: en.coreSettings.taxCreate })).toBeInTheDocument();
    unmountCompany403En();

    const { unmount: unmountCompany403Ar } = await renderTaxesPage("ar");
    const companyDeniedAlertAr = await screen.findByRole("alert");
    expect(within(companyDeniedAlertAr).getByText(ar.coreSettings.companyOptionsLoadFailed)).toBeInTheDocument();
    expect(
      within(companyDeniedAlertAr).getByText((text) =>
        text.includes(ar.coreIdentity.errors.MISSING_REQUIRED_PERMISSIONS),
      ),
    ).toBeInTheDocument();
    expect(within(companyDeniedAlertAr).queryByRole("button", { name: ar.common.retry })).toBeNull();
    unmountCompany403Ar();

    const corrId = "01902001-3000-7000-8000-000000000088";
    const companyTransientCorrId = "01902001-3000-7000-8000-000000000089";
    let taxAttempt = 0;
    let companyAttempt = 0;
    vi.restoreAllMocks();
    vi.spyOn(axiosClient, "get").mockImplementation(async (url) => {
      if (url.startsWith(COMPANIES_PATH)) {
        companyAttempt += 1;
        if (companyAttempt === 1) {
          throw apiError(503, "UPSTREAM_UNAVAILABLE", "Raw upstream company outage", companyTransientCorrId);
        }
        const parsedUrl = new URL(url, "https://tenant.test");
        const pageNum = Number(parsedUrl.searchParams.get("page") ?? "1");
        const pageRows = Array.from({ length: 100 }, (_, index) => {
          const n = (pageNum - 1) * 100 + index + 1;
          return {
            id: `01902001-3000-7000-8000-${String(n).padStart(12, "0")}`,
            code: `C${n}`,
            name: `Company ${n}`,
            status: "ACTIVE",
          };
        });
        return companiesEnvelope(pageRows, pageNum, 1_001);
      }
      taxAttempt += 1;
      if (taxAttempt === 1) {
        return {
          status: 200,
          statusText: "OK",
          headers: new Headers(),
          data: { items: [tenantWideTax], total: 1, page: 1, limit: 20 },
        };
      }
      if (taxAttempt === 2) {
        throw apiError(500, "INTERNAL_ERROR", "Raw SQL failure", corrId);
      }
      return pageEnvelope([]);
    });

    await renderTaxesPage("en");

    const companyTransientAlert = await screen.findByRole("alert");
    expect(within(companyTransientAlert).getByText(en.coreSettings.companyOptionsLoadFailed)).toBeInTheDocument();
    expect(
      within(companyTransientAlert).getByText((text) =>
        text.includes(en.coreSettings.companyOptionsLoadFailedDescription) &&
        text.includes(companyTransientCorrId),
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Raw upstream company outage")).toBeNull();
    expect(await screen.findByText(en.coreSettings.taxLoadFailed)).toBeInTheDocument();
    expect(screen.queryByText(en.coreIdentity.errors.OFFLINE)).toBeNull();

    fireEvent.click(within(companyTransientAlert).getByRole("button", { name: en.common.retry }));
    expect(await screen.findByText(en.coreSettings.companyOptionsTruncated)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: en.common.retry }));
    expect(await screen.findByText((text) => text.includes(corrId))).toBeInTheDocument();
    expect(screen.queryByText("Raw SQL failure")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: en.common.retry }));
    expect(await screen.findByText(en.coreSettings.taxEmpty)).toBeInTheDocument();
  });

  it("enforces company-level manage scope across row actions and modals while keeping backend write DTOs unchanged", async () => {
    currentUser = {
      ...currentUser,
      permissionScopes: {
        "taxes.tax.manage": {
          tenantWide: false,
          companyIds: [companyAId],
          branchIds: [],
        },
      },
    };
    vi.spyOn(axiosClient, "get").mockImplementation(async (url) => {
      if (url.startsWith(COMPANIES_PATH)) return companiesEnvelope();
      return pageEnvelope([tenantWideTax, companyATax, companyBTax]);
    });
    const postSpy = vi
      .spyOn(axiosClient, "post")
      .mockRejectedValueOnce(apiError(409, TAX_CODE_TAKEN_CODE, "Duplicate code"))
      .mockResolvedValueOnce(rowEnvelope({ ...companyATax, id: createdTaxId }, 201));
    const patchSpy = vi.spyOn(axiosClient, "patch").mockResolvedValueOnce(rowEnvelope(companyATax));

    await renderTaxesPage("en");
    expect(await screen.findByText("Municipality Levy")).toBeInTheDocument();
    expect(await screen.findByText("Acme Retail")).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: `${en.coreSettings.taxEditTitle}: Municipality Levy (MUN25)` }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: `${en.coreSettings.deactivate}: Municipality Levy (MUN25)` }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: `${en.coreSettings.taxEditTitle}: Standard VAT (VAT15)` }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: `${en.coreSettings.taxEditTitle}: Port Duty (PORT1)` }),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: en.coreSettings.taxCreate }));
    const createDialog = await screen.findByRole("dialog");
    expect(within(createDialog).queryByText(en.coreSettings.taxCreateDescription)).toBeNull();
    expect(within(createDialog).queryByText(en.coreSettings.taxScopeHint)).toBeNull();
    expect(within(createDialog).queryByText(en.coreSettings.taxCodeHint)).toBeNull();
    expect(within(createDialog).queryByText(en.coreSettings.taxRateHint)).toBeNull();
    expect(within(createDialog).queryByText(en.coreSettings.taxInclusiveHint)).toBeNull();
    expect(within(createDialog).getByText("%")).toBeInTheDocument();
    const createScopeCombobox = within(createDialog).getByRole("combobox", {
      name: en.coreSettings.taxCompany,
    });
    expect(createScopeCombobox).toHaveTextContent("Acme Retail");
    expect(createScopeCombobox).toBeDisabled();

    fireEvent.change(within(createDialog).getByLabelText(new RegExp(`^${en.coreSettings.taxCode}`)), {
      target: { value: "mun25" },
    });
    fireEvent.change(within(createDialog).getByLabelText(new RegExp(`^${en.coreSettings.taxName}`)), {
      target: { value: "Regional Levy" },
    });
    fireEvent.change(within(createDialog).getByLabelText(new RegExp(`^${en.coreSettings.taxRate}`)), {
      target: { value: "3.5" },
    });
    fireEvent.click(within(createDialog).getByRole("button", { name: en.coreSettings.taxCreateSubmit }));

    expect(
      await within(createDialog).findByText(
        formatTemplate(en.coreSettings.taxCodeTaken, { company: "Acme Retail" }),
      ),
    ).toBeInTheDocument();

    fireEvent.change(within(createDialog).getByLabelText(new RegExp(`^${en.coreSettings.taxCode}`)), {
      target: { value: "reg35" },
    });
    fireEvent.click(within(createDialog).getByRole("button", { name: en.coreSettings.taxCreateSubmit }));

    await waitFor(() =>
      expect(postSpy).toHaveBeenLastCalledWith(
        TAXES_PATH,
        {
          code: "REG35",
          name: "Regional Levy",
          rate: 3.5,
          companyId: companyAId,
        },
        expect.anything(),
      ),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.click(
      screen.getByRole("button", { name: `${en.coreSettings.taxEditTitle}: Municipality Levy (MUN25)` }),
    );
    const editDialog = await screen.findByRole("dialog");
    expect(within(editDialog).queryByText("Municipality Levy · MUN25")).toBeNull();
    const editCodeInput = within(editDialog).getByRole("textbox", {
      name: en.coreSettings.taxCode,
    });
    expect(editCodeInput).toHaveValue("MUN25");
    expect(editCodeInput).toHaveAttribute("readonly");
    expect(
      within(editDialog).getByRole("combobox", {
        name: new RegExp(`^${en.common.status}`),
      }),
    ).toHaveTextContent(en.common.active);
    const editScopeInput = within(editDialog).getByRole("textbox", {
      name: en.coreSettings.taxCompany,
    });
    expect(editScopeInput).toHaveValue("Acme Retail");
    expect(editScopeInput).toHaveAttribute("readonly");

    fireEvent.change(within(editDialog).getByLabelText(new RegExp(`^${en.coreSettings.taxName}`)), {
      target: { value: "Updated Municipality Levy" },
    });
    fireEvent.click(within(editDialog).getByRole("button", { name: en.coreSettings.save }));

    await waitFor(() =>
      expect(patchSpy).toHaveBeenCalledWith(
        `${TAXES_PATH}/${companyATaxId}`,
        { name: "Updated Municipality Levy" },
        expect.anything(),
      ),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("renders inline card filters, debounces search and preserves all filters while sorting both directions", async () => {
    const taxUrls: string[] = [];
    vi.spyOn(axiosClient, "get").mockImplementation(async (url) => {
      if (url.startsWith(COMPANIES_PATH)) return companiesEnvelope();
      taxUrls.push(url);
      const page = Number(new URL(url, "https://tenant.test").searchParams.get("page") ?? "1");
      return page === 2
        ? pageEnvelope([companyATax], { page: 2, total: 21, totalPages: 2, hasPrev: true })
        : pageEnvelope([tenantWideTax], { page: 1, total: 21, totalPages: 2, hasNext: true });
    });

    await renderTaxesPage("en");
    expect(await screen.findByText("Standard VAT")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.filters.label })).toBeNull();

    const statusTrigger = await screen.findByRole("combobox", { name: en.common.status });
    const scopeTrigger = await screen.findByRole("combobox", { name: en.coreSettings.taxCompany });
    const inclusiveTrigger = await screen.findByRole("combobox", {
      name: en.coreSettings.taxInclusive,
    });
    expect(scopeTrigger).toHaveTextContent(en.coreIdentity.filters.allCompanies);

    await selectRadixOption(statusTrigger, en.common.active);
    await selectRadixOption(scopeTrigger, "Acme Retail");
    await selectRadixOption(inclusiveTrigger, en.coreSettings.taxInclusiveYes);

    await waitFor(() =>
      expect(taxUrls.at(-1)).toBe(
        `${TAXES_PATH}?page=1&limit=20&sortBy=code&sortDir=ASC&status=ACTIVE&companyId=${companyAId}&isInclusive=true`,
      ),
    );

    await selectRadixOption(scopeTrigger, en.coreIdentity.filters.allCompanies);
    await waitFor(() =>
      expect(taxUrls.at(-1)).toBe(
        `${TAXES_PATH}?page=1&limit=20&sortBy=code&sortDir=ASC&status=ACTIVE&isInclusive=true`,
      ),
    );
    await selectRadixOption(scopeTrigger, "Acme Retail");
    await waitFor(() =>
      expect(taxUrls.at(-1)).toBe(
        `${TAXES_PATH}?page=1&limit=20&sortBy=code&sortDir=ASC&status=ACTIVE&companyId=${companyAId}&isInclusive=true`,
      ),
    );

    fireEvent.change(screen.getByPlaceholderText(en.coreSettings.taxSearch), {
      target: { value: "levy" },
    });
    await waitFor(
      () =>
        expect(taxUrls.at(-1)).toBe(
          `${TAXES_PATH}?page=1&limit=20&sortBy=code&sortDir=ASC&search=levy&status=ACTIVE&companyId=${companyAId}&isInclusive=true`,
        ),
      { timeout: 1_500 },
    );

    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${en.coreSettings.taxRate}`) }));
    await waitFor(() =>
      expect(taxUrls.at(-1)).toBe(
        `${TAXES_PATH}?page=1&limit=20&sortBy=rate&sortDir=ASC&search=levy&status=ACTIVE&companyId=${companyAId}&isInclusive=true`,
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${en.coreSettings.taxRate}`) }));
    await waitFor(() =>
      expect(taxUrls.at(-1)).toBe(
        `${TAXES_PATH}?page=1&limit=20&sortBy=rate&sortDir=DESC&search=levy&status=ACTIVE&companyId=${companyAId}&isInclusive=true`,
      ),
    );
  });

  it("resets pagination to page one when an inline filter changes", async () => {
    const taxUrls: string[] = [];
    mockRowsPerPageTaxList(taxUrls);
    await renderTaxesPage("en");
    expect(await screen.findByText("Standard VAT")).toBeInTheDocument();
    const { inclusiveTrigger } = await applyActiveTaxQuery(taxUrls, "DESC");
    await waitFor(() => expect(screen.getByRole("button", { name: en.common.nextPage })).toBeEnabled());

    fireEvent.click(screen.getByRole("button", { name: en.common.nextPage }));
    expect(await screen.findByText("Municipality Levy")).toBeInTheDocument();
    expect(taxUrls.at(-1)).toBe(
      `${TAXES_PATH}?page=2&limit=20&sortBy=rate&sortDir=DESC&search=levy&status=ACTIVE&companyId=${companyAId}&isInclusive=true`,
    );

    // Changing isInclusive while on page 2 resets pagination to page 1.
    await selectRadixOption(inclusiveTrigger, en.coreSettings.taxInclusiveNo);
    await waitFor(() =>
      expect(taxUrls.at(-1)).toBe(
        `${TAXES_PATH}?page=1&limit=20&sortBy=rate&sortDir=DESC&search=levy&status=ACTIVE&companyId=${companyAId}&isInclusive=false`,
      ),
    );
    expect(await screen.findByText("Standard VAT")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.common.previousPage })).toBeDisabled();
  });

  it("clears every filter from page two while preserving sort", async () => {
    const taxUrls: string[] = [];
    mockRowsPerPageTaxList(taxUrls);
    await renderTaxesPage("en");
    expect(await screen.findByText("Standard VAT")).toBeInTheDocument();
    const { scopeTrigger } = await applyActiveTaxQuery(taxUrls, "DESC", false);
    await waitFor(() => expect(screen.getByRole("button", { name: en.common.nextPage })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: en.common.nextPage }));
    expect(await screen.findByText("Municipality Levy")).toBeInTheDocument();
    expect(taxUrls.at(-1)).toBe(
      `${TAXES_PATH}?page=2&limit=20&sortBy=rate&sortDir=DESC&search=levy&status=ACTIVE&companyId=${companyAId}&isInclusive=false`,
    );

    // In-card "Clear filters" resets status, companyId, isInclusive, search, and page to 1.
    expect(screen.queryByText(en.coreSettings.taxEmpty)).toBeNull();
    expect(screen.getByPlaceholderText(en.coreSettings.taxSearch)).toHaveValue("levy");
    fireEvent.click(screen.getByRole("button", { name: en.coreSettings.clearFilters }));
    await waitFor(() =>
      expect(taxUrls.at(-1)).toBe(`${TAXES_PATH}?page=1&limit=20&sortBy=rate&sortDir=DESC`),
    );
    expect(await screen.findByText("Standard VAT")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.common.previousPage })).toBeDisabled();
    expect(screen.getByPlaceholderText(en.coreSettings.taxSearch)).toHaveValue("");
    expect(scopeTrigger).toHaveTextContent(en.coreIdentity.filters.allCompanies);
    expect(screen.queryByRole("button", { name: en.coreSettings.clearFilters })).toBeNull();
  });

  it.each([20, 0])("recovers after deactivation leaves %i rows, retains query state, and clears filters", async (total) => {
    const taxUrls: string[] = [];
    let deactivated = false;
    vi.spyOn(axiosClient, "get").mockImplementation(async (url) => {
      if (url.startsWith(COMPANIES_PATH)) return companiesEnvelope();
      taxUrls.push(url);
      const page = Number(new URL(url, "https://tenant.test").searchParams.get("page") ?? "1");
      if (deactivated) {
        return page === 2
          ? pageEnvelope([], { page: 2, total, totalPages: total === 0 ? 0 : 1, hasPrev: true })
          : pageEnvelope(total === 0 ? [] : [tenantWideTax], { page: 1, total, totalPages: total === 0 ? 0 : 1 });
      }
      return page === 2
        ? pageEnvelope([companyATax], { page: 2, total: 21, totalPages: 2, hasPrev: true })
        : pageEnvelope([tenantWideTax], { page: 1, total: 21, totalPages: 2, hasNext: true });
    });
    const deleteSpy = vi.spyOn(axiosClient, "delete").mockResolvedValue(rowEnvelope(null, 204));

    await renderTaxesPage("en");
    expect(await screen.findByText("Standard VAT")).toBeInTheDocument();

    const statusTrigger = await screen.findByRole("combobox", { name: en.common.status });
    const scopeTrigger = await screen.findByRole("combobox", { name: en.coreSettings.taxCompany });
    await selectRadixOption(statusTrigger, en.common.active);
    await selectRadixOption(scopeTrigger, "Acme Retail");

    await waitFor(() =>
      expect(taxUrls.at(-1)).toBe(
        `${TAXES_PATH}?page=1&limit=20&sortBy=code&sortDir=ASC&status=ACTIVE&companyId=${companyAId}`,
      ),
    );

    fireEvent.change(screen.getByPlaceholderText(en.coreSettings.taxSearch), {
      target: { value: "levy" },
    });
    await waitFor(
      () =>
        expect(taxUrls.at(-1)).toBe(
          `${TAXES_PATH}?page=1&limit=20&sortBy=code&sortDir=ASC&search=levy&status=ACTIVE&companyId=${companyAId}`,
        ),
      { timeout: 1_500 },
    );

    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${en.coreSettings.taxRate}`) }));
    await waitFor(() =>
      expect(taxUrls.at(-1)).toBe(
        `${TAXES_PATH}?page=1&limit=20&sortBy=rate&sortDir=ASC&search=levy&status=ACTIVE&companyId=${companyAId}`,
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${en.coreSettings.taxRate}`) }));
    await waitFor(() =>
      expect(taxUrls.at(-1)).toBe(
        `${TAXES_PATH}?page=1&limit=20&sortBy=rate&sortDir=DESC&search=levy&status=ACTIVE&companyId=${companyAId}`,
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: en.common.nextPage }));
    expect(await screen.findByText("Municipality Levy")).toBeInTheDocument();
    expect(taxUrls.at(-1)).toBe(
      `${TAXES_PATH}?page=2&limit=20&sortBy=rate&sortDir=DESC&search=levy&status=ACTIVE&companyId=${companyAId}`,
    );

    deactivated = true;
    fireEvent.click(
      screen.getByRole("button", { name: `${en.coreSettings.deactivate}: Municipality Levy (MUN25)` }),
    );
    const confirmModal = await screen.findByRole("alertdialog");
    expect(
      within(confirmModal).getByText(
        formatTemplate(en.coreSettings.taxDeactivateMessage, { code: "Municipality Levy (MUN25)" }),
      ),
    ).toBeInTheDocument();
    fireEvent.click(within(confirmModal).getByRole("button", { name: en.coreSettings.deactivate }));

    await waitFor(() =>
      expect(deleteSpy).toHaveBeenCalledWith(`${TAXES_PATH}/${companyATaxId}`, expect.anything()),
    );
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await waitFor(() =>
      expect(taxUrls.at(-1)).toBe(
        `${TAXES_PATH}?page=1&limit=20&sortBy=rate&sortDir=DESC&search=levy&status=ACTIVE&companyId=${companyAId}`,
      ),
    );
    expect(await screen.findByText(total === 0 ? en.coreSettings.taxEmpty : "Standard VAT")).toBeInTheDocument();

    const clearButtons = screen.getAllByRole("button", { name: en.coreSettings.clearFilters });
    fireEvent.click(clearButtons[clearButtons.length - 1]);
    await waitFor(() => expect(taxUrls.at(-1)).toBe(`${TAXES_PATH}?page=1&limit=20&sortBy=rate&sortDir=DESC`));
    expect(screen.getByPlaceholderText(en.coreSettings.taxSearch)).toHaveValue("");
  });

  it("aborts superseded in-flight list reads and ignores stale completions and unmount races", async () => {
    const signals: AbortSignal[] = [];
    let resolveSecondTaxes: ((value: AxiosResponse<unknown>) => void) | undefined;

    vi.spyOn(axiosClient, "get").mockImplementation((url, config?: TenantApiRequestConfig) => {
      if (url.startsWith(COMPANIES_PATH)) return Promise.resolve(companiesEnvelope([]));
      if (config?.signal) signals.push(config.signal);
      if (signals.length === 1) {
        return Promise.resolve(pageEnvelope([tenantWideTax]));
      }
      if (signals.length === 2) {
        return new Promise<AxiosResponse<unknown>>((resolve) => {
          resolveSecondTaxes = resolve;
        });
      }
      if (signals.length === 3) {
        return Promise.resolve(pageEnvelope([companyATax]));
      }
      return new Promise<AxiosResponse<unknown>>(() => {});
    });

    const { unmount } = await renderTaxesPage("en");
    expect(await screen.findByText("Standard VAT")).toBeInTheDocument();
    expect(signals).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${en.coreSettings.taxName}`) }));
    await waitFor(() => expect(signals).toHaveLength(2));
    expect(screen.queryByText("Standard VAT")).toBeNull();

    await selectRadixOption(screen.getByRole("combobox", { name: en.common.status }), en.common.active);
    await waitFor(() => expect(signals).toHaveLength(3));
    expect(signals[1]?.aborted).toBe(true);

    expect(await screen.findByText("Municipality Levy")).toBeInTheDocument();

    await act(async () => {
      resolveSecondTaxes?.(pageEnvelope([companyBTax]));
    });
    expect(screen.queryByText("Port Duty")).toBeNull();
    expect(screen.getByText("Municipality Levy")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${en.coreSettings.taxCode}`) }));
    await waitFor(() => expect(signals).toHaveLength(4));

    unmount();
    expect(signals[3]?.aborted).toBe(true);
  });

  it.each(["en", "ar"] as const)("renders the default page size and Previous/Next controls without First/Last (%s)", async (lang) => {
    const taxUrls: string[] = [];
    mockRowsPerPageTaxList(taxUrls);
    await renderTaxesPage(lang);
    const t = lang === "ar" ? ar : en;
    expect(await screen.findByText("Standard VAT")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: t.common.rowsPerPage })).toHaveTextContent("20");
    expect(screen.queryByRole("button", { name: t.common.firstPage })).toBeNull();
    expect(screen.queryByRole("button", { name: t.common.lastPage })).toBeNull();
    expect(screen.getByRole("button", { name: t.common.previousPage })).toBeDisabled();
    expect(screen.getByRole("button", { name: t.common.nextPage })).toBeEnabled();
  });

  it("sends page sizes 50 and 100 to the server and resets page two while preserving active filters/search/sort", async () => {
    const taxUrls: string[] = [];
    mockRowsPerPageTaxList(taxUrls);
    await renderTaxesPage("en");
    expect(await screen.findByText("Standard VAT")).toBeInTheDocument();
    await applyActiveTaxQuery(taxUrls);

    fireEvent.click(screen.getByRole("button", { name: en.common.nextPage }));
    expect(await screen.findByText("Municipality Levy")).toBeInTheDocument();
    expect(taxUrls.at(-1)).toBe(
      `${TAXES_PATH}?page=2&limit=20&sortBy=rate&sortDir=ASC&search=levy&status=ACTIVE&companyId=${companyAId}&isInclusive=true`,
    );

    await selectRadixOption(screen.getByRole("combobox", { name: en.common.rowsPerPage }), "50");
    await waitFor(() =>
      expect(taxUrls.at(-1)).toBe(
        `${TAXES_PATH}?page=1&limit=50&sortBy=rate&sortDir=ASC&search=levy&status=ACTIVE&companyId=${companyAId}&isInclusive=true`,
      ),
    );
    expect(await screen.findByText("Standard VAT")).toBeInTheDocument();

    await selectRadixOption(screen.getByRole("combobox", { name: en.common.rowsPerPage }), "100");
    await waitFor(() =>
      expect(taxUrls.at(-1)).toBe(
        `${TAXES_PATH}?page=1&limit=100&sortBy=rate&sortDir=ASC&search=levy&status=ACTIVE&companyId=${companyAId}&isInclusive=true`,
      ),
    );
  });

  it("recovers an emptied page under limit 50 while preserving the page size and active query", async () => {
    const taxUrls: string[] = [];
    let deactivatedOn50 = false;
    mockRowsPerPageTaxList(taxUrls, () => deactivatedOn50);
    const deleteSpy = vi.spyOn(axiosClient, "delete").mockResolvedValue(rowEnvelope(null, 204));
    await renderTaxesPage("en");
    expect(await screen.findByText("Standard VAT")).toBeInTheDocument();
    await applyActiveTaxQuery(taxUrls);
    await selectRadixOption(screen.getByRole("combobox", { name: en.common.rowsPerPage }), "50");
    await waitFor(() => expect(taxUrls.at(-1)).toBe(
      `${TAXES_PATH}?page=1&limit=50&sortBy=rate&sortDir=ASC&search=levy&status=ACTIVE&companyId=${companyAId}&isInclusive=true`,
    ));
    expect(await screen.findByText("Standard VAT")).toBeInTheDocument();

    // Emptied-page recovery under limit=50 clamps to page 1 with limit=50 and active query preserved.
    fireEvent.click(screen.getByRole("button", { name: en.common.nextPage }));
    expect(await screen.findByText("Municipality Levy")).toBeInTheDocument();
    deactivatedOn50 = true;
    fireEvent.click(
      screen.getByRole("button", { name: `${en.coreSettings.deactivate}: Municipality Levy (MUN25)` }),
    );
    const confirmModal = await screen.findByRole("alertdialog");
    fireEvent.click(within(confirmModal).getByRole("button", { name: en.coreSettings.deactivate }));
    await waitFor(() =>
      expect(deleteSpy).toHaveBeenCalledWith(`${TAXES_PATH}/${companyATaxId}`, expect.anything()),
    );
    await waitFor(() =>
      expect(taxUrls.at(-1)).toBe(
        `${TAXES_PATH}?page=1&limit=50&sortBy=rate&sortDir=ASC&search=levy&status=ACTIVE&companyId=${companyAId}&isInclusive=true`,
      ),
    );
    expect(await screen.findByText("Standard VAT")).toBeInTheDocument();

  });
});

// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, TooltipProvider } from "@/design-system";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { I18nProvider } from "@/i18n/I18nContext";
import { setLanguage } from "@/i18n/useLanguage";
import { axiosClient, TenantApiClientError, type AxiosResponse } from "@/lib/api/axiosClient";
import type { PermissionScope } from "@/lib/auth/permission-scope";
import {
  CURRENCIES_PATH,
  CURRENCY_CODE_TAKEN_CODE,
  CURRENCY_COMPANY_IN_USE_CODE,
} from "./currency-contract";
import CurrenciesPage from "./page";

interface MockAuthUser {
  id: string;
  isTenantOwner: boolean;
  permissions: string[];
  permissionScopes: Record<string, PermissionScope>;
}

const manageUser = (): MockAuthUser => ({
  id: "01902001-3000-7000-8000-000000000001",
  isTenantOwner: false,
  permissions: ["currencies.currency.read", "currencies.currency.manage"],
  permissionScopes: {
    "currencies.currency.read": { tenantWide: true, companyIds: [], branchIds: [] },
    "currencies.currency.manage": { tenantWide: true, companyIds: [], branchIds: [] },
  },
});

const authState = vi.hoisted(
  (): { user: MockAuthUser; isAuthenticated: boolean; isLoading: boolean } => ({
    user: {
      id: "01902001-3000-7000-8000-000000000001",
      isTenantOwner: false,
      permissions: ["currencies.currency.read", "currencies.currency.manage"],
      permissionScopes: {
        "currencies.currency.read": { tenantWide: true, companyIds: [], branchIds: [] },
        "currencies.currency.manage": { tenantWide: true, companyIds: [], branchIds: [] },
      },
    },
    isAuthenticated: true,
    isLoading: false,
  }),
);

vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => authState }));

const usdRow = {
  id: "01902001-3000-7000-8000-000000000011",
  code: "USD",
  name: "US Dollar",
  symbol: "$",
  decimalPlaces: 2,
  isDefault: true,
  exchangeRate: "1",
  status: "ACTIVE" as const,
  updatedAt: "2026-08-25T10:05:00.000Z",
};

const eurRow = {
  id: "01902001-3000-7000-8000-000000000012",
  code: "EUR",
  name: "Euro",
  symbol: "€",
  decimalPlaces: 2,
  isDefault: false,
  exchangeRate: "0.9",
  status: "ACTIVE" as const,
  updatedAt: "2026-08-25T10:05:00.000Z",
};

const exactPrecisionRow = {
  id: "01902001-3000-7000-8000-000000000013",
  code: "CHF",
  name: "Swiss Franc",
  symbol: "CHF",
  decimalPlaces: 2,
  isDefault: false,
  exchangeRate: "1234567890.12345678",
  status: "INACTIVE" as const,
  updatedAt: "2026-08-25T10:05:00.000Z",
};

const missingRateRow = {
  id: "01902001-3000-7000-8000-000000000014",
  code: "JPY",
  name: "Japanese Yen",
  symbol: "¥",
  decimalPlaces: 0,
  isDefault: false,
  exchangeRate: null,
  status: "INACTIVE" as const,
  updatedAt: "2026-08-25T10:05:00.000Z",
};

function isBaseUrl(url: string): boolean {
  const params = new URL(url, "https://portal.example").searchParams;
  return params.get("limit") === "1" && params.get("isDefault") === "true";
}

function pageEnvelope(rows: unknown[], limit = 20): AxiosResponse<unknown> {
  const total = rows.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    status: 200,
    statusText: "OK",
    headers: new Headers(),
    data: {
      success: true,
      data: rows,
      meta: { page: 1, limit, total, totalPages, hasNext: false, hasPrev: false },
    },
  };
}

function rowEnvelope(data: unknown, status = 200): AxiosResponse<unknown> {
  return { status, statusText: "OK", headers: new Headers(), data: { success: true, data } };
}

function apiError(status: number, errorCode: string, message: string, correlationId?: string) {
  return new TenantApiClientError(message, {
    status,
    statusText: "Error",
    headers: new Headers(),
    data: { success: false, status: "ERROR", statusCode: status, errorCode, message, correlationId },
  });
}

async function renderPage(language: "en" | "ar" = "en") {
  await act(async () => {
    await setLanguage(language);
  });
  return render(
    <I18nProvider initialLanguage={language}>
      <TooltipProvider>
        <ToastProvider>
          <CurrenciesPage />
        </ToastProvider>
      </TooltipProvider>
    </I18nProvider>,
  );
}

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => undefined;
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => undefined;
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => undefined;
});

beforeEach(() => {
  authState.user = manageUser();
});
afterEach(() => {
  cleanup();
  window.localStorage.removeItem("tenant_lang");
  vi.restoreAllMocks();
});

describe("CurrenciesPage T02 columns, inline filters, modals, and reactivation", () => {
  it("renders a 5-column table without symbol or row-number columns, fixed-8 string rates, Default replacing Active badge, and a single combined filter resetting page", async () => {
    const getSpy = vi.spyOn(axiosClient, "get").mockImplementation(async (url) => {
      if (isBaseUrl(url)) return pageEnvelope([usdRow], 1);
      const params = new URL(url, "https://portal.example").searchParams;
      const requestedPage = Number(params.get("page") ?? "1");
      return {
        status: 200,
        statusText: "OK",
        headers: new Headers(),
        data: {
          success: true,
          data: requestedPage === 2 ? [eurRow] : [usdRow, eurRow, exactPrecisionRow],
          meta: {
            page: requestedPage,
            limit: 20,
            total: 25,
            totalPages: 2,
            hasNext: requestedPage < 2,
            hasPrev: requestedPage > 1,
          },
        },
      };
    });

    await renderPage("en");
    expect(await screen.findByText("Euro")).toBeInTheDocument();

    const headers = screen.getAllByRole("columnheader");
    expect(headers).toHaveLength(5);
    expect(headers.map((th) => th.textContent)).not.toContain("#");
    expect(headers.map((th) => th.textContent)).not.toContain(en.coreSettings.currencySymbol);

    // Fixed 8 fractional digits preserved as exact decimal strings without float rounding.
    expect(screen.getByText("1.00000000")).toBeInTheDocument();
    expect(screen.getByText("0.90000000")).toBeInTheDocument();
    expect(screen.getByText("1,234,567,890.12345678")).toBeInTheDocument();

    // Default row shows Default badge instead of redundant Active badge.
    const rows = screen.getAllByRole("row");
    const usdTableRow = rows.find((row) => row.textContent?.includes("US Dollar"))!;
    expect(within(usdTableRow).getByText(en.coreSettings.currencyDefault)).toBeInTheDocument();
    expect(within(usdTableRow).queryByText(en.common.active)).toBeNull();

    // One status filter and one independent server page-size selector.
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
    expect(screen.getAllByRole("combobox", { name: en.common.status })).toHaveLength(1);
    expect(screen.getByRole("combobox", { name: en.common.rowsPerPage })).toBeInTheDocument();
    const statusSelect = screen.getByRole("combobox", { name: en.common.status });

    fireEvent.click(screen.getByRole("button", { name: en.common.nextPage }));
    await waitFor(() =>
      expect(getSpy).toHaveBeenCalledWith(
        `${CURRENCIES_PATH}?page=2&limit=20&sortBy=code&sortDir=ASC`,
        expect.anything(),
      ),
    );

    fireEvent.keyDown(statusSelect, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: en.common.active }));
    await waitFor(() =>
      expect(getSpy).toHaveBeenLastCalledWith(
        `${CURRENCIES_PATH}?page=1&limit=20&sortBy=code&sortDir=ASC&status=ACTIVE`,
        expect.anything(),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: en.common.nextPage }));
    await waitFor(() =>
      expect(getSpy).toHaveBeenLastCalledWith(
        `${CURRENCIES_PATH}?page=2&limit=20&sortBy=code&sortDir=ASC&status=ACTIVE`,
        expect.anything(),
      ),
    );

    // Selecting Non-default resets page to 1, clears prior status=ACTIVE, and sends isDefault=false.
    fireEvent.keyDown(statusSelect, { key: "ArrowDown" });
    fireEvent.click(
      await screen.findByRole("option", { name: en.coreSettings.currencyFilterNonDefaultOnly }),
    );
    await waitFor(() =>
      expect(getSpy).toHaveBeenLastCalledWith(
        `${CURRENCIES_PATH}?page=1&limit=20&sortBy=code&sortDir=ASC&isDefault=false`,
        expect.anything(),
      ),
    );

    // Selecting Inactive clears prior isDefault=false and sends status=INACTIVE.
    fireEvent.keyDown(statusSelect, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: en.common.inactive }));
    await waitFor(() =>
      expect(getSpy).toHaveBeenLastCalledWith(
        `${CURRENCIES_PATH}?page=1&limit=20&sortBy=code&sortDir=ASC&status=INACTIVE`,
        expect.anything(),
      ),
    );

    // Selecting All statuses clears status/isDefault completely.
    fireEvent.keyDown(statusSelect, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: en.coreSettings.statusAny }));
    await waitFor(() =>
      expect(getSpy).toHaveBeenLastCalledWith(
        `${CURRENCIES_PATH}?page=1&limit=20&sortBy=code&sortDir=ASC`,
        expect.anything(),
      ),
    );
  });

  it("cancels set-default with zero mutations, disables invalid row actions, and opens centered blocker dialog on domain refusal", async () => {
    const corrId = "01902001-3000-7000-8000-000000000091";
    vi.spyOn(axiosClient, "get").mockImplementation(async (url) =>
      isBaseUrl(url) ? pageEnvelope([usdRow], 1) : pageEnvelope([usdRow, eurRow, exactPrecisionRow]),
    );
    const postSpy = vi.spyOn(axiosClient, "post").mockResolvedValue(rowEnvelope(eurRow));
    const deleteSpy = vi
      .spyOn(axiosClient, "delete")
      .mockRejectedValueOnce(apiError(409, CURRENCY_COMPANY_IN_USE_CODE, "Raw company wire error", corrId));

    await renderPage("en");
    expect(await screen.findByText("Euro")).toBeInTheDocument();

    // Default row menu has Set as default and Deactivate disabled.
    fireEvent.keyDown(screen.getByRole("button", { name: `${en.common.actions}: US Dollar (USD)` }), {
      key: "Enter",
    });
    expect(await screen.findByRole("menuitem", { name: en.coreSettings.currencySetDefault })).toHaveAttribute(
      "data-disabled",
    );
    expect(screen.getByRole("menuitem", { name: en.coreSettings.deactivate })).toHaveAttribute(
      "data-disabled",
    );
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });

    // Cancel on Set-Default confirmation sends zero POST requests.
    fireEvent.keyDown(screen.getByRole("button", { name: `${en.common.actions}: Euro (EUR)` }), {
      key: "Enter",
    });
    fireEvent.click(await screen.findByRole("menuitem", { name: en.coreSettings.currencySetDefault }));
    const confirmModal = await screen.findByRole("dialog", {
      name: en.coreSettings.currencySetDefaultConfirmTitle,
    });
    expect(within(confirmModal).getByText("1 USD = 0.9 EUR")).toBeInTheDocument();
    fireEvent.click(within(confirmModal).getByRole("button", { name: en.common.cancel }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(postSpy).not.toHaveBeenCalled();

    // Domain blocker on deactivate opens centered CurrencyBlockerModal naming Euro (EUR) and retains rows.
    fireEvent.keyDown(screen.getByRole("button", { name: `${en.common.actions}: Euro (EUR)` }), {
      key: "Enter",
    });
    fireEvent.click(await screen.findByRole("menuitem", { name: en.coreSettings.deactivate }));
    const deactivateAlert = await screen.findByRole("alertdialog");
    fireEvent.click(within(deactivateAlert).getByRole("button", { name: en.coreSettings.deactivate }));

    await waitFor(() => expect(deleteSpy).toHaveBeenCalledTimes(1));
    const blockerDialog = await screen.findByRole("dialog", {
      name: en.coreSettings.currencyDeactivateBlockedTitle,
    });
    expect(within(blockerDialog).getByText(new RegExp(en.coreSettings.currencyCompanyInUse))).toBeInTheDocument();
    expect(within(blockerDialog).getByText(new RegExp(corrId))).toBeInTheDocument();
    expect(within(blockerDialog).queryByText("Raw company wire error")).toBeNull();
    expect(within(blockerDialog).getByText("Euro")).toBeInTheDocument();
    expect(within(blockerDialog).getByText("EUR")).toBeInTheDocument();
    fireEvent.click(within(blockerDialog).getByRole("button", { name: en.common.close }));
    expect(screen.getByText("Euro")).toBeInTheDocument();
  });

  it(
    "maps server formErrorCode onto T01 inline fields while preserving draft and handles direct vs edit reactivation in AR",
    async () => {
    vi.spyOn(axiosClient, "get").mockImplementation(async (url) =>
      isBaseUrl(url)
        ? pageEnvelope([usdRow], 1)
        : pageEnvelope([usdRow, exactPrecisionRow, missingRateRow]),
    );
    const postSpy = vi
      .spyOn(axiosClient, "post")
      .mockRejectedValueOnce(apiError(409, CURRENCY_CODE_TAKEN_CODE, "Raw duplicate wire text"));
    const patchSpy = vi
      .spyOn(axiosClient, "patch")
      .mockResolvedValueOnce(rowEnvelope({ ...exactPrecisionRow, status: "ACTIVE" }))
      .mockResolvedValueOnce(rowEnvelope({ ...missingRateRow, status: "ACTIVE", exchangeRate: "155" }));

    await renderPage("ar");
    expect(await screen.findByText("Swiss Franc")).toBeInTheDocument();

    // Server CURRENCY_CODE_TAKEN maps inline onto code field and retains draft + table rows,
    // and known existing base ("USD") blocks Make default + blank rate locally before POST.
    fireEvent.click(screen.getByRole("button", { name: ar.coreSettings.currencyCreate }));
    const createDialog = await screen.findByRole("dialog");
    const codeChoice = within(createDialog).getByRole("combobox", { name: ar.coreSettings.currencyCode });
    const nameInput = within(createDialog).getByRole("textbox", { name: ar.coreSettings.currencyName });
    const rateInput = within(createDialog).getByRole("textbox", {
      name: ar.coreSettings.currencyExchangeRate,
    });
    expect(document.activeElement).toBe(codeChoice);

    fireEvent.keyDown(codeChoice, { key: "ArrowDown" });
    const codeListbox = await screen.findByRole("listbox");
    fireEvent.click(within(codeListbox).getByText("USD"));
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    fireEvent.change(nameInput, { target: { value: "الدولار" } });
    fireEvent.click(within(createDialog).getByRole("checkbox", { name: ar.coreSettings.currencyMakeDefault }));
    fireEvent.click(within(createDialog).getByRole("button", { name: ar.coreSettings.save }));
    expect(postSpy).not.toHaveBeenCalled();
    expect(within(createDialog).getByText(ar.coreSettings.currencyRateRequired)).toBeInTheDocument();

    fireEvent.change(rateInput, { target: { value: "3.75" } });
    fireEvent.click(within(createDialog).getByRole("button", { name: ar.coreSettings.save }));

    await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(1));
    expect(await within(createDialog).findByText(ar.coreSettings.currencyCodeTaken)).toBeInTheDocument();
    expect(within(createDialog).queryByText("Raw duplicate wire text")).toBeNull();
    expect(nameInput).toHaveValue("الدولار");
    expect(rateInput).toHaveValue("3.75");
    fireEvent.click(within(createDialog).getByRole("button", { name: ar.common.cancel }));
    const discardConfirm = screen.queryByRole("button", { name: ar.common.discardConfirm });
    if (discardConfirm) fireEvent.click(discardConfirm);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("Swiss Franc")).toBeInTheDocument();

    // Direct reactivation with saved rate sends PATCH { status: "ACTIVE" }.
    fireEvent.click(
      screen.getByRole("button", { name: `${ar.coreSettings.reactivate}: Swiss Franc (CHF)` }),
    );
    await waitFor(() =>
      expect(patchSpy).toHaveBeenNthCalledWith(
        1,
        `${CURRENCIES_PATH}/${exactPrecisionRow.id}`,
        { status: "ACTIVE" },
        expect.anything(),
      ),
    );

    // Inactive without saved rate opens Edit modal in reactivate mode.
    fireEvent.click(
      screen.getByRole("button", { name: `${ar.coreSettings.reactivate}: Japanese Yen (JPY)` }),
    );
    const editDialog = await screen.findByRole("dialog");
    const editRateInput = within(editDialog).getByRole("textbox", {
      name: ar.coreSettings.currencyExchangeRate,
    });
    fireEvent.change(editRateInput, { target: { value: "155" } });
    expect(within(editDialog).getByText("1 USD = 155 JPY")).toBeInTheDocument();
    fireEvent.click(within(editDialog).getByRole("button", { name: ar.coreSettings.save }));
    await waitFor(() =>
      expect(patchSpy).toHaveBeenNthCalledWith(
        2,
        `${CURRENCIES_PATH}/${missingRateRow.id}`,
        { status: "ACTIVE", exchangeRate: 155 },
        expect.anything(),
      ),
    );
  },
  15_000,
  );
});

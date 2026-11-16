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
import { formatTemplate } from "@/lib/format/template";
import { buildCurrencyColumns } from "./components/CurrencyTableColumns";
import { CURRENCIES_PATH } from "./currency-contract";
import CurrenciesPage from "./page";

interface MockAuthUser {
  id: string;
  isTenantOwner: boolean;
  permissions: string[];
  permissionScopes: Record<string, PermissionScope>;
}

const defaultUser = (): MockAuthUser => ({
  id: "01902001-3000-7000-8000-000000000001",
  isTenantOwner: false,
  permissions: ["currencies.currency.read", "currencies.currency.manage"],
  permissionScopes: {
    "currencies.currency.read": { tenantWide: true, companyIds: [], branchIds: [] },
    "currencies.currency.manage": { tenantWide: true, companyIds: [], branchIds: [] },
  },
});

const authState = vi.hoisted(
  (): {
    user: MockAuthUser;
    realtimeAuthGeneration: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
  } => ({
    user: {
      id: "01902001-3000-7000-8000-000000000001",
      isTenantOwner: false,
      permissions: ["currencies.currency.read", "currencies.currency.manage"],
      permissionScopes: {
        "currencies.currency.read": { tenantWide: true, companyIds: [], branchIds: [] },
        "currencies.currency.manage": { tenantWide: true, companyIds: [], branchIds: [] },
      },
    },
    realtimeAuthGeneration: "gen-1",
    isAuthenticated: true,
    isLoading: false,
  }),
);

vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => authState }));

const usdId = "01902001-3000-7000-8000-000000000011";
const eurId = "01902001-3000-7000-8000-000000000012";
const gbpId = "01902001-3000-7000-8000-000000000013";

function makeRow(id: string, code: string, name: string, exchangeRate: string, isDefault = false) {
  return {
    id, code, name, symbol: code === "USD" ? "$" : "€", decimalPlaces: 2,
    isDefault, exchangeRate, status: "ACTIVE" as const, updatedAt: "2026-08-25T10:05:00.000Z",
  };
}

const usdRow = makeRow(usdId, "USD", "US Dollar", "1.00000000", true);
const eurRow = makeRow(eurId, "EUR", "Euro", "0.92345678", false);

function isBaseUrl(url: string): boolean {
  const params = new URL(url, "https://portal.example").searchParams;
  return params.get("limit") === "1" && params.get("isDefault") === "true";
}

function pageEnvelope(
  rows: unknown[],
  overrides: Partial<{ page: number; limit: number; total: number; totalPages: number }> = {},
): AxiosResponse<unknown> {
  const { page = 1, limit = 20, total = rows.length } = overrides;
  const totalPages = overrides.totalPages ?? (total === 0 ? 0 : Math.ceil(total / limit));
  const meta = { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 };
  return { status: 200, statusText: "OK", headers: new Headers(), data: { success: true, data: rows, meta } };
}

function rowEnvelope(data: unknown, status = 200): AxiosResponse<unknown> {
  return { status, statusText: "OK", headers: new Headers(), data: { success: true, data } };
}

function apiError(status: number, errorCode: string, message: string, correlationId?: string) {
  const data = { success: false, status: "ERROR", statusCode: status, errorCode, message, correlationId };
  return new TenantApiClientError(message, { status, statusText: "Error", headers: new Headers(), data });
}

async function renderCurrenciesPage(language: "en" | "ar" = "en") {
  await act(async () => { await setLanguage(language); });
  return render(
    <I18nProvider initialLanguage={language}>
      <TooltipProvider>
        <ToastProvider><CurrenciesPage /></ToastProvider>
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
  authState.user = defaultUser();
  authState.realtimeAuthGeneration = "gen-1";
});
afterEach(() => {
  cleanup();
  window.localStorage.removeItem("tenant_lang");
  vi.restoreAllMocks();
});

describe("CurrenciesPage transport-boundary behavior", () => {
  it("renders canonical { data, meta } rows, exact decimal rates, no SubNav, and no raw UUID labels in EN and AR", async () => {
    const getSpy = vi.spyOn(axiosClient, "get").mockImplementation(async (url) =>
      isBaseUrl(url) ? pageEnvelope([usdRow], { limit: 1 }) : pageEnvelope([usdRow, eurRow]),
    );
    const { container, unmount } = await renderCurrenciesPage("en");

    expect(await screen.findByText("Euro")).toBeInTheDocument();
    expect(getSpy).toHaveBeenCalledWith(
      `${CURRENCIES_PATH}?page=1&limit=20&sortBy=code&sortDir=ASC`,
      expect.objectContaining({ suppressForbiddenToast: true }),
    );
    expect(screen.getByText("0.92345678")).toBeInTheDocument();
    expect(screen.getByText(en.coreSettings.currencyDefault)).toBeInTheDocument();
    expect(container.querySelector("nav")).toBeNull();
    expect(screen.queryByRole("link", { name: en.nav.coreTaxes })).toBeNull();
    expect(screen.queryByText(en.coreSettings.currenciesSubtitle)).toBeNull();
    expect(screen.getByRole("button", { name: `${en.coreSettings.currencyEditTitle}: Euro (EUR)` })).toBeInTheDocument();
    expect(container.textContent).not.toContain(usdId);
    expect(container.textContent).not.toContain(eurId);

    unmount();
    await renderCurrenciesPage("ar");
    expect(await screen.findByText(ar.coreSettings.currencyDefault)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: ar.coreSettings.currencyCreate })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `${ar.coreSettings.currencyEditTitle}: Euro (EUR)` })).toBeInTheDocument();
  });

  it("enforces tenant-wide manage scope and renders PermissionGate on authoritative 403", async () => {
    authState.user = {
      ...defaultUser(),
      permissionScopes: {
        "currencies.currency.read": { tenantWide: true, companyIds: [], branchIds: [] },
        "currencies.currency.manage": {
          tenantWide: false,
          companyIds: ["01902001-3000-7000-8000-000000000055"],
          branchIds: [],
        },
      },
    };
    let forbidden = false;
    vi.spyOn(axiosClient, "get").mockImplementation(async (url) => {
      if (forbidden) throw apiError(403, "FORBIDDEN", "Raw forbidden wire text");
      return isBaseUrl(url) ? pageEnvelope([usdRow], { limit: 1 }) : pageEnvelope([usdRow, eurRow]);
    });
    const { unmount } = await renderCurrenciesPage("en");

    expect(await screen.findByText("Euro")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.coreSettings.currencyCreate })).toBeNull();
    expect(screen.queryByRole("button", { name: `${en.coreSettings.currencyEditTitle}: Euro (EUR)` })).toBeNull();
    unmount();

    forbidden = true;
    await renderCurrenciesPage("en");
    expect(await screen.findByText(en.permissionGate.title)).toBeInTheDocument();
    expect(screen.queryByText("Raw forbidden wire text")).toBeNull();
  });

  it("handles malformed legacy payload, 500 error with correlationId, and unfiltered/filtered empty states", async () => {
    const corrId = "01902001-3000-7000-8000-000000000088";
    let listCall = 0;
    vi.spyOn(axiosClient, "get").mockImplementation(async (url) => {
      if (isBaseUrl(url)) return pageEnvelope([], { limit: 1 });
      listCall += 1;
      if (listCall === 1) {
        return {
          status: 200, statusText: "OK", headers: new Headers(),
          data: { items: [eurRow], total: 1, page: 1, limit: 20 },
        };
      }
      if (listCall === 2) throw apiError(500, "INTERNAL_ERROR", "Raw SQL failure", corrId);
      return pageEnvelope([]);
    });

    await renderCurrenciesPage("en");
    expect(await screen.findByText(en.coreSettings.currencyLoadFailed)).toBeInTheDocument();
    expect(screen.queryByText(en.coreIdentity.errors.OFFLINE)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: en.common.retry }));
    expect(await screen.findByText(new RegExp(corrId))).toBeInTheDocument();
    expect(screen.queryByText("Raw SQL failure")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: en.common.retry }));
    expect(await screen.findByText(en.coreSettings.currencyEmpty)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(en.coreSettings.currencySearch), { target: { value: "JPY" } });
    expect(await screen.findByText(en.coreSettings.currencyEmptyFiltered)).toBeInTheDocument();
    expect(screen.queryByText(en.coreSettings.currencyEmpty)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: en.coreSettings.clearFilters }));
    expect(await screen.findByText(en.coreSettings.currencyEmpty)).toBeInTheDocument();
    expect(listCall).toBe(5);
  });

  it("sorts the exchange-rate column using sortBy=exchangeRate", async () => {
    const getSpy = vi.spyOn(axiosClient, "get").mockImplementation(async (url) =>
      isBaseUrl(url) ? pageEnvelope([usdRow], { limit: 1 }) : pageEnvelope([usdRow, eurRow]),
    );
    await renderCurrenciesPage("en");
    expect(await screen.findByText("Euro")).toBeInTheDocument();

    const rateSortButton = () =>
      screen.getByRole("button", { name: new RegExp(`^${en.coreSettings.currencyExchangeRate}`) });
    fireEvent.click(rateSortButton());
    await waitFor(() =>
      expect(getSpy).toHaveBeenLastCalledWith(
        `${CURRENCIES_PATH}?page=1&limit=20&sortBy=exchangeRate&sortDir=ASC`,
        expect.anything(),
      ),
    );
    fireEvent.click(rateSortButton());
    await waitFor(() =>
      expect(getSpy).toHaveBeenLastCalledWith(
        `${CURRENCIES_PATH}?page=1&limit=20&sortBy=exchangeRate&sortDir=DESC`,
        expect.anything(),
      ),
    );
  });

  it("recovers from an emptied last page after deactivating with name + ISO confirmation", async () => {
    let listCall = 0;
    const getSpy = vi.spyOn(axiosClient, "get").mockImplementation(async (url) => {
      if (isBaseUrl(url)) return pageEnvelope([usdRow], { limit: 1 });
      listCall += 1;
      if (listCall === 1) return pageEnvelope([usdRow], { page: 1, total: 21, totalPages: 2 });
      if (listCall === 2) return pageEnvelope([eurRow], { page: 2, total: 21, totalPages: 2 });
      if (listCall === 3) return pageEnvelope([], { page: 2, total: 20, totalPages: 1 });
      return pageEnvelope([usdRow], { page: 1, total: 20, totalPages: 1 });
    });
    const deleteSpy = vi.spyOn(axiosClient, "delete").mockResolvedValueOnce(rowEnvelope(null, 204));

    await renderCurrenciesPage("en");
    expect(await screen.findByText("US Dollar")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: en.common.nextPage }));
    expect(await screen.findByText("Euro")).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("button", { name: `${en.common.actions}: Euro (EUR)` }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: en.coreSettings.deactivate }));

    const deactivateTitle = `${en.coreSettings.currencyDeactivateTitle} — Euro (EUR)`;
    const dialog = await screen.findByRole("alertdialog", { name: deactivateTitle });
    expect(within(dialog).getByRole("heading", { name: deactivateTitle })).toBeInTheDocument();
    expect(
      within(dialog).getByText(formatTemplate(en.coreSettings.currencyDeactivateMessage, { code: "Euro (EUR)" })),
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: en.coreSettings.deactivate }));
    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith(`${CURRENCIES_PATH}/${eurId}`, expect.anything()));
    await waitFor(() =>
      expect(getSpy).toHaveBeenCalledWith(`${CURRENCIES_PATH}?page=1&limit=20&sortBy=code&sortDir=ASC`, expect.anything()),
    );
    expect(await screen.findByText("US Dollar")).toBeInTheDocument();
  });

  it(
    "creates, edits with shortened title, and confirms before setting default currency",
    async () => {
    vi.spyOn(axiosClient, "get").mockImplementation(async (url) =>
      isBaseUrl(url) ? pageEnvelope([usdRow], { limit: 1 }) : pageEnvelope([usdRow, eurRow]),
    );
    const postSpy = vi.spyOn(axiosClient, "post").mockResolvedValue(rowEnvelope({ ...eurRow, id: gbpId }));
    const patchSpy = vi.spyOn(axiosClient, "patch").mockResolvedValue(rowEnvelope(eurRow));

    await renderCurrenciesPage("en");
    expect(await screen.findByText("Euro")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: new RegExp(`^${formatTemplate(en.coreSettings.currencyExchangeRatePerBase, { code: "USD" }).replace(/[()]/gu, "\\$&")}`),
        }),
      ).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: en.coreSettings.currencyCreate }));
    const createDialog = await screen.findByRole("dialog");
    expect(within(createDialog).queryByText(en.coreSettings.currencyCreateDescription)).toBeNull();
    expect(
      within(createDialog).getByText(formatTemplate(en.coreSettings.currencyRatePerBaseHint, { base: "USD" })),
    ).toBeInTheDocument();

    const createCodeChoice = within(createDialog).getByRole("combobox", {
      name: en.coreSettings.currencyCode,
    });
    expect(document.activeElement).toBe(createCodeChoice);
    fireEvent.keyDown(createCodeChoice, { key: "ArrowDown" });
    const createCodeListbox = await screen.findByRole("listbox");
    fireEvent.click(within(createCodeListbox).getByText("GBP"));
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());

    const createInput = (name: string) => within(createDialog).getByRole("textbox", { name });
    fireEvent.change(createInput(en.coreSettings.currencyName), { target: { value: "British Pound" } });
    fireEvent.change(createInput(en.coreSettings.currencyExchangeRate), { target: { value: "0.78912345" } });
    expect(within(createDialog).getByText("1 USD = 0.78912345 GBP")).toBeInTheDocument();
    expect(
      within(createDialog).queryByText(formatTemplate(en.coreSettings.currencyRatePerBaseHint, { base: "USD" })),
    ).toBeNull();
    fireEvent.click(within(createDialog).getByRole("button", { name: en.coreSettings.save }));
    await waitFor(() =>
      expect(postSpy).toHaveBeenCalledWith(
        CURRENCIES_PATH,
        { code: "GBP", name: "British Pound", exchangeRate: 0.78912345 },
        expect.anything(),
      ),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: `${en.coreSettings.currencyEditTitle}: Euro (EUR)` }));
    const editDialog = await screen.findByRole("dialog");
    expect(within(editDialog).getByRole("heading", { name: en.coreSettings.currencyEditTitle })).toBeInTheDocument();
    fireEvent.change(within(editDialog).getByRole("textbox", { name: en.coreSettings.currencyName }), {
      target: { value: "Eurozone Euro" },
    });
    fireEvent.click(within(editDialog).getByRole("button", { name: en.coreSettings.save }));
    await waitFor(() =>
      expect(patchSpy).toHaveBeenCalledWith(`${CURRENCIES_PATH}/${eurId}`, { name: "Eurozone Euro" }, expect.anything()),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.keyDown(screen.getByRole("button", { name: `${en.common.actions}: Euro (EUR)` }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: en.coreSettings.currencySetDefault }));
    const confirmDialog = await screen.findByRole("dialog", { name: en.coreSettings.currencySetDefaultConfirmTitle });
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(within(confirmDialog).getByText("1 USD = 0.92345678 EUR")).toBeInTheDocument();
    fireEvent.click(within(confirmDialog).getByRole("button", { name: en.coreSettings.currencySetDefault }));
    await waitFor(() =>
      expect(postSpy).toHaveBeenCalledWith(`${CURRENCIES_PATH}/${eurId}/set-default`, undefined, expect.anything()),
    );
  },
  15_000,
  );

  it("retains readable rows with retry on same-query refresh failure and hides old rows behind loading then ErrorState on changed-query failure", async () => {
    const builtColumns = buildCurrencyColumns({
      t: en,
      lang: "en",
      canManage: true,
      pendingId: null,
      baseCurrencyCode: "USD",
      onEdit: () => undefined,
      onSetDefault: () => undefined,
      onDeactivate: () => undefined,
      onReactivate: () => undefined,
    });
    expect(builtColumns.find((col) => col.id === "rate")).toMatchObject({
      align: "end",
      numeric: true,
      sortField: "exchangeRate",
    });

    const chfRow = {
      ...makeRow(gbpId, "CHF", "Swiss Franc", "0.86500000", false),
      status: "INACTIVE" as const,
    };
    const corrRefresh = "01902001-3000-7000-8000-000000000071";
    const corrFilter = "01902001-3000-7000-8000-000000000072";

    let rejectFilterDeferred!: (err: unknown) => void;
    const filterDeferred = new Promise<AxiosResponse<unknown>>((_, rej) => {
      rejectFilterDeferred = rej;
    });

    let listCall = 0;
    vi.spyOn(axiosClient, "get").mockImplementation((url) => {
      if (isBaseUrl(url)) return Promise.resolve(pageEnvelope([usdRow], { limit: 1 }));
      listCall += 1;
      if (listCall === 1) return Promise.resolve(pageEnvelope([usdRow, eurRow]));
      if (listCall === 2) {
        return Promise.reject(apiError(500, "INTERNAL_ERROR", "Raw transient SQL error", corrRefresh));
      }
      if (listCall === 3) return Promise.resolve(pageEnvelope([usdRow, eurRow]));
      if (listCall === 4) return filterDeferred;
      return Promise.resolve(pageEnvelope([chfRow]));
    });

    await renderCurrenciesPage("en");
    expect(await screen.findByText("Euro")).toBeInTheDocument();
    expect(screen.getByText("US Dollar")).toBeInTheDocument();
    const usdTableRow = screen.getAllByRole("row").find((row) => row.textContent?.includes("US Dollar"))!;
    const eurTableRow = screen.getAllByRole("row").find((row) => row.textContent?.includes("Euro"))!;
    expect(within(usdTableRow).getByText(en.coreSettings.currencyDefault)).toBeInTheDocument();
    expect(within(eurTableRow).getByText(en.common.active)).toBeInTheDocument();

    // Same-query refresh failure retains readable rows and shows transient banner + Retry.
    fireEvent.click(screen.getByRole("button", { name: en.coreSettings.reload }));
    expect(await screen.findByText(new RegExp(corrRefresh))).toBeInTheDocument();
    expect(screen.queryByText("Raw transient SQL error")).toBeNull();
    expect(screen.getByText("Euro")).toBeInTheDocument();
    expect(screen.getByText("US Dollar")).toBeInTheDocument();
    expect(screen.queryByText(en.coreSettings.currencyEmpty)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: en.common.retry }));
    await waitFor(() => expect(screen.queryByText(new RegExp(corrRefresh))).toBeNull());
    expect(screen.getByText("Euro")).toBeInTheDocument();

    // Changed filter hides old rows immediately while pending, then renders ErrorState + Retry on failure.
    const statusSelect = screen.getByRole("combobox", { name: en.common.status });
    fireEvent.keyDown(statusSelect, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: en.common.inactive }));

    await waitFor(() => expect(listCall).toBe(4));
    expect(screen.queryByText("Euro")).toBeNull();
    expect(screen.queryByText("US Dollar")).toBeNull();
    expect(screen.queryByText(en.coreSettings.currencyEmptyFiltered)).toBeNull();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.coreSettings.reload })).toBeDisabled();

    await act(async () => {
      rejectFilterDeferred(apiError(500, "INTERNAL_ERROR", "Raw filter crash", corrFilter));
    });
    expect(await screen.findByText(new RegExp(corrFilter))).toBeInTheDocument();
    expect(screen.queryByText("Raw filter crash")).toBeNull();
    expect(screen.queryByText("Euro")).toBeNull();
    expect(screen.queryByText("US Dollar")).toBeNull();
    expect(screen.queryByText(en.coreSettings.currencyEmptyFiltered)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: en.common.retry }));
    expect(await screen.findByText("Swiss Franc")).toBeInTheDocument();
    const chfTableRow = screen.getAllByRole("row").find((row) => row.textContent?.includes("Swiss Franc"))!;
    expect(within(chfTableRow).getByText(en.common.inactive)).toBeInTheDocument();
  });

  it("clears private rows, open edit modal, and base-currency evidence across actor rotation and mid-session 403", async () => {
    const gbpRow = makeRow(gbpId, "GBP", "British Pound", "1.00000000", false);
    let rejectForbidden!: (reason: unknown) => void;
    let forbiddenRequests = 0;
    const forbiddenDeferred = new Promise<AxiosResponse<unknown>>((_resolve, reject) => {
      rejectForbidden = reject;
    });
    let resolveActor2List!: (res: AxiosResponse<unknown>) => void;
    let resolveActor2Base!: (res: AxiosResponse<unknown>) => void;
    const actor2ListDeferred = new Promise<AxiosResponse<unknown>>((res) => {
      resolveActor2List = res;
    });
    const actor2BaseDeferred = new Promise<AxiosResponse<unknown>>((res) => {
      resolveActor2Base = res;
    });

    let phase: "actor1" | "actor2Pending" | "forbidden" = "actor1";
    vi.spyOn(axiosClient, "get").mockImplementation((url) => {
      if (phase === "forbidden") {
        forbiddenRequests += 1;
        return forbiddenDeferred;
      }
      if (phase === "actor2Pending") {
        return isBaseUrl(url) ? actor2BaseDeferred : actor2ListDeferred;
      }
      return Promise.resolve(
        isBaseUrl(url) ? pageEnvelope([usdRow], { limit: 1 }) : pageEnvelope([usdRow, eurRow]),
      );
    });

    const view = await renderCurrenciesPage("en");
    expect(await screen.findByText("Euro")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: new RegExp(
            `^${formatTemplate(en.coreSettings.currencyExchangeRatePerBase, { code: "USD" }).replace(/[()]/gu, "\\$&")}`,
          ),
        }),
      ).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: `${en.coreSettings.currencyEditTitle}: Euro (EUR)` }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    phase = "actor2Pending";
    authState.realtimeAuthGeneration = "gen-2";
    authState.user = {
      ...defaultUser(),
      id: "01902001-3000-7000-8000-000000000002",
    };
    act(() => {
      view.rerender(
        <I18nProvider initialLanguage="en">
          <TooltipProvider>
            <ToastProvider>
              <CurrenciesPage />
            </ToastProvider>
          </TooltipProvider>
        </I18nProvider>,
      );
    });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("Euro")).toBeNull();
    expect(screen.queryByText("US Dollar")).toBeNull();
    expect(screen.getByRole("table")).toBeInTheDocument();

    await act(async () => {
      resolveActor2Base(pageEnvelope([], { limit: 1 }));
      resolveActor2List(pageEnvelope([gbpRow]));
    });
    expect(await screen.findByText("British Pound")).toBeInTheDocument();
    expect(screen.queryByText(/per 1 USD/u)).toBeNull();

    phase = "forbidden";
    fireEvent.click(screen.getByRole("button", { name: en.coreSettings.reload }));
    await waitFor(() => expect(forbiddenRequests).toBeGreaterThan(0));
    fireEvent.click(
      screen.getByRole("button", { name: `${en.coreSettings.currencyEditTitle}: British Pound (GBP)` }),
    );
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await act(async () => {
      rejectForbidden(apiError(403, "FORBIDDEN", "Raw revoked access"));
    });
    expect(await screen.findByText(en.permissionGate.title)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("British Pound")).toBeNull();
    expect(screen.queryByText("Raw revoked access")).toBeNull();
  });

  it("wires server-backed rows-per-page (20/50/100) and omits First/Last in EN/AR, resets page to 1 with active filters/sort, and hides old rows on pending/failed new-limit GETs", async () => {
    const gbpRow = makeRow(gbpId, "GBP", "British Pound", "0.78912345", false);
    const corr100 = "01902001-3000-7000-8000-000000000095";
    let resolveSortedPage!: (response: AxiosResponse<unknown>) => void;
    const sortedPageDeferred = new Promise<AxiosResponse<unknown>>((resolve) => {
      resolveSortedPage = resolve;
    });
    let rejectLimit100!: (reason: unknown) => void;
    const limit100Deferred = new Promise<AxiosResponse<unknown>>((_res, rej) => {
      rejectLimit100 = rej;
    });
    let limit100Attempts = 0;
    const listUrls: string[] = [];
    const baseUrls: string[] = [];

    vi.spyOn(axiosClient, "get").mockImplementation((url) => {
      if (isBaseUrl(url)) {
        baseUrls.push(url);
        return Promise.resolve(pageEnvelope([usdRow], { limit: 1 }));
      }
      listUrls.push(url);
      const params = new URL(url, "https://portal.example").searchParams;
      const limit = Number(params.get("limit"));
      const page = Number(params.get("page"));
      if (limit === 100) {
        limit100Attempts += 1;
        if (limit100Attempts === 1) return limit100Deferred;
        return Promise.resolve(pageEnvelope([gbpRow], { page: 1, limit: 100, total: 1 }));
      }
      if (limit === 50) {
        return Promise.resolve(pageEnvelope([eurRow], { page: 1, limit: 50, total: 55 }));
      }
      if (page === 1 && params.get("sortBy") === "exchangeRate" && params.get("search") === "Cur") {
        return sortedPageDeferred;
      }
      return Promise.resolve(
        page === 2
          ? pageEnvelope([eurRow], { page: 2, limit: 20, total: 45 })
          : pageEnvelope([usdRow], { page: 1, limit: 20, total: 45 }),
      );
    });

    const { unmount } = await renderCurrenciesPage("ar");
    expect(await screen.findByText("US Dollar")).toBeInTheDocument();
    const arPageSizeSelect = screen.getByRole("combobox", { name: ar.common.rowsPerPage });
    expect(arPageSizeSelect).toHaveTextContent("20");
    expect(screen.queryByRole("button", { name: ar.common.firstPage })).toBeNull();
    expect(screen.queryByRole("button", { name: ar.common.lastPage })).toBeNull();
    expect(screen.getByRole("button", { name: ar.common.previousPage })).toBeDisabled();
    expect(screen.getByRole("button", { name: ar.common.nextPage })).toBeEnabled();
    unmount();

    listUrls.length = 0;
    baseUrls.length = 0;
    await renderCurrenciesPage("en");
    expect(await screen.findByText("US Dollar")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.common.firstPage })).toBeNull();
    expect(screen.queryByRole("button", { name: en.common.lastPage })).toBeNull();

    const statusSelect = screen.getByRole("combobox", { name: en.common.status });
    fireEvent.keyDown(statusSelect, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: en.common.active }));
    fireEvent.change(screen.getByPlaceholderText(en.coreSettings.currencySearch), {
      target: { value: "Cur" },
    });
    const rateHeader = await screen.findByRole("button", {
      name: new RegExp(
        `^${formatTemplate(en.coreSettings.currencyExchangeRatePerBase, { code: "USD" }).replace(/[()]/gu, "\\$&")}`,
      ),
    });
    fireEvent.click(rateHeader);
    await waitFor(() =>
      expect(listUrls.at(-1)).toBe(
        `${CURRENCIES_PATH}?page=1&limit=20&sortBy=exchangeRate&sortDir=ASC&search=Cur&status=ACTIVE`,
      ),
    );
    // A request being sent does not mean the new query has settled or pagination is available.
    expect(screen.queryByRole("button", { name: en.common.nextPage })).toBeNull();
    expect(screen.queryByText("US Dollar")).toBeNull();
    await act(async () => {
      resolveSortedPage(pageEnvelope([usdRow], { page: 1, limit: 20, total: 45 }));
    });
    expect(await screen.findByText("US Dollar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.common.nextPage })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: en.common.nextPage }));
    expect(await screen.findByText("Euro")).toBeInTheDocument();
    expect(listUrls.at(-1)).toBe(
      `${CURRENCIES_PATH}?page=2&limit=20&sortBy=exchangeRate&sortDir=ASC&search=Cur&status=ACTIVE`,
    );

    const enPageSizeSelect = screen.getByRole("combobox", { name: en.common.rowsPerPage });
    fireEvent.keyDown(enPageSizeSelect, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "50" }));
    await waitFor(() =>
      expect(listUrls.at(-1)).toBe(
        `${CURRENCIES_PATH}?page=1&limit=50&sortBy=exchangeRate&sortDir=ASC&search=Cur&status=ACTIVE`,
      ),
    );
    expect(await screen.findByText("Euro")).toBeInTheDocument();
    expect(baseUrls).toHaveLength(1);

    // Selecting 100 hides old limit=50 rows while pending, settles to ErrorState on 500, and recovers on Retry.
    fireEvent.keyDown(screen.getByRole("combobox", { name: en.common.rowsPerPage }), {
      key: "ArrowDown",
    });
    fireEvent.click(await screen.findByRole("option", { name: "100" }));
    await waitFor(() =>
      expect(listUrls.at(-1)).toBe(
        `${CURRENCIES_PATH}?page=1&limit=100&sortBy=exchangeRate&sortDir=ASC&search=Cur&status=ACTIVE`,
      ),
    );
    expect(screen.queryByText("Euro")).toBeNull();
    expect(screen.queryByText(en.coreSettings.currencyEmptyFiltered)).toBeNull();
    expect(screen.getByRole("button", { name: en.coreSettings.reload })).toBeDisabled();

    await act(async () => {
      rejectLimit100(apiError(500, "INTERNAL_ERROR", "Raw limit 100 SQL crash", corr100));
    });
    expect(await screen.findByText(new RegExp(corr100))).toBeInTheDocument();
    expect(screen.queryByText("Raw limit 100 SQL crash")).toBeNull();
    expect(screen.queryByText("Euro")).toBeNull();
    expect(screen.queryByText(en.coreSettings.currencyEmptyFiltered)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: en.common.retry }));
    expect(await screen.findByText("British Pound")).toBeInTheDocument();
  });
});

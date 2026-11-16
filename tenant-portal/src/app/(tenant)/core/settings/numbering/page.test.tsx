// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast as sonnerToast } from "sonner";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/design-system";
import { I18nProvider } from "@/i18n/I18nContext";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { setLanguage } from "@/i18n/useLanguage";
import { TenantApiClientError, axiosClient, type AxiosResponse } from "@/lib/api/axiosClient";
import {
  SEQUENCE_CODE_TAKEN_CODE,
  SEQUENCE_NOT_FOUND_CODE,
  SEQUENCE_VALUE_INVALID_CODE,
  toNumberingForm,
  type NumberingFormValues,
} from "./numbering-contract";
import NumberingPage from "./page";
import { useNumberingSequences } from "./hooks/useNumberingSequences";

const alphaCompanyId = "01902001-3000-7000-8000-0000000000c1";
const unknownCompanyId = "01902001-3000-7000-8000-0000000000c9";
const correlationId = "01902001-3000-7000-8000-0000000000f1";

interface MockAuthUser {
  id: string;
  accessMode?: string;
  permissions: string[];
  permissionScopes: Record<string, { tenantWide: boolean; companyIds: string[]; branchIds: string[] }>;
}

const defaultUser = (): MockAuthUser => ({
  id: "01902001-3000-7000-8000-0000000000a1",
  permissions: ["numbering.read", "numbering.manage"],
  permissionScopes: {
    "numbering.read": { tenantWide: true, companyIds: [], branchIds: [] },
    "numbering.manage": { tenantWide: true, companyIds: [alphaCompanyId], branchIds: [] },
  },
});

const authState = vi.hoisted(() => ({
  realtimeAuthGeneration: "gen-1",
  user: {
    id: "01902001-3000-7000-8000-0000000000a1",
    permissions: ["numbering.read", "numbering.manage"],
    permissionScopes: {
      "numbering.read": { tenantWide: true, companyIds: [], branchIds: [] },
      "numbering.manage": { tenantWide: true, companyIds: ["01902001-3000-7000-8000-0000000000c1"], branchIds: [] },
    },
  } as MockAuthUser,
}));

vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => authState }));

const companiesPayload = [{ id: alphaCompanyId, code: "ALPHA", name: "Alpha Trading" }];
const tenantWideRow = {
  id: "01902001-3000-7000-8000-000000000001", code: "QUOTE", prefix: "BIG-",
  padding: 6, nextValue: "9007199254740993", companyId: null, updatedAt: "2026-08-25T10:05:00.000Z",
};
const companyScopedRow = {
  id: "01902001-3000-7000-8000-000000000002", code: "SALES_INVOICE", prefix: "INV-",
  padding: 5, nextValue: "43", companyId: alphaCompanyId, updatedAt: "2026-08-25T10:06:00.000Z",
};
const unknownScopedRow = {
  id: "01902001-3000-7000-8000-000000000003", code: "LEGACY_DOC", prefix: null,
  padding: 4, nextValue: "9", companyId: unknownCompanyId, updatedAt: "2026-08-25T10:07:00.000Z",
};

function okResponse(data: unknown, status = 200): AxiosResponse<unknown> {
  return { data, status, statusText: status === 201 ? "Created" : "OK", headers: new Headers() };
}

function pageEnvelope(
  rows: readonly unknown[],
  meta: { page?: number; limit?: number; total?: number; totalPages?: number; hasNext?: boolean; hasPrev?: boolean } = {},
) {
  const page = meta.page ?? 1;
  const limit = meta.limit ?? 20;
  const total = meta.total ?? rows.length;
  const totalPages = meta.totalPages ?? (total === 0 ? 0 : Math.ceil(total / limit));
  return okResponse({
    success: true,
    status: "SUCCESS",
    statusCode: 200,
    data: rows,
    meta: {
      page, limit, total, totalPages,
      hasNext: meta.hasNext ?? page < totalPages,
      hasPrev: meta.hasPrev ?? page > 1,
    },
    correlationId,
  });
}

function companiesEnvelope(items = companiesPayload) {
  return pageEnvelope(items, { page: 1, limit: 100, total: items.length });
}

function pageProvidersUi(language: "en" | "ar" = "en") {
  return (
    <I18nProvider initialLanguage={language}>
      <TooltipProvider>
        <NumberingPage />
      </TooltipProvider>
    </I18nProvider>
  );
}

async function renderPage(language: "en" | "ar" = "en") {
  await setLanguage(language);
  return render(pageProvidersUi(language));
}

beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => undefined;
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => undefined;
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => undefined;
});

beforeEach(() => {
  authState.realtimeAuthGeneration = "gen-1";
  authState.user = defaultUser();
});

afterEach(() => {
  cleanup();
  window.localStorage.removeItem("tenant_lang");
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("NumberingPage list transport, columns, scopes and states", () => {
  it("renders exact Reference 03 columns without row numbers or raw counter/status columns and hides raw UUIDs", async () => {
    const getSpy = vi.spyOn(axiosClient, "get").mockImplementation(async (url) => {
      if (url.startsWith("/api/tenant/core/v1/organization/companies")) return companiesEnvelope();
      if (url.startsWith("/api/tenant/core/v1/numbering?")) {
        return pageEnvelope([tenantWideRow, companyScopedRow, unknownScopedRow]);
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    await renderPage("en");

    expect(await screen.findByText("SALES_INVOICE")).toBeInTheDocument();
    expect(getSpy).toHaveBeenCalledWith(
      "/api/tenant/core/v1/numbering?page=1&limit=20&sortBy=code&sortDir=ASC",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        cache: "no-store",
        suppressForbiddenToast: true,
      }),
    );

    const table = screen.getByRole("table");
    const headers = within(table).getAllByRole("columnheader");
    expect(headers).toHaveLength(6);
    expect(headers[0]).toHaveTextContent(en.coreSettings.numberingCode);
    expect(headers[1]).toHaveTextContent(en.coreIdentity.cascade.company);
    expect(headers[2]).toHaveTextContent(en.coreSettings.numberingPrefix);
    expect(headers[3]).toHaveTextContent(en.coreSettings.numberingPadding);
    expect(headers[4]).toHaveTextContent(en.coreSettings.numberingNextNumber);
    expect(headers[5]).toHaveTextContent(en.common.actions);
    expect(within(table).queryByRole("columnheader", { name: "#" })).toBeNull();
    expect(within(table).queryByRole("columnheader", { name: en.common.status })).toBeNull();

    expect(screen.getByText("INV-")).toBeInTheDocument();
    expect(screen.getByText("INV-00043")).toBeInTheDocument();
    expect(screen.getByText("BIG-9007199254740993")).toBeInTheDocument();
    expect(screen.queryByText("9007199254740993")).toBeNull();
    expect(screen.getByText("0009")).toBeInTheDocument();
    expect(screen.getByText(en.audit.valueEmpty)).toBeInTheDocument();
    expect(screen.getByText(en.coreSettings.numberingTenantWide)).toBeInTheDocument();
    expect(screen.getByText("Alpha Trading")).toBeInTheDocument();
    expect(screen.queryByText("ALPHA — Alpha Trading")).toBeNull();
    expect(screen.getByText(en.coreSettings.unknownCompany)).toBeInTheDocument();
    expect(table.textContent).not.toContain(unknownCompanyId);
    expect(table.textContent).not.toContain(alphaCompanyId);

    // No unbacked status, delete, reset or yearly options.
    expect(screen.queryByRole("button", { name: /delete|deactivate|reset/iu })).toBeNull();
    expect(screen.getByRole("button", { name: en.coreSettings.numberingCreate })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.coreSettings.reload })).toBeInTheDocument();
  });

  it("renders Arabic RTL copy and bidi-isolated sequence identifiers", async () => {
    vi.spyOn(axiosClient, "get").mockImplementation(async (url) => {
      if (url.startsWith("/api/tenant/core/v1/organization/companies")) return companiesEnvelope();
      return pageEnvelope([companyScopedRow]);
    });

    await renderPage("ar");

    const codeNode = await screen.findByText("SALES_INVOICE");
    expect(codeNode.tagName).toBe("BDI");
    expect(codeNode).toHaveAttribute("dir", "ltr");
    expect(screen.getByText("Alpha Trading")).toBeInTheDocument();
    expect(
      within(screen.getByRole("table")).getAllByRole("columnheader")[1],
    ).toHaveTextContent(ar.coreIdentity.cascade.company);
    expect(
      screen.getByRole("combobox", { name: ar.coreIdentity.cascade.company }),
    ).toHaveTextContent(ar.coreIdentity.filters.allCompanies);
    expect(screen.getByRole("button", { name: ar.coreSettings.numberingCreate })).toBeInTheDocument();
  });

  it("retains readable numbering rows during partial company load failure and recovers on retry", async () => {
    let companyAttempt = 0;
    vi.spyOn(axiosClient, "get").mockImplementation(async (url) => {
      if (url.startsWith("/api/tenant/core/v1/organization/companies")) {
        companyAttempt += 1;
        if (companyAttempt === 1) {
          throw new TenantApiClientError("Companies down", {
            status: 503,
            statusText: "Service Unavailable",
            headers: new Headers(),
            data: { success: false, statusCode: 503, correlationId },
          });
        }
        return companiesEnvelope();
      }
      return pageEnvelope([tenantWideRow, companyScopedRow]);
    });

    await renderPage("en");
    expect(await screen.findByText("SALES_INVOICE")).toBeInTheDocument();
    expect(screen.getByText("QUOTE")).toBeInTheDocument();
    expect(screen.getByText(en.coreSettings.unknownCompany)).toBeInTheDocument();
    expect(screen.getByRole("table").textContent).not.toContain(alphaCompanyId);

    const companyAlert = screen.getByRole("alert");
    expect(companyAlert).toHaveTextContent(en.coreSettings.companyOptionsLoadFailed);

    fireEvent.click(within(companyAlert).getByRole("button", { name: en.common.retry }));
    expect(await screen.findByText("Alpha Trading")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("separates read-only access (permission and subscription) from 403 PermissionGate and handles 404 without blind retry", async () => {
    const getSpy = vi.spyOn(axiosClient, "get").mockImplementation(async (url) => {
      if (url.startsWith("/api/tenant/core/v1/organization/companies")) return companiesEnvelope();
      return pageEnvelope([companyScopedRow]);
    });

    // 1. Permission read-only (`numbering.read` without `numbering.manage`) -> ReadOnlyGate notice + readable table, no Create/Edit.
    authState.user = {
      id: "01902001-3000-7000-8000-0000000000a2",
      permissions: ["numbering.read"],
      permissionScopes: {
        "numbering.read": { tenantWide: true, companyIds: [], branchIds: [] },
      },
    };
    const readOnlyRender = await renderPage("en");
    expect(await screen.findByText("SALES_INVOICE")).toBeInTheDocument();
    expect(screen.getByText(en.crmSettings.readOnly)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.coreSettings.numberingCreate })).toBeNull();
    expect(
      screen.queryByRole("button", { name: `${en.coreSettings.numberingEditTitle}: SALES_INVOICE` }),
    ).toBeNull();
    expect(within(screen.getByRole("table")).getAllByRole("columnheader")).toHaveLength(5);
    readOnlyRender.unmount();

    // 2. Subscription READ_ONLY mode -> subscription read-only notice, no Create/Edit.
    authState.user = { ...defaultUser(), accessMode: "READ_ONLY" };
    const subReadOnlyRender = await renderPage("en");
    expect(await screen.findByText("SALES_INVOICE")).toBeInTheDocument();
    expect(screen.getByText(en.coreBilling.accessReadOnlyNotice)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.coreSettings.numberingCreate })).toBeNull();
    subReadOnlyRender.unmount();

    // 3. 404 list response -> NotFoundState without Retry button.
    authState.user = defaultUser();
    getSpy.mockImplementation(async (url) => {
      if (url.startsWith("/api/tenant/core/v1/organization/companies")) return companiesEnvelope([]);
      throw new TenantApiClientError("Not found", {
        status: 404,
        statusText: "Not Found",
        headers: new Headers(),
        data: { success: false, statusCode: 404, errorCode: SEQUENCE_NOT_FOUND_CODE, correlationId },
      });
    });
    const notFoundRender = await renderPage("en");
    expect(await screen.findByText(en.editDrawer.notFoundTitle)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.common.retry })).toBeNull();
    notFoundRender.unmount();

    // 4. 403 Forbidden -> PermissionGate, never empty state or read-only banner.
    getSpy.mockImplementation(async (url) => {
      if (url.startsWith("/api/tenant/core/v1/organization/companies")) return companiesEnvelope([]);
      throw new TenantApiClientError("Forbidden", {
        status: 403,
        statusText: "Forbidden",
        headers: new Headers(),
        data: { success: false, statusCode: 403, errorCode: "FORBIDDEN", correlationId },
      });
    });
    await renderPage("en");
    expect(await screen.findByText(en.permissionGate.title)).toBeInTheDocument();
    expect(screen.queryByText(en.coreSettings.numberingEmpty)).toBeNull();
    expect(screen.queryByText(en.crmSettings.readOnly)).toBeNull();
  });

  it("distinguishes malformed-envelope, offline transport, retryable HTTP error and empty states without leaking raw debug text", async () => {
    const getSpy = vi.spyOn(axiosClient, "get");

    getSpy.mockImplementation(async (url) => {
      if (url.startsWith("/api/tenant/core/v1/organization/companies")) return companiesEnvelope([]);
      return pageEnvelope([]);
    });
    const emptyRender = await renderPage("en");
    expect(await screen.findByText(en.coreSettings.numberingEmpty)).toBeInTheDocument();
    emptyRender.unmount();

    let listAttempt = 0;
    getSpy.mockImplementation(async (url) => {
      if (url.startsWith("/api/tenant/core/v1/organization/companies")) return companiesEnvelope([]);
      listAttempt += 1;
      if (listAttempt === 1) {
        return okResponse({
          success: true,
          data: { items: [companyScopedRow], total: 1, page: 1, limit: 20 },
          correlationId,
        });
      }
      return pageEnvelope([companyScopedRow]);
    });
    const invalidRender = await renderPage("en");
    expect(await screen.findByText(en.coreSettings.numberingLoadFailed)).toBeInTheDocument();
    expect(screen.getByText(en.coreSettings.invalidResponseDescription)).toBeInTheDocument();
    expect(screen.queryByText(en.coreIdentity.errors.UNKNOWN)).toBeNull();
    expect(screen.queryByText(en.coreIdentity.errors.OFFLINE)).toBeNull();
    expect(screen.queryByText(/Invalid Core numbering response/iu)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: en.common.retry }));
    expect(await screen.findByText("SALES_INVOICE")).toBeInTheDocument();
    invalidRender.unmount();

    getSpy.mockImplementation(async (url) => {
      if (url.startsWith("/api/tenant/core/v1/organization/companies")) return companiesEnvelope([]);
      throw new TypeError("Failed to fetch");
    });
    const offlineRender = await renderPage("en");
    expect(await screen.findByText(en.coreSettings.numberingLoadFailed)).toBeInTheDocument();
    expect(screen.getByText(en.coreIdentity.errors.OFFLINE)).toBeInTheDocument();
    expect(screen.queryByText(/Failed to fetch/iu)).toBeNull();
    offlineRender.unmount();

    getSpy.mockImplementation(async (url) => {
      if (url.startsWith("/api/tenant/core/v1/organization/companies")) return companiesEnvelope([]);
      throw new TenantApiClientError("RAW_SQL_DEBUG_TRACE", {
        status: 503,
        statusText: "Service Unavailable",
        headers: new Headers(),
        data: {
          success: false,
          statusCode: 503,
          message: "RAW_SQL_DEBUG_TRACE",
          correlationId,
        },
      });
    });
    await renderPage("en");
    expect(await screen.findByText(en.coreSettings.numberingLoadFailed)).toBeInTheDocument();
    expect(
      screen.getByText(`${en.coreIdentity.errors.UNKNOWN} — ${en.errors.reference}: ${correlationId}`),
    ).toBeInTheDocument();
    expect(screen.queryByText(/RAW_SQL_DEBUG_TRACE/u)).toBeNull();
  });

  it("exposes directly visible company Select and compact search with supported query and reset behavior", async () => {
    const requestedUrls: string[] = [];
    vi.spyOn(axiosClient, "get").mockImplementation(async (url) => {
      if (url.startsWith("/api/tenant/core/v1/organization/companies")) return companiesEnvelope();
      requestedUrls.push(url);
      const parsedUrl = new URL(url, "http://mersany.mutakamel.ai:5002");
      if (Number(parsedUrl.searchParams.get("page") ?? "1") === 2) {
        return pageEnvelope([], { page: 2, limit: 20, total: 20, totalPages: 1, hasNext: false, hasPrev: true });
      }
      if (requestedUrls.length === 1) {
        return pageEnvelope([companyScopedRow], { page: 1, limit: 20, total: 21, totalPages: 2, hasNext: true, hasPrev: false });
      }
      return pageEnvelope([companyScopedRow]);
    });

    await renderPage("en");
    expect(await screen.findByText("SALES_INVOICE")).toBeInTheDocument();

    // Company Select and Search are directly visible without opening any Filters popover button.
    expect(screen.queryByRole("button", { name: en.filters.label })).toBeNull();
    const companyCombo = screen.getByRole("combobox", { name: en.coreIdentity.cascade.company });
    expect(companyCombo).toHaveTextContent(en.coreIdentity.filters.allCompanies);
    expect(screen.getByPlaceholderText(en.coreSettings.numberingSearch)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: en.common.nextPage }));
    await waitFor(() => {
      expect(requestedUrls).toContain("/api/tenant/core/v1/numbering?page=2&limit=20&sortBy=code&sortDir=ASC");
      expect(requestedUrls[requestedUrls.length - 1]).toBe(
        "/api/tenant/core/v1/numbering?page=1&limit=20&sortBy=code&sortDir=ASC",
      );
    });
    expect(await screen.findByText("SALES_INVOICE")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: new RegExp(en.coreSettings.numberingNextNumber, "u") }));
    await waitFor(() => {
      expect(requestedUrls[requestedUrls.length - 1]).toBe(
        "/api/tenant/core/v1/numbering?page=1&limit=20&sortBy=nextValue&sortDir=ASC",
      );
    });

    fireEvent.click(companyCombo);
    fireEvent.click(await screen.findByRole("option", { name: "Alpha Trading" }));
    await waitFor(() => {
      expect(requestedUrls[requestedUrls.length - 1]).toBe(
        `/api/tenant/core/v1/numbering?page=1&limit=20&sortBy=nextValue&sortDir=ASC&companyId=${alphaCompanyId}`,
      );
    });

    const searchInput = screen.getByPlaceholderText(en.coreSettings.numberingSearch);
    fireEvent.change(searchInput, { target: { value: "INV" } });
    await waitFor(() => {
      expect(requestedUrls[requestedUrls.length - 1]).toContain("search=INV");
    });

    // Reset clears both visible Company Select and Search input immediately.
    fireEvent.click(screen.getByRole("button", { name: en.coreSettings.clearFilters }));
    await waitFor(() => {
      expect(companyCombo).toHaveTextContent(en.coreIdentity.filters.allCompanies);
      expect(searchInput).toHaveValue("");
      expect(requestedUrls[requestedUrls.length - 1]).toBe(
        "/api/tenant/core/v1/numbering?page=1&limit=20&sortBy=nextValue&sortDir=ASC",
      );
    });
  });

  it.each(["create", "edit"] as const)("permanently dismisses private %s state after 403 even when the same session later recovers", async (mode) => {
    let listAttempt = 0;
    vi.spyOn(axiosClient, "get").mockImplementation(async (url) => {
      if (url.startsWith("/api/tenant/core/v1/organization/companies")) return companiesEnvelope();
      if (!url.startsWith("/api/tenant/core/v1/numbering?")) throw new Error(`Unexpected GET ${url}`);
      listAttempt += 1;
      if (listAttempt === 2) {
        throw new TenantApiClientError("Forbidden", {
          status: 403, statusText: "Forbidden", headers: new Headers(),
          data: { success: false, statusCode: 403, errorCode: "FORBIDDEN", correlationId },
        });
      }
      return pageEnvelope([companyScopedRow]);
    });
    const conflictError = new TenantApiClientError("Conflict", {
      status: 409, statusText: "Conflict", headers: new Headers(),
      data: { success: false, statusCode: 409, errorCode: SEQUENCE_CODE_TAKEN_CODE, correlationId },
    });
    const postSpy = vi.spyOn(axiosClient, "post").mockRejectedValueOnce(conflictError);
    const patchSpy = vi.spyOn(axiosClient, "patch").mockRejectedValueOnce(conflictError);

    await setLanguage("en");
    const { result } = renderHook(() => useNumberingSequences(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <I18nProvider initialLanguage="en"><TooltipProvider>{children}</TooltipProvider></I18nProvider>
      ),
    });
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    const loadedSequence = result.current.items[0]!;
    act(() => {
      if (mode === "create") result.current.openCreate();
      else result.current.openEdit(loadedSequence);
    });
    expect(mode === "create" ? result.current.createOpen : result.current.editing !== null).toBe(true);

    // Populate server form feedback before 403 arrives so 403 must clear associated feedback too.
    const draftValues: NumberingFormValues = {
      code: "SALES_INVOICE",
      prefix: "INV-",
      padding: "6",
      startValue: "50",
      companyId: alphaCompanyId,
    };
    await act(async () => {
      const ok = mode === "create"
        ? await result.current.create(draftValues)
        : await result.current.update(draftValues);
      expect(ok).toBe(false);
    });
    if (mode === "create") {
      expect(result.current.formFieldErrors.code).toBeTruthy();
    } else {
      expect(result.current.formError).toBeTruthy();
    }

    await act(async () => { await result.current.reload(); });
    expect(result.current.isQueryForbidden).toBe(true);
    expect(result.current.items).toEqual([]);
    expect(result.current.createOpen).toBe(false);
    expect(result.current.editing).toBeNull();
    expect(result.current.editingNotFound).toBe(false);
    expect(result.current.formError).toBeNull();
    expect(result.current.formFieldErrors).toEqual({});
    expect(result.current.canManage).toBe(false);
    expect(result.current.canCreate).toBe(false);
    expect(result.current.canManageScope(alphaCompanyId)).toBe(false);

    // Denied direct action handlers fail closed without opening dialogs or issuing writes.
    const postCallsOnDeny = postSpy.mock.calls.length;
    const patchCallsOnDeny = patchSpy.mock.calls.length;
    await act(async () => {
      result.current.openCreate();
      result.current.openEdit(loadedSequence);
      expect(await result.current.create(draftValues)).toBe(false);
      expect(await result.current.update(draftValues)).toBe(false);
    });
    expect(result.current.createOpen).toBe(false);
    expect(result.current.editing).toBeNull();
    expect(postSpy).toHaveBeenCalledTimes(postCallsOnDeny);
    expect(patchSpy).toHaveBeenCalledTimes(patchCallsOnDeny);

    await act(async () => { await result.current.reload(); });
    expect(result.current.isQueryForbidden).toBe(false);
    expect(result.current.items).toHaveLength(1);
    expect(result.current.createOpen).toBe(false);
    expect(result.current.editing).toBeNull();
    expect(result.current.formError).toBeNull();
    expect(result.current.formFieldErrors).toEqual({});
  });

  it.each(["resolve", "reject"] as const)(
    "invalidates in-flight write on authoritative 403 so stale %s after recovery cannot publish or release a newer write lock",
    async (staleOutcome) => {
      const toastSpy = vi.spyOn(sonnerToast, "custom").mockImplementation(() => "toast-id");
      let listAttempt = 0;
      vi.spyOn(axiosClient, "get").mockImplementation(async (url) => {
        if (url.startsWith("/api/tenant/core/v1/organization/companies")) return companiesEnvelope();
        if (!url.startsWith("/api/tenant/core/v1/numbering?")) throw new Error(`Unexpected GET ${url}`);
        listAttempt += 1;
        if (listAttempt === 2) {
          throw new TenantApiClientError("Forbidden", {
            status: 403, statusText: "Forbidden", headers: new Headers(),
            data: { success: false, statusCode: 403, errorCode: "FORBIDDEN", correlationId },
          });
        }
        return pageEnvelope([companyScopedRow]);
      });

      let resolveFirstWrite: ((value: AxiosResponse<unknown>) => void) | null = null;
      let rejectFirstWrite: ((reason: unknown) => void) | null = null;
      let resolveSecondWrite: ((value: AxiosResponse<unknown>) => void) | null = null;
      let postAttempt = 0;
      const postSpy = vi.spyOn(axiosClient, "post").mockImplementation(() => {
        postAttempt += 1;
        if (postAttempt === 1) {
          return new Promise<AxiosResponse<unknown>>((resolve, reject) => {
            resolveFirstWrite = resolve;
            rejectFirstWrite = reject;
          });
        }
        if (postAttempt === 2) {
          return new Promise<AxiosResponse<unknown>>((resolve) => {
            resolveSecondWrite = resolve;
          });
        }
        throw new Error(`Unexpected extra POST attempt ${postAttempt}`);
      });

      await setLanguage("en");
      const { result } = renderHook(() => useNumberingSequences(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <I18nProvider initialLanguage="en"><TooltipProvider>{children}</TooltipProvider></I18nProvider>
        ),
      });
      await waitFor(() => expect(result.current.items).toHaveLength(1));

      const firstValues: NumberingFormValues = {
        code: "FIRST_SEQ",
        prefix: "F1-",
        padding: "5",
        startValue: "1",
        companyId: alphaCompanyId,
      };
      const secondValues: NumberingFormValues = {
        code: "SECOND_SEQ",
        prefix: "F2-",
        padding: "6",
        startValue: "10",
        companyId: alphaCompanyId,
      };

      act(() => result.current.openCreate());
      expect(result.current.createOpen).toBe(true);

      let firstPromise!: Promise<boolean>;
      let duplicateSameTickPromise!: Promise<boolean>;
      act(() => {
        firstPromise = result.current.create(firstValues);
        duplicateSameTickPromise = result.current.create(firstValues);
      });
      expect(await duplicateSameTickPromise).toBe(false);
      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(result.current.isSubmitting).toBe(true);

      // Authoritative 403 arrives while first write is still pending.
      await act(async () => { await result.current.reload(); });
      expect(result.current.isQueryForbidden).toBe(true);
      expect(result.current.createOpen).toBe(false);
      expect(result.current.isSubmitting).toBe(false);

      // Same session recovers; private modal stays closed until user opens a fresh attempt.
      await act(async () => { await result.current.reload(); });
      expect(result.current.isQueryForbidden).toBe(false);
      expect(result.current.createOpen).toBe(false);

      act(() => result.current.openCreate());
      expect(result.current.createOpen).toBe(true);
      let secondPromise!: Promise<boolean>;
      act(() => {
        secondPromise = result.current.create(secondValues);
      });
      expect(postSpy).toHaveBeenCalledTimes(2);
      expect(result.current.isSubmitting).toBe(true);
      const listCallsBeforeStaleSettles = listAttempt;

      // Stale first write settles while second write is still in-flight.
      await act(async () => {
        if (staleOutcome === "resolve") {
          resolveFirstWrite?.(
            okResponse({ success: true, statusCode: 201, data: tenantWideRow, correlationId }, 201),
          );
        } else {
          rejectFirstWrite?.(
            new TenantApiClientError("Conflict", {
              status: 409, statusText: "Conflict", headers: new Headers(),
              data: { success: false, statusCode: 409, errorCode: SEQUENCE_CODE_TAKEN_CODE, correlationId },
            }),
          );
        }
        expect(await firstPromise).toBe(false);
      });

      // Stale completion/finally must neither publish nor release the second write's lock.
      expect(toastSpy).not.toHaveBeenCalled();
      expect(listAttempt).toBe(listCallsBeforeStaleSettles);
      expect(result.current.createOpen).toBe(true);
      expect(result.current.formError).toBeNull();
      expect(result.current.formFieldErrors).toEqual({});
      expect(result.current.isSubmitting).toBe(true);

      await act(async () => {
        result.current.closeCreate();
        expect(await result.current.create(secondValues)).toBe(false);
      });
      expect(result.current.createOpen).toBe(true);
      expect(postSpy).toHaveBeenCalledTimes(2);

      // Second write completes cleanly and releases its own lock.
      await act(async () => {
        resolveSecondWrite?.(
          okResponse({ success: true, statusCode: 201, data: companyScopedRow, correlationId }, 201),
        );
        expect(await secondPromise).toBe(true);
      });
      expect(result.current.createOpen).toBe(false);
      expect(result.current.isSubmitting).toBe(false);
      expect(toastSpy).toHaveBeenCalledTimes(1);
      expect(listAttempt).toBe(listCallsBeforeStaleSettles + 1);
    },
  );

  it("invalidates in-flight write across A -> B -> A scope rotation even when authFenceKey matches A again", async () => {
    const toastSpy = vi.spyOn(sonnerToast, "custom").mockImplementation(() => "toast-id");
    vi.spyOn(axiosClient, "get").mockImplementation(async (url) => {
      if (url.startsWith("/api/tenant/core/v1/organization/companies")) return companiesEnvelope();
      return pageEnvelope([companyScopedRow]);
    });

    let resolveFirstPatch: ((value: AxiosResponse<unknown>) => void) | null = null;
    let resolveSecondPatch: ((value: AxiosResponse<unknown>) => void) | null = null;
    let patchAttempt = 0;
    const patchSpy = vi.spyOn(axiosClient, "patch").mockImplementation(() => {
      patchAttempt += 1;
      if (patchAttempt === 1) {
        return new Promise<AxiosResponse<unknown>>((resolve) => {
          resolveFirstPatch = resolve;
        });
      }
      if (patchAttempt === 2) {
        return new Promise<AxiosResponse<unknown>>((resolve) => {
          resolveSecondPatch = resolve;
        });
      }
      throw new Error(`Unexpected extra PATCH attempt ${patchAttempt}`);
    });

    await setLanguage("en");
    const { result, rerender } = renderHook(() => useNumberingSequences(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <I18nProvider initialLanguage="en"><TooltipProvider>{children}</TooltipProvider></I18nProvider>
      ),
    });
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    const target = result.current.items[0]!;
    act(() => result.current.openEdit(target));
    expect(result.current.editing?.id).toBe(target.id);

    let firstPatchPromise!: Promise<boolean>;
    act(() => {
      firstPatchPromise = result.current.update({ ...toNumberingForm(target), padding: "6" });
    });
    expect(patchSpy).toHaveBeenCalledTimes(1);
    expect(result.current.isSubmitting).toBe(true);

    // Scope A -> B (tenantWide manage narrowed to company-only).
    authState.user = {
      ...defaultUser(),
      permissionScopes: {
        "numbering.read": { tenantWide: true, companyIds: [], branchIds: [] },
        "numbering.manage": { tenantWide: false, companyIds: [alphaCompanyId], branchIds: [] },
      },
    };
    rerender();
    expect(result.current.editing).toBeNull();
    expect(result.current.isSubmitting).toBe(false);

    // Scope B -> A (exact original user + generation, so authFenceKey string matches A again).
    authState.user = defaultUser();
    rerender();
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.editing).toBeNull();
    expect(result.current.isSubmitting).toBe(false);

    // Start newer edit write under restored A while first write is still pending.
    act(() => result.current.openEdit(result.current.items[0]!));
    let secondPatchPromise!: Promise<boolean>;
    act(() => {
      secondPatchPromise = result.current.update({ ...toNumberingForm(target), padding: "7" });
    });
    expect(patchSpy).toHaveBeenCalledTimes(2);
    expect(result.current.isSubmitting).toBe(true);

    await act(async () => {
      resolveFirstPatch?.(
        okResponse({ success: true, statusCode: 200, data: { ...companyScopedRow, padding: 6 }, correlationId }),
      );
      expect(await firstPatchPromise).toBe(false);
    });
    expect(toastSpy).not.toHaveBeenCalled();
    expect(result.current.editing?.id).toBe(target.id);
    expect(result.current.isSubmitting).toBe(true);

    await act(async () => {
      expect(await result.current.update({ ...toNumberingForm(target), padding: "8" })).toBe(false);
    });
    expect(patchSpy).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveSecondPatch?.(
        okResponse({ success: true, statusCode: 200, data: { ...companyScopedRow, padding: 7 }, correlationId }),
      );
      expect(await secondPatchPromise).toBe(true);
    });
    expect(result.current.editing).toBeNull();
    expect(result.current.isSubmitting).toBe(false);
    expect(toastSpy).toHaveBeenCalledTimes(1);
  });

  it.each(["resolve", "reject"] as const)(
    "disposes in-flight write on unmount (%s) and permanently dismisses write 403 while preserving 404 edit NotFoundState",
    async (unmountOutcome) => {
      const toastSpy = vi.spyOn(sonnerToast, "custom").mockImplementation(() => "toast-id");
      let numberingReads = 0;
      vi.spyOn(axiosClient, "get").mockImplementation(async (url) => {
        if (url.startsWith("/api/tenant/core/v1/organization/companies")) return companiesEnvelope();
        numberingReads += 1;
        return pageEnvelope([companyScopedRow]);
      });

      let resolveUnmountedPatch: ((value: AxiosResponse<unknown>) => void) | null = null;
      let rejectUnmountedPatch: ((reason: unknown) => void) | null = null;
      const patchSpy = vi.spyOn(axiosClient, "patch").mockImplementationOnce(
        () =>
          new Promise<AxiosResponse<unknown>>((resolve, reject) => {
            resolveUnmountedPatch = resolve;
            rejectUnmountedPatch = reject;
          }),
      );

      await setLanguage("en");
      const firstHook = renderHook(() => useNumberingSequences(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <I18nProvider initialLanguage="en"><TooltipProvider>{children}</TooltipProvider></I18nProvider>
        ),
      });
      await waitFor(() => expect(firstHook.result.current.items).toHaveLength(1));

      const target = firstHook.result.current.items[0]!;
      act(() => firstHook.result.current.openEdit(target));
      let unmountedWritePromise!: Promise<boolean>;
      act(() => {
        unmountedWritePromise = firstHook.result.current.update({ ...toNumberingForm(target), padding: "6" });
      });
      expect(firstHook.result.current.isSubmitting).toBe(true);
      const readsBeforeUnmount = numberingReads;

      firstHook.unmount();

      await act(async () => {
        if (unmountOutcome === "resolve") {
          resolveUnmountedPatch?.(
            okResponse({ success: true, statusCode: 200, data: { ...companyScopedRow, padding: 6 }, correlationId }),
          );
        } else {
          rejectUnmountedPatch?.(
            new TenantApiClientError("Unprocessable", {
              status: 422, statusText: "Unprocessable Entity", headers: new Headers(),
              data: { success: false, statusCode: 422, errorCode: SEQUENCE_VALUE_INVALID_CODE, correlationId },
            }),
          );
        }
        expect(await unmountedWritePromise).toBe(false);
      });
      expect(toastSpy).not.toHaveBeenCalled();
      expect(numberingReads).toBe(readsBeforeUnmount);

      // Verify direct write 403 permanently dismisses private state + feedback, whereas 404 preserves edit NotFoundState.
      patchSpy
        .mockRejectedValueOnce(
          new TenantApiClientError("Conflict", {
            status: 409, statusText: "Conflict", headers: new Headers(),
            data: { success: false, statusCode: 409, errorCode: SEQUENCE_CODE_TAKEN_CODE, correlationId },
          }),
        )
        .mockRejectedValueOnce(
          new TenantApiClientError("Forbidden", {
            status: 403, statusText: "Forbidden", headers: new Headers(),
            data: { success: false, statusCode: 403, errorCode: "FORBIDDEN", correlationId },
          }),
        )
        .mockRejectedValueOnce(
          new TenantApiClientError("Not found", {
            status: 404, statusText: "Not Found", headers: new Headers(),
            data: { success: false, statusCode: 404, errorCode: SEQUENCE_NOT_FOUND_CODE, correlationId },
          }),
        );

      const secondHook = renderHook(() => useNumberingSequences(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <I18nProvider initialLanguage="en"><TooltipProvider>{children}</TooltipProvider></I18nProvider>
        ),
      });
      await waitFor(() => expect(secondHook.result.current.items).toHaveLength(1));

      const row = secondHook.result.current.items[0]!;
      act(() => secondHook.result.current.openEdit(row));
      await act(async () => {
        expect(await secondHook.result.current.update({ ...toNumberingForm(row), padding: "6" })).toBe(false);
      });
      expect(secondHook.result.current.formError).toBeTruthy();

      await act(async () => {
        expect(await secondHook.result.current.update({ ...toNumberingForm(row), padding: "7" })).toBe(false);
      });
      expect(secondHook.result.current.editing).toBeNull();
      expect(secondHook.result.current.editingNotFound).toBe(false);
      expect(secondHook.result.current.formError).toBeNull();
      expect(secondHook.result.current.formFieldErrors).toEqual({});
      expect(secondHook.result.current.isSubmitting).toBe(false);

      await act(async () => { await secondHook.result.current.reload(); });
      expect(secondHook.result.current.editing).toBeNull();

      act(() => secondHook.result.current.openEdit(secondHook.result.current.items[0]!));
      await act(async () => {
        expect(await secondHook.result.current.update({ ...toNumberingForm(row), padding: "8" })).toBe(false);
      });
      expect(secondHook.result.current.editing?.id).toBe(row.id);
      expect(secondHook.result.current.editingNotFound).toBe(true);
    },
  );

  it("retains readable rows on same-query transient refresh failure with working retry, and clears private rows on 403 refresh", async () => {
    let listAttempt = 0;
    vi.spyOn(axiosClient, "get").mockImplementation(async (url) => {
      if (url.startsWith("/api/tenant/core/v1/organization/companies")) return companiesEnvelope();
      listAttempt += 1;
      if (listAttempt === 1) {
        return pageEnvelope([tenantWideRow, companyScopedRow]);
      }
      if (listAttempt === 2) {
        throw new TypeError("Failed to fetch");
      }
      if (listAttempt === 3) {
        return pageEnvelope([companyScopedRow]);
      }
      throw new TenantApiClientError("Forbidden", {
        status: 403,
        statusText: "Forbidden",
        headers: new Headers(),
        data: { success: false, statusCode: 403, errorCode: "FORBIDDEN", correlationId },
      });
    });

    await renderPage("en");
    expect(await screen.findByText("SALES_INVOICE")).toBeInTheDocument();
    expect(screen.getByText("INV-00043")).toBeInTheDocument();
    expect(screen.getByText("BIG-9007199254740993")).toBeInTheDocument();
    expect(screen.getByText(en.coreSettings.numberingTenantWide)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: en.coreSettings.reload }));

    const refreshAlert = await screen.findByRole("alert");
    expect(refreshAlert).toHaveTextContent(en.coreSettings.numberingLoadFailed);
    expect(refreshAlert).toHaveTextContent(en.coreIdentity.errors.OFFLINE);
    expect(refreshAlert.textContent).not.toMatch(/Failed to fetch/iu);
    expect(screen.getByText("SALES_INVOICE")).toBeInTheDocument();
    expect(screen.getByText("INV-00043")).toBeInTheDocument();
    expect(screen.getByText("BIG-9007199254740993")).toBeInTheDocument();
    expect(screen.queryByText(en.coreSettings.numberingEmpty)).toBeNull();

    fireEvent.click(within(refreshAlert).getByRole("button", { name: en.common.retry }));
    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.queryByText("BIG-9007199254740993")).toBeNull();
    });
    expect(screen.getByText("SALES_INVOICE")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: en.coreSettings.reload }));
    expect(await screen.findByText(en.permissionGate.title)).toBeInTheDocument();
    expect(screen.queryByText("SALES_INVOICE")).toBeNull();
    expect(screen.queryByText("INV-00043")).toBeNull();
  });

  it("hides old rows with a truthful loading boundary during deferred filter/page changes and renders ErrorState on rejection", async () => {
    let listAttempt = 0;
    let rejectFiltered: ((reason: unknown) => void) | null = null;
    let rejectPaged: ((reason: unknown) => void) | null = null;

    vi.spyOn(axiosClient, "get").mockImplementation((url) => {
      if (url.startsWith("/api/tenant/core/v1/organization/companies")) {
        return Promise.resolve(companiesEnvelope());
      }
      listAttempt += 1;
      if (listAttempt === 1) {
        return Promise.resolve(
          pageEnvelope([companyScopedRow], { page: 1, limit: 20, total: 25, totalPages: 2, hasNext: true }),
        );
      }
      if (listAttempt === 2) {
        return new Promise<AxiosResponse<unknown>>((_resolve, reject) => {
          rejectFiltered = reject;
        });
      }
      if (listAttempt === 3) {
        return Promise.resolve(
          pageEnvelope([companyScopedRow], { page: 1, limit: 20, total: 25, totalPages: 2, hasNext: true }),
        );
      }
      return new Promise<AxiosResponse<unknown>>((_resolve, reject) => {
        rejectPaged = reject;
      });
    });

    await renderPage("en");
    expect(await screen.findByText("SALES_INVOICE")).toBeInTheDocument();

    const companyCombo = screen.getByRole("combobox", { name: en.coreIdentity.cascade.company });
    fireEvent.click(companyCombo);
    fireEvent.click(await screen.findByRole("option", { name: "Alpha Trading" }));

    await waitFor(() => expect(listAttempt).toBe(2));
    expect(screen.queryByText("SALES_INVOICE")).toBeNull();
    expect(screen.queryByText(en.coreSettings.numberingEmpty)).toBeNull();
    expect(screen.queryByText(en.coreSettings.numberingLoadFailed)).toBeNull();
    expect(
      within(screen.getByRole("table")).queryByRole("columnheader", {
        name: en.coreSettings.numberingCode,
      }),
    ).toBeNull();

    await act(async () => {
      rejectFiltered?.(
        new TenantApiClientError("Upstream failure", {
          status: 503,
          statusText: "Service Unavailable",
          headers: new Headers(),
          data: { success: false, statusCode: 503, correlationId },
        }),
      );
    });

    expect(await screen.findByText(en.coreSettings.numberingLoadFailed)).toBeInTheDocument();
    expect(screen.queryByText("SALES_INVOICE")).toBeNull();
    expect(screen.queryByText(en.coreSettings.numberingEmpty)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: en.common.retry }));
    expect(await screen.findByText("SALES_INVOICE")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: en.common.nextPage }));
    await waitFor(() => expect(listAttempt).toBe(4));
    expect(screen.queryByText("SALES_INVOICE")).toBeNull();
    expect(screen.queryByText(en.coreSettings.numberingEmpty)).toBeNull();

    await act(async () => {
      rejectPaged?.(new TypeError("Failed to fetch"));
    });

    expect(await screen.findByText(en.coreSettings.numberingLoadFailed)).toBeInTheDocument();
    expect(screen.getByText(en.coreIdentity.errors.OFFLINE)).toBeInTheDocument();
    expect(screen.queryByText("SALES_INVOICE")).toBeNull();
    expect(screen.queryByText(en.coreSettings.numberingEmpty)).toBeNull();
  });

  it("clears private rows, closes open modals, and fences late read/write completions across auth generation and scope rotation", async () => {
    const toastSpy = vi.spyOn(sonnerToast, "custom").mockImplementation(() => "toast-id");
    let listAttempt = 0;
    let resolveStaleRead: ((value: AxiosResponse<unknown>) => void) | null = null;
    let resolveRotatedRead: ((value: AxiosResponse<unknown>) => void) | null = null;
    let resolveStalePost: ((value: AxiosResponse<unknown>) => void) | null = null;

    vi.spyOn(axiosClient, "get").mockImplementation((url) => {
      if (url.startsWith("/api/tenant/core/v1/organization/companies")) {
        return Promise.resolve(companiesEnvelope());
      }
      listAttempt += 1;
      if (listAttempt === 1) {
        return Promise.resolve(pageEnvelope([companyScopedRow]));
      }
      if (listAttempt === 2) {
        return new Promise<AxiosResponse<unknown>>((resolve) => {
          resolveStaleRead = resolve;
        });
      }
      return new Promise<AxiosResponse<unknown>>((resolve) => {
        resolveRotatedRead = resolve;
      });
    });

    const postSpy = vi.spyOn(axiosClient, "post").mockImplementation(
      () =>
        new Promise<AxiosResponse<unknown>>((resolve) => {
          resolveStalePost = resolve;
        }),
    );

    const { rerender } = await renderPage("en");
    expect(await screen.findByText("SALES_INVOICE")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: en.coreSettings.reload }));
    await waitFor(() => expect(listAttempt).toBe(2));

    fireEvent.click(screen.getByRole("button", { name: en.coreSettings.numberingCreate }));
    const dialog = await screen.findByRole("dialog", { name: en.coreSettings.numberingCreateTitle });
    fireEvent.change(within(dialog).getByRole("textbox", { name: en.coreSettings.numberingCode }), {
      target: { value: "STALE_SEQ" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: en.coreSettings.save }));
    expect(postSpy).toHaveBeenCalledOnce();

    authState.realtimeAuthGeneration = "gen-2";
    authState.user = {
      id: "01902001-3000-7000-8000-0000000000a9",
      permissions: ["numbering.read", "numbering.manage"],
      permissionScopes: {
        "numbering.read": { tenantWide: false, companyIds: [alphaCompanyId], branchIds: [] },
        "numbering.manage": { tenantWide: false, companyIds: [alphaCompanyId], branchIds: [] },
      },
    };
    rerender(pageProvidersUi("en"));

    await waitFor(() => expect(listAttempt).toBe(3));
    expect(screen.queryByText("SALES_INVOICE")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText(en.coreSettings.numberingEmpty)).toBeNull();
    expect(
      within(screen.getByRole("table")).queryByRole("columnheader", {
        name: en.coreSettings.numberingCode,
      }),
    ).toBeNull();

    await act(async () => {
      resolveStaleRead?.(pageEnvelope([tenantWideRow]));
      resolveStalePost?.(
        okResponse({ success: true, statusCode: 201, data: tenantWideRow, correlationId }, 201),
      );
    });

    expect(screen.queryByText("QUOTE")).toBeNull();
    expect(toastSpy).not.toHaveBeenCalled();

    await act(async () => {
      resolveRotatedRead?.(pageEnvelope([]));
    });

    expect(await screen.findByText(en.coreSettings.numberingEmpty)).toBeInTheDocument();
    expect(screen.queryByText("QUOTE")).toBeNull();
    expect(screen.queryByText("SALES_INVOICE")).toBeNull();
  });

  it("aborts superseded in-flight list requests so stale responses never overwrite newer state", async () => {
    let resolveFirst: ((value: AxiosResponse<unknown>) => void) | null = null;
    let firstSignal: AbortSignal | undefined;
    let callCount = 0;

    vi.spyOn(axiosClient, "get").mockImplementation((url, config) => {
      if (url.startsWith("/api/tenant/core/v1/organization/companies")) {
        return Promise.resolve(companiesEnvelope([]));
      }
      callCount += 1;
      if (callCount === 1) {
        firstSignal = config?.signal ?? undefined;
        return new Promise<AxiosResponse<unknown>>((resolve) => {
          resolveFirst = resolve;
        });
      }
      return Promise.resolve(pageEnvelope([companyScopedRow]));
    });

    await renderPage("en");
    await waitFor(() => expect(callCount).toBe(1));

    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });

    expect(await screen.findByText("SALES_INVOICE")).toBeInTheDocument();
    expect(firstSignal?.aborted).toBe(true);

    await act(async () => {
      resolveFirst?.(pageEnvelope([tenantWideRow]));
    });
    expect(screen.getByText("SALES_INVOICE")).toBeInTheDocument();
    expect(screen.queryByText("QUOTE")).toBeNull();
  });
});

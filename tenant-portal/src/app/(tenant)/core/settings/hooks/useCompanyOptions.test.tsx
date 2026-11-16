// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import {
  TenantApiClientError, axiosClient, type AxiosResponse, type TenantApiRequestConfig,
} from "@/lib/api/axiosClient";
import { companyLabel } from "../company-options";
import { useCompanyOptions } from "./useCompanyOptions";

interface MockPermissionScope { tenantWide: boolean; companyIds: string[]; branchIds: string[] }

const authState = vi.hoisted(() => ({
  user: {
    permissions: ["taxes.tax.manage"] as string[],
    permissionScopes: {
      "taxes.tax.manage": {
        tenantWide: false, companyIds: ["01902001-3000-7000-8000-000000000001"], branchIds: [],
      },
    } as Record<string, MockPermissionScope>,
  },
}));

vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => authState }));

function company(index: number) {
  return {
    id: `01902001-3000-7000-8000-${String(index).padStart(12, "0")}`,
    code: `C${index}`,
    name: `Company ${index}`,
  };
}

function wireCompany(index: number) {
  return {
    ...company(index), legalName: null, taxNumber: null, currencyCode: "SAR", status: "ACTIVE",
    createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z",
  };
}

function ordinaryAbortError(): Error {
  const error = new Error("The operation was aborted.");
  error.name = "AbortError";
  return error;
}

function rejectOnSignalAbort(_path: string, config?: TenantApiRequestConfig): Promise<AxiosResponse<unknown>> {
  return new Promise((_, reject) => {
    if (config?.signal?.aborted) return reject(ordinaryAbortError());
    config?.signal?.addEventListener("abort", () => reject(ordinaryAbortError()), { once: true });
  });
}

function page(total: number, pageNumber: number, itemsOverride?: unknown): AxiosResponse<unknown> {
  const limit = 100;
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  const start = (pageNumber - 1) * limit;
  const count = Math.max(0, Math.min(limit, total - start));
  const data = itemsOverride ?? Array.from({ length: count }, (_, i) => wireCompany(start + i + 1));
  return {
    data: {
      success: true, status: "SUCCESS", statusCode: 200,
      code: "ORG_COMPANIES_LISTED", message: "Companies retrieved.", data,
      meta: {
        page: pageNumber, limit, total, totalPages,
        hasNext: pageNumber < totalPages, hasPrev: pageNumber > 1 && totalPages > 0,
      },
      correlationId: "01902001-3000-7000-8000-000000009999", timestamp: "2026-11-01T10:00:00.000Z",
    },
    status: 200, statusText: "OK", headers: new Headers(),
  };
}

beforeEach(() => {
  authState.user = {
    permissions: ["taxes.tax.manage"],
    permissionScopes: { "taxes.tax.manage": { tenantWide: false, companyIds: [company(1).id], branchIds: [] } },
  };
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("settings company choices", () => {
  it("loads 250 companies in sequential pages of 100 from the Core HTTP envelope and projects scope", async () => {
    let finishFirst!: (value: AxiosResponse<unknown>) => void;
    const getSpy = vi
      .spyOn(axiosClient, "get")
      .mockImplementationOnce(() => new Promise((resolve) => { finishFirst = resolve; }))
      .mockResolvedValueOnce(page(250, 2))
      .mockResolvedValueOnce(page(250, 3));

    const { result } = renderHook(() => useCompanyOptions("taxes.tax.manage"));
    await waitFor(() => expect(getSpy).toHaveBeenCalledTimes(1));
    expect(result.current.companies).toEqual([]);

    await act(async () => { finishFirst(page(250, 1)); });
    await waitFor(() => expect(result.current.companies).toHaveLength(250));
    expect(
      getSpy.mock.calls.map(([path]) => new URL(path, "https://tenant.test").searchParams.get("page")),
    ).toEqual(["1", "2", "3"]);
    expect(result.current.companies[249]).toEqual(company(250));
    expect(result.current.manageableCompanies).toEqual([company(1)]);
    expect(result.current.tenantWideAllowed).toBe(false);
    expect(result.current.canManageScope(company(1).id)).toBe(true);
    expect(result.current.canManageScope(company(2).id)).toBe(false);
    expect(result.current.canManageScope(null)).toBe(false);
    expect(result.current.loadError).toBeNull();
    expect(result.current.isTruncated).toBe(false);
    expect(result.current.canCreate).toBe(true);

    for (const [path, config] of getSpy.mock.calls) {
      const url = new URL(path, "https://tenant.test");
      expect(url.pathname).toBe("/api/tenant/core/v1/organization/companies");
      expect(Object.fromEntries(url.searchParams.entries())).toMatchObject({
        limit: "100", status: "ACTIVE", sortBy: "name", sortDir: "ASC",
      });
      expect(config).toMatchObject({
        signal: expect.any(AbortSignal), suppressForbiddenToast: true, cache: "no-store",
      });
    }
  });

  it("withholds partial pages when a later page fails and publishes completely on retry", async () => {
    const getSpy = vi.spyOn(axiosClient, "get")
      .mockResolvedValueOnce(page(250, 1))
      .mockRejectedValueOnce(new Error("Network Error"));

    const { result } = renderHook(() => useCompanyOptions("taxes.tax.manage"));
    await waitFor(() => expect(result.current.loadError).not.toBeNull());
    expect(result.current.companies).toEqual([]);
    expect(result.current.canCreate).toBe(false);
    expect(result.current.loadError).toMatchObject({ status: 0 });

    getSpy.mockResolvedValueOnce(page(250, 1)).mockResolvedValueOnce(page(250, 2)).mockResolvedValueOnce(page(250, 3));
    await act(async () => { await result.current.retry(); });
    expect(result.current.companies).toHaveLength(250);
    expect(result.current.loadError).toBeNull();
    expect(result.current.canCreate).toBe(true);
  });

  it("keeps successful choices and create scope when a refresh fails", async () => {
    const getSpy = vi.spyOn(axiosClient, "get").mockResolvedValueOnce(page(1, 1));
    const { result } = renderHook(() => useCompanyOptions("taxes.tax.manage"));
    await waitFor(() => expect(result.current.companies).toHaveLength(1));

    getSpy.mockRejectedValueOnce(new Error("Network Error"));
    await act(async () => { await result.current.retry(); });
    expect(result.current.companies).toEqual([company(1)]);
    expect(result.current.canCreate).toBe(true);
    expect(result.current.loadError).not.toBeNull();
  });

  it.each([1_000, 1_250])("bounds a %i-company listing to ten requests of 100", async (total) => {
    const getSpy = vi.spyOn(axiosClient, "get").mockImplementation(async (path: string) =>
      page(total, Number(new URL(path, "https://tenant.test").searchParams.get("page"))),
    );
    const { result } = renderHook(() => useCompanyOptions("taxes.tax.manage"));
    await waitFor(() => expect(result.current.companies).toHaveLength(1_000));
    expect(getSpy).toHaveBeenCalledTimes(10);
    expect(result.current.isTruncated).toBe(total > 1_000);
  });

  it("rejects prematurely short pages and legacy non-envelope shapes", async () => {
    const getSpy = vi.spyOn(axiosClient, "get").mockResolvedValueOnce(page(250, 1, []));
    const { result } = renderHook(() => useCompanyOptions("taxes.tax.manage"));
    await waitFor(() => expect(result.current.loadError).not.toBeNull());
    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(result.current.companies).toEqual([]);

    getSpy.mockResolvedValueOnce({
      data: { items: [wireCompany(1)], total: 1 }, status: 200, statusText: "OK", headers: new Headers(),
    });
    await act(async () => { await result.current.retry(); });
    expect(result.current.loadError).not.toBeNull();
    expect(result.current.companies).toEqual([]);
  });

  it("aborts on unmount and never requests the next page", async () => {
    let finish!: (value: AxiosResponse<unknown>) => void;
    const getSpy = vi.spyOn(axiosClient, "get")
      .mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const { unmount } = renderHook(() => useCompanyOptions("taxes.tax.manage"));
    await waitFor(() => expect(getSpy).toHaveBeenCalledTimes(1));
    const signal = getSpy.mock.calls[0][1]?.signal as AbortSignal;
    unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => { finish(page(250, 1)); });
    expect(getSpy).toHaveBeenCalledTimes(1);
  });

  it("cancels an overlapping read before retry and ignores its late result", async () => {
    let finish!: (value: AxiosResponse<unknown>) => void;
    const getSpy = vi.spyOn(axiosClient, "get")
      .mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }))
      .mockResolvedValueOnce(page(1, 1));
    const { result } = renderHook(() => useCompanyOptions("taxes.tax.manage"));
    await waitFor(() => expect(getSpy).toHaveBeenCalledTimes(1));
    const signal = getSpy.mock.calls[0][1]?.signal as AbortSignal;
    await act(async () => { await result.current.retry(); });
    expect(signal.aborted).toBe(true);
    await act(async () => { finish(page(250, 1)); });
    expect(result.current.companies).toEqual([company(1)]);
    expect(result.current.loadError).toBeNull();
    expect(getSpy).toHaveBeenCalledTimes(2);
  });

  it("ignores ordinary Error AbortError rejections on active retry and mid-page unmount", async () => {
    expect(ordinaryAbortError()).not.toBeInstanceOf(DOMException);
    const getSpy = vi.spyOn(axiosClient, "get")
      .mockResolvedValueOnce(page(1, 1))
      .mockRejectedValueOnce(ordinaryAbortError())
      .mockResolvedValueOnce(page(250, 1))
      .mockImplementationOnce(rejectOnSignalAbort);
    const { result, unmount } = renderHook(() => useCompanyOptions("taxes.tax.manage"));
    await waitFor(() => expect(result.current.companies).toEqual([company(1)]));
    await act(async () => { await result.current.retry(); });
    expect(result.current.loadError).toBeNull();
    expect(result.current.companies).toEqual([company(1)]);

    let pendingRetry!: Promise<void>;
    act(() => { pendingRetry = result.current.retry(); });
    await waitFor(() => expect(getSpy).toHaveBeenCalledTimes(4));
    expect(result.current.companies).toEqual([company(1)]);
    const pageTwoSignal = getSpy.mock.calls[3][1]?.signal as AbortSignal;
    unmount();
    expect(pageTwoSignal.aborted).toBe(true);
    await act(async () => { await pendingRetry; });
    expect(getSpy).toHaveBeenCalledTimes(4);
  });

  it("cancels a mid-page retry rejecting with ordinary AbortError and publishes the newer retry", async () => {
    const getSpy = vi.spyOn(axiosClient, "get")
      .mockResolvedValueOnce(page(1, 1))
      .mockResolvedValueOnce(page(250, 1))
      .mockImplementationOnce(rejectOnSignalAbort)
      .mockResolvedValueOnce(page(2, 1));
    const { result } = renderHook(() => useCompanyOptions("taxes.tax.manage"));
    await waitFor(() => expect(result.current.companies).toEqual([company(1)]));

    let supersededRetry!: Promise<void>;
    act(() => { supersededRetry = result.current.retry(); });
    await waitFor(() => expect(getSpy).toHaveBeenCalledTimes(3));
    const supersededSignal = getSpy.mock.calls[2][1]?.signal as AbortSignal;
    await act(async () => { await Promise.all([result.current.retry(), supersededRetry]); });
    expect(supersededSignal.aborted).toBe(true);
    expect(result.current.companies).toEqual([company(1), company(2)]);
    expect(result.current.loadError).toBeNull();
    expect(getSpy).toHaveBeenCalledTimes(4);
  });

  it("preserves tenant-wide create authority when organization company read is forbidden", async () => {
    authState.user = {
      permissions: ["taxes.tax.manage"],
      permissionScopes: { "taxes.tax.manage": { tenantWide: true, companyIds: [], branchIds: [] } },
    };
    vi.spyOn(axiosClient, "get").mockRejectedValueOnce(new TenantApiClientError("Forbidden", {
      status: 403, statusText: "Forbidden", headers: new Headers(),
      data: { errorCode: "MISSING_REQUIRED_PERMISSIONS", message: "Forbidden" },
    }));
    const { result } = renderHook(() => useCompanyOptions("taxes.tax.manage"));
    await waitFor(() => expect(result.current.loadError).not.toBeNull());
    expect(result.current.loadError).toMatchObject({ status: 403, code: "MISSING_REQUIRED_PERMISSIONS" });
    expect(result.current.companies).toEqual([]);
    expect(result.current.tenantWideAllowed).toBe(true);
    expect(result.current.canManageScope(null)).toBe(true);
    expect(result.current.canManageScope(company(1).id)).toBe(true);
    expect(result.current.canCreate).toBe(true);
  });

  it("denies write scope when the user holds read-only permission despite loaded companies", async () => {
    authState.user = {
      permissions: ["taxes.tax.read"],
      permissionScopes: { "taxes.tax.read": { tenantWide: true, companyIds: [], branchIds: [] } },
    };
    vi.spyOn(axiosClient, "get").mockResolvedValueOnce(page(2, 1));
    const { result } = renderHook(() => useCompanyOptions("taxes.tax.manage"));
    await waitFor(() => expect(result.current.companies).toHaveLength(2));
    expect(result.current.manageableCompanies).toEqual([]);
    expect(result.current.tenantWideAllowed).toBe(false);
    expect(result.current.canManageScope(null)).toBe(false);
    expect(result.current.canManageScope(company(1).id)).toBe(false);
    expect(result.current.canCreate).toBe(false);
  });

  it.each([en, ar])("uses the localized unknown-company label instead of a UUID", (t) => {
    expect(companyLabel([], company(1).id, t.coreSettings.taxTenantWide, t.coreSettings.unknownCompany))
      .toBe(t.coreSettings.unknownCompany);
    expect(companyLabel([], null, t.coreSettings.taxTenantWide, t.coreSettings.unknownCompany))
      .toBe(t.coreSettings.taxTenantWide);
  });
});

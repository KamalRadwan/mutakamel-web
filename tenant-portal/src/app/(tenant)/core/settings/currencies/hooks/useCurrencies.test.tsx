// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { axiosClient, TenantApiClientError, type AxiosResponse } from "@/lib/api/axiosClient";
import type { PermissionScope } from "@/lib/auth/permission-scope";
import { CURRENCY_PAGE_SIZE, currenciesListPath, currencyPath, type Currency } from "../currency-contract";
import { useCurrencies } from "./useCurrencies";

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

const { toast, authState } = vi.hoisted(() => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    errorFromApi: vi.fn(),
    outcomeFromApi: vi.fn(),
  },
  authState: {
    user: {
      id: "01902001-3000-7000-8000-000000000001",
      isTenantOwner: false,
      permissions: ["currencies.currency.read", "currencies.currency.manage"],
      permissionScopes: {
        "currencies.currency.read": { tenantWide: true, companyIds: [], branchIds: [] },
        "currencies.currency.manage": { tenantWide: true, companyIds: [], branchIds: [] },
      },
    } as MockAuthUser | null,
    realtimeAuthGeneration: "gen-1" as string | null,
    isAuthenticated: true,
    isLoading: false,
  },
}));

vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => authState }));
vi.mock("@/design-system", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/design-system")>();
  return { ...actual, useToast: () => toast };
});
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));

beforeEach(() => {
  vi.clearAllMocks();
  authState.user = defaultUser();
  authState.realtimeAuthGeneration = "gen-1";
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const currencies: Currency[] = Array.from({ length: 41 }, (_, index) => ({
  id: `01902001-3000-7000-8000-${String(index + 1).padStart(12, "0")}`,
  code: "EUR",
  name: `Currency ${index + 1}`,
  symbol: null,
  decimalPlaces: 2,
  isDefault: false,
  exchangeRate: "0.92345678",
  status: "ACTIVE",
  updatedAt: "2026-08-25T10:05:00.000Z",
}));

function isBaseCurrencyUrl(url: string): boolean {
  const query = new URL(url, "https://portal.example").searchParams;
  return query.get("limit") === "1" && query.get("isDefault") === "true";
}

function emptyBaseResponse(): AxiosResponse<unknown> {
  return {
    status: 200,
    statusText: "OK",
    headers: new Headers(),
    data: {
      success: true,
      status: "SUCCESS",
      statusCode: 200,
      data: [],
      meta: { page: 1, limit: 1, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
    },
  };
}

describe("useCurrencies pagination recovery", () => {
  it.each([
    { before: 21, after: 20 },
    { before: 41, after: 40 },
    { before: 21, after: 0 },
  ])("reloads the last valid filtered page when total falls from $before to $after", async ({ before, after }) => {
    let total = before;
    const getSpy = vi.spyOn(axiosClient, "get").mockImplementation(async (url) => {
      if (isBaseCurrencyUrl(url)) return emptyBaseResponse();
      const query = new URL(url, "https://portal.example").searchParams;
      const page = Number(query.get("page"));
      const start = (page - 1) * CURRENCY_PAGE_SIZE;
      const slice = currencies.slice(start, Math.min(start + CURRENCY_PAGE_SIZE, total));
      const totalPages = total === 0 ? 0 : Math.ceil(total / CURRENCY_PAGE_SIZE);
      return {
        status: 200,
        statusText: "OK",
        headers: new Headers(),
        data: {
          success: true,
          status: "SUCCESS",
          statusCode: 200,
          data: slice,
          meta: {
            page,
            limit: CURRENCY_PAGE_SIZE,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
        },
      };
    });
    const deleteSpy = vi.spyOn(axiosClient, "delete").mockImplementation(async () => {
      total = after;
      return { status: 204, statusText: "No Content", headers: new Headers(), data: null };
    });

    const { result } = renderHook(() => useCurrencies());
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    act(() => {
      result.current.setStatusFilter("ACTIVE");
      result.current.setSearch("Currency");
      result.current.setSort({ id: "name", direction: "desc" });
    });
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    const originalPage = Math.ceil(before / CURRENCY_PAGE_SIZE);
    act(() => result.current.setPage(originalPage));
    await waitFor(() => {
      expect(result.current.isRefreshing).toBe(false);
      expect(result.current.items).toHaveLength(1);
    });
    const target = result.current.items[0]!;
    act(() => result.current.openDeactivate(target));
    await act(async () => {
      await result.current.deactivate();
    });

    const lastPage = Math.max(1, Math.ceil(after / CURRENCY_PAGE_SIZE));
    await waitFor(() => {
      expect(result.current.isRefreshing).toBe(false);
      expect(result.current.pageInfo).toEqual({ page: lastPage, limit: CURRENCY_PAGE_SIZE, total: after });
      expect(result.current.items).toHaveLength(Math.min(after, CURRENCY_PAGE_SIZE));
    });
    expect(deleteSpy).toHaveBeenCalledWith(
      currencyPath(target.id),
      expect.objectContaining({ cache: "no-store", maxResponseBytes: 10_000 }),
    );
    expect(getSpy).toHaveBeenLastCalledWith(
      currenciesListPath(lastPage, "ACTIVE", "Currency", "name", "DESC"),
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        cache: "no-store",
        suppressForbiddenToast: true,
        maxResponseBytes: 400_000,
      }),
    );
    expect(result.current.statusFilter).toBe("ACTIVE");
    expect(result.current.search).toBe("Currency");
    expect(result.current.sort).toEqual({ id: "name", direction: "desc" });
    expect(result.current.queryError).toBeNull();
  });
});

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function pageResponse(rows: Currency[], total = rows.length, page = 1): AxiosResponse<unknown> {
  const totalPages = total === 0 ? 0 : Math.ceil(total / CURRENCY_PAGE_SIZE);
  const meta = { page, limit: CURRENCY_PAGE_SIZE, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 };
  return {
    status: 200, statusText: "OK", headers: new Headers(),
    data: { success: true, status: "SUCCESS", statusCode: 200, data: rows, meta },
  };
}

describe("useCurrencies latest-request ownership", () => {
  const initialRow: Currency = currencies[0]!;
  const filteredRow: Currency = { ...currencies[1]!, code: "CHF", name: "Swiss Franc", status: "INACTIVE" };
  const staleRow: Currency = { ...currencies[2]!, code: "GBP", name: "Stale Pound", status: "ACTIVE" };

  it("aborts a manual refresh when a newer filter starts so stale rows cannot overwrite filtered state", async () => {
    const manualDeferred = createDeferred<AxiosResponse<unknown>>();
    const filterDeferred = createDeferred<AxiosResponse<unknown>>();
    let manualSignal: AbortSignal | undefined;
    let filterSignal: AbortSignal | undefined;
    let callCount = 0;

    vi.spyOn(axiosClient, "get").mockImplementation((url, config) => {
      if (isBaseCurrencyUrl(url)) return Promise.resolve(emptyBaseResponse());
      callCount += 1;
      if (callCount === 1) return Promise.resolve(pageResponse([initialRow]));
      if (callCount === 2) { manualSignal = config?.signal ?? undefined; return manualDeferred.promise; }
      filterSignal = config?.signal ?? undefined;
      return filterDeferred.promise;
    });

    const { result } = renderHook(() => useCurrencies());
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    expect(result.current.items).toEqual([initialRow]);

    act(() => { void result.current.reload(); });
    await waitFor(() => expect(manualSignal).toBeInstanceOf(AbortSignal));
    expect(result.current.isRefreshing).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.items).toEqual([initialRow]);

    act(() => { result.current.setStatusFilter("INACTIVE"); result.current.setSearch("CHF"); });
    await waitFor(() => expect(filterSignal).toBeInstanceOf(AbortSignal));
    expect(manualSignal?.aborted).toBe(true);
    expect(filterSignal?.aborted).toBe(false);

    await act(async () => { filterDeferred.resolve(pageResponse([filteredRow])); });
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    expect(result.current.items).toEqual([filteredRow]);
    expect(result.current.pageInfo.total).toBe(1);
    expect(result.current.queryError).toBeNull();

    await act(async () => { manualDeferred.resolve(pageResponse([initialRow, staleRow], 2)); });
    expect(result.current.items).toEqual([filteredRow]);
    expect(result.current.pageInfo.total).toBe(1);
    expect(result.current.queryError).toBeNull();
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it("prevents a superseded manual refresh failure from publishing stale error or clearing loading early, and preserves prior rows", async () => {
    const server500 = new TenantApiClientError("Internal crash", {
      status: 500, statusText: "Internal Server Error", headers: new Headers(),
      data: { success: false, status: "ERROR", statusCode: 500, errorCode: "INTERNAL_ERROR" },
    });
    const manualDeferred1 = createDeferred<AxiosResponse<unknown>>();
    const filterDeferred = createDeferred<AxiosResponse<unknown>>();
    const manualDeferred2 = createDeferred<AxiosResponse<unknown>>();
    let manualSignal1: AbortSignal | undefined;
    let manualSignal2: AbortSignal | undefined;
    let callCount = 0;

    vi.spyOn(axiosClient, "get").mockImplementation((url, config) => {
      if (isBaseCurrencyUrl(url)) return Promise.resolve(emptyBaseResponse());
      callCount += 1;
      if (callCount === 1) return Promise.resolve(pageResponse([initialRow]));
      if (callCount === 2) { manualSignal1 = config?.signal ?? undefined; return manualDeferred1.promise; }
      if (callCount === 3) return filterDeferred.promise;
      if (callCount === 4) { manualSignal2 = config?.signal ?? undefined; return manualDeferred2.promise; }
      if (callCount === 5) return Promise.resolve(pageResponse([initialRow]));
      return Promise.reject(server500);
    });

    const { result } = renderHook(() => useCurrencies());
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));

    act(() => { void result.current.reload(); });
    await waitFor(() => expect(manualSignal1).toBeInstanceOf(AbortSignal));
    act(() => { result.current.setStatusFilter("INACTIVE"); });
    await waitFor(() => expect(callCount).toBe(3));
    expect(manualSignal1?.aborted).toBe(true);

    // Stale manual failure settles while the newer filter request is still in flight.
    await act(async () => { manualDeferred1.reject(server500); });
    expect(result.current.queryError).toBeNull();
    expect(result.current.isRefreshing).toBe(true);
    expect(result.current.items).toEqual([initialRow]);

    await act(async () => { filterDeferred.resolve(pageResponse([filteredRow])); });
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    expect(result.current.items).toEqual([filteredRow]);
    expect(result.current.queryError).toBeNull();

    // Stale manual failure settles after a newer filter request has already completed.
    act(() => { void result.current.reload(); });
    await waitFor(() => expect(manualSignal2).toBeInstanceOf(AbortSignal));
    act(() => { result.current.setSearch("EUR"); });
    await waitFor(() => {
      expect(result.current.isRefreshing).toBe(false);
      expect(result.current.items).toEqual([initialRow]);
    });
    expect(manualSignal2?.aborted).toBe(true);

    await act(async () => { manualDeferred2.reject(server500); });
    expect(result.current.queryError).toBeNull();
    expect(result.current.items).toEqual([initialRow]);
    expect(result.current.isRefreshing).toBe(false);

    // Latest non-superseded failure publishes queryError while preserving prior rows.
    await act(async () => { await result.current.reload(); });
    expect(result.current.queryError?.status).toBe(500);
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.items).toEqual([initialRow]);
  });

  it("hides old visibleItems immediately on changed filter/sort while pending, then clears items and exits loading on rejection", async () => {
    const server500 = new TenantApiClientError("Filter failed", {
      status: 500, statusText: "Internal Server Error", headers: new Headers(),
      data: { success: false, status: "ERROR", statusCode: 500, errorCode: "INTERNAL_ERROR" },
    });
    const filterDeferred = createDeferred<AxiosResponse<unknown>>();
    const sortDeferred = createDeferred<AxiosResponse<unknown>>();
    let listCall = 0;

    vi.spyOn(axiosClient, "get").mockImplementation((url) => {
      if (isBaseCurrencyUrl(url)) return Promise.resolve(emptyBaseResponse());
      listCall += 1;
      if (listCall === 1) return Promise.resolve(pageResponse([initialRow], 25, 1));
      if (listCall === 2) return filterDeferred.promise;
      return sortDeferred.promise;
    });

    const { result } = renderHook(() => useCurrencies());
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    expect(result.current.visibleItems).toEqual([initialRow]);
    expect(result.current.hasRetainedRows).toBe(true);
    expect(result.current.isLoading).toBe(false);

    act(() => { result.current.setStatusFilter("INACTIVE"); });
    expect(result.current.visibleItems).toEqual([]);
    expect(result.current.visiblePageInfo.total).toBe(0);
    expect(result.current.hasRetainedRows).toBe(false);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.queryError).toBeNull();

    await waitFor(() => expect(listCall).toBe(2));
    await act(async () => { filterDeferred.reject(server500); });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.items).toEqual([]);
    expect(result.current.visibleItems).toEqual([]);
    expect(result.current.hasRetainedRows).toBe(false);
    expect(result.current.queryError?.status).toBe(500);

    act(() => { result.current.setSort({ id: "exchangeRate", direction: "desc" }); });
    expect(result.current.queryError).toBeNull();
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(listCall).toBe(3));
    await act(async () => { sortDeferred.resolve(pageResponse([filteredRow])); });
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.visibleItems).toEqual([filteredRow]);
    expect(result.current.queryError).toBeNull();
  });

  it("clears rows, open edit modal, and baseCurrency on auth generation/actor rotation and ignores deferred stale reads", async () => {
    const usdBaseRow: Currency = {
      ...initialRow,
      id: "01902001-3000-7000-8000-000000000099",
      code: "USD",
      name: "US Dollar",
      isDefault: true,
      exchangeRate: "1.00000000",
    };
    const staleListDeferred = createDeferred<AxiosResponse<unknown>>();
    const staleBaseDeferred = createDeferred<AxiosResponse<unknown>>();
    const nextListDeferred = createDeferred<AxiosResponse<unknown>>();
    const nextBaseDeferred = createDeferred<AxiosResponse<unknown>>();
    let staleListSignal: AbortSignal | undefined;
    let staleBaseSignal: AbortSignal | undefined;
    let listCalls = 0;
    let baseCalls = 0;

    vi.spyOn(axiosClient, "get").mockImplementation((url, config) => {
      if (isBaseCurrencyUrl(url)) {
        baseCalls += 1;
        if (baseCalls === 1) return Promise.resolve(pageResponse([usdBaseRow], 1));
        if (baseCalls === 2) { staleBaseSignal = config?.signal ?? undefined; return staleBaseDeferred.promise; }
        return nextBaseDeferred.promise;
      }
      listCalls += 1;
      if (listCalls === 1) return Promise.resolve(pageResponse([initialRow]));
      if (listCalls === 2) { staleListSignal = config?.signal ?? undefined; return staleListDeferred.promise; }
      return nextListDeferred.promise;
    });

    const { result, rerender } = renderHook(() => useCurrencies());
    await waitFor(() => {
      expect(result.current.isRefreshing).toBe(false);
      expect(result.current.baseStatus).toBe("ready");
    });
    act(() => { result.current.openEdit(initialRow); });
    expect(result.current.editing?.id).toBe(initialRow.id);
    expect(result.current.baseCurrency?.code).toBe("USD");

    act(() => { void result.current.reload(); });
    await waitFor(() => {
      expect(staleListSignal).toBeInstanceOf(AbortSignal);
      expect(staleBaseSignal).toBeInstanceOf(AbortSignal);
    });

    authState.realtimeAuthGeneration = "gen-2";
    authState.user = { ...defaultUser(), id: "01902001-3000-7000-8000-000000000002" };
    act(() => { rerender(); });

    expect(result.current.items).toEqual([]);
    expect(result.current.visibleItems).toEqual([]);
    expect(result.current.editing).toBeNull();
    expect(result.current.baseCurrency).toBeNull();
    expect(result.current.baseStatus).toBe("loading");
    expect(result.current.isLoading).toBe(true);
    expect(staleListSignal?.aborted).toBe(true);
    expect(staleBaseSignal?.aborted).toBe(true);

    await waitFor(() => {
      expect(listCalls).toBe(3);
      expect(baseCalls).toBe(3);
    });

    await act(async () => {
      staleListDeferred.resolve(pageResponse([staleRow]));
      staleBaseDeferred.resolve(pageResponse([usdBaseRow], 1));
    });
    expect(result.current.items).toEqual([]);
    expect(result.current.visibleItems).toEqual([]);
    expect(result.current.baseCurrency).toBeNull();
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      nextListDeferred.resolve(pageResponse([filteredRow]));
      nextBaseDeferred.resolve(emptyBaseResponse());
    });
    await waitFor(() => {
      expect(result.current.isRefreshing).toBe(false);
      expect(result.current.baseStatus).toBe("ready");
    });
    expect(result.current.visibleItems).toEqual([filteredRow]);
    expect(result.current.baseCurrency).toBeNull();
  });

  it("resets page to 1 on supported pageSize changes (50/100), preserves filters/search/sort, ignores invalid or unchanged sizes, keeps base lookup at limit=1, and hides old rows on pending/failed new-limit reads", async () => {
    const secondPageActiveRow: Currency = {
      ...currencies[1]!,
      code: "CAD",
      name: "Canadian Dollar",
      status: "ACTIVE",
    };
    const server500 = new TenantApiClientError("Limit 100 failed", {
      status: 500,
      statusText: "Internal Server Error",
      headers: new Headers(),
      data: { success: false, status: "ERROR", statusCode: 500, errorCode: "INTERNAL_ERROR" },
    });
    const limit100Deferred = createDeferred<AxiosResponse<unknown>>();
    const listUrls: string[] = [];
    const baseUrls: string[] = [];
    let totalFor50 = 51;

    vi.spyOn(axiosClient, "get").mockImplementation((url) => {
      if (isBaseCurrencyUrl(url)) {
        baseUrls.push(url);
        return Promise.resolve(emptyBaseResponse());
      }
      listUrls.push(url);
      const query = new URL(url, "https://portal.example").searchParams;
      const limit = Number(query.get("limit"));
      const page = Number(query.get("page"));
      if (limit === 100) {
        return limit100Deferred.promise;
      }
      if (limit === 50) {
        const rows = page === 1 ? [initialRow] : totalFor50 > 50 ? [secondPageActiveRow] : [];
        const totalPages = Math.ceil(totalFor50 / 50);
        return Promise.resolve({
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
              limit: 50,
              total: totalFor50,
              totalPages,
              hasNext: page < totalPages,
              hasPrev: page > 1,
            },
          },
        });
      }
      const totalPages = 2;
      return Promise.resolve({
        status: 200,
        statusText: "OK",
        headers: new Headers(),
        data: {
          success: true,
          status: "SUCCESS",
          statusCode: 200,
          data: [initialRow],
          meta: {
            page,
            limit: 20,
            total: 25,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
        },
      });
    });
    vi.spyOn(axiosClient, "delete").mockImplementation(async () => {
      totalFor50 = 50;
      return { status: 204, statusText: "No Content", headers: new Headers(), data: null };
    });

    const { result } = renderHook(() => useCurrencies());
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    expect(result.current.pageSize).toBe(20);
    expect(baseUrls).toHaveLength(1);

    act(() => {
      result.current.setStatusFilter("ACTIVE");
      result.current.setSearch("Currency");
      result.current.setSort({ id: "exchangeRate", direction: "desc" });
    });
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));

    act(() => result.current.setPage(2));
    await waitFor(() => {
      expect(result.current.isRefreshing).toBe(false);
      expect(result.current.pageInfo.page).toBe(2);
    });

    const countBeforeInvalid = listUrls.length;
    act(() => {
      result.current.setPageSize(25);
      result.current.setPageSize(20);
    });
    expect(result.current.pageSize).toBe(20);
    expect(result.current.pageInfo.page).toBe(2);
    expect(listUrls).toHaveLength(countBeforeInvalid);

    act(() => result.current.setPageSize(50));
    expect(result.current.pageSize).toBe(50);
    expect(result.current.visibleItems).toEqual([]);
    expect(result.current.visiblePageInfo).toEqual({ page: 1, limit: 50, total: 0 });
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    expect(listUrls.at(-1)).toBe(
      currenciesListPath(1, "ACTIVE", "Currency", "exchangeRate", "DESC", undefined, 50),
    );
    expect(result.current.pageInfo).toEqual({ page: 1, limit: 50, total: 51 });
    expect(baseUrls).toHaveLength(1);

    // Emptied-page recovery under limit=50 clamps back to page 1 with limit=50 preserved.
    act(() => result.current.setPage(2));
    await waitFor(() => {
      expect(result.current.isRefreshing).toBe(false);
      expect(result.current.items).toEqual([secondPageActiveRow]);
    });
    act(() => result.current.openDeactivate(secondPageActiveRow));
    await act(async () => {
      await result.current.deactivate();
    });
    await waitFor(() => {
      expect(result.current.isRefreshing).toBe(false);
      expect(result.current.pageInfo).toEqual({ page: 1, limit: 50, total: 50 });
    });
    expect(listUrls.at(-1)).toBe(
      currenciesListPath(1, "ACTIVE", "Currency", "exchangeRate", "DESC", undefined, 50),
    );

    // Deferred limit=100 hides old limit=50 rows while pending and clears items on failure.
    act(() => result.current.setPageSize(100));
    expect(result.current.visibleItems).toEqual([]);
    expect(result.current.visiblePageInfo).toEqual({ page: 1, limit: 100, total: 0 });
    expect(result.current.hasRetainedRows).toBe(false);
    expect(result.current.isLoading).toBe(true);

    await waitFor(() =>
      expect(listUrls.at(-1)).toBe(
        currenciesListPath(1, "ACTIVE", "Currency", "exchangeRate", "DESC", undefined, 100),
      ),
    );
    await act(async () => {
      limit100Deferred.reject(server500);
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.items).toEqual([]);
    expect(result.current.visibleItems).toEqual([]);
    expect(result.current.queryError?.status).toBe(500);
  });
});

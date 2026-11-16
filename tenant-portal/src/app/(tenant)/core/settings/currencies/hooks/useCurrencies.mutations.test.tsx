// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { axiosClient, TenantApiClientError, type AxiosResponse } from "@/lib/api/axiosClient";
import type { PermissionScope } from "@/lib/auth/permission-scope";
import {
  CURRENCIES_PATH,
  CURRENCY_PAGE_SIZE,
  currencyPath,
  setDefaultCurrencyPath,
  toCurrencyForm,
  type Currency,
} from "../currency-contract";
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

const usdRow: Currency = {
  id: "01902001-3000-7000-8000-000000000011",
  code: "USD",
  name: "US Dollar",
  symbol: "$",
  decimalPlaces: 2,
  isDefault: true,
  exchangeRate: "1.00000000",
  status: "ACTIVE",
  updatedAt: "2026-08-25T10:05:00.000Z",
};

const eurRow: Currency = {
  id: "01902001-3000-7000-8000-000000000012",
  code: "EUR",
  name: "Euro",
  symbol: "€",
  decimalPlaces: 2,
  isDefault: false,
  exchangeRate: "0.92345678",
  status: "ACTIVE",
  updatedAt: "2026-08-25T10:05:00.000Z",
};

const inactiveChfRow: Currency = {
  id: "01902001-3000-7000-8000-000000000013",
  code: "CHF",
  name: "Swiss Franc",
  symbol: "CHF",
  decimalPlaces: 2,
  isDefault: false,
  exchangeRate: "0.86500000",
  status: "INACTIVE",
  updatedAt: "2026-08-25T10:05:00.000Z",
};

const inactiveNoRateRow: Currency = {
  id: "01902001-3000-7000-8000-000000000014",
  code: "JPY",
  name: "Japanese Yen",
  symbol: "¥",
  decimalPlaces: 0,
  isDefault: false,
  exchangeRate: null,
  status: "INACTIVE",
  updatedAt: "2026-08-25T10:05:00.000Z",
};

function pageResponse(rows: Currency[], limit = CURRENCY_PAGE_SIZE): AxiosResponse<unknown> {
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

function rowResponse(row: unknown): AxiosResponse<unknown> {
  return {
    status: 200,
    statusText: "OK",
    headers: new Headers(),
    data: { success: true, data: row },
  };
}

function isBaseUrl(url: string): boolean {
  const params = new URL(url, "https://portal.example").searchParams;
  return params.get("limit") === "1" && params.get("isDefault") === "true";
}

describe("useCurrencies base-currency read, handler guards, and mutation fencing", () => {
  it("keeps baseCurrency independent of filtered rows and reports unknown on base-read failure without inferring EGP", async () => {
    let failBase = false;
    const getSpy = vi.spyOn(axiosClient, "get").mockImplementation(async (url) => {
      if (isBaseUrl(url)) {
        if (failBase) {
          throw new TenantApiClientError("Upstream error", {
            status: 500,
            statusText: "Error",
            headers: new Headers(),
            data: { errorCode: "INTERNAL_ERROR" },
          });
        }
        return pageResponse([usdRow], 1);
      }
      const params = new URL(url, "https://portal.example").searchParams;
      if (params.get("isDefault") === "false") return pageResponse([eurRow]);
      return pageResponse([usdRow, eurRow]);
    });

    const { result } = renderHook(() => useCurrencies());
    await waitFor(() => {
      expect(result.current.isRefreshing).toBe(false);
      expect(result.current.baseStatus).toBe("ready");
    });
    expect(result.current.baseCurrency?.code).toBe("USD");

    act(() => result.current.setDefaultFilter(false));
    await waitFor(() => expect(result.current.items).toEqual([eurRow]));
    expect(getSpy).toHaveBeenCalledWith(
      `${CURRENCIES_PATH}?page=1&limit=20&sortBy=code&sortDir=ASC&isDefault=false`,
      expect.anything(),
    );
    expect(result.current.baseCurrency?.code).toBe("USD");
    expect(result.current.baseStatus).toBe("ready");

    failBase = true;
    await act(async () => {
      await result.current.reloadBaseCurrency();
    });
    expect(result.current.baseStatus).toBe("unknown");
    expect(result.current.baseCurrency).toBeNull();
  });

  it("enforces handler-level restrictions and synchronous ref fencing across mutations", async () => {
    vi.spyOn(axiosClient, "get").mockImplementation(async (url) =>
      isBaseUrl(url) ? pageResponse([usdRow], 1) : pageResponse([usdRow, eurRow, inactiveChfRow]),
    );

    let resolvePost!: (res: AxiosResponse<unknown>) => void;
    const postSpy = vi.spyOn(axiosClient, "post").mockImplementation(
      () =>
        new Promise<AxiosResponse<unknown>>((res) => {
          resolvePost = res;
        }),
    );
    const deleteSpy = vi.spyOn(axiosClient, "delete").mockResolvedValue({
      status: 204,
      statusText: "No Content",
      headers: new Headers(),
      data: null,
    });
    const patchSpy = vi.spyOn(axiosClient, "patch").mockResolvedValue(rowResponse(eurRow));

    const { result } = renderHook(() => useCurrencies());
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));

    // Handler guards reject default and inactive targets even if called programmatically.
    act(() => {
      result.current.openSetDefault(usdRow);
      result.current.openSetDefault(inactiveChfRow);
      result.current.openDeactivate(usdRow);
      result.current.openDeactivate(inactiveChfRow);
    });
    expect(result.current.settingDefault).toBeNull();
    expect(result.current.deactivating).toBeNull();
    expect(await result.current.reactivate(usdRow)).toBe(false);
    expect(await result.current.reactivate(eurRow)).toBe(false);
    expect(postSpy).not.toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(patchSpy).not.toHaveBeenCalled();

    // Synchronous double invocation dispatches POST set-default once and does not swap default optimistically.
    act(() => result.current.openSetDefault(eurRow));
    expect(result.current.settingDefault?.id).toBe(eurRow.id);

    let firstPromise!: Promise<boolean>;
    let secondPromise!: Promise<boolean>;
    act(() => {
      firstPromise = result.current.confirmSetDefault();
      secondPromise = result.current.confirmSetDefault();
    });
    expect(await secondPromise).toBe(false);
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy).toHaveBeenCalledWith(
      setDefaultCurrencyPath(eurRow.id),
      undefined,
      expect.anything(),
    );
    // No optimistic default swap while request is in flight.
    expect(result.current.items.find((row) => row.isDefault)?.code).toBe("USD");

    await act(async () => {
      resolvePost(rowResponse({ ...eurRow, isDefault: true, exchangeRate: "1.00000000" }));
      expect(await firstPromise).toBe(true);
    });
  });

  it("rejects malformed write payloads and routes missing-rate reactivation through edit", async () => {
    vi.spyOn(axiosClient, "get").mockImplementation(async (url) =>
      isBaseUrl(url)
        ? pageResponse([usdRow], 1)
        : pageResponse([usdRow, inactiveChfRow, inactiveNoRateRow]),
    );
    const postSpy = vi
      .spyOn(axiosClient, "post")
      .mockResolvedValueOnce(rowResponse({ invalid: true }));
    const patchSpy = vi
      .spyOn(axiosClient, "patch")
      .mockResolvedValueOnce(rowResponse({ ...inactiveChfRow, status: "ACTIVE" }))
      .mockResolvedValueOnce(
        rowResponse({ ...inactiveNoRateRow, status: "ACTIVE", exchangeRate: "155.00000000" }),
      );

    const { result } = renderHook(() => useCurrencies());
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));

    // Malformed create response fails validation and preserves createOpen + rows.
    act(() => result.current.openCreate());
    let created = true;
    await act(async () => {
      created = await result.current.create({
        code: "GBP",
        name: "British Pound",
        symbol: "£",
        decimalPlaces: "2",
        exchangeRate: "0.78",
        isDefault: false,
      });
    });
    expect(created).toBe(false);
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(result.current.createOpen).toBe(true);
    expect(result.current.formErrorCode).toBe("INVALID_CURRENCIES_RESPONSE");
    expect(result.current.items).toHaveLength(3);
    act(() => result.current.closeCreate());

    // Inactive row with saved valid rate reactivates directly via PATCH { status: "ACTIVE" }.
    await act(async () => {
      expect(await result.current.reactivate(inactiveChfRow)).toBe(true);
    });
    expect(patchSpy).toHaveBeenNthCalledWith(
      1,
      currencyPath(inactiveChfRow.id),
      { status: "ACTIVE" },
      expect.anything(),
    );

    // Inactive row without saved rate opens edit in reactivate mode instead of firing direct PATCH.
    await act(async () => {
      expect(await result.current.reactivate(inactiveNoRateRow)).toBe(false);
    });
    expect(patchSpy).toHaveBeenCalledTimes(1);
    expect(result.current.editing?.id).toBe(inactiveNoRateRow.id);
    expect(result.current.isReactivatingInEdit).toBe(true);

    await act(async () => {
      const updated = await result.current.update({
        ...toCurrencyForm(inactiveNoRateRow),
        exchangeRate: "155",
      });
      expect(updated).toBe(true);
    });
    expect(patchSpy).toHaveBeenNthCalledWith(
      2,
      currencyPath(inactiveNoRateRow.id),
      { status: "ACTIVE", exchangeRate: 155 },
      expect.anything(),
    );
    expect(result.current.editing).toBeNull();
  });

  it("clears open edit state on actor/scope rotation and prevents a late mutation completion from toasting, refreshing, or clearing a newer actor's submission", async () => {
    const getSpy = vi.spyOn(axiosClient, "get").mockImplementation(async (url) =>
      isBaseUrl(url) ? pageResponse([usdRow], 1) : pageResponse([usdRow, eurRow]),
    );

    let resolveStalePatch!: (res: AxiosResponse<unknown>) => void;
    const patchSpy = vi.spyOn(axiosClient, "patch").mockImplementation(
      () =>
        new Promise<AxiosResponse<unknown>>((res) => {
          resolveStalePatch = res;
        }),
    );

    let resolveActor2Post!: (res: AxiosResponse<unknown>) => void;
    const postSpy = vi.spyOn(axiosClient, "post").mockImplementation(
      () =>
        new Promise<AxiosResponse<unknown>>((res) => {
          resolveActor2Post = res;
        }),
    );

    const { result, rerender } = renderHook(() => useCurrencies());
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));

    act(() => result.current.openEdit(eurRow));
    expect(result.current.editing?.id).toBe(eurRow.id);

    let staleUpdatePromise!: Promise<boolean>;
    act(() => {
      staleUpdatePromise = result.current.update({
        ...toCurrencyForm(eurRow),
        name: "Stale Actor Euro",
      });
    });
    expect(result.current.isSubmitting).toBe(true);
    expect(patchSpy).toHaveBeenCalledTimes(1);

    authState.realtimeAuthGeneration = "gen-2";
    authState.user = { ...defaultUser(), id: "01902001-3000-7000-8000-000000000002" };
    act(() => rerender());

    expect(result.current.editing).toBeNull();
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.formError).toBeNull();
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));

    const getCallsBeforeLateSettle = getSpy.mock.calls.length;

    act(() => result.current.openCreate());
    let actor2CreatePromise!: Promise<boolean>;
    act(() => {
      actor2CreatePromise = result.current.create({
        code: "GBP",
        name: "British Pound",
        symbol: "£",
        decimalPlaces: "2",
        exchangeRate: "0.78",
        isDefault: false,
      });
    });
    expect(result.current.createOpen).toBe(true);
    expect(result.current.isSubmitting).toBe(true);
    expect(postSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveStalePatch(rowResponse({ ...eurRow, name: "Stale Actor Euro" }));
      expect(await staleUpdatePromise).toBe(false);
    });
    expect(toast.success).not.toHaveBeenCalled();
    expect(getSpy).toHaveBeenCalledTimes(getCallsBeforeLateSettle);
    expect(result.current.createOpen).toBe(true);
    expect(result.current.isSubmitting).toBe(true);

    await act(async () => {
      resolveActor2Post(
        rowResponse({
          ...eurRow,
          id: "01902001-3000-7000-8000-000000000019",
          code: "GBP",
          name: "British Pound",
        }),
      );
      expect(await actor2CreatePromise).toBe(true);
    });
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(result.current.createOpen).toBe(false);
    expect(result.current.isSubmitting).toBe(false);
  });

  it.each(["empty-grants", "missing-scopes"] as const)("fails closed for owner metadata with %s instead of inferring session permissions", async (projection) => {
    authState.user = {
      ...defaultUser(), isTenantOwner: true,
      permissions: projection === "empty-grants" ? [] : defaultUser().permissions,
      permissionScopes: {},
    };
    const getSpy = vi.spyOn(axiosClient, "get").mockImplementation(async (url) =>
      isBaseUrl(url) ? pageResponse([usdRow], 1) : pageResponse([usdRow, eurRow]),
    );
    const postSpy = vi.spyOn(axiosClient, "post").mockResolvedValue(rowResponse(eurRow));
    const patchSpy = vi.spyOn(axiosClient, "patch").mockResolvedValue(rowResponse(eurRow));
    const { result } = renderHook(() => useCurrencies());
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    expect(getSpy).not.toHaveBeenCalled();
    expect(result.current.canManage).toBe(false);
    expect(result.current.visibleItems).toEqual([]);
    expect(result.current.baseCurrency).toBeNull();
    act(() => {
      result.current.openCreate();
      result.current.openEdit(eurRow);
    });
    expect(result.current.createOpen).toBe(false);
    expect(result.current.editing).toBeNull();
    await act(async () => {
      expect(await result.current.create(toCurrencyForm(eurRow))).toBe(false);
      expect(await result.current.update(toCurrencyForm(eurRow))).toBe(false);
    });
    expect(postSpy).not.toHaveBeenCalled();
    expect(patchSpy).not.toHaveBeenCalled();
  });

  it("ignores a deferred mutation completion after unmount without toasting or refreshing", async () => {
    const getSpy = vi.spyOn(axiosClient, "get").mockImplementation(async (url) =>
      isBaseUrl(url) ? pageResponse([usdRow], 1) : pageResponse([usdRow, eurRow]),
    );
    let resolvePatch!: (response: AxiosResponse<unknown>) => void;
    const patchSpy = vi.spyOn(axiosClient, "patch").mockImplementation(
      () => new Promise<AxiosResponse<unknown>>((resolve) => { resolvePatch = resolve; }),
    );
    const { result, unmount } = renderHook(() => useCurrencies());
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    act(() => result.current.openEdit(eurRow));
    let pending!: Promise<boolean>;
    act(() => { pending = result.current.update({ ...toCurrencyForm(eurRow), name: "Updated Euro" }); });
    expect(patchSpy).toHaveBeenCalledOnce();
    const readsBeforeUnmount = getSpy.mock.calls.length;
    unmount();
    let settled!: boolean;
    await act(async () => {
      resolvePatch(rowResponse({ ...eurRow, name: "Updated Euro" }));
      settled = await pending;
    });
    expect(settled).toBe(false);
    expect(toast.success).not.toHaveBeenCalled();
    expect(getSpy).toHaveBeenCalledTimes(readsBeforeUnmount);
  });

  it("clears private rows, baseCurrency, and open row actions when a refresh returns authoritative 403", async () => {
    let forbidden = false;
    vi.spyOn(axiosClient, "get").mockImplementation(async (url) => {
      if (forbidden) {
        throw new TenantApiClientError("Forbidden", {
          status: 403,
          statusText: "Forbidden",
          headers: new Headers(),
          data: { errorCode: "FORBIDDEN" },
        });
      }
      return isBaseUrl(url) ? pageResponse([usdRow], 1) : pageResponse([usdRow, eurRow]);
    });

    const { result } = renderHook(() => useCurrencies());
    await waitFor(() => {
      expect(result.current.isRefreshing).toBe(false);
      expect(result.current.baseStatus).toBe("ready");
    });

    act(() => {
      result.current.openEdit(eurRow);
      result.current.openSetDefault(eurRow);
    });
    expect(result.current.editing?.id).toBe(eurRow.id);
    expect(result.current.settingDefault?.id).toBe(eurRow.id);
    expect(result.current.baseCurrency?.code).toBe("USD");

    forbidden = true;
    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.isQueryForbidden).toBe(true);
    expect(result.current.items).toEqual([]);
    expect(result.current.visibleItems).toEqual([]);
    expect(result.current.baseCurrency).toBeNull();
    expect(result.current.editing).toBeNull();
    expect(result.current.settingDefault).toBeNull();
  });

  it("invalidates in-flight row intent on permission disposal without releasing a newer operation, and drops post-unmount row failures", async () => {
    const getSpy = vi.spyOn(axiosClient, "get").mockImplementation(async (url) =>
      isBaseUrl(url) ? pageResponse([usdRow], 1) : pageResponse([usdRow, eurRow]),
    );
    let resolveFirstSetDefault!: (response: AxiosResponse<unknown>) => void;
    let resolveSecondSetDefault!: (response: AxiosResponse<unknown>) => void;
    let postCall = 0;
    const postSpy = vi.spyOn(axiosClient, "post").mockImplementation(
      () =>
        new Promise<AxiosResponse<unknown>>((resolve) => {
          postCall += 1;
          if (postCall === 1) resolveFirstSetDefault = resolve;
          else resolveSecondSetDefault = resolve;
        }),
    );
    let rejectDelete!: (reason: unknown) => void;
    vi.spyOn(axiosClient, "delete").mockImplementation(
      () =>
        new Promise<AxiosResponse<unknown>>((_, reject) => {
          rejectDelete = reject;
        }),
    );

    const { result, rerender, unmount } = renderHook(() => useCurrencies());
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));

    act(() => result.current.openSetDefault(eurRow));
    let staleSetDefault!: Promise<boolean>;
    act(() => {
      staleSetDefault = result.current.confirmSetDefault();
    });
    expect(result.current.pendingId).toBe(eurRow.id);
    expect(postSpy).toHaveBeenCalledTimes(1);

    // Revoke tenant-wide manage mid-flight, then restore it and start a newer operation.
    authState.user = {
      ...defaultUser(),
      permissionScopes: {
        "currencies.currency.read": { tenantWide: true, companyIds: [], branchIds: [] },
        "currencies.currency.manage": { tenantWide: false, companyIds: [], branchIds: [] },
      },
    };
    act(() => rerender());
    expect(result.current.pendingId).toBeNull();
    expect(result.current.settingDefault).toBeNull();

    authState.user = defaultUser();
    act(() => rerender());
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    const readsBeforeStaleSettle = getSpy.mock.calls.length;

    act(() => result.current.openSetDefault(eurRow));
    let activeSetDefault!: Promise<boolean>;
    act(() => {
      activeSetDefault = result.current.confirmSetDefault();
    });
    expect(result.current.pendingId).toBe(eurRow.id);
    expect(postSpy).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveFirstSetDefault(rowResponse({ ...eurRow, isDefault: true, exchangeRate: "1.00000000" }));
      expect(await staleSetDefault).toBe(false);
    });
    expect(toast.success).not.toHaveBeenCalled();
    expect(getSpy).toHaveBeenCalledTimes(readsBeforeStaleSettle);
    expect(result.current.pendingId).toBe(eurRow.id);

    await act(async () => {
      resolveSecondSetDefault(rowResponse({ ...eurRow, isDefault: true, exchangeRate: "1.00000000" }));
      expect(await activeSetDefault).toBe(true);
    });
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(result.current.pendingId).toBeNull();

    // Start a row delete, unmount, and reject late: no error toast or refresh fires.
    act(() => result.current.openDeactivate(eurRow));
    let unmountedDeactivate!: Promise<boolean>;
    act(() => {
      unmountedDeactivate = result.current.deactivate();
    });
    unmount();

    await act(async () => {
      rejectDelete(
        new TenantApiClientError("Server error", {
          status: 500,
          statusText: "Error",
          headers: new Headers(),
          data: { errorCode: "INTERNAL_ERROR" },
        }),
      );
      expect(await unmountedDeactivate).toBe(false);
    });
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.errorFromApi).not.toHaveBeenCalled();
  });
});

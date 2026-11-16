// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import type { TenantUserProfile } from "@/context/AuthContext";
import { useQuotationCurrencies } from "./useQuotationCurrencies";

type User = Pick<TenantUserProfile, "id" | "isTenantOwner" | "permissions" | "permissionScopes" | "featureEntitlements">;
const mocks = vi.hoisted(() => ({ user: null as User | null, generation: 1, load: vi.fn(), get: vi.fn() }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: mocks.user, realtimeAuthGeneration: mocks.generation }) }));
vi.mock("@/app/(tenant)/core/contracts/currency-options", () => ({ loadActiveCurrencyOptions: mocks.load }));
vi.mock("../../trade-api", () => ({ tradeGet: mocks.get }));

const COMPANY = "019f0000-0000-7000-8000-000000000001";
const HEADERS = { "x-mutakamel-company-id": COMPANY,
  "x-mutakamel-branch-id": "019f0000-0000-7000-8000-000000000002",
  "x-mutakamel-channel-id": "019f0000-0000-7000-8000-000000000003" };
const SAR = { id: "019f0000-0000-7000-8000-000000000004", code: "SAR", name: "Saudi riyal", status: "ACTIVE", isDefault: true };
const USD = { ...SAR, id: "019f0000-0000-7000-8000-000000000005", code: "USD", name: "US dollar", isDefault: false };
function pricingUser(): User {
  return { id: "actor", isTenantOwner: false, permissions: ["trade.pricing.read"],
    permissionScopes: { "trade.pricing.read": { tenantWide: false, companyIds: [COMPANY], branchIds: [] } },
    featureEntitlements: { "trade.pricing": true } };
}
beforeEach(() => {
  mocks.load.mockReset(); mocks.get.mockReset(); mocks.generation = 1;
  mocks.user = { id: "actor", isTenantOwner: true, permissions: [], permissionScopes: {}, featureEntitlements: {} };
  mocks.load.mockResolvedValue([SAR, USD]);
});
afterEach(cleanup);

describe("quotation active workspace currencies", () => {
  it("uses the existing paginated Core active-directory loader and its configured default", async () => {
    mocks.load.mockResolvedValue([SAR, USD, { ...USD, code: "EUR", status: "INACTIVE" }]);
    const { result } = renderHook(() => useQuotationCurrencies(HEADERS, true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.currencies.map((currency) => currency.code)).toEqual(["SAR", "USD"]);
    expect(result.current.defaultCode).toBe("SAR");
    expect(result.current.options[0]).toEqual({ value: "SAR", label: "Saudi riyal (SAR)" });
    expect(mocks.load).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("uses only an explicit active workspace row if no default is configured, and invents none for empty data", async () => {
    mocks.load.mockResolvedValueOnce([{ ...USD, isDefault: false }]);
    const { result } = renderHook(() => useQuotationCurrencies(HEADERS, true));
    await waitFor(() => expect(result.current.defaultCode).toBe("USD"));
    mocks.load.mockResolvedValueOnce([]);
    act(() => { result.current.retry(); });
    expect(result.current.options).toEqual([]);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.defaultCode).toBe("");
    expect(result.current.currencies).toEqual([]);
  });

  it("uses the proven Trade reference fallback with Company-only headers and active workspace rows", async () => {
    mocks.user = pricingUser();
    mocks.get.mockResolvedValue({ data: { currencies: [{ code: "USD", name: "US dollar", isDefault: true }] } });
    const { result } = renderHook(() => useQuotationCurrencies(HEADERS, true));
    await waitFor(() => expect(result.current.defaultCode).toBe("USD"));
    expect(mocks.load).not.toHaveBeenCalled();
    expect(mocks.get).toHaveBeenCalledWith("/api/tenant/trade/v1/pricing/reference-data",
      expect.objectContaining({ headers: { "x-mutakamel-company-id": COMPANY } }));
  });

  it.each(["feature", "company"])("does not call Trade without its current %s authority", (missing) => {
    mocks.user = pricingUser();
    if (missing === "feature") mocks.user.featureEntitlements = {};
    else mocks.user.permissionScopes["trade.pricing.read"] = { tenantWide: false, companyIds: [], branchIds: [HEADERS["x-mutakamel-branch-id"]] };
    const { result } = renderHook(() => useQuotationCurrencies(HEADERS, true));
    expect(result.current.canRead).toBe(false);
    expect(result.current.options).toEqual([]);
    expect(mocks.get).not.toHaveBeenCalled(); expect(mocks.load).not.toHaveBeenCalled();
  });

  it("keeps an authoritative Core403 visible instead of hiding it behind a fallback", async () => {
    mocks.user = { ...pricingUser(), isTenantOwner: true };
    mocks.load.mockRejectedValue(new TenantApiClientError("Forbidden", { status: 403, statusText: "Forbidden", headers: new Headers(), data: {} }));
    const { result } = renderHook(() => useQuotationCurrencies(HEADERS, true));
    await waitFor(() => expect(result.current.error?.status).toBe(403));
    expect(result.current.options).toEqual([]);
    expect(result.current.defaultCode).toBe("");
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("hides choices and ignores a late response after the authenticated actor changes", async () => {
    let resolveFirst!: (value: typeof SAR[]) => void;
    mocks.load.mockImplementationOnce(() => new Promise<typeof SAR[]>((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce([USD]);
    const { result, rerender } = renderHook(() => useQuotationCurrencies(HEADERS, true));
    await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(1));
    mocks.user = { ...mocks.user!, id: "another-actor" };
    rerender();
    expect(result.current.options).toEqual([]);
    await waitFor(() => expect(result.current.defaultCode).toBe("USD"));
    await act(async () => { resolveFirst([SAR]); });
    expect(result.current.currencies.map((currency) => currency.code)).toEqual(["USD"]);
  });

  it("does not request currencies for a locked or disabled composer", () => {
    const { result } = renderHook(() => useQuotationCurrencies(HEADERS, false));
    expect(result.current.loading).toBe(false);
    expect(mocks.load).not.toHaveBeenCalled(); expect(mocks.get).not.toHaveBeenCalled();
  });
});

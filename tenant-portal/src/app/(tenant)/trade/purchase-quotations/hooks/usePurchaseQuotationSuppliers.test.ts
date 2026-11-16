// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePurchaseQuotationSuppliers } from "./usePurchaseQuotationSuppliers";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../../trade-api", () => ({ tradeGet: mocks.get }));
vi.mock("@/lib/api/errors", () => ({ normalizeApiError: (error: unknown) => error }));
const headers = { "x-mutakamel-company-id": "company", "x-mutakamel-branch-id": "branch" };
const supplier = { partyId: "019f0000-0000-7000-8000-000000000125", displayName: "Supplier 125" };
beforeEach(() => { vi.clearAllMocks(); mocks.get.mockResolvedValue({ data: { items: [supplier] } }); });
afterEach(cleanup);

describe("purchase quotation supplier discovery", () => {
  it("does not fetch or allow the picker without a scoped draft permission", () => {
    const { result } = renderHook(() => usePurchaseQuotationSuppliers(headers, false));
    expect(mocks.get).not.toHaveBeenCalled();
    expect(result.current.canUseSupplierPicker).toBe(false);
  });

  it("waits for endpoint access and sends name searches to the server", async () => {
    const { result } = renderHook(() => usePurchaseQuotationSuppliers(headers, true));
    expect(result.current.canUseSupplierPicker).toBe(false);
    await waitFor(() => expect(result.current.canUseSupplierPicker).toBe(true));
    act(() => result.current.searchSuppliers("Supplier 125"));
    await waitFor(() => expect(mocks.get).toHaveBeenLastCalledWith(
      "/api/tenant/trade/v1/purchase-quotations/supplier-options?limit=50&search=Supplier+125",
      expect.objectContaining({ headers }),
    ));
    await waitFor(() => expect(result.current.suppliers).toEqual([supplier]));
  });

  it("keeps forbidden responses distinct from an empty result and can retry", async () => {
    mocks.get.mockRejectedValueOnce({ status: 403, code: "TRADE.AUTH.TARGET_DENIED" });
    const { result } = renderHook(() => usePurchaseQuotationSuppliers(headers, true));
    await waitFor(() => expect(result.current.suppliersError?.status).toBe(403));
    expect(result.current.canUseSupplierPicker).toBe(false);
    act(() => result.current.searchSuppliers(""));
    await waitFor(() => expect(result.current.canUseSupplierPicker).toBe(true));
    expect(result.current.suppliersError).toBeNull();
  });

  it("discards stale search and previous-Branch responses", async () => {
    let resolveOld!: (response: unknown) => void;
    mocks.get.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    const { result, rerender } = renderHook(({ scope }) => usePurchaseQuotationSuppliers(scope, true),
      { initialProps: { scope: headers } });
    await waitFor(() => expect(mocks.get).toHaveBeenCalledOnce());
    const nextHeaders = { ...headers, "x-mutakamel-branch-id": "other-branch" };
    mocks.get.mockResolvedValue({ data: { items: [] } });
    rerender({ scope: nextHeaders });
    expect(result.current.suppliers).toEqual([]);
    expect(result.current.canUseSupplierPicker).toBe(false);
    await waitFor(() => expect(result.current.canUseSupplierPicker).toBe(true));
    await act(async () => resolveOld({ data: { items: [supplier] } }));
    expect(result.current.suppliers).toEqual([]);

    mocks.get.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    act(() => result.current.searchSuppliers("old"));
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(3));
    act(() => result.current.searchSuppliers("new"));
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(4));
    await act(async () => resolveOld({ data: { items: [supplier] } }));
    expect(result.current.suppliers).toEqual([]);
  });
});

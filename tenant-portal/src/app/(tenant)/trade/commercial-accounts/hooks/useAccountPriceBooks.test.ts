// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountRole } from "../commercial-account-contract";
import { useAccountPriceBooks } from "./useAccountPriceBooks";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  scope: { headers: { "x-mutakamel-company-id": "company" }, gap: null as string | null },
}));
vi.mock("../../trade-api", () => ({ tradeGet: mocks.get }));
vi.mock("../../useTradeScope", () => ({ useTradeScopeRequest: () => mocks.scope }));

const ID = "0192f3a0-0000-7000-8000-000000000001";
function response(purpose = "PURCHASE", status = "ACTIVE") {
  return { data: { items: [{
    id: ID, code: "BOOK", purpose, currencyCode: "EGP", status, version: 1, versions: [],
  }], total: 1, page: 1, limit: 25 } };
}

beforeEach(() => {
  mocks.get.mockReset().mockResolvedValue(response());
  mocks.scope = { headers: { "x-mutakamel-company-id": "company" }, gap: null };
});
afterEach(cleanup);

describe("account price-book suggestions", () => {
  it.each<[AccountRole, string]>([["SUPPLIER", "PURCHASE"], ["CUSTOMER", "SALES"]])(
    "requests active %s-compatible books", async (role, purpose) => {
      mocks.get.mockResolvedValue(response(purpose));
      const { result } = renderHook(() => useAccountPriceBooks(role));
      await waitFor(() => expect(result.current.books).toHaveLength(1));
      expect(mocks.get).toHaveBeenCalledWith(
        `/api/tenant/trade/v1/price-books?page=1&limit=25&purpose=${purpose}&status=ACTIVE`,
        expect.objectContaining({ headers: mocks.scope.headers, signal: expect.any(AbortSignal) }),
      );
    },
  );

  it.each([["SALES", "ACTIVE"], ["PURCHASE", "INACTIVE"]])(
    "excludes a returned %s/%s book", async (purpose, status) => {
      mocks.get.mockResolvedValue(response(purpose, status));
      const { result } = renderHook(() => useAccountPriceBooks("SUPPLIER"));
      await act(async () => {});
      expect(result.current.books).toEqual([]);
      expect(result.current.unavailable).toBe(false);
    },
  );

  it("ignores a superseded role response even when transport does not abort", async () => {
    let resolveOld!: (value: ReturnType<typeof response>) => void;
    mocks.get.mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }));
    const { result, rerender } = renderHook((role: AccountRole) => useAccountPriceBooks(role), { initialProps: "CUSTOMER" as AccountRole });
    const oldSignal = mocks.get.mock.calls[0][1].signal as AbortSignal;
    rerender("SUPPLIER");
    await waitFor(() => expect(result.current.books[0]?.purpose).toBe("PURCHASE"));
    await act(async () => { resolveOld(response("SALES")); });
    expect(oldSignal.aborted).toBe(true);
    expect(result.current.books[0]?.purpose).toBe("PURCHASE");
  });

  it("hides previous-company options immediately when the company changes", async () => {
    const { result, rerender } = renderHook(() => useAccountPriceBooks("SUPPLIER"));
    await waitFor(() => expect(result.current.books).toHaveLength(1));
    mocks.get.mockReturnValue(new Promise(() => {}));
    mocks.scope = { headers: { "x-mutakamel-company-id": "other-company" }, gap: null };
    rerender();
    expect(result.current.books).toEqual([]);
  });

  it("reports forbidden suggestions as unavailable", async () => {
    mocks.get.mockRejectedValue({ status: 403 });
    const { result } = renderHook(() => useAccountPriceBooks("SUPPLIER"));
    await waitFor(() => expect(result.current.unavailable).toBe(true));
    expect(result.current.books).toEqual([]);
  });
});

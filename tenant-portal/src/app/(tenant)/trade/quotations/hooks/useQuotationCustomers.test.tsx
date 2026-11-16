// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tradeGet } from "../../trade-api";
import { useQuotationCustomers } from "./useQuotationCustomers";

vi.mock("../../trade-api", () => ({ tradeGet: vi.fn() }));
const get = vi.mocked(tradeGet);
const id = (value: number) => `0192f3a0-0000-7000-8000-${String(value).padStart(12, "0")}`;
const firstHeaders = { "x-company-id": id(20), "x-branch-id": id(21) };
const secondHeaders = { "x-company-id": id(30), "x-branch-id": id(31) };
const customer = (value: number) => ({ partyId: id(value), partyType: "ORGANIZATION" as const, displayName: `Customer ${value}`, crmCustomerProfileId: null,
  commercialAccountStatus: "ACTIVE", eligibilitySource: "ACTIVE_COMMERCIAL_ACCOUNT", quotationSelectable: true, denialCode: null });
const response = (value: number, nextCursor?: string) => ({
  data: { items: [customer(value)], ...(nextCursor ? { nextCursor } : {}) }, headers: new Headers(), status: 200,
});

beforeEach(() => get.mockReset());
afterEach(cleanup);

describe("quotation customer picker recovery", () => {
  it("retries the current search after a failed request", async () => {
    get.mockRejectedValueOnce(new Error("unavailable"));
    const { result } = renderHook(() => useQuotationCustomers(firstHeaders, true));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    get.mockResolvedValueOnce(response(1));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.options[0]?.partyId).toBe(id(1)));
    expect(get).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeNull();
  });

  it("does not send a previous branch's cursor when context changes", async () => {
    get.mockResolvedValueOnce(response(1, "opaque-branch-a-cursor"))
      .mockResolvedValueOnce(response(2)).mockResolvedValueOnce(response(3));
    const { result, rerender } = renderHook(({ headers }) => useQuotationCustomers(headers, true), { initialProps: { headers: firstHeaders } });
    await waitFor(() => expect(result.current.hasMore).toBe(true));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.options).toHaveLength(2));
    rerender({ headers: secondHeaders });
    expect(result.current.options).toEqual([]);
    await waitFor(() => expect(result.current.options[0]?.partyId).toBe(id(3)));
    expect(String(get.mock.calls[2][0])).not.toContain("cursor=");
  });

  it("ignores an old-scope response even if its transport ignores abort", async () => {
    let resolveOld!: (value: ReturnType<typeof response>) => void;
    const old = new Promise<ReturnType<typeof response>>((resolve) => { resolveOld = resolve; });
    get.mockReturnValueOnce(old).mockResolvedValueOnce(response(2));
    const { result, rerender } = renderHook(({ headers }) => useQuotationCustomers(headers, true), { initialProps: { headers: firstHeaders } });
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    rerender({ headers: secondHeaders });
    await waitFor(() => expect(result.current.options[0]?.partyId).toBe(id(2)));
    await act(async () => { resolveOld(response(1)); await old; });
    expect(result.current.options.map((entry) => entry.partyId)).toEqual([id(2)]);
  });
});

// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { tradeGet } from "../../trade-api";
import { CONTACT_OPTION, CUSTOMER_OPTION, HEADERS } from "./quotation-composer.test-fixtures";
import { useQuotationContacts } from "./useQuotationContacts";

const auth = vi.hoisted(() => ({ actor: "actor-a", generation: 1 }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: { id: auth.actor }, realtimeAuthGeneration: auth.generation }) }));
vi.mock("../../trade-api", async (original) => ({ ...await original<typeof import("../../trade-api")>(), tradeGet: vi.fn() }));
const get = vi.mocked(tradeGet);
const second = { ...CONTACT_OPTION, partyId: "01890000-0000-7000-8000-000000000005", displayName: "Second contact fixture" };
const page = (items = [CONTACT_OPTION], nextCursor?: string) => ({ status: 200, headers: new Headers(),
  data: { partyType: "ORGANIZATION", items, ...(nextCursor ? { nextCursor } : {}) } });
const options = { headers: HEADERS, partyId: CUSTOMER_OPTION.partyId, partyType: "ORGANIZATION" as const, enabled: true };
beforeEach(() => { get.mockReset(); auth.actor = "actor-a"; auth.generation = 1; });
afterEach(cleanup);

describe("quotation linked contacts pagination and identity fences", () => {
  it("does not request contacts for a person", () => {
    const { result } = renderHook(() => useQuotationContacts({ ...options, partyType: "PERSON" }));
    expect(result.current.partyType).toBe("PERSON");
    expect(result.current.options).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(get).not.toHaveBeenCalled();
  });

  it("preserves accumulated pages across a failed load-more request and retries the same cursor", async () => {
    get.mockResolvedValueOnce(page([CONTACT_OPTION], "opaque-page-two"))
      .mockRejectedValueOnce(new TenantApiClientError("Unavailable", { status: 503, statusText: "Unavailable", headers: new Headers(), data: { code: "TRADE.DEPENDENCY.TIMEOUT" } }))
      .mockResolvedValueOnce(page([second]));
    const { result } = renderHook(() => useQuotationContacts(options));
    await waitFor(() => expect(result.current.hasMore).toBe(true));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.error?.status).toBe(503));
    expect(result.current.hasMore).toBe(false);
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.options.map((option) => option.partyId)).toEqual([CONTACT_OPTION.partyId, second.partyId]));
    expect(get.mock.calls[2][0]).toBe(get.mock.calls[1][0]);
    expect(String(get.mock.calls[2][0])).toContain("cursor=opaque-page-two");
  });

  it.each(["actor", "scope", "party"] as const)("quarantines old %s data immediately and ignores late transport responses", async (change) => {
    let finish!: (value: ReturnType<typeof page>) => void;
    const pending = new Promise<ReturnType<typeof page>>((resolve) => { finish = resolve; });
    get.mockReturnValueOnce(pending).mockResolvedValueOnce(page([second]));
    const { result, rerender } = renderHook((query) => useQuotationContacts(query), { initialProps: options });
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    const next = { ...options };
    if (change === "actor") auth.actor = "actor-b";
    if (change === "scope") next.headers = { ...HEADERS, "x-mutakamel-branch-id": second.partyId };
    if (change === "party") next.partyId = second.partyId;
    rerender(next);
    expect(result.current.options).toEqual([]);
    await waitFor(() => expect(result.current.options[0]?.partyId).toBe(second.partyId));
    await act(async () => { finish(page()); await pending; });
    expect(result.current.options.map((option) => option.partyId)).toEqual([second.partyId]);
    expect(get.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });

  it("resets search/cursor for a new party and stops repeated cursor loops while deduplicating", async () => {
    get.mockResolvedValueOnce(page([CONTACT_OPTION], "same-cursor"))
      .mockResolvedValueOnce(page([CONTACT_OPTION, second], "same-cursor"))
      .mockResolvedValueOnce(page([]));
    const { result, rerender } = renderHook((query) => useQuotationContacts(query), { initialProps: options });
    await waitFor(() => expect(result.current.hasMore).toBe(true));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.options).toHaveLength(2));
    expect(result.current.hasMore).toBe(false);
    rerender({ ...options, partyId: second.partyId });
    await waitFor(() => expect(get).toHaveBeenCalledTimes(3));
    expect(new URL(String(get.mock.calls[2][0]), "http://test.local").searchParams.has("cursor")).toBe(false);
    expect(result.current.options).toEqual([]);
  });

  it("hides prior search results until the new search settles, with no old cursor", async () => {
    get.mockResolvedValueOnce(page([CONTACT_OPTION], "old-search-cursor")).mockResolvedValueOnce(page([]));
    const { result } = renderHook(() => useQuotationContacts(options));
    await waitFor(() => expect(result.current.options).toHaveLength(1));
    act(() => result.current.setSearch("missing contact"));
    expect(result.current.options).toEqual([]);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const url = new URL(String(get.mock.calls[1][0]), "http://test.local");
    expect(url.searchParams.get("search")).toBe("missing contact");
    expect(url.searchParams.has("cursor")).toBe(false);
    expect(result.current.error).toBeNull();
  });
});

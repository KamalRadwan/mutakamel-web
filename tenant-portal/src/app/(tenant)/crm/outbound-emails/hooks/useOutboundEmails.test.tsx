// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axiosClient, type AxiosResponse } from "@/lib/api/axiosClient";
import { useOutboundEmails } from "./useOutboundEmails";

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: { permissions: [] } }),
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: {}, lang: "en" }),
}));
vi.mock("@/lib/api/axiosClient", () => ({ axiosClient: { get: vi.fn() } }));

function deferred() {
  let resolve!: (value: AxiosResponse<unknown>) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<AxiosResponse<unknown>>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function page(id: string, nextCursor: string | null): AxiosResponse<unknown> {
  return { status: 200, statusText: "OK", headers: new Headers(), data: {
    items: [{
      outboundEmailId: id, sourceType: "LEAD", sourceId: "lead-id",
      status: "SENT", requestedAt: "2026-10-18T09:00:00.000Z",
      recipient: { displayName: "Recipient", maskedAddress: "r***@example.com" },
      requestedBy: { id: "actor-id", displayName: "Actor" },
    }],
    nextCursor, hasNext: nextCursor !== null,
  } };
}

beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

describe("outbound email request generations", () => {
  it("keeps the new filter's rows and cursor after an obsolete load-more resolves", async () => {
    const oldMore = deferred();
    const get = vi.mocked(axiosClient.get);
    get.mockResolvedValueOnce(page("old-first", "old-cursor"))
      .mockImplementationOnce(() => oldMore.promise)
      .mockResolvedValueOnce(page("new-first", "new-cursor"))
      .mockResolvedValueOnce(page("new-more", null));
    const { result } = renderHook(() => useOutboundEmails());
    await waitFor(() => expect(result.current.hasNext).toBe(true));
    act(() => result.current.loadMore());
    const oldSignal = get.mock.calls[1][1]?.signal;
    act(() => result.current.setStatus("SENT"));
    await waitFor(() => expect(result.current.items[0]?.outboundEmailId).toBe("new-first"));
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => oldMore.resolve(page("obsolete", "wrong-cursor")));
    expect(result.current.items.map((item) => item.outboundEmailId)).toEqual(["new-first"]);
    expect(result.current.queryError).toBeNull();
    act(() => result.current.loadMore());
    const query = new URL(get.mock.calls[3][0], "http://localhost").searchParams;
    expect(query.get("status")).toBe("SENT");
    expect(query.get("cursor")).toBe("new-cursor");
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.hasNext).toBe(false);
  });

  it("ignores obsolete failures and finalizers while a reload is pending", async () => {
    const oldMore = deferred();
    const reload = deferred();
    const get = vi.mocked(axiosClient.get);
    get.mockResolvedValueOnce(page("first", "cursor"))
      .mockImplementationOnce(() => oldMore.promise)
      .mockImplementationOnce(() => reload.promise);
    const { result, unmount } = renderHook(() => useOutboundEmails());
    await waitFor(() => expect(result.current.hasNext).toBe(true));
    act(() => result.current.loadMore());
    act(() => { void result.current.reload(); });
    expect(get.mock.calls[1][1]?.signal?.aborted).toBe(true);
    await act(async () => oldMore.reject(new Error("obsolete failure")));
    expect(result.current.queryError).toBeNull();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isLoadingMore).toBe(false);
    unmount();
    expect(get.mock.calls[2][1]?.signal?.aborted).toBe(true);
    await act(async () => reload.resolve(page("after-unmount", null)));
  });
});

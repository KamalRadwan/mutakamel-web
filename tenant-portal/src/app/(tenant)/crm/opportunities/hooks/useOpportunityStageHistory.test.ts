// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axiosClient, TenantApiClientError, type AxiosResponse } from "@/lib/api/axiosClient";
import { opportunityStageHistoryPath } from "../opportunity-contract";
import { useOpportunityStageHistory } from "./useOpportunityStageHistory";

const id = "018f0000-0000-7000-8000-000000000001";
const otherId = "018f0000-0000-7000-8000-000000000002";
const row = (rowId: string) => ({ id: rowId, changedAt: "2026-10-18T00:00:00.000Z", fromStageSnapshot: null, toStageSnapshot: null });
const response = (data: unknown): AxiosResponse<unknown> => ({ data, status: 200, statusText: "OK", headers: new Headers() });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("opportunity stage history paging", () => {
  it("clears loaded history after an authoritative denial", async () => {
    vi.spyOn(axiosClient, "get")
      .mockResolvedValueOnce(response({ items: [row(id)], nextCursor: "older_cursor" }))
      .mockRejectedValueOnce(new TenantApiClientError("Forbidden", {
        status: 403, statusText: "Forbidden", headers: new Headers(), data: {},
      }));
    const onForbidden = vi.fn();
    const { result } = renderHook(() => useOpportunityStageHistory(id, 0, onForbidden));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    await act(async () => { await result.current.loadMore(); });
    expect(result.current.denied).toBe(true);
    expect(result.current.items).toEqual([]);
    expect(result.current.nextCursor).toBeNull();
    expect(onForbidden).toHaveBeenCalledOnce();
  });
  it("keeps loaded rows on a failed older-page read and retries the same cursor", async () => {
    const get = vi.spyOn(axiosClient, "get")
      .mockResolvedValueOnce(response({ items: [row(id)], nextCursor: "opaque_cursor" }))
      .mockRejectedValueOnce(new Error("Unavailable"))
      .mockResolvedValueOnce(response({ items: [row(otherId)], nextCursor: null }));
    const { result } = renderHook(() => useOpportunityStageHistory(id, 0));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    await act(async () => { await result.current.loadMore(); });
    expect(result.current.failed).toBe(true);
    expect(result.current.items.map((item) => item.id)).toEqual([id]);
    await act(async () => { await result.current.loadMore(); });
    expect(result.current.failed).toBe(false);
    expect(result.current.nextCursor).toBeNull();
    expect(result.current.items.map((item) => item.id)).toEqual([id, otherId]);
    expect(get.mock.calls.map(([path]) => path)).toEqual([
      opportunityStageHistoryPath(id), opportunityStageHistoryPath(id, "opaque_cursor"),
      opportunityStageHistoryPath(id, "opaque_cursor"),
    ]);
  });

  it("ignores an old selection's late response", async () => {
    let resolveOld!: (value: AxiosResponse<unknown>) => void;
    vi.spyOn(axiosClient, "get")
      .mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
      .mockResolvedValueOnce(response({ items: [row(otherId)], nextCursor: null }));
    const { result, rerender } = renderHook(({ selectedId }) => useOpportunityStageHistory(selectedId, 0), {
      initialProps: { selectedId: id },
    });
    await waitFor(() => expect(result.current.loading).toBe(true));
    rerender({ selectedId: otherId });
    await waitFor(() => expect(result.current.items[0]?.id).toBe(otherId));
    await act(async () => { resolveOld(response({ items: [row(id)], nextCursor: "old_cursor" })); });
    expect(result.current.items.map((item) => item.id)).toEqual([otherId]);
    expect(result.current.nextCursor).toBeNull();
  });
});

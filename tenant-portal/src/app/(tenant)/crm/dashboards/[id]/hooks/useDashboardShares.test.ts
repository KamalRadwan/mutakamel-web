// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDashboardShares } from "./useDashboardShares";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/axiosClient")>();
  return { ...actual, axiosClient: { ...actual.axiosClient, get } };
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("dashboard share loading failures", () => {
  it("retains the shares error and retries the share-list request", async () => {
    get.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ data: [] });
    const { result } = renderHook(() => useDashboardShares("01900300-0000-7000-8000-000000000001", true));

    await waitFor(() => expect(result.current.error).not.toBeNull());
    await act(async () => { await result.current.reload(); });

    expect(result.current.error).toBeNull();
    expect(result.current.shares).toEqual([]);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("exposes and retries target-search failures instead of silently returning no matches", async () => {
    get
      .mockResolvedValueOnce({ data: [] })
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ data: { items: [], nextOffset: null } });
    const { result } = renderHook(() => useDashboardShares("01900300-0000-7000-8000-000000000001", true));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));

    await act(async () => { await result.current.searchTargets("sales"); });
    expect(result.current.targetSearchError).not.toBeNull();
    await act(async () => { result.current.retrySearchTargets(); });
    await waitFor(() => expect(get).toHaveBeenCalledTimes(3));
    expect(result.current.targetSearchError).toBeNull();
  });
});

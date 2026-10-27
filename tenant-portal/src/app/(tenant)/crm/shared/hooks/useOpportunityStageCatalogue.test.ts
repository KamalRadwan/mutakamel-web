// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axiosClient } from "@/lib/api/axiosClient";
import { OPPORTUNITY_STAGES_PATH } from "../../pipelines/pipeline-contract";
import { useOpportunityStageCatalogue } from "./useOpportunityStageCatalogue";

vi.mock("@/lib/api/axiosClient", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api/axiosClient")>(),
  axiosClient: { get: vi.fn() },
}));

afterEach(cleanup);
beforeEach(() => vi.resetAllMocks());

describe("useOpportunityStageCatalogue", () => {
  it("loads only when enabled, using the bounded catalogue request", async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: [] } as Awaited<ReturnType<typeof axiosClient.get>>);
    const { result, rerender } = renderHook(
      ({ enabled }) => useOpportunityStageCatalogue(enabled),
      { initialProps: { enabled: false } },
    );
    await act(async () => {});
    expect(axiosClient.get).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    expect(axiosClient.get).toHaveBeenCalledExactlyOnceWith(
      OPPORTUNITY_STAGES_PATH,
      expect.objectContaining({ cache: "no-store", maxResponseBytes: 512 * 1024 }),
    );
    expect(result.current.items).toEqual([]);
    expect(result.current.degraded).toBe(false);
  });

  it("reports invalid responses and recovers on reload", async () => {
    vi.mocked(axiosClient.get)
      .mockResolvedValueOnce({ data: { invalid: true } } as Awaited<ReturnType<typeof axiosClient.get>>)
      .mockResolvedValueOnce({ data: [] } as Awaited<ReturnType<typeof axiosClient.get>>);
    const { result } = renderHook(() => useOpportunityStageCatalogue(true));
    await waitFor(() => expect(result.current.degraded).toBe(true));
    expect(result.current.hasLoaded).toBe(false);
    expect(result.current.queryError).not.toBeNull();
    await act(async () => { expect(await result.current.reload()).toBe(true); });
    expect(result.current.hasLoaded).toBe(true);
    expect(result.current.queryError).toBeNull();
  });

  it("aborts the request when the consumer unmounts", async () => {
    vi.mocked(axiosClient.get).mockImplementation(() => new Promise(() => {}));
    const { unmount } = renderHook(() => useOpportunityStageCatalogue(true));
    await waitFor(() => expect(axiosClient.get).toHaveBeenCalledOnce());
    const signal = vi.mocked(axiosClient.get).mock.calls[0][1]?.signal;
    expect(signal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
  });
});

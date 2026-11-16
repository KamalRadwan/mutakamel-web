// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TenantStorageMigrationView } from "./types";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("./api", () => ({ tenantStorageMigrationApi: { get: getMock } }));

import { useTenantStorageMigration } from "./use-tenant-storage-migration";

const MIGRATION_ID = "019f0000-0000-7000-8000-000000000040";
const copying: TenantStorageMigrationView = {
  id: MIGRATION_ID,
  tenantId: "019f0000-0000-7000-8000-000000000001",
  sourceStorageServerId: "019f0000-0000-7000-8000-000000000010",
  targetStorageServerId: "019f0000-0000-7000-8000-000000000011",
  expectedStoragePlacementRevision: "3",
  resultingStoragePlacementRevision: null,
  sourceOperationGeneration: "1",
  targetOperationGeneration: "1",
  status: "COPYING",
  copiedObjectCount: null,
  copiedBytes: null,
  namespaceDigest: null,
  failureCode: null,
  retainSource: false,
  sourceReleaseRequestedAt: null,
};

describe("useTenantStorageMigration polling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getMock.mockReset();
    getMock.mockResolvedValue(copying);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("retries a failed poll after five seconds and clears its error only on success", async () => {
    let resolveRetry!: (value: TenantStorageMigrationView) => void;
    getMock
      .mockResolvedValueOnce(copying)
      .mockRejectedValueOnce(new Error("Temporary network failure"))
      .mockReturnValueOnce(new Promise<TenantStorageMigrationView>((resolve) => {
        resolveRetry = resolve;
      }));
    const { result } = renderHook(() => useTenantStorageMigration());
    await act(async () => { result.current.lookup(MIGRATION_ID); });

    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(getMock).toHaveBeenCalledTimes(2);
    expect(result.current.migration).toEqual(copying);
    expect(result.current.error).not.toBeNull();
    const pollError = result.current.error;

    await act(async () => { await vi.advanceTimersByTimeAsync(4_999); });
    expect(getMock).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(getMock).toHaveBeenCalledTimes(3);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toEqual(pollError);

    const completed = { ...copying, status: "COMPLETED" as const };
    await act(async () => { resolveRetry(completed); });
    expect(result.current.migration).toEqual(completed);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(getMock).toHaveBeenCalledTimes(3);
  });

  it.each(["clear", "unmount"] as const)("%s cancels the retry timer after a failed poll", async (action) => {
    getMock.mockResolvedValueOnce(copying).mockRejectedValueOnce(new Error("Offline"));
    const { result, unmount } = renderHook(() => useTenantStorageMigration());
    await act(async () => { result.current.lookup(MIGRATION_ID); });
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(result.current.error).not.toBeNull();
    expect(vi.getTimerCount()).toBe(1);

    act(() => {
      if (action === "clear") result.current.clear();
      else unmount();
    });
    expect(vi.getTimerCount()).toBe(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(getMock).toHaveBeenCalledTimes(2);
    if (action === "clear") {
      expect(result.current.migration).toBeNull();
      expect(result.current.error).toBeNull();
    }
  });

  it.each(["clear", "unmount"] as const)("%s prevents an aborted poll from scheduling another timer", async (action) => {
    let rejectPoll!: (reason: Error) => void;
    getMock.mockResolvedValueOnce(copying).mockReturnValueOnce(
      new Promise<TenantStorageMigrationView>((_resolve, reject) => {
        rejectPoll = reject;
      }),
    );
    const { result, unmount } = renderHook(() => useTenantStorageMigration());
    await act(async () => { result.current.lookup(MIGRATION_ID); });
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    const signal = getMock.mock.calls[1][1] as AbortSignal;
    act(() => {
      if (action === "clear") result.current.clear();
      else unmount();
    });
    expect(signal.aborted).toBe(true);
    await act(async () => { rejectPoll(new Error("Aborted")); });
    expect(vi.getTimerCount()).toBe(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(getMock).toHaveBeenCalledTimes(2);
  });

  it("does not poll a committed migration awaiting source release", async () => {
    getMock.mockResolvedValue({ ...copying, status: "PLACEMENT_COMMITTED", retainSource: true });
    const { result } = renderHook(() => useTenantStorageMigration());
    await act(async () => { result.current.lookup(MIGRATION_ID); });
    expect(vi.getTimerCount()).toBe(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(getMock).toHaveBeenCalledTimes(1);
  });
});

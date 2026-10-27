// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { dashboardPath, dashboardRunPath } from "../../dashboard-contract";
import { useDashboardDetail } from "./useDashboardDetail";

const { get, post, patch } = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(), patch: vi.fn(),
}));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/axiosClient")>();
  return { ...actual, axiosClient: { ...actual.axiosClient, get, post, patch } };
});

const A = "01900300-0000-7000-8000-000000000001";
const B = "01900300-0000-7000-8000-000000000002";
const emptySelection = { datePreset: null, compare: null, branchId: null, currencyCode: null };
const filters = { ...emptySelection, currencyCode: "EGP" };

function definition(id: string, revision = 7) {
  return {
    id, revision, name: id, ownerUserId: A, ownerName: null, description: null,
    defaultFilters: { datePreset: "CURRENT_MONTH" }, sourceTemplateKey: null,
    createdAt: "2026-10-17T00:00:00Z", updatedAt: "2026-10-17T00:00:00Z",
    accessLevel: "OWNER", isShared: false, isDefault: false, isFavorite: false,
    lastOpenedAt: null, placements: [], unavailablePlacements: [],
  };
}

function execution(id: string) {
  return { dashboardId: id, revision: 7, generatedAt: "2026-10-17T00:00:00Z", widgets: {} };
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("dashboard selection changes", () => {
  it.each(["rerun", "reload"] as const)("keeps the latest rerun when an older %s resolves last", async (older) => {
    get.mockResolvedValue({ data: definition(A) });
    post.mockResolvedValue({ data: execution(A) });
    const { result } = renderHook(() => useDashboardDetail(A));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let finishFirst!: (value: { data: ReturnType<typeof execution> }) => void;
    let finishSecond!: (value: { data: ReturnType<typeof execution> }) => void;
    post.mockReturnValueOnce(new Promise((resolve) => { finishFirst = resolve; }));
    post.mockReturnValueOnce(new Promise((resolve) => { finishSecond = resolve; }));
    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = older === "reload" ? result.current.reload() : result.current.rerun(filters);
      second = result.current.rerun({ ...filters, currencyCode: "USD" });
    });
    const latest = { ...execution(A), revision: 9 };
    await act(async () => {
      finishSecond({ data: latest });
      await second;
    });
    expect(result.current.run?.revision).toBe(9);
    expect(result.current.isRunning).toBe(false);
    await act(async () => {
      finishFirst({ data: execution(A) });
      await first;
    });
    expect(result.current.run?.revision).toBe(9);
    expect(result.current.selection.currencyCode).toBe("USD");
    expect(result.current.runError).toBeNull();
  });

  it.each([false, true])("clears the previous dashboard while loading (definition failure: %s)", async (fails) => {
    get.mockResolvedValue({ data: definition(A) });
    post.mockResolvedValue({ data: execution(A) });
    const { result, rerender } = renderHook(({ id }) => useDashboardDetail(id), {
      initialProps: { id: A },
    });
    await waitFor(() => expect(result.current.detail?.id).toBe(A));
    await act(async () => { await result.current.rerun(filters); });
    expect(result.current.selection).toEqual(filters);
    expect(result.current.run?.dashboardId).toBe(A);

    let finishDefinition!: (value: { data: ReturnType<typeof definition> }) => void;
    let failDefinition!: (reason: unknown) => void;
    get.mockReturnValueOnce(new Promise((resolve, reject) => {
      finishDefinition = resolve;
      failDefinition = reject;
    }));
    let finishRun!: (value: { data: ReturnType<typeof execution> }) => void;
    post.mockReturnValueOnce(new Promise((resolve) => { finishRun = resolve; }));

    rerender({ id: B });
    await waitFor(() => expect(get).toHaveBeenLastCalledWith(dashboardPath(B), expect.any(Object)));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.detail).toBeNull();
    expect(result.current.run).toBeNull();
    expect(result.current.selection).toEqual(emptySelection);
    expect(post).toHaveBeenLastCalledWith(dashboardRunPath(B), {}, expect.any(Object));
    await act(async () => {
      expect((await result.current.rename("Wrong revision", "")).ok).toBe(false);
    });
    expect(patch).not.toHaveBeenCalled();

    await act(async () => {
      if (fails) {
        failDefinition(new TenantApiClientError("Server error", {
          status: 500, statusText: "Internal Server Error", headers: new Headers(), data: {},
        }));
      } else {
        finishDefinition({ data: definition(B, 2) });
      }
      finishRun({ data: execution(B) });
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    if (fails) {
      expect(result.current.detailError?.status).toBe(500);
      expect(result.current.detail).toBeNull();
    } else {
      expect(result.current.detail?.id).toBe(B);
      expect(result.current.detail?.revision).toBe(2);
      expect(result.current.detailError).toBeNull();
    }
    expect(result.current.run?.dashboardId).toBe(B);
    expect(result.current.selection).toEqual(emptySelection);
  });

  it("keeps the selected filters when reloading the same dashboard", async () => {
    get.mockResolvedValue({ data: definition(A) });
    post.mockResolvedValue({ data: execution(A) });
    const { result } = renderHook(() => useDashboardDetail(A));
    await waitFor(() => expect(result.current.detail?.id).toBe(A));
    await act(async () => { await result.current.rerun(filters); });
    await act(async () => { await result.current.reload(); });
    expect(result.current.selection).toEqual(filters);
    expect(post).toHaveBeenLastCalledWith(
      dashboardRunPath(A), { filters: { currencyCode: "EGP" } }, expect.any(Object),
    );
  });
});

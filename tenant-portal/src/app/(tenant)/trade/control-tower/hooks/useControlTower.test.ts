// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { CONTROL_TOWER_READ_PERMISSION } from "../control-tower-contract";
import { useControlTower } from "./useControlTower";

const state = vi.hoisted(() => ({
  permissions: [] as string[],
  headers: {} as Record<string, string>,
  get: vi.fn(),
}));

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: null }) }));
vi.mock("../../trade-api", () => ({ tradeGet: state.get }));
vi.mock("../../trade-advanced-scope", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../trade-advanced-scope")>(),
  useTradeBranchSelection: () => ({
    branchIds: ["branch-a", "branch-b"],
    branchId: state.headers["x-mutakamel-branch-id"],
    selectBranch: (branchId: string) => {
      state.headers = { ...state.headers, "x-mutakamel-branch-id": branchId };
    },
  }),
  useTradeScope: () => ({
    headers: state.headers,
    permissions: state.permissions,
    isTenantOwner: false,
  }),
}));

const row = {
  id: "01902001-3000-7000-8000-000000000001",
  sourceOwner: "worker-app",
  sourceType: "PDF_RENDER",
  category: "RENDER",
  severity: "HIGH",
  status: "OPEN",
  retryClass: "TRANSIENT",
  safeErrorCode: "RENDER_FAILED",
  version: 1,
  updatedAt: "2026-10-31T00:00:00.000Z",
};
const response = { data: { items: [row], total: 1, page: 1, limit: 25 } };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((accept, refuse) => {
    resolve = accept;
    reject = refuse;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  state.permissions = [CONTROL_TOWER_READ_PERMISSION];
  state.headers = { "x-mutakamel-branch-id": "branch-a" };
  state.get.mockReset().mockResolvedValue(response);
});
afterEach(cleanup);

describe("control tower list authorization and scope", () => {
  it("does not request the list automatically or manually without read permission", async () => {
    state.permissions = [];
    const { result } = renderHook(() => useControlTower());
    await act(async () => { await result.current.reload(); });
    expect(result.current.canRead).toBe(false);
    expect(state.get).not.toHaveBeenCalled();
    expect(result.current.items).toEqual([]);
    expect(result.current.pageInfo.total).toBe(0);
  });

  it("clears branch rows before the next request settles and keeps them empty on failure", async () => {
    const { result, rerender } = renderHook(() => useControlTower());
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.pageInfo.total).toBe(1);
    const next = deferred<typeof response>();
    state.get.mockReturnValueOnce(next.promise);

    act(() => { result.current.selectBranch("branch-b"); });
    rerender();
    await waitFor(() => expect(state.get).toHaveBeenCalledTimes(2));
    expect(state.get).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({
      headers: { "x-mutakamel-branch-id": "branch-b" },
    }));
    expect(result.current.items).toEqual([]);
    expect(result.current.pageInfo.total).toBe(0);

    await act(async () => { next.reject(new Error("Branch unavailable")); });
    expect(result.current.queryError).toMatchObject({ status: 0, message: "Branch unavailable" });
    expect(result.current.items).toEqual([]);
    expect(result.current.pageInfo.total).toBe(0);
    expect(result.current.isRefreshing).toBe(false);
  });

  it("clears loaded rows when a reload fails in the same scope", async () => {
    const { result } = renderHook(() => useControlTower());
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    state.get.mockRejectedValueOnce(new Error("Reload failed"));
    await act(async () => { await result.current.reload(); });
    expect(result.current.items).toEqual([]);
    expect(result.current.pageInfo.total).toBe(0);
    expect(result.current.queryError).toMatchObject({ status: 0, message: "Reload failed" });
  });

  it("clears the previous branch when the new scope has no read permission", async () => {
    const { result, rerender } = renderHook(() => useControlTower());
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    state.permissions = [];
    act(() => { result.current.selectBranch("branch-b"); });
    rerender();
    await waitFor(() => expect(result.current.items).toEqual([]));
    expect(result.current.pageInfo.total).toBe(0);
    expect(result.current.canRead).toBe(false);
    expect(state.get).toHaveBeenCalledTimes(1);
  });

  it("ignores an old branch response after its request was aborted", async () => {
    const previous = deferred<typeof response>();
    state.get.mockReturnValueOnce(previous.promise);
    const { result, rerender } = renderHook(() => useControlTower());
    await waitFor(() => expect(state.get).toHaveBeenCalledTimes(1));
    const oldSignal = state.get.mock.calls[0][1].signal as AbortSignal;
    state.get.mockResolvedValueOnce({ data: { items: [], total: 0, page: 1, limit: 25 } });
    act(() => { result.current.selectBranch("branch-b"); });
    rerender();
    await waitFor(() => expect(state.get).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    expect(oldSignal.aborted).toBe(true);
    await act(async () => { previous.resolve(response); });
    expect(result.current.items).toEqual([]);
    expect(result.current.pageInfo.total).toBe(0);
    expect(result.current.queryError).toBeNull();
  });
});

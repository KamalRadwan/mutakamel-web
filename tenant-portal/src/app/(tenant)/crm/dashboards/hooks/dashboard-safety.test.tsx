// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useDashboards } from "./useDashboards";
import { DASHBOARDS_PATH, dashboardDefaultPath } from "../dashboard-contract";
import { TenantApiClientError } from "@/lib/api/axiosClient";
const { get, put, auth } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), auth: { generation: 0, canMutate: true, id: "01900300-0000-7000-8000-000000000001" } }));
vi.mock("@/hooks/useAccessMode", () => ({ useAccessMode: () => ({ canMutate: auth.canMutate }) }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ realtimeAuthGeneration: auth.generation, user: { id: auth.id, isTenantOwner: true, permissions: [], accessibleBranches: [] } }) }));
vi.mock("@/lib/api/axiosClient", async (original) => ({ ...(await original<typeof import("@/lib/api/axiosClient")>()), axiosClient: { get, put } }));
const ID = "01900300-0000-7000-8000-000000000001";
const OTHER = "01900300-0000-7000-8000-000000000002";
const definition = (id = ID) => ({ id, ownerUserId: auth.id, name: "Sales", revision: 3, updatedAt: "2026-11-03T10:00:00Z", accessLevel: "OWNER", placements: [], unavailablePlacements: [] });
const catalog = { grid: {}, visualizations: [], metrics: [], dimensions: [], templates: [] };
beforeEach(() => { auth.generation++; auth.canMutate = true; auth.id = ID; get.mockImplementation(async (path: string) => ({ data: path === DASHBOARDS_PATH ? { items: [definition()], nextCursor: null } : catalog })); });
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("admits only one preference write before React commits pending state", async () => {
  let resolve!: (value: unknown) => void;
  put.mockReturnValue(new Promise((done) => { resolve = done; }));
  const { result } = renderHook(() => useDashboards(true));
  await waitFor(() => expect(result.current.items).toHaveLength(1));
  let first!: ReturnType<typeof result.current.setDefault>;
  act(() => { first = result.current.setDefault(ID); void result.current.setDefault(ID); });
  expect(put).toHaveBeenCalledTimes(1);
  expect(put).toHaveBeenCalledWith(dashboardDefaultPath(ID), undefined, expect.objectContaining({ nonReplayable: true }));
  await act(async () => { resolve({ data: { ...definition(), isDefault: true }, headers: new Headers(), status: 200 }); await first; });
});
it("rejects a wrong-resource receipt and keeps the fence across remount until read and explicit review", async () => {
  put.mockResolvedValue({ data: { ...definition(OTHER), isDefault: true }, headers: new Headers(), status: 200 });
  const first = renderHook(() => useDashboards(true));
  await waitFor(() => expect(first.result.current.items).toHaveLength(1));
  await act(async () => { expect((await first.result.current.setDefault(ID)).ok).toBe(false); });
  expect(first.result.current.needsReconciliation).toBe(true);
  first.unmount();
  const second = renderHook(() => useDashboards(true));
  await waitFor(() => expect(second.result.current.reviewReady).toBe(true));
  await act(async () => { expect((await second.result.current.setDefault(ID)).ok).toBe(false); });
  expect(put).toHaveBeenCalledTimes(1);
  act(() => second.result.current.acknowledge());
  expect(second.result.current.needsReconciliation).toBe(false);
});
it("hides prior authority immediately and cannot revive it through A to B to A", async () => {
  const { result, rerender } = renderHook(() => useDashboards(true));
  await waitFor(() => expect(result.current.items).toHaveLength(1));
  get.mockReturnValue(new Promise(() => undefined));
  auth.id = OTHER; rerender(); expect(result.current.items).toEqual([]);
  auth.id = ID; rerender(); expect(result.current.items).toEqual([]);
});
it("invalidates an old write handler as soon as the tenant becomes read-only", async () => {
  const { result, rerender } = renderHook(() => useDashboards(true));
  await waitFor(() => expect(result.current.items).toHaveLength(1));
  const oldHandler = result.current.setDefault;
  auth.canMutate = false; rerender();
  await act(async () => { expect((await oldHandler(ID)).ok).toBe(false); });
  expect(put).not.toHaveBeenCalled();
});
it("distinguishes a confirmed write from a failed refresh without replaying it", async () => {
  put.mockResolvedValue({ data: { ...definition(), isDefault: true }, headers: new Headers(), status: 200 });
  const { result } = renderHook(() => useDashboards(true));
  await waitFor(() => expect(result.current.items).toHaveLength(1));
  get.mockRejectedValue(new Error("offline after receipt"));
  await act(async () => { expect(await result.current.setDefault(ID)).toMatchObject({ ok: true, refreshFailed: true }); });
  expect(put).toHaveBeenCalledTimes(1);
  expect(result.current.items).toHaveLength(1);
});
it("settles a current read invalidated by a rejected concurrent write without exposing its obsolete response", async () => {
  const { result } = renderHook(() => useDashboards(true));
  await waitFor(() => expect(result.current.items).toHaveLength(1));
  let finishRead!: (response: unknown) => void;
  get.mockImplementation((path: string) => path === DASHBOARDS_PATH ? new Promise((resolve) => { finishRead = resolve; }) : Promise.resolve({ data: catalog }));
  put.mockRejectedValue(new TenantApiClientError("Rejected", { status: 409, statusText: "Conflict", headers: new Headers(), data: { code: "CRM_DASHBOARD_NAME_CONFLICT" } }));
  let read!: Promise<boolean>;
  act(() => { read = result.current.reload(); });
  await act(async () => { expect((await result.current.setDefault(ID)).ok).toBe(false); });
  await act(async () => { finishRead({ data: { items: [{ ...definition(), name: "Obsolete" }], nextCursor: null } }); await read; });
  expect(result.current.isLoading).toBe(false);
  expect(result.current.items[0].name).toBe("Sales");
});


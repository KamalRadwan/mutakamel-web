// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { usePipelineAssignments } from "./usePipelineAssignments";
import { deferred, PIPELINE_ID, response, USER_ID } from "./pipeline-safety.test-support";

const { get, put, auth } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), auth: { id: "assignments-safety", permissions: ["crm.pipelines.manage"] } }));
vi.mock("@/lib/api/axiosClient", async (original) => {
  const actual = await original<typeof import("@/lib/api/axiosClient")>();
  return { ...actual, axiosClient: { ...actual.axiosClient, get, put } };
});
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: auth, realtimeAuthGeneration: "assignments-safety-session" }) }));
const restricted = { accessMode: "RESTRICTED", userIds: [USER_ID], teamIds: [] };
const all = { accessMode: "ALL", userIds: [], teamIds: [] };
let actor = 0;
beforeEach(() => {
  auth.id = `assignments-safety-${++actor}`;
  get.mockImplementation(async (path: string) => response(path.includes("assignment-options") ? { users: [{ id: USER_ID, label: "Nour", status: "ACTIVE" }], teams: [] } : restricted));
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("fences duplicate replacements synchronously and validates the exact replacement receipt", async () => {
  const write = deferred<ReturnType<typeof response>>(); put.mockReturnValue(write.promise);
  const { result } = renderHook(() => usePipelineAssignments(PIPELINE_ID, true));
  await waitFor(() => expect(result.current.assignments).not.toBeNull());
  act(() => result.current.setAccessMode("ALL"));
  let first!: Promise<unknown>;
  await act(async () => { first = result.current.save(); expect(await result.current.save()).toMatchObject({ ok: false }); });
  expect(put).toHaveBeenCalledTimes(1);
  get.mockResolvedValue(response(all));
  await act(async () => { write.resolve(response(all)); await first; });
  expect(result.current.assignments?.accessMode).toBe("ALL");
});

it("keeps an unknown replacement fenced across remount, preserves a draft, and never retries on recovery", async () => {
  const first = renderHook(() => usePipelineAssignments(PIPELINE_ID, true));
  await waitFor(() => expect(first.result.current.assignments).not.toBeNull());
  act(() => first.result.current.setAccessMode("ALL"));
  put.mockRejectedValue(new TypeError("lost")); get.mockRejectedValue(new TypeError("offline"));
  await act(async () => { await first.result.current.save(); });
  expect(first.result.current.accessMode).toBe("ALL"); expect(first.result.current.needsReconciliation).toBe(true);
  first.unmount();
  const next = renderHook(() => usePipelineAssignments(PIPELINE_ID, true));
  await waitFor(() => expect(next.result.current.loadError).not.toBeNull());
  await act(async () => { await next.result.current.save(); });
  expect(put).toHaveBeenCalledTimes(1);
  get.mockResolvedValue(response(restricted));
  await act(async () => { expect(await next.result.current.reconcile()).toBe(true); });
  expect(next.result.current.needsReconciliation).toBe(false);
  expect(put).toHaveBeenCalledTimes(1);
});

it("ignores an old assignments read after an explicit replacement", async () => {
  const { result } = renderHook(() => usePipelineAssignments(PIPELINE_ID, true));
  await waitFor(() => expect(result.current.assignments).not.toBeNull());
  const old = deferred<ReturnType<typeof response>>(); get.mockReturnValueOnce(old.promise);
  let oldRead!: Promise<boolean>;
  act(() => { oldRead = result.current.reload(); result.current.setAccessMode("ALL"); });
  put.mockResolvedValue(response(all)); get.mockResolvedValue(response(all));
  await act(async () => { await result.current.save(); });
  await act(async () => { old.resolve(response(restricted)); expect(await oldRead).toBe(false); });
  expect(result.current.assignments?.accessMode).toBe("ALL"); expect(result.current.accessMode).toBe("ALL");
});

it("does not treat a different replacement body as a successful receipt", async () => {
  const { result } = renderHook(() => usePipelineAssignments(PIPELINE_ID, true));
  await waitFor(() => expect(result.current.assignments).not.toBeNull());
  act(() => result.current.setAccessMode("ALL"));
  put.mockResolvedValue(response(restricted)); get.mockRejectedValue(new TypeError("offline"));
  await act(async () => { expect(await result.current.save()).toMatchObject({ ok: false, uncertain: true, reconciled: false }); });
  expect(result.current.needsReconciliation).toBe(true);
});

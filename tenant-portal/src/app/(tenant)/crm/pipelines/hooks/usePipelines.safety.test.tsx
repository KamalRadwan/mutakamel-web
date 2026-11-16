// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { usePipelines } from "./usePipelines";
import { usePipelinesPage } from "./usePipelinesPage";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
import { deferred, OTHER_ID, pipeline, PIPELINE_ID, response } from "./pipeline-safety.test-support";

const { get, post, put, remove, auth } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), remove: vi.fn(), auth: { id: "list-safety", permissions: ["crm.pipelines.read", "crm.pipelines.manage"] } }));
vi.mock("@/lib/api/axiosClient", async (original) => {
  const actual = await original<typeof import("@/lib/api/axiosClient")>();
  return { ...actual, axiosClient: { ...actual.axiosClient, get, post, put, delete: remove } };
});
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: auth, realtimeAuthGeneration: "list-safety-session" }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/hooks/useUnsavedChangesGuard", () => ({ useUnsavedChangesGuard: () => ({ requestDiscard: (action: () => void) => action(), isDiscardOpen: false }) }));
vi.mock("./usePipelineFeedback", () => ({ usePipelineFeedback: () => ({ report: (result: { ok: boolean }) => result.ok, describeFailure: () => "Failed", outcome: vi.fn() }) }));
vi.mock("../../shared/hooks/useOpportunityStageCatalogue", () => ({ useOpportunityStageCatalogue: () => ({ items: [], isLoading: false, queryError: null, reload: vi.fn() }) }));
let actor = 0;
beforeEach(() => { auth.id = `list-safety-${++actor}`; get.mockResolvedValue(response([pipeline()])); });
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("fences duplicate defaults synchronously before React commits pending state", async () => {
  const write = deferred<ReturnType<typeof response>>();
  put.mockReturnValue(write.promise);
  const { result } = renderHook(() => usePipelines());
  await waitFor(() => expect(result.current.hasLoaded).toBe(true));
  let first!: Promise<unknown>;
  await act(async () => {
    first = result.current.setDefault(PIPELINE_ID);
    expect(await result.current.setDefault(PIPELINE_ID)).toMatchObject({ ok: false });
  });
  expect(put).toHaveBeenCalledTimes(1);
  get.mockResolvedValue(response([pipeline({ isDefault: true })]));
  await act(async () => { write.resolve(response(pipeline({ isDefault: true }))); await first; });
  expect(result.current.allItems[0].isDefault).toBe(true);
});

it("rereads an unknown default instead of asserting the previous default", async () => {
  const { result } = renderHook(() => usePipelines());
  await waitFor(() => expect(result.current.hasLoaded).toBe(true));
  put.mockRejectedValue(new TypeError("response lost"));
  get.mockResolvedValue(response([pipeline({ isDefault: true })]));
  await act(async () => { expect(await result.current.setDefault(PIPELINE_ID)).toMatchObject({ ok: false, uncertain: true, reconciled: true }); });
  expect(result.current.allItems[0].isDefault).toBe(true);
  expect(put).toHaveBeenCalledTimes(1);
});

it("keeps failed reconciliation fenced across hook remount and permits only an explicit retry after recovery", async () => {
  const first = renderHook(() => usePipelines());
  await waitFor(() => expect(first.result.current.hasLoaded).toBe(true));
  put.mockRejectedValue(new TypeError("lost")); get.mockRejectedValue(new TypeError("offline"));
  await act(async () => { await first.result.current.setDefault(PIPELINE_ID); });
  expect(first.result.current.needsReconciliation).toBe(true);
  first.unmount();
  const next = renderHook(() => usePipelines());
  await waitFor(() => expect(next.result.current.isLoading).toBe(false));
  await act(async () => { await next.result.current.remove(PIPELINE_ID); await next.result.current.create({ code: "NEW", nameAr: "جديد", nameEn: "New", description: "", isDefault: false, stageIds: [] }); });
  expect(remove).not.toHaveBeenCalled(); expect(post).not.toHaveBeenCalled();
  get.mockResolvedValue(response([pipeline()]));
  await act(async () => { expect(await next.result.current.reload()).toBe(true); });
  expect(next.result.current.needsReconciliation).toBe(false);
  expect(put).toHaveBeenCalledTimes(1);
  put.mockResolvedValue(response(pipeline({ isDefault: true })));
  get.mockResolvedValue(response([pipeline({ isDefault: true })]));
  await act(async () => { expect(await next.result.current.setDefault(PIPELINE_ID)).toMatchObject({ ok: true }); });
  expect(put).toHaveBeenCalledTimes(2);
});

it("ignores a pre-write late list read", async () => {
  const { result } = renderHook(() => usePipelines());
  await waitFor(() => expect(result.current.hasLoaded).toBe(true));
  const old = deferred<ReturnType<typeof response>>();
  get.mockReturnValueOnce(old.promise);
  let oldRead!: Promise<boolean>;
  act(() => { oldRead = result.current.reload(); });
  put.mockResolvedValue(response(pipeline({ isDefault: true })));
  get.mockResolvedValue(response([pipeline({ isDefault: true })]));
  await act(async () => { await result.current.setDefault(PIPELINE_ID); });
  await act(async () => { old.resolve(response([pipeline()])); expect(await oldRead).toBe(false); });
  expect(result.current.allItems[0].isDefault).toBe(true);
});

it("rejects a wrong-resource default receipt and keeps the failed-reread fence", async () => {
  const { result } = renderHook(() => usePipelines());
  await waitFor(() => expect(result.current.hasLoaded).toBe(true));
  put.mockResolvedValue(response(pipeline({ id: OTHER_ID, isDefault: true, stages: [] })));
  get.mockRejectedValue(new TypeError("offline"));
  await act(async () => { expect(await result.current.setDefault(PIPELINE_ID)).toMatchObject({ ok: false, uncertain: true, reconciled: false }); });
  expect(result.current.needsReconciliation).toBe(true);
});

it("create Check current clears its block after a successful read, while reopen cannot bypass a failed read", async () => {
  const { result } = renderHook(() => usePipelinesPage());
  await waitFor(() => expect(result.current.list.hasLoaded).toBe(true));
  const input = { code: "NEW", nameAr: "جديد", nameEn: "New", description: "", isDefault: false, stageIds: [] };
  act(() => result.current.openCreate());
  post.mockRejectedValue(new TypeError("lost")); get.mockRejectedValue(new TypeError("offline"));
  await act(async () => { await result.current.create(input); });
  expect(result.current.createUncertain).toBe(true);
  act(() => { result.current.setIsCreateOpen(false); result.current.openCreate(); });
  await act(async () => { await result.current.create(input); });
  expect(post).toHaveBeenCalledTimes(1);
  await act(async () => { await result.current.reconcileCreate(); });
  expect(result.current.createUncertain).toBe(true);
  get.mockResolvedValue(response([pipeline()]));
  await act(async () => { await result.current.reconcileCreate(); });
  expect(result.current.createUncertain).toBe(false);
  expect(post).toHaveBeenCalledTimes(1);
});

it("does not clear a catalogue fence with a reader-shaped partial configuration", async () => {
  const { result } = renderHook(() => usePipelines());
  await waitFor(() => expect(result.current.hasLoaded).toBe(true));
  put.mockRejectedValue(new TypeError("lost"));
  get.mockResolvedValue(response([pipeline({ assignments: null })]));
  await act(async () => { await result.current.setDefault(PIPELINE_ID); });
  expect(result.current.needsReconciliation).toBe(true);
  await act(async () => { expect(await result.current.reload()).toBe(false); });
  expect(result.current.needsReconciliation).toBe(true);
  get.mockResolvedValue(response([pipeline()]));
  await act(async () => { expect(await result.current.reload()).toBe(true); });
  expect(result.current.needsReconciliation).toBe(false);
});

it.each([{ status: 503, code: "SERVICE_UNAVAILABLE" }, { status: 409, code: "GW.IDEM.IN_FLIGHT" }])("keeps $code fenced on a failed reread and never repeats the PUT automatically", async ({ status, code }) => {
  const { result } = renderHook(() => usePipelines());
  await waitFor(() => expect(result.current.hasLoaded).toBe(true));
  put.mockRejectedValue(new TenantApiClientError("Unknown result", { status, statusText: "", headers: new Headers(), data: { code } }));
  get.mockRejectedValue(new TypeError("offline"));
  await act(async () => { expect(await result.current.setDefault(PIPELINE_ID)).toMatchObject({ ok: false, uncertain: true, reconciled: false }); });
  expect(result.current.needsReconciliation).toBe(true);
  await act(async () => { await result.current.setDefault(PIPELINE_ID); });
  expect(put).toHaveBeenCalledTimes(1);
  get.mockResolvedValue(response([pipeline({ isDefault: true })]));
  await act(async () => { expect(await result.current.reload()).toBe(true); });
  expect(put).toHaveBeenCalledTimes(1);
});

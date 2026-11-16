// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { usePipelineDetail } from "./usePipelineDetail";
import { deferred, OTHER_ID, pipeline, PIPELINE_ID, response, stages } from "./pipeline-safety.test-support";

const { get, post, patch, remove, auth } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), remove: vi.fn(), auth: { id: "detail-safety", permissions: ["crm.pipelines.read", "crm.pipelines.manage"] } }));
vi.mock("@/lib/api/axiosClient", async (original) => {
  const actual = await original<typeof import("@/lib/api/axiosClient")>();
  return { ...actual, axiosClient: { ...actual.axiosClient, get, post, patch, delete: remove } };
});
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: auth, realtimeAuthGeneration: "detail-safety-session" }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("../../shared/hooks/useOpportunityStageCatalogue", () => ({ useOpportunityStageCatalogue: () => ({ items: [], queryError: null, reload: vi.fn() }) }));
let actor = 0;
beforeEach(() => { auth.id = `detail-safety-${++actor}`; get.mockResolvedValue(response(pipeline())); });
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("synchronously rejects a different stage operation while an edit is pending", async () => {
  const write = deferred<ReturnType<typeof response>>();
  patch.mockReturnValue(write.promise);
  const { result } = renderHook(() => usePipelineDetail(PIPELINE_ID));
  await waitFor(() => expect(result.current.pipeline).not.toBeNull());
  let first!: Promise<unknown>;
  await act(async () => {
    first = result.current.save({ nameAr: "مبيعات", nameEn: "Sales", description: "Updated", isActive: true });
    expect(await result.current.attachStage(OTHER_ID)).toMatchObject({ ok: false });
    expect(await result.current.moveStage(stages()[1].id, 1)).toMatchObject({ ok: false });
  });
  expect(post).not.toHaveBeenCalled(); expect(patch).toHaveBeenCalledTimes(1);
  get.mockResolvedValue(response(pipeline({ description: "Updated" })));
  await act(async () => { write.resolve(response(pipeline({ description: "Updated" }))); await first; });
});

it("unknown reorder rereads the committed order and never asserts a false rollback", async () => {
  const { result } = renderHook(() => usePipelineDetail(PIPELINE_ID));
  await waitFor(() => expect(result.current.pipeline).not.toBeNull());
  const current = stages();
  const committed = [current[0], current[2], current[1], current[3]].map((stage, index) => ({ ...stage, rank: index + 1 }));
  patch.mockRejectedValue(new TypeError("response lost"));
  get.mockResolvedValue(response(pipeline({ stages: committed })));
  await act(async () => { expect(await result.current.moveStage(current[1].id, 1)).toMatchObject({ ok: false, uncertain: true, reconciled: true }); });
  expect(result.current.pipeline?.stages.map((stage) => stage.id)).toEqual(committed.map((stage) => stage.id));
  expect(patch).toHaveBeenCalledTimes(1);
});

it("unknown attach and failed reread fence edit/reset/detach across remount until recovery", async () => {
  const first = renderHook(() => usePipelineDetail(PIPELINE_ID));
  await waitFor(() => expect(first.result.current.pipeline).not.toBeNull());
  post.mockRejectedValue(new TypeError("lost")); get.mockRejectedValue(new TypeError("offline"));
  await act(async () => { await first.result.current.attachStage(OTHER_ID); });
  expect(first.result.current.needsReconciliation).toBe(true);
  first.unmount();
  const next = renderHook(() => usePipelineDetail(PIPELINE_ID));
  await waitFor(() => expect(next.result.current.isLoading).toBe(false));
  await act(async () => {
    await next.result.current.reset(); await next.result.current.detachStage(stages()[1].id);
    await next.result.current.save({ nameAr: "مبيعات", nameEn: "Sales", description: "", isActive: true });
  });
  expect(post).toHaveBeenCalledTimes(1); expect(patch).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled();
  get.mockResolvedValue(response(pipeline()));
  await act(async () => { expect(await next.result.current.reload()).toBe(true); });
  expect(next.result.current.needsReconciliation).toBe(false);
  expect(post).toHaveBeenCalledTimes(1);
});

it("rejects a malformed successful attach receipt instead of reporting success", async () => {
  const { result } = renderHook(() => usePipelineDetail(PIPELINE_ID));
  await waitFor(() => expect(result.current.pipeline).not.toBeNull());
  post.mockResolvedValue(response({ id: "wrong-shape" }, 201));
  get.mockRejectedValue(new TypeError("offline"));
  await act(async () => { expect(await result.current.attachStage(OTHER_ID)).toMatchObject({ ok: false, uncertain: true, reconciled: false }); });
  expect(result.current.needsReconciliation).toBe(true);
});

it("does not accept a late detail from the previous pipeline resource", async () => {
  const old = deferred<ReturnType<typeof response>>();
  get.mockImplementation((path: string) => path.includes(PIPELINE_ID) ? old.promise : Promise.resolve(response(pipeline({ id: OTHER_ID, code: "OTHER", stages: [] }))));
  const { result, rerender } = renderHook(({ id }) => usePipelineDetail(id), { initialProps: { id: PIPELINE_ID } });
  await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
  rerender({ id: OTHER_ID });
  await waitFor(() => expect(result.current.pipeline?.id).toBe(OTHER_ID));
  await act(async () => { old.resolve(response(pipeline())); await old.promise; });
  expect(result.current.pipeline?.id).toBe(OTHER_ID);
});

it("does not expose a late detail after actor scope changes", async () => {
  const old = deferred<ReturnType<typeof response>>();
  get.mockReturnValueOnce(old.promise).mockResolvedValue(response(pipeline({ nameEn: "New actor view" })));
  const { result, rerender } = renderHook(() => usePipelineDetail(PIPELINE_ID));
  await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
  auth.id = `new-actor-${actor}`;
  rerender();
  await waitFor(() => expect(result.current.pipeline?.nameEn).toBe("New actor view"));
  await act(async () => { old.resolve(response(pipeline({ nameEn: "Old actor view" }))); await old.promise; });
  expect(result.current.pipeline?.nameEn).toBe("New actor view");
});

it("rejects configuration accessMode disagreement without clearing uncertainty", async () => {
  const { result } = renderHook(() => usePipelineDetail(PIPELINE_ID));
  await waitFor(() => expect(result.current.pipeline).not.toBeNull());
  post.mockRejectedValue(new TypeError("lost"));
  get.mockResolvedValue(response(pipeline({ accessMode: "RESTRICTED" })));
  await act(async () => { await result.current.attachStage(OTHER_ID); });
  expect(result.current.needsReconciliation).toBe(true);
  await act(async () => { expect(await result.current.reload()).toBe(false); });
  expect(result.current.needsReconciliation).toBe(true);
});

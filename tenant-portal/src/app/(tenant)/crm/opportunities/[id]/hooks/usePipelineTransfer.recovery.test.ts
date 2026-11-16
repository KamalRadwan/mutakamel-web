// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axiosClient } from "@/lib/api/axiosClient";
import { createWriteAttempt, runIdempotentWrite } from "@/lib/api/idempotent-write";
import { parseOpportunityDetailResponse } from "../../opportunity-contract";
import type { OpportunityPipeline } from "../../hooks/pipeline-types";
import { usePipelineTransfer } from "./usePipelineTransfer";

vi.mock("@/lib/api/axiosClient", async (original) => ({ ...await original<typeof import("@/lib/api/axiosClient")>(), axiosClient: { get: vi.fn() } }));
vi.mock("@/lib/api/idempotent-write", () => ({ createWriteAttempt: vi.fn(), runIdempotentWrite: vi.fn() }));
const id = (suffix: string) => `01900100-0000-7000-8000-${suffix.padStart(12, "0")}`;
const origin = parseOpportunityDetailResponse({ id: id("1"), branchId: id("2"), customerProfileId: id("3"), pipelineId: id("4"), stageId: id("5"), title: "Support contract", status: "IN_PROGRESS", importance: 0, createdAt: "2026-11-01T09:00:00.000Z", updatedAt: "2026-11-04T09:00:00.000Z" });
const target: OpportunityPipeline = { id: id("6"), code: "GOVERNMENT", nameEn: "Government sales", nameAr: "حكومي", isActive: true, isDefault: false, stages: [] };
const fresh = { ...origin, pipelineId: target.id, stageId: id("7"), updatedAt: "2026-11-04T10:00:00.000Z" };
const response = (data: unknown) => ({ data, status: 200, statusText: "OK", headers: new Headers() });
beforeEach(() => {
  vi.mocked(axiosClient.get).mockReset().mockResolvedValue(response(origin));
  vi.mocked(createWriteAttempt).mockReset().mockImplementation(() => ({ idempotencyKey: id(String(20 + vi.mocked(createWriteAttempt).mock.calls.length)) }));
  vi.mocked(runIdempotentWrite).mockReset().mockResolvedValue({ kind: "success", value: fresh, replayed: false });
});
afterEach(cleanup);

function setup() {
  const onReconcile = vi.fn();
  const hook = renderHook(() => usePipelineTransfer(origin, [target], onReconcile));
  act(() => hook.result.current.openDialog());
  act(() => { hook.result.current.setPipelineId(target.id); hook.result.current.setReason("Public procurement"); });
  return { ...hook, onReconcile };
}

describe("pipeline transfer recovery", () => {
  it("blocks fresh commands and confirms an already-applied transfer with a read", async () => {
    vi.mocked(runIdempotentWrite).mockResolvedValueOnce({ kind: "ambiguous", error: { status: 0 } });
    vi.mocked(axiosClient.get).mockResolvedValue(response(fresh));
    const { result } = setup();
    await act(async () => { await result.current.submit(); });
    const original = result.current.ambiguity!.attempt;
    act(() => { result.current.setPipelineId(id("99")); result.current.openDialog(); });
    await act(async () => { await result.current.submit(); });
    expect(result.current.pipelineId).toBe(target.id);
    expect(runIdempotentWrite).toHaveBeenCalledOnce();
    expect(createWriteAttempt).toHaveBeenCalledOnce();
    await act(async () => { await result.current.ambiguity!.replay(); });
    expect(axiosClient.get).toHaveBeenCalledOnce();
    expect(runIdempotentWrite).toHaveBeenCalledOnce();
    expect(result.current.ambiguity).toBeNull();
    expect(result.current.open).toBe(false);
    expect(original.idempotencyKey).toBeTruthy();
  });

  it("replays only the original idempotent body/key after an unchanged read", async () => {
    vi.mocked(runIdempotentWrite).mockResolvedValueOnce({ kind: "ambiguous", error: { status: 0 } });
    const { result } = setup();
    await act(async () => { await result.current.submit(); });
    const original = vi.mocked(runIdempotentWrite).mock.calls[0][0];
    act(() => result.current.setReason("Different intent"));
    await act(async () => { await result.current.ambiguity!.replay(); });
    const replay = vi.mocked(runIdempotentWrite).mock.calls[1][0];
    expect(axiosClient.get).toHaveBeenCalledOnce();
    expect(replay.attempt).toBe(original.attempt);
    expect(replay.body).toBe(original.body);
    expect(createWriteAttempt).toHaveBeenCalledOnce();
    expect(result.current.open).toBe(false);
  });

  it("keeps uncertainty and intent through a failed read or refused replay", async () => {
    vi.mocked(runIdempotentWrite).mockResolvedValueOnce({ kind: "ambiguous", error: { status: 0 } }).mockResolvedValueOnce({ kind: "failed", error: { status: 403 } });
    const { result } = setup();
    await act(async () => { await result.current.submit(); });
    const attempt = result.current.ambiguity!.attempt;
    vi.mocked(axiosClient.get).mockRejectedValueOnce(new Error("Read unavailable"));
    await act(async () => { await result.current.reconcile(); });
    expect(result.current.ambiguity!.attempt).toBe(attempt);
    expect(result.current.locked).toBe(true);
    await act(async () => { await result.current.ambiguity!.replay(); });
    expect(result.current.ambiguity!.attempt).toBe(attempt);
    expect(result.current.error?.status).toBe(403);
    await act(async () => { await result.current.submit(); });
    expect(createWriteAttempt).toHaveBeenCalledOnce();
  });

  it("does not replay a newer record after another stage or scalar change", async () => {
    vi.mocked(runIdempotentWrite).mockResolvedValueOnce({ kind: "ambiguous", error: { status: 0 } });
    vi.mocked(axiosClient.get).mockResolvedValue(response({ ...origin, updatedAt: fresh.updatedAt }));
    const { result, onReconcile } = setup();
    await act(async () => { await result.current.submit(); });
    await act(async () => { await result.current.ambiguity!.replay(); });
    expect(runIdempotentWrite).toHaveBeenCalledOnce();
    expect(result.current.error?.status).toBe(409);
    expect(onReconcile).toHaveBeenCalledOnce();
  });

  it("keeps applied-unreadable recovery reachable and never repeats its write", async () => {
    vi.mocked(runIdempotentWrite).mockResolvedValueOnce({ kind: "applied_unreadable", error: { status: 200 } });
    const { result } = setup();
    await act(async () => { await result.current.submit(); });
    expect(result.current.open).toBe(true);
    expect(result.current.locked).toBe(true);
    vi.mocked(axiosClient.get).mockRejectedValueOnce(new Error("Read unavailable"));
    await act(async () => { await result.current.reconcile(); });
    expect(result.current.appliedUnreadable).not.toBeNull();
    vi.mocked(axiosClient.get).mockResolvedValue(response(fresh));
    await act(async () => { await result.current.reconcile(); });
    expect(result.current.open).toBe(false);
    expect(result.current.appliedUnreadable).toBeNull();
    expect(runIdempotentWrite).toHaveBeenCalledOnce();
  });
});

// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useOutboundEmailWrite } from "./useOutboundEmailWrite";

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/lib/api/axiosClient", async (original) => ({
  ...await original<typeof import("@/lib/api/axiosClient")>(), axiosClient: { post },
}));
vi.mock("@/lib/uuid", () => ({ generateUUIDv7: () => "01900500-0000-7000-8000-000000000009" }));
const path = "/api/tenant/crm/v1/outbound-emails";
const body = { sourceType: "LEAD", sourceId: "01900500-0000-7000-8000-000000000002" };
const accepted = { data: {
  outboundEmailId: "01900500-0000-7000-8000-000000000001", status: "QUEUED",
  requestedAt: "2026-11-03T09:00:00.000Z", recipient: { displayName: "Ahmed", maskedAddress: "a***@***" },
}, headers: new Headers() };
beforeEach(() => post.mockReset());
afterEach(cleanup);

describe("outbound email frozen write intent", () => {
  it("fences two submissions in the same tick and a second submission after acceptance", async () => {
    let resolve!: (value: typeof accepted) => void;
    post.mockReturnValue(new Promise((done) => { resolve = done; }));
    const { result } = renderHook(() => useOutboundEmailWrite("actor-a", true));
    let first!: ReturnType<typeof result.current.submit>;
    act(() => { first = result.current.submit(path, body); void result.current.submit(path, body); });
    expect(post).toHaveBeenCalledTimes(1);
    await act(async () => { resolve(accepted); await first; });
    await act(async () => { await result.current.submit(path, body); });
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("retains the key and exact body after uncertainty and only replays on explicit reconciliation", async () => {
    post.mockRejectedValueOnce(new Error("Connection interrupted")).mockResolvedValueOnce(accepted);
    const { result } = renderHook(() => useOutboundEmailWrite("actor-a", true));
    await act(async () => { await result.current.submit(path, body); });
    expect(result.current.uncertain).toBe(true);
    await act(async () => { await result.current.submit(path, { ...body, sourceId: "other" }); });
    expect(post).toHaveBeenCalledTimes(1);
    await act(async () => { expect((await result.current.reconcile()).accepted?.status).toBe("QUEUED"); });
    expect(post.mock.calls[1]).toEqual(post.mock.calls[0]);
    expect(post.mock.calls[0][2].headers["x-idempotency-key"]).toMatch(/-7000-/);
    expect(post.mock.calls[0][2].nonReplayable).toBe(true);
  });

  it("does not emit accepted success from a stale actor's pending request", async () => {
    let resolve!: (value: typeof accepted) => void;
    post.mockReturnValue(new Promise((done) => { resolve = done; }));
    const { result, rerender } = renderHook(({ scope }) => useOutboundEmailWrite(scope, true), { initialProps: { scope: "actor-a" } });
    let first!: ReturnType<typeof result.current.submit>;
    act(() => { first = result.current.submit(path, body); });
    rerender({ scope: "actor-b" });
    await act(async () => { resolve(accepted); expect((await first).accepted).toBeNull(); });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.uncertain).toBe(false);
  });

  it("keeps an unreadable accepted response unresolved instead of issuing a new intent", async () => {
    post.mockResolvedValue({ ...accepted, data: { ...accepted.data, status: "SENT" } });
    const { result } = renderHook(() => useOutboundEmailWrite("actor-a", true));
    await act(async () => { expect((await result.current.submit(path, body)).accepted).toBeNull(); });
    expect(result.current.uncertain).toBe(true);
    expect(result.current.clear()).toBe(false);
    await act(async () => { await result.current.submit(path, body); });
    expect(post).toHaveBeenCalledTimes(1);
  });
});

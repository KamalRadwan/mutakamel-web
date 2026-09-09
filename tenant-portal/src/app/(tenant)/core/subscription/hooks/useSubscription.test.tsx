// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSubscriptionFixture } from "../subscription-read.fixture";
import { TenantApiClientError } from "@/lib/api/axiosClient";

const auth = vi.hoisted(() => ({ user: { id: "actor", isTenantOwner: true }, isAuthenticated: true, realtimeAuthGeneration: "session-1" }));
const reads = vi.hoisted(() => ({ detail: vi.fn(), items: vi.fn() }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth }));
vi.mock("../subscription-read", () => ({ readSubscription: reads.detail, readSubscriptionItems: reads.items }));
const { useSubscription } = await import("./useSubscription");
const view = createSubscriptionFixture().data;
function items() { return {  subscriptionId: view.subscription.id, subscriptionRevision: view.subscriptionRevision, baseItems: view.baseItems, addonSelections: view.addonSelections }; }
beforeEach(() => {
  auth.user = { id: "actor", isTenantOwner: true }; auth.isAuthenticated = true; auth.realtimeAuthGeneration = "session-1";
  reads.detail.mockReset().mockResolvedValue(view); reads.items.mockReset().mockResolvedValue(items());
});
afterEach(cleanup);

describe("complete accepted subscription read lifecycle", () => {
  it("exposes both base and Addons from a matching negotiated snapshot", async () => {
    const { result } = renderHook(useSubscription);
    await waitFor(() => expect(result.current.view).toBe(view));
    expect(result.current.view?.addonSelections).toHaveLength(1);
    expect(result.current.view?.totals.combinedRecurringUsd).toBe("115.0000");
  });
  it("does not request financial data for a non-owner", () => {
    auth.user.isTenantOwner = false;
    const { result } = renderHook(useSubscription);
    expect(result.current.denied).toBe(true);
    expect(reads.detail).not.toHaveBeenCalled(); expect(reads.items).not.toHaveBeenCalled();
  });
  it.each(["subscription", "revision", "addon"])("rejects cross-snapshot mismatch %s without partial fallback", async (kind) => {
    const changed = items();
    if (kind === "subscription") changed.subscriptionId = "other";
    if (kind === "revision") changed.subscriptionRevision = "8";
    if (kind === "addon") changed.addonSelections = [];
    reads.items.mockResolvedValue(changed);
    const { result } = renderHook(useSubscription);
    await waitFor(() => expect(result.current.subscriptionError).not.toBeNull());
    expect(result.current.view).toBeNull(); expect(result.current.items).toEqual([]);
  });
  it("does not degrade an items failure to base-only data", async () => {
    reads.items.mockRejectedValue(new Error("unavailable"));
    const { result } = renderHook(useSubscription);
    await waitFor(() => expect(result.current.subscriptionError).not.toBeNull());
    expect(result.current.view).toBeNull(); expect(result.current.items).toEqual([]);
  });
  it("honors current server403 over a stale owner claim", async () => {
    reads.detail.mockRejectedValue(new TenantApiClientError("denied", { status: 403, statusText: "Forbidden", headers: new Headers(), data: {} }));
    const { result } = renderHook(useSubscription);
    await waitFor(() => expect(result.current.denied).toBe(true));
    expect(result.current.view).toBeNull();
  });
  it("hides old money immediately on session replacement", async () => {
    const { result, rerender } = renderHook(useSubscription);
    await waitFor(() => expect(result.current.view).toBe(view));
    reads.detail.mockImplementationOnce(() => new Promise(() => undefined));
    auth.realtimeAuthGeneration = "session-2"; rerender();
    expect(result.current.view).toBeNull(); expect(result.current.items).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });
  it("invalidates both projections on explicit refresh and cancels on unmount", async () => {
    const { result, unmount } = renderHook(useSubscription);
    await waitFor(() => expect(result.current.view).toBe(view));
    reads.detail.mockImplementationOnce(() => new Promise(() => undefined));
    act(() => result.current.reload());
    expect(result.current.view).toBeNull();
    expect(reads.items).toHaveBeenCalledTimes(2);
    const signal = reads.detail.mock.calls[1][0] as AbortSignal;
    unmount(); expect(signal.aborted).toBe(true);
  });
});

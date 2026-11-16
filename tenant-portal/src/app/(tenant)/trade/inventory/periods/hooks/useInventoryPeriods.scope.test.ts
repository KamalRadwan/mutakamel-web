// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { useInventoryPeriods } from "./useInventoryPeriods";

const mock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), headers: { "x-mutakamel-company-id": "A" }, generation: "session-1" }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: { id: "actor", permissions: [] }, realtimeAuthGeneration: mock.generation }) }));
vi.mock("@/design-system", () => ({ useToast: () => ({ success: vi.fn() }) }));
vi.mock("../../../trade-advanced-scope", () => ({
  useTradeBranchSelection: () => ({ branchIds: [], branchId: null, selectBranch: vi.fn() }),
  useTradeScope: () => ({ headers: mock.headers, permissions: [], isTenantOwner: true, isResolved: true }), hasTradePermission: () => true,
}));
vi.mock("../../../trade-api", () => ({ tradeGet: mock.get, tradePost: mock.post, tradePatch: vi.fn(), tradeIfMatch: (value: number) => `"${value}"`, isTradeReplay: () => false }));
const row = (code: string) => ({ id: "01902001-3000-7000-8000-000000000001", code, startsOn: "2026-11-01", endsOn: "2026-11-30", status: "OPEN", maxBackdateDays: 7, version: 1, closeReason: null, closedAt: null });
const response = (code: string) => ({ data: { items: [row(code)], total: 1, page: 1, limit: 50 }, headers: new Headers() });
beforeEach(() => { mock.get.mockReset(); mock.post.mockReset(); mock.headers = { "x-mutakamel-company-id": "A" }; mock.generation = "session-1"; });
afterEach(cleanup);
describe("period scope isolation", () => {
  it("hides old rows and modals immediately, and ignores an old manual reload after A → B → A", async () => {
    mock.get.mockResolvedValueOnce(response("PERIOD-A"));
    const { result, rerender } = renderHook(useInventoryPeriods);
    await waitFor(() => expect(result.current.items[0]?.code).toBe("PERIOD-A"));
    act(() => { result.current.openCreate(); result.current.openTransition(row("PERIOD-A"), "close"); });
    let finishOld!: (value: ReturnType<typeof response>) => void;
    let finishB!: (value: ReturnType<typeof response>) => void;
    let finishNew!: (value: ReturnType<typeof response>) => void;
    mock.get.mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }));
    let oldReload!: Promise<void>;
    act(() => { oldReload = result.current.reload(); });
    mock.get.mockImplementationOnce(() => new Promise((resolve) => { finishB = resolve; }));
    mock.headers = { "x-mutakamel-company-id": "B" }; rerender();
    expect(result.current.items).toEqual([]);
    expect(result.current.createOpen).toBe(false);
    expect(result.current.transition).toBeNull();
    await waitFor(() => expect(mock.get).toHaveBeenCalledTimes(3));
    mock.get.mockImplementationOnce(() => new Promise((resolve) => { finishNew = resolve; }));
    mock.headers = { "x-mutakamel-company-id": "A" }; rerender();
    await waitFor(() => expect(mock.get).toHaveBeenCalledTimes(4));
    await act(async () => { finishOld(response("STALE-A")); await oldReload; finishB(response("STALE-B")); });
    expect(result.current.items).toEqual([]);
    await act(async () => { finishNew(response("FRESH-A")); });
    expect(result.current.items[0]?.code).toBe("FRESH-A");
    expect(result.current.createOpen).toBe(false);
  });

  it("removes a current record when the authentication generation changes", async () => {
    mock.get.mockResolvedValueOnce(response("PERIOD-A")).mockImplementation(() => new Promise(() => {}));
    const { result, rerender } = renderHook(useInventoryPeriods);
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    mock.generation = "session-2"; rerender();
    expect(result.current.items).toEqual([]);
  });

  it("retains only a matching successful page after a failed refresh", async () => {
    mock.get.mockResolvedValueOnce(response("PERIOD-A")).mockRejectedValue(new Error("Refresh failed"));
    const { result } = renderHook(useInventoryPeriods);
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    await act(async () => { await result.current.reload(); });
    expect(result.current.items[0]?.code).toBe("PERIOD-A"); expect(result.current.hasLoaded).toBe(true); expect(result.current.queryError).not.toBeNull();
    act(() => { result.current.setStatusFilter("CLOSED"); });
    act(() => result.current.applyFilters());
    expect(result.current.items).toEqual([]); expect(result.current.hasLoaded).toBe(false);
    await waitFor(() => expect(result.current.queryError).not.toBeNull());
    expect(result.current.items).toEqual([]);
  });

  it("keeps filter edits local until Apply, then Clear resets the request and page", async () => {
    mock.get.mockResolvedValue(response("PERIOD-A"));
    const { result } = renderHook(useInventoryPeriods);
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    act(() => { result.current.setStatusFilter("CLOSED"); result.current.setEffectiveAtFilter("2026-11-03T12:00"); });
    expect(mock.get).toHaveBeenCalledTimes(1);
    expect(result.current.items).toHaveLength(1);
    act(() => result.current.applyFilters());
    await waitFor(() => expect(mock.get).toHaveBeenCalledTimes(2));
    expect(mock.get.mock.calls[1][0]).toContain("status=CLOSED");
    expect(mock.get.mock.calls[1][0]).toContain("effectiveAt=");
    act(() => result.current.clearFilters());
    await waitFor(() => expect(mock.get).toHaveBeenCalledTimes(3));
    expect(mock.get.mock.calls[2][0]).not.toContain("status=");
    expect(mock.get.mock.calls[2][0]).not.toContain("effectiveAt=");
    expect(result.current.pagination.page).toBe(1);
    expect(result.current.statusFilter).toBeUndefined();
    expect(result.current.effectiveAtFilter).toBe("");
  });

  it("retains the original create/key after a timeout, blocks abandonment and replays without reconstructing the draft", async () => {
    mock.get.mockResolvedValue(response("PERIOD-A"));
    mock.post.mockRejectedValueOnce(new Error("Timeout")).mockResolvedValue({ data: row("NOVEMBER"), headers: new Headers() });
    const { result, rerender } = renderHook(useInventoryPeriods);
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    const values = { code: "NOVEMBER", startsOn: "2026-11-01", endsOn: "2026-11-30", maxBackdateDays: "7" };
    act(() => result.current.openCreate());
    await act(async () => { expect(await result.current.create(values)).toBe(false); });
    const original = mock.post.mock.calls[0];
    expect(result.current.createDraft).toEqual(values);
    expect(result.current.unresolved).toBe(true);
    act(() => result.current.closeCreate());
    expect(result.current.createOpen).toBe(true);
    await act(async () => { expect(await result.current.create({ ...values, code: "CHANGED" })).toBe(false); });
    expect(mock.post).toHaveBeenCalledTimes(1);
    expect(result.current.createDraft).toEqual(values);
    mock.headers = { "x-mutakamel-company-id": "B" }; rerender();
    expect(result.current.createDraft).toBeUndefined();
    expect(result.current.canRetryOriginal).toBe(false);
    mock.headers = { "x-mutakamel-company-id": "A" }; rerender();
    expect(result.current.createDraft).toBeUndefined();
    expect(result.current.canRetryOriginal).toBe(true);
    act(() => result.current.openCreate());
    await act(async () => { expect(await result.current.retryOriginal()).toBe(true); });
    expect(mock.post.mock.calls[1][1]).toEqual(original[1]);
    expect(mock.post.mock.calls[1][2].headers["x-idempotency-key"]).toBe(original[2].headers["x-idempotency-key"]);
    expect(result.current.createOpen).toBe(false);
    expect(result.current.unresolved).toBe(false);
  });
});

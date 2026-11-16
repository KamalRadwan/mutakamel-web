// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { useDashboardDetail } from "./useDashboardDetail";

const mock = vi.hoisted(() => ({
  headers: {} as Record<string, string>,
  user: { isTenantOwner: true },
  get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(),
  toast: { outcomeFromApi: vi.fn() },
}));

vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: mock.user }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/design-system", () => ({ useToast: () => mock.toast }));
vi.mock("../../../trade-advanced-scope", () => ({
  useTradeScope: () => ({ headers: mock.headers }),
  useTradeBranchSelection: () => ({ branchId: null }),
}));
vi.mock("../../../trade-api", () => ({
  tradeGet: mock.get, tradePost: mock.post, tradePatch: mock.patch,
  tradeDelete: mock.delete, tradeIfMatch: (revision: number) => `"${revision}"`,
}));

const id = "01902001-3000-7000-8000-000000000001";
const otherId = "01902001-3000-7000-8000-000000000002";
const companyId = "01902001-3000-7000-8000-000000000003";
const otherCompanyId = "01902001-3000-7000-8000-000000000004";
const timestamp = "2026-10-31T00:00:00.000Z";

function deferred() {
  let resolve!: (value: { data: unknown }) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<{ data: unknown }>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function detail(dashboardId = id) {
  return { id: dashboardId, name: "Analytics", description: null, accessLevel: "OWNER",
    scopeCoverage: "SINGLE_COMPANY", revision: 1, updatedAt: timestamp, placements: [] };
}

const run = { dashboardId: id, dashboardRevision: 1, status: "READY",
  generatedAt: timestamp, widgets: [] };

function response(path: string) {
  if (path.includes("share-targets")) {
    return { data: { items: [{ subjectId: otherId, subjectType: "USER", label: "Reader" }] } };
  }
  if (path.endsWith("/shares")) {
    return { data: { items: [{ id: otherId, subjectId: otherId,
      subjectType: "USER", accessLevel: "VIEW" }] } };
  }
  return { data: detail(path.endsWith(otherId) ? otherId : id) };
}

beforeEach(() => {
  vi.resetAllMocks();
  mock.headers = { "x-mutakamel-company-id": companyId };
  mock.get.mockImplementation(async (path: string) => response(path));
  mock.post.mockResolvedValue({ data: run });
  mock.patch.mockResolvedValue({ data: {} });
});
afterEach(cleanup);

describe("dashboard request lifetime", () => {
  it.each(["layout", "place", "unplace", "share", "unshare"] as const)(
    "keeps a failed %s action visible without reloading",
    async (action) => {
      const { result } = renderHook(() => useDashboardDetail(id));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      const failure = new TenantApiClientError("Revision conflict", {
        status: 409, statusText: "Conflict", headers: new Headers(),
        data: { code: "TRADE.DASHBOARD.REVISION_CONFLICT" },
      });
      mock.toast.outcomeFromApi.mockReturnValue(false);
      mock.patch.mockRejectedValue(failure);
      mock.post.mockRejectedValue(failure);
      mock.delete.mockRejectedValue(failure);
      const dashboard = result.current.dashboard;
      const actions = {
        layout: () => result.current.saveLayout([]),
        place: () => result.current.addPlacement(otherId),
        unplace: () => result.current.removePlacement(otherId),
        share: () => result.current.upsertShares([
          { subjectId: otherId, subjectType: "USER", accessLevel: "VIEW" },
        ]),
        unshare: () => result.current.removeShare(otherId),
      };
      await act(async () => { await actions[action](); });
      expect(result.current.actionError).toBe(en.tradeAnalytics.errorRevisionConflict);
      expect(result.current.pending).toBeNull();
      expect(result.current.dashboard).toBe(dashboard);
      expect(result.current.isLoading).toBe(false);
      expect(mock.get).toHaveBeenCalledTimes(3);
    },
  );

  it("refreshes a successful action without clearing the workspace or last run", async () => {
    const { result } = renderHook(() => useDashboardDetail(id));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { await result.current.execute(); });
    const previous = result.current;
    const refresh = deferred();
    mock.get.mockImplementation((path: string) => refresh.promise.then(() =>
      path.endsWith(`/${id}`) ? { data: { ...detail(), revision: 2 } } : response(path)));
    let saving!: Promise<void>;
    act(() => { saving = result.current.saveLayout([]); });
    await waitFor(() => expect(mock.get).toHaveBeenCalledTimes(6));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.dashboard).toBe(previous.dashboard);
    expect(result.current.run).toBe(previous.run);
    expect(result.current.shares).toBe(previous.shares);
    expect(result.current.shareTargets).toBe(previous.shareTargets);
    await act(async () => { refresh.resolve({ data: {} }); await saving; });
    expect(result.current.dashboard?.revision).toBe(2);
    expect(result.current.run).toBe(previous.run);
    expect(result.current.isLoading).toBe(false);
    mock.post.mockResolvedValueOnce({ data: { ...run, dashboardRevision: 2 } });
    await act(async () => { await result.current.execute(); });
    expect(result.current.run?.dashboardRevision).toBe(2);
  });

  it("aborts a mutation refresh on unmount and ignores its late failure", async () => {
    const { result, unmount } = renderHook(() => useDashboardDetail(id));
    await waitFor(() => expect(result.current.canEdit).toBe(true));
    const refresh = deferred();
    mock.get.mockImplementation(() => refresh.promise);
    let saving!: Promise<void>;
    act(() => { saving = result.current.saveLayout([]); });
    await waitFor(() => expect(mock.get).toHaveBeenCalledTimes(6));
    const signal = mock.get.mock.calls[3][1].signal as AbortSignal;
    unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => { refresh.reject(new Error("late failure")); await saving; });
    expect(mock.toast.outcomeFromApi).not.toHaveBeenCalled();
  });

  it.each(["id", "company"])("clears all previous data on a %s switch even if detail fails", async (kind) => {
    const { result, rerender } = renderHook(({ dashboardId }) => useDashboardDetail(dashboardId), {
      initialProps: { dashboardId: id },
    });
    await waitFor(() => expect(result.current.shares).toHaveLength(1));
    await act(async () => { await result.current.execute(); });
    expect(result.current.run).not.toBeNull();
    expect(result.current.shareTargets).toHaveLength(1);
    const next = deferred();
    mock.get.mockImplementation(() => next.promise);
    if (kind === "company") mock.headers = { "x-mutakamel-company-id": otherCompanyId };
    rerender({ dashboardId: kind === "id" ? otherId : id });
    await waitFor(() => expect(mock.get).toHaveBeenCalledTimes(6));
    expect(result.current.dashboard).toBeNull();
    expect(result.current.run).toBeNull();
    expect(result.current.shares).toEqual([]);
    expect(result.current.shareTargets).toEqual([]);
    await act(async () => { next.reject(new Error("detail failed")); });
    expect(result.current.queryError).not.toBeNull();
    expect(result.current.dashboard).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it.each(["id", "company"])("aborts and ignores a late run after a %s switch", async (kind) => {
    const { result, rerender } = renderHook(({ dashboardId }) => useDashboardDetail(dashboardId), {
      initialProps: { dashboardId: id },
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const oldRun = deferred();
    mock.post.mockReturnValueOnce(oldRun.promise);
    let execution!: Promise<void>;
    act(() => { execution = result.current.execute(); });
    const signal = mock.post.mock.calls[0][2].signal as AbortSignal;
    if (kind === "company") mock.headers = { "x-mutakamel-company-id": otherCompanyId };
    rerender({ dashboardId: kind === "id" ? otherId : id });
    await waitFor(() => expect(result.current.pending).toBeNull());
    expect(signal.aborted).toBe(true);
    // Keep a new run pending: the old finally must not clear its pending state.
    const newRun = deferred();
    mock.post.mockReturnValueOnce(newRun.promise);
    let newExecution!: Promise<void>;
    act(() => { newExecution = result.current.execute(); });
    await act(async () => { oldRun.resolve({ data: run }); await execution; });
    expect(result.current.run).toBeNull();
    expect(result.current.pending).toBe("run");
    await act(async () => { newRun.resolve({ data: run }); await newExecution; });
    expect(result.current.run).not.toBeNull();
  });

  it("allows only the newest refresh to write state", async () => {
    const { result } = renderHook(() => useDashboardDetail(id));
    await waitFor(() => expect(result.current.canEdit).toBe(true));
    const mutationRefresh = deferred();
    mock.get.mockImplementation(() => mutationRefresh.promise);
    let mutation!: Promise<void>;
    act(() => { mutation = result.current.saveLayout([]); });
    await waitFor(() => expect(mock.get).toHaveBeenCalledTimes(6));
    const signal = mock.get.mock.calls[3][1].signal as AbortSignal;
    mock.get.mockImplementation(async (path: string) => path.endsWith(`/${id}`)
      ? { data: { ...detail(), name: "Newest" } } : response(path));
    await act(async () => { await result.current.reload(); });
    expect(signal.aborted).toBe(true);
    await act(async () => { mutationRefresh.resolve({ data: detail() }); await mutation; });
    expect(result.current.dashboard?.name).toBe("Newest");
    expect(result.current.shares).toHaveLength(1);
  });

  it("ignores an old load and mutation completion after switching company", async () => {
    const { result, rerender } = renderHook(() => useDashboardDetail(id));
    await waitFor(() => expect(result.current.canEdit).toBe(true));
    const mutation = deferred();
    mock.patch.mockReturnValueOnce(mutation.promise);
    let saving!: Promise<void>;
    act(() => { saving = result.current.saveLayout([]); });
    const oldLoad = deferred();
    mock.get.mockImplementation(() => oldLoad.promise);
    let loading!: Promise<void>;
    act(() => { loading = result.current.reload(); });
    const signal = mock.get.mock.calls[3][1].signal as AbortSignal;
    mock.headers = { "x-mutakamel-company-id": otherCompanyId };
    mock.get.mockImplementation(async (path: string) => path.endsWith(`/${id}`)
      ? { data: { ...detail(), name: "New company" } } : response(path));
    rerender();
    await waitFor(() => expect(result.current.dashboard?.name).toBe("New company"));
    expect(signal.aborted).toBe(true);
    await act(async () => {
      oldLoad.resolve({ data: detail() });
      mutation.resolve({ data: {} });
      await Promise.all([loading, saving]);
    });
    expect(result.current.dashboard?.name).toBe("New company");
    expect(mock.get).toHaveBeenCalledTimes(9);
  });

  it("aborts a pending run on unmount without reporting its late error", async () => {
    const { result, unmount } = renderHook(() => useDashboardDetail(id));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const request = deferred();
    mock.post.mockReturnValueOnce(request.promise);
    let execution!: Promise<void>;
    act(() => { execution = result.current.execute(); });
    const signal = mock.post.mock.calls[0][2].signal as AbortSignal;
    unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => { request.reject(new Error("late failure")); await execution; });
    expect(mock.toast.outcomeFromApi).not.toHaveBeenCalled();
  });
});

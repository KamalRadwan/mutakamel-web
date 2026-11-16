// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { useDashboards } from "./useDashboards";

const mock = vi.hoisted(() => ({
  headers: {},
  get: vi.fn(),
  toast: {},
}));

vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: null }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/design-system", () => ({ useToast: () => mock.toast }));
vi.mock("../../trade-advanced-scope", () => ({
  useTradeScope: () => ({ headers: mock.headers }),
  useTradeBranchSelection: () => ({ branchIds: [], branchId: null, selectBranch: vi.fn() }),
}));
vi.mock("../../trade-api", () => ({
  tradeGet: mock.get, tradePost: vi.fn(), tradeDelete: vi.fn(),
  tradeIfMatch: vi.fn(), isTradeReplay: vi.fn(),
}));

afterEach(() => { cleanup(); vi.resetAllMocks(); });

function deferred() {
  let resolve!: (value: { data: unknown }) => void;
  const promise = new Promise<{ data: unknown }>((done) => { resolve = done; });
  return { promise, resolve };
}

function response(path: string, version: number) {
  const row = { id: "01902001-3000-7000-8000-000000000001", name: `Load ${version}`,
    accessLevel: "OWNER", revision: version, updatedAt: "2026-10-31T00:00:00.000Z" };
  if (path.endsWith("/catalog")) return { data: { metrics: [], catalogVersion: version } };
  if (path.endsWith("/default")) {
    return { data: { dashboard: version === 2 ? row : null,
      ensureTemplate: version === 1 ? { templateKey: "old" } : null } };
  }
  return { data: { items: [row], pagination: { limit: 50, offset: 0, nextOffset: version * 50 } } };
}

describe("dashboard list request lifetime", () => {
  it("keeps the newest load when an aborted predecessor resolves last", async () => {
    const older = Array.from({ length: 4 }, deferred);
    mock.get.mockImplementation(() => older[mock.get.mock.calls.length - 1].promise);
    const { result } = renderHook(() => useDashboards());
    await waitFor(() => expect(mock.get).toHaveBeenCalledTimes(4));
    const signal = mock.get.mock.calls[0][1].signal as AbortSignal;
    mock.get.mockImplementation(async (path: string) => response(path, 2));
    await act(async () => { await result.current.reload(); });
    expect(signal.aborted).toBe(true);
    const newest = result.current;
    await act(async () => {
      older.forEach((request, index) => request.resolve(response(mock.get.mock.calls[index][0], 1)));
    });
    expect(result.current.items).toEqual(newest.items);
    expect(result.current.items[0].name).toBe("Load 2");
    expect(result.current.quickJump).toEqual(newest.quickJump);
    expect(result.current.defaultDashboardId).toBe(newest.defaultDashboardId);
    expect(result.current.ensureTemplateKey).toBeNull();
    expect(result.current.catalog?.catalogVersion).toBe(2);
    expect(result.current.nextOffset).toBe(100);
    expect(result.current.queryError).toBeNull();
    expect(result.current.catalogUnavailable).toBe(false);
    expect(result.current.isRefreshing).toBe(false);
  });

  it("aborts a refresh started outside the effect on unmount", async () => {
    mock.get.mockImplementation(async (path: string) => response(path, 2));
    const { result, unmount } = renderHook(() => useDashboards());
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    const pending = deferred();
    mock.get.mockReturnValue(pending.promise);
    let refresh!: Promise<void>;
    act(() => { refresh = result.current.reload(); });
    const signal = mock.get.mock.calls[4][1].signal as AbortSignal;
    unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => { pending.resolve({ data: {} }); await refresh; });
  });
});

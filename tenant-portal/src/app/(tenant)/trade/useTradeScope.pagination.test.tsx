// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tradeGet } from "./trade-api";
import { en } from "@/i18n/dictionaries/en";
import { TradeScopeProvider, useTradeScope, useTradeScopeRequest } from "./useTradeScope";

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));

vi.mock("@/context/AuthContext", () => {
  const user = {
    accessibleCompanies: ["019f0000-0000-7000-8000-000000000001"],
    accessibleBranches: ["019f0000-0000-7000-8000-000000000002"], teamMemberships: [],
  };
  return { useTenantAuth: () => ({ user }) };
});
vi.mock("./trade-api", () => ({
  tradeGet: vi.fn(), CHANNEL_SCOPE_HEADER: "x-mutakamel-channel-id",
}));
const get = vi.mocked(tradeGet);
const channel = (id: number) => ({
  id: `019f0000-0000-7000-8000-${String(id).padStart(12, "0")}`,
  companyId: "019f0000-0000-7000-8000-000000000001",
  code: `CHANNEL${id}`, name: `Channel ${id}`, channelType: "POS", status: "ACTIVE",
  configurationProfileVersionId: null, version: 1, updatedAt: "2026-10-26T00:00:00.000Z",
});
beforeEach(() => { localStorage.clear(); get.mockReset(); });
afterEach(cleanup);

describe("Trade scope channel pagination", () => {
  it("does not restore an inactive or unknown-status saved channel", async () => {
    localStorage.setItem("tenant_trade_channel", channel(3).id);
    get.mockResolvedValueOnce({
      data: {
        items: [{ ...channel(3), status: "INACTIVE" }, { ...channel(4), status: "OTHER" }],
        total: 2, page: 1, limit: 100,
      },
      headers: new Headers(), status: 200,
    });
    const { result } = renderHook(() => useTradeScope(), { wrapper: TradeScopeProvider });
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.isLoadingChannels).toBe(false));
    expect(result.current.channels).toEqual([]);
    expect(result.current.context.channelId).toBeNull();
    expect(localStorage.getItem("tenant_trade_channel")).toBeNull();
  });

  it("refreshes active choices and clears a deactivated saved selection", async () => {
    const response = (items: unknown[]) => ({
      data: { items, total: items.length, page: 1, limit: 100 },
      headers: new Headers(), status: 200,
    });
    get.mockResolvedValueOnce(response([channel(3)]));
    const { result } = renderHook(() => useTradeScope(), { wrapper: TradeScopeProvider });
    await waitFor(() => expect(result.current.channels).toHaveLength(1));
    act(() => result.current.selectChannel(channel(3).id));
    expect(result.current.context.channelId).toBe(channel(3).id);

    get.mockResolvedValueOnce(response([channel(3), channel(4)]));
    act(() => result.current.refreshChannels());
    await waitFor(() => expect(result.current.channels).toHaveLength(2));

    get.mockResolvedValueOnce(response([{ ...channel(3), status: "INACTIVE" }, channel(4)]));
    act(() => result.current.refreshChannels());
    await waitFor(() => expect(result.current.context.channelId).toBeNull());
    expect(result.current.channels.map((item) => item.id)).toEqual([channel(4).id]);
    expect(localStorage.getItem("tenant_trade_channel")).toBeNull();
    act(() => result.current.selectChannel(channel(3).id));
    expect(result.current.context.channelId).toBeNull();
  });

  it("omits channel headers only when requested and preserves company/branch scope", async () => {
    localStorage.setItem("tenant_trade_channel", channel(3).id);
    localStorage.setItem("tenant_trade_branch", channel(2).id);
    get.mockResolvedValueOnce({
      data: { items: [channel(3)], total: 1, page: 1, limit: 100 },
      headers: new Headers(), status: 200,
    });
    const { result } = renderHook(() => ({
      scope: useTradeScope(),
      company: useTradeScopeRequest("COMPANY", { includeChannel: false }),
      branch: useTradeScopeRequest("BRANCH", { includeChannel: false }),
      operating: useTradeScopeRequest("BRANCH"),
    }), { wrapper: TradeScopeProvider });
    await waitFor(() => expect(result.current.scope.context.channelId).toBe(channel(3).id));
    expect(result.current.company.headers).toEqual({ "x-mutakamel-company-id": channel(1).companyId });
    expect(result.current.branch.headers).toEqual({
      "x-mutakamel-company-id": channel(1).companyId,
      "x-mutakamel-branch-id": channel(2).id,
    });
    expect(result.current.branch.gap).toBeNull();
    expect(result.current.operating.headers["x-mutakamel-channel-id"]).toBe(channel(3).id);
  });

  it("handles the page cap as an explicit error without partial choices", async () => {
    get.mockImplementation(async () => ({
      data: {
        items: Array.from({ length: 100 }, (_, i) => channel(i + 1)),
        total: 100000, page: get.mock.calls.length, limit: 100,
      },
      headers: new Headers(), status: 200,
    }));
    const { result } = renderHook(() => useTradeScope(), { wrapper: TradeScopeProvider });
    await waitFor(() => expect(result.current.channelsError?.message).toBe(en.trade.channelPageLimit));
    expect(result.current.channels).toEqual([]);
    expect(result.current.isLoadingChannels).toBe(false);
    expect(get).toHaveBeenCalledTimes(20);
  });

  it("restores a saved selection found after the first server page", async () => {
    localStorage.setItem("tenant_trade_channel", channel(101).id);
    get.mockResolvedValueOnce({
      data: { items: Array.from({ length: 100 }, (_, i) => channel(i + 1)), total: 101, page: 1, limit: 100 },
      headers: new Headers(), status: 200,
    }).mockResolvedValueOnce({
      data: { items: [channel(101)], total: 101, page: 2, limit: 100 },
      headers: new Headers(), status: 200,
    });
    const { result } = renderHook(() => useTradeScope(), { wrapper: TradeScopeProvider });
    await waitFor(() => expect(result.current.context.channelId).toBe(channel(101).id));
    expect(result.current.channels).toHaveLength(101);
    expect(result.current.channelsError).toBeNull();
    expect(get).toHaveBeenCalledTimes(2);
    expect(get).toHaveBeenLastCalledWith(expect.stringContaining("?page=2&limit=100"),
      expect.objectContaining({ headers: { "x-mutakamel-company-id": channel(1).companyId } }));
  });
});

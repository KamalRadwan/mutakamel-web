// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { tradeGet, tradePatch, tradePost } from "../../trade-api";
import { TradeScopeProvider, useTradeScope } from "../../useTradeScope";
import { CHANNELS_PATH, channelPath, channelBranchesPath, channelBranchPath } from "../channel-contract";
import { useChannels } from "./useChannels";
import { useChannelDetail } from "./useChannelDetail";

const fixture = vi.hoisted(() => ({
  company: "019f0000-0000-7000-8000-000000000001",
  branch: "019f0000-0000-7000-8000-000000000002",
  channel: "019f0000-0000-7000-8000-000000000003",
  status: "ACTIVE",
  created: false,
  mapped: false,
}));

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/context/AuthContext", () => {
  const user = {
    accessibleCompanies: [fixture.company], accessibleBranches: [fixture.branch],
    teamMemberships: [], isTenantOwner: true, permissions: [],
  };
  return { useTenantAuth: () => ({ user }) };
});
vi.mock("@/design-system", () => ({
  useToast: () => ({ success: vi.fn() }),
}));
vi.mock("../../trade-api", () => ({
  CHANNEL_SCOPE_HEADER: "x-mutakamel-channel-id",
  tradeGet: vi.fn(), tradePost: vi.fn(), tradePatch: vi.fn(),
  tradeIfMatch: (version: number) => `"${version}"`,
}));
vi.mock("../../useTradeWrite", () => ({
  useTradeWrite: () => async (write: () => Promise<unknown>) => {
    await write();
    return { ok: true, replayed: false, error: null };
  },
}));

const channel = () => ({
  id: fixture.channel, companyId: fixture.company, code: "CHANNEL", name: "Channel",
  channelType: "POS", status: fixture.status, configurationProfileVersionId: null,
  version: 1, updatedAt: "2026-10-26T00:00:00.000Z",
});
const mapping = () => ({
  id: "019f0000-0000-7000-8000-000000000004", channelId: fixture.channel,
  companyId: fixture.company, branchId: fixture.branch, isActive: true,
  version: 1, updatedAt: "2026-10-26T00:00:00.000Z",
});
const response = (data: unknown) => ({ data, headers: new Headers(), status: 200 });
const get = vi.mocked(tradeGet);
const post = vi.mocked(tradePost);
const patch = vi.mocked(tradePatch);

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("tenant_trade_branch", fixture.branch);
  localStorage.setItem("tenant_trade_channel", fixture.channel);
  fixture.status = "ACTIVE";
  fixture.created = false;
  fixture.mapped = false;
  vi.clearAllMocks();
  get.mockImplementation(async (path) => {
    if (path === channelPath(fixture.channel)) {
      return response({ ...channel(), branches: fixture.mapped ? [mapping()] : [] });
    }
    return response({
      items: [channel(), ...(fixture.created ? [{
        ...channel(), id: mapping().id, code: "NEW", status: "ACTIVE",
      }] : [])],
      total: fixture.created ? 2 : 1, page: 1, limit: 100,
    });
  });
  post.mockImplementation(async () => {
    fixture.created = true;
    return response(channel());
  });
  patch.mockImplementation(async (_path, body) => {
    if (typeof body === "object" && body !== null && "status" in body && typeof body.status === "string") {
      fixture.status = body.status;
    }
    return response(channel());
  });
});
afterEach(cleanup);

describe("channel administration scope", () => {
  it("refreshes operating choices after create and deactivation without channel headers", async () => {
    const { result } = renderHook(() => ({ scope: useTradeScope(), list: useChannels() }), {
      wrapper: TradeScopeProvider,
    });
    await waitFor(() => expect(result.current.scope.context.channelId).toBe(fixture.channel));
    await waitFor(() => expect(result.current.list.items).toHaveLength(1));
    await act(async () => {
      expect(await result.current.list.create({
        code: "NEW", name: "New channel", channelType: "POS", status: "ACTIVE",
      })).toBe(true);
    });
    await waitFor(() => expect(result.current.scope.channels).toHaveLength(2));
    expect(post).toHaveBeenCalledWith(CHANNELS_PATH, expect.any(Object), {
      headers: { "x-mutakamel-company-id": fixture.company },
    });

    act(() => result.current.list.openEdit(result.current.list.items[0]));
    await act(async () => {
      expect(await result.current.list.update({
        code: "CHANNEL", name: "Channel", channelType: "POS", status: "INACTIVE",
      })).toBe(true);
    });
    await waitFor(() => expect(result.current.scope.context.channelId).toBeNull());
    expect(result.current.scope.channels.map((item) => item.id)).toEqual([mapping().id]);
    expect(result.current.list.items[0].status).toBe("INACTIVE");
    expect(patch).toHaveBeenCalledWith(channelPath(fixture.channel), { status: "INACTIVE" }, {
      headers: { "x-mutakamel-company-id": fixture.company, "if-match": '"1"' },
    });
    act(() => result.current.list.openEdit(result.current.list.items[0]));
    await act(async () => {
      expect(await result.current.list.update({
        code: "CHANNEL", name: "Channel", channelType: "POS", status: "ACTIVE",
      })).toBe(true);
    });
    await waitFor(() => expect(result.current.scope.channels).toHaveLength(2));
    expect(patch).toHaveBeenLastCalledWith(channelPath(fixture.channel), { status: "ACTIVE" }, {
      headers: { "x-mutakamel-company-id": fixture.company, "if-match": '"1"' },
    });
    for (const [, config] of get.mock.calls) {
      expect(config?.headers).not.toHaveProperty("x-mutakamel-channel-id");
    }
  });

  it("handles an oversized list without exposing partial administration rows", async () => {
    get.mockImplementation(async (path) => {
      const page = Number(new URL(path, "http://test.local").searchParams.get("page"));
      return response({ items: Array.from({ length: 100 }, channel), total: 100000, page, limit: 100 });
    });
    const { result } = renderHook(() => useChannels(), { wrapper: TradeScopeProvider });
    await waitFor(() => expect(result.current.queryError?.message).toBe(en.trade.channelPageLimit));
    expect(result.current.items).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it.each([false, true])("saves the selected channel's branch mapping (existing: %s)", async (existing) => {
    fixture.mapped = existing;
    const { result } = renderHook(() => ({
      scope: useTradeScope(), detail: useChannelDetail(fixture.channel),
    }), { wrapper: TradeScopeProvider });
    await waitFor(() => expect(result.current.scope.context.channelId).toBe(fixture.channel));
    await waitFor(() => expect(result.current.detail.channel).not.toBeNull());
    await act(async () => result.current.detail.saveBranchMapping(true));
    const headers = {
      "x-mutakamel-company-id": fixture.company,
      "x-mutakamel-branch-id": fixture.branch,
    };
    if (existing) {
      expect(patch).toHaveBeenCalledWith(channelBranchPath(fixture.channel, fixture.branch),
        { isActive: true }, { headers: { ...headers, "if-match": '"1"' } });
    } else {
      expect(post).toHaveBeenCalledWith(channelBranchesPath(fixture.channel),
        { branchId: fixture.branch, isActive: true }, { headers });
    }
    expect(get).toHaveBeenCalledWith(channelPath(fixture.channel), expect.objectContaining({
      headers: { "x-mutakamel-company-id": fixture.company },
    }));
  });
});

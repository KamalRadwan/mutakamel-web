// @vitest-environment jsdom
import { useEffect } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TradeScopeProvider, useTradeScope, useTradeScopeRequest, type TradeScopeChange } from "./useTradeScope";
import type { TradeOperatingContext } from "./trade-scope";

const fixture = vi.hoisted(() => {
  const id = (value: number) => `019f0000-0000-7000-8000-${String(value).padStart(12, "0")}`;
  const companyA = id(1); const branchA = id(2); const channelA = id(3);
  const companyB = id(4); const branchB = id(5); const channelB = id(6);
  const channel = (value: string, companyId: string) => ({ id: value, companyId, code: value === channelA ? "DIRECT-A" : "DIRECT-B", name: "Direct sales", channelType: "INTERNAL_SALES", status: "ACTIVE", configurationProfileVersionId: null, version: 1, updatedAt: "2026-11-04T12:00:00Z" });
  return { companyA, branchA, channelA, companyB, branchB, channelB,
    a: { companyId: companyA, branchId: branchA, channelId: channelA }, b: { companyId: companyB, branchId: branchB, channelId: channelB },
    user: { accessibleCompanies: [companyA, companyB], accessibleBranches: [branchA, branchB] },
    branchesA: [branchA], branchesB: [branchB], emptyBranches: [] as string[],
    channelsA: [channel(channelA, companyA)], channelsB: [channel(channelB, companyB)], emptyChannels: [] as ReturnType<typeof channel>[],
    refresh: vi.fn(),
  };
});
vi.mock("next/navigation", () => ({ usePathname: () => "/trade/quotations/new" }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: fixture.user }) }));
vi.mock("./trade-api", () => ({ CHANNEL_SCOPE_HEADER: "x-mutakamel-channel-id" }));
vi.mock("./hooks/useTradeBranchChoices", () => ({ useTradeBranchChoices: (companyId: string | null) => ({
  branchIds: companyId === fixture.companyA ? fixture.branchesA : companyId === fixture.companyB ? fixture.branchesB : fixture.emptyBranches,
  isLoadingBranches: false, branchesError: null, refreshBranches: fixture.refresh,
}) }));
vi.mock("./hooks/useTradeChannelChoices", () => ({ useTradeChannelChoices: (companyId: string | null) => ({
  channels: companyId === fixture.companyA ? fixture.channelsA : companyId === fixture.companyB ? fixture.channelsB : fixture.emptyChannels,
  isLoadingChannels: false, channelsError: null, refreshChannels: fixture.refresh,
}) }));

interface Commit { context: TradeOperatingContext; headers: Record<string, string> }
function headers(context: TradeOperatingContext) {
  return { "x-mutakamel-company-id": context.companyId, "x-mutakamel-branch-id": context.branchId,
    ...(context.channelId ? { "x-mutakamel-channel-id": context.channelId } : {}) };
}
function useObservedScope(commits: Commit[]) {
  const scope = useTradeScope(); const request = useTradeScopeRequest("BRANCH");
  useEffect(() => { commits.push({ context: { ...scope.context }, headers: { ...request.headers } }); }, [commits, request.headers, scope.context]);
  return { scope, request };
}
async function setup() {
  const commits: Commit[] = [];
  const hook = renderHook(() => useObservedScope(commits), { wrapper: TradeScopeProvider });
  await waitFor(() => expect(hook.result.current.scope.context).toEqual(fixture.a));
  commits.length = 0;
  return { ...hook, commits };
}

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  localStorage.setItem("tenant_trade_company", fixture.companyA);
  localStorage.setItem("tenant_trade_branch", fixture.branchA);
  localStorage.setItem("tenant_trade_channel", fixture.channelA);
});
afterEach(cleanup);

describe("atomic quotation operating context commit", () => {
  it("commits company, branch and channel together without exposing mixed request headers", async () => {
    const { result, commits } = await setup();
    act(() => result.current.scope.selectContext(fixture.b, "Company B · Branch B · Direct sales"));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.scope.context).toEqual(fixture.b);
    expect(result.current.request.headers).toEqual(headers(fixture.b));
    expect(commits.length).toBeGreaterThan(0);
    for (const commit of commits) { expect(commit.context).toEqual(fixture.b); expect(commit.headers).toEqual(headers(fixture.b)); }
    expect(localStorage.getItem("tenant_trade_company")).toBe(fixture.companyB);
    expect(localStorage.getItem("tenant_trade_branch")).toBe(fixture.branchB);
    expect(localStorage.getItem("tenant_trade_channel")).toBe(fixture.channelB);
  });

  it("preserves the whole old context until the dirty guard's captured request is confirmed", async () => {
    const { result, commits } = await setup();
    const pending: TradeScopeChange[] = [];
    act(() => { result.current.scope.registerContextGuard((change) => { pending.push(change); return false; }, false); });
    const label = "Company B · Branch B · Direct sales";
    act(() => result.current.scope.selectContext(fixture.b, label));
    expect(pending).toEqual([{ kind: "context", value: fixture.b, label }]);
    expect(result.current.scope.context).toEqual(fixture.a); expect(result.current.request.headers).toEqual(headers(fixture.a));
    expect(localStorage.getItem("tenant_trade_company")).toBe(fixture.companyA);
    expect(commits).toEqual([]);
    act(() => result.current.scope.applyContextChange(pending[0]));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.scope.context).toEqual(fixture.b);
    for (const commit of commits) expect(commit.headers).toEqual(headers(fixture.b));
  });

  it.each([
    { label: "unknown company", value: { companyId: "019f0000-0000-7000-8000-000000000099" } },
    { label: "unknown branch", value: { branchId: "019f0000-0000-7000-8000-000000000099" } },
    { label: "malformed branch", value: { branchId: "not-a-uuid" } },
    { label: "malformed channel", value: { channelId: "not-a-uuid" } },
    { label: "missing company", value: { companyId: null } },
    { label: "missing branch", value: { branchId: null } },
  ])("refuses $label without changing context or storage", async ({ value }) => {
    const { result } = await setup();
    act(() => result.current.scope.selectContext({ ...fixture.b, ...value }, "Invalid selection"));
    expect(result.current.scope.context).toEqual(fixture.a); expect(result.current.request.headers).toEqual(headers(fixture.a));
    expect(localStorage.getItem("tenant_trade_company")).toBe(fixture.companyA);
    expect(localStorage.getItem("tenant_trade_branch")).toBe(fixture.branchA);
    expect(localStorage.getItem("tenant_trade_channel")).toBe(fixture.channelA);
  });

  it("commits the explicit no-channel option and removes its persisted header value", async () => {
    const { result, commits } = await setup(); const next = { ...fixture.b, channelId: null };
    act(() => result.current.scope.selectContext(next, "Company B · Branch B · No channel"));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.scope.context).toEqual(next); expect(result.current.request.headers).toEqual(headers(next));
    expect(localStorage.getItem("tenant_trade_channel")).toBeNull();
    for (const commit of commits) expect(commit.headers).toEqual(headers(next));
  });

  it("does not open a dirty-change decision when the exact current triple is selected", async () => {
    const { result } = await setup(); const guard = vi.fn(() => false);
    act(() => { result.current.scope.registerContextGuard(guard, false); });
    act(() => result.current.scope.selectContext({ ...fixture.a }, "Current context"));
    expect(guard).not.toHaveBeenCalled(); expect(result.current.scope.context).toEqual(fixture.a);
  });
});

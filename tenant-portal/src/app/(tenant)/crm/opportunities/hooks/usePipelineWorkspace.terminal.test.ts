// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { OpportunityActionCapability } from "./pipeline-types";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { usePipelineWorkspace } from "./usePipelineWorkspace";

const access = vi.hoisted(() => ({ canMutate: true }));
vi.mock("@/hooks/useAccessMode", () => ({ useAccessMode: () => access }));
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
const branchId = "01900100-0000-7000-8000-000000000111";
const pipelineId = "01900100-0000-7000-8000-000000000100";
const ownerId = "01900100-0000-7000-8000-000000000113";
const sourceId = "01900100-0000-7000-8000-000000000101";
const wonId = "01900100-0000-7000-8000-000000000102";
const lostId = "01900100-0000-7000-8000-000000000103";
const row = {
  id: "01900100-0000-7000-8000-000000000110",
  title: "Annual renewal",
  stageId: sourceId,
  ownerUserId: ownerId,
};
const user = { id: ownerId };
const scope = { ready: true, headers: {} };
const searchParams = new URLSearchParams({ pipelineId });
let updateCapability: OpportunityActionCapability | null;

vi.mock("next/navigation", () => ({
  usePathname: () => "/crm/opportunities",
  useSearchParams: () => searchParams,
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user }),
}));
vi.mock("@/hooks/useOrganizationScope", () => ({
  SCOPE_UNRESOLVED_ERROR: { code: "SCOPE_UNRESOLVED" },
  useOrganizationScopeHeaders: () => scope,
}));
vi.mock("@/hooks/useTenantBranchSelection", () => ({
  useTenantBranchSelection: () => ({
    branchId,
    branchIds: [branchId],
    selectBranch: vi.fn(),
  }),
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: en, lang: "en" }),
}));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/axiosClient")>()),
  axiosClient: api,
}));

const stages = [
  { id: sourceId, flag: "QUALIFICATION", category: "IN_PROGRESS" },
  { id: wonId, flag: "WON", category: "WON" },
  { id: lostId, flag: "LOST", category: "LOST" },
].map((stage, index) => ({
  ...stage,
  pipelineId,
  opportunityStageId: stage.id,
  nameEn: stage.flag,
  nameAr: stage.flag,
  rank: index + 1,
  isActive: true,
  isSystem: true,
}));

beforeEach(() => {
  vi.clearAllMocks();
  access.canMutate = true;
  updateCapability = { scope: "all", ownerUserIds: null };
  api.post.mockResolvedValue({ data: {}, status: 201 });
  api.get.mockImplementation(async (path: string) => {
    if (path === "/api/tenant/crm/v1/pipelines") {
      return {
        data: [{
          id: pipelineId,
          code: "SALES",
          nameEn: "Sales",
          nameAr: "المبيعات",
          isDefault: true,
          isActive: true,
          stages,
        }],
      };
    }
    if (path.includes("/board?")) {
      return { data: {
        pipeline: {
          id: pipelineId, code: "SALES", nameEn: "Sales", nameAr: "Sales",
          isDefault: true, isActive: true, stages,
        },
        stages: stages.map((stage, index) => ({
          stage, items: [],
          summary: { totalCount: 100 + index, amountsByCurrency: [] },
          activitySummary: {
            totalCount: 100 + index, noOpenCount: 100 + index,
            overdueCount: 0, todayCount: 0, futureCount: 0,
          },
          pageInfo: { limit: 50, hasMore: false, nextCursor: null },
        })),
      } };
    }
    if (path.includes("/capabilities?")) {
      return {
        data: {
          branchId,
          opportunities: { create: null, update: updateCapability, delete: null },
        },
      };
    }
    if (path === `/api/tenant/crm/v1/opportunities/${row.id}`) {
      return { data: { id: row.id, stageId: sourceId } };
    }
    throw new Error(`Unexpected GET: ${path}`);
  });
});

afterEach(cleanup);

async function renderListWorkspace() {
  const hook = renderHook(() => usePipelineWorkspace(false));
  await waitFor(() => expect(hook.result.current.capabilities).not.toBeNull());
  expect(hook.result.current.board).toBeNull();
  return hook;
}

describe("Card/Table terminal stage moves without a board", () => {
  it.each([
    { stageId: wonId, flag: "WON", body: { stageId: wonId, reason: "Signed" } },
    { stageId: lostId, flag: "LOST", body: { stageId: lostId, lostReason: "Signed" } },
  ])("confirms $flag and refreshes the list", async ({ stageId, flag, body }) => {
    const { result } = await renderListWorkspace();
    const reload = vi.fn().mockResolvedValue(undefined);

    act(() => result.current.requestListStageMove(row, stageId, reload));
    expect(result.current.terminalMove).toMatchObject({
      opportunity: { id: row.id, title: row.title },
      targetFlag: flag,
    });
    expect(api.post).not.toHaveBeenCalled();

    await act(async () => {
      expect(await result.current.confirmTerminalMove("  Signed  ")).toBe(true);
    });
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith(
      `/api/tenant/crm/v1/opportunities/${row.id}/stage`,
      body,
      expect.objectContaining({ nonReplayable: true, skipAutoIdempotency: true }),
    );
    expect(reload).toHaveBeenCalledOnce();
    expect(result.current.terminalMove).toBeNull();
    expect(result.current.board).toBeNull();
    expect(api.get.mock.calls.some(([path]) => String(path).includes("/board"))).toBe(false);
  });

  it("cancels without submitting or reloading", async () => {
    const { result } = await renderListWorkspace();
    const reload = vi.fn().mockResolvedValue(undefined);
    act(() => result.current.requestListStageMove(row, lostId, reload));
    act(() => result.current.cancelTerminalMove());
    expect(result.current.terminalMove).toBeNull();
    expect(api.post).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("checks the list row owner against update scope", async () => {
    updateCapability = { scope: "own", ownerUserIds: [ownerId] };
    const { result } = await renderListWorkspace();
    act(() => result.current.requestListStageMove(
      { ...row, ownerUserId: null },
      wonId,
      vi.fn().mockResolvedValue(undefined),
    ));
    expect(result.current.terminalMove).toBeNull();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("retains the dialog and error after a write that did not apply", async () => {
    const { result } = await renderListWorkspace();
    const reload = vi.fn().mockResolvedValue(undefined);
    api.post.mockRejectedValueOnce(new Error("Connection interrupted"));
    act(() => result.current.requestListStageMove(row, lostId, reload));
    await act(async () => {
      expect(await result.current.confirmTerminalMove("Budget declined")).toBe(false);
    });
    expect(result.current.terminalMove).not.toBeNull();
    expect(result.current.error).toBe(en.crmOpportunities.moveFailed);
    expect(result.current.isMutating).toBe(false);
    expect(api.post).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledOnce();
  });
});

describe("Card/Table server stage summaries", () => {
  it("loads all-stage counts beyond the list page and preserves filters", async () => {
    const { result } = renderHook(() => usePipelineWorkspace(false, true));
    await waitFor(() => expect(result.current.funnelLanes).toHaveLength(3));
    expect(result.current.funnelLanes?.map((lane) => lane.summary.totalCount))
      .toEqual([100, 101, 102]);
    expect(result.current.funnelLanes?.reduce((sum, lane) => sum + lane.summary.totalCount, 0))
      .toBe(303);
    act(() => result.current.setBasicSearch({
      text: "Renewal", myOpportunities: true, filters: [
        { field: "stage", value: wonId },
      ],
    }));
    expect(result.current.funnelLanes).toBeUndefined();
    await waitFor(() => expect(result.current.funnelLanes).toHaveLength(3));
    const calls = api.get.mock.calls.filter(([path]) => String(path).includes("/board?"));
    const query = new URL(String(calls.at(-1)?.[0]), "https://tenant.example").searchParams;
    expect(query.get("branchId")).toBe(branchId);
    expect(query.get("search")).toBe("Renewal");
    expect(query.get("ownerUserId")).toBe(ownerId);
    expect(query.has("stageId")).toBe(false);
    expect(query.has("page")).toBe(false);
  });

  it("keeps counts unavailable on a failed summary read", async () => {
    const get = api.get.getMockImplementation()!;
    api.get.mockImplementation((path: string) => path.includes("/board?")
      ? Promise.reject(new Error("Offline")) : get(path));
    const { result } = renderHook(() => usePipelineWorkspace(false, true));
    await waitFor(() => expect(result.current.loadError).not.toBeNull());
    expect(result.current.funnelLanes).toBeUndefined();
  });
});

it("refreshes server stage summaries after a list terminal move", async () => {
  const { result } = renderHook(() => usePipelineWorkspace(false, true));
  await waitFor(() => expect(result.current.funnelLanes).toHaveLength(3));
  api.get.mockClear();
  const reload = vi.fn().mockResolvedValue(undefined);
  act(() => result.current.requestListStageMove(row, wonId, reload));
  await act(async () => { expect(await result.current.confirmTerminalMove("Confirmed won")).toBe(true); });
  expect(reload).toHaveBeenCalledOnce();
  expect(api.get.mock.calls.some(([path]) => String(path).includes("/board?"))).toBe(true);
});

describe("confirmed reopening and refreshed action rights", () => {
  it.each([wonId, lostId])("confirms reopening a closed list row from %s", async (stageId) => {
    const { result } = await renderListWorkspace();
    const reload = vi.fn(async () => undefined);
    act(() => result.current.requestListStageMove({ ...row, stageId }, sourceId, reload));
    expect(result.current.reopenMove?.opportunity.id).toBe(row.id);
    expect(api.post).not.toHaveBeenCalled();
    await act(async () => { expect(await result.current.confirmReopenMove()).toBe(true); });
    expect(api.post).toHaveBeenCalledWith(expect.stringContaining(row.id), { stageId: sourceId }, expect.any(Object));
    expect(reload).toHaveBeenCalledOnce();
    expect(result.current.reopenMove).toBeNull();
  });

  it("cancels reopening without sending a write", async () => {
    const { result } = await renderListWorkspace();
    act(() => result.current.requestListStageMove({ ...row, stageId: wonId }, sourceId, vi.fn()));
    act(() => result.current.cancelReopenMove());
    expect(result.current.reopenMove).toBeNull();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("refreshes capabilities on focus and refuses an already open confirmation after revocation", async () => {
    const { result } = await renderListWorkspace();
    act(() => result.current.requestListStageMove({ ...row, stageId: wonId }, sourceId, vi.fn()));
    updateCapability = null;
    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(result.current.capabilities?.update).toBeNull());
    await act(async () => { expect(await result.current.confirmReopenMove()).toBe(false); });
    expect(api.post).not.toHaveBeenCalled();
  });

  it("removes effective capabilities and blocks pending writes in read-only mode", async () => {
    const { result, rerender } = await renderListWorkspace();
    act(() => result.current.requestListStageMove(row, wonId, vi.fn()));
    access.canMutate = false;
    rerender();
    expect(result.current.capabilities).toBeNull();
    expect(result.current.canUpdateOpportunity(row)).toBe(false);
    await act(async () => { expect(await result.current.confirmTerminalMove("Signed")).toBe(false); });
    expect(api.post).not.toHaveBeenCalled();
  });

  it("refreshes capabilities after a stage write returns 403", async () => {
    const { result } = await renderListWorkspace();
    api.get.mockClear();
    api.post.mockRejectedValueOnce(new TenantApiClientError("Forbidden", {
      status: 403, statusText: "Forbidden", data: {}, headers: new Headers(),
    }));
    act(() => result.current.requestListStageMove(row, wonId, vi.fn()));
    await act(async () => { expect(await result.current.confirmTerminalMove("Signed")).toBe(false); });
    expect(api.get.mock.calls.some(([path]) => String(path).includes("/capabilities?"))).toBe(true);
  });
});

it("queues a board reopen until the shared confirmation runs", async () => {
  const get = api.get.getMockImplementation()!;
  api.get.mockImplementation(async (path: string) => {
    const response = await get(path);
    if (!path.includes("/board?")) return response;
    return { ...response, data: { ...response.data, stages: response.data.stages.map((lane: { stage: { id: string }; items: unknown[] }) => ({
      ...lane,
      items: lane.stage.id === wonId ? [{
        ...row, branchId, pipelineId, stageId: wonId, stageFlag: "WON", status: "WON",
        customerProfileId: "01900100-0000-7000-8000-000000000112",
        importance: 0, cardColor: null, amount: null, currencyCode: null,
        activityState: "NO_OPEN", tags: [],
        createdAt: "2026-10-17T00:00:00Z", updatedAt: "2026-10-17T00:00:00Z",
      }] : [],
    })) } };
  });
  const { result } = renderHook(() => usePipelineWorkspace(true));
  await waitFor(() => expect(result.current.board?.stages[1].items).toHaveLength(1));
  act(() => result.current.moveCard(row.id, wonId, sourceId));
  expect(result.current.reopenMove?.cardId).toBe(row.id);
  expect(api.post).not.toHaveBeenCalled();
  await act(async () => { expect(await result.current.confirmReopenMove()).toBe(true); });
  expect(api.post).toHaveBeenCalledWith(expect.stringContaining(row.id), { stageId: sourceId }, expect.any(Object));
});

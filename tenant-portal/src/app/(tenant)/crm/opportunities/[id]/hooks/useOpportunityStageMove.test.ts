// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import type { OpportunityDetail } from "../../opportunity-contract";
import type { OpportunityStage } from "../../hooks/pipeline-types";
import { useOpportunityStageMove } from "./useOpportunityStageMove";

const dictionaries: Record<string, typeof en> = { en, ar };
const mocks = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn(), lang: "en" }));
vi.mock("@/lib/api/axiosClient", async (original) => ({
  ...(await original<typeof import("@/lib/api/axiosClient")>()),
  axiosClient: { post: mocks.post, get: mocks.get },
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: dictionaries[mocks.lang], lang: mocks.lang }),
}));
vi.mock("../../../shared/hooks/useCrmErrorText", () => ({
  useCrmErrorText: () => (error: { status: number }) => {
    const t = dictionaries[mocks.lang];
    return error.status === 403 ? t.crmShared.errorForbidden : t.crmShared.errorOffline;
  },
}));
vi.mock("../../hooks/usePipelineWorkspace", () => ({
  buildStageMoveRequest: (stageId: string, flag: string, reason?: string) => ({
    stageId, ...(flag === "LOST" ? { lostReason: reason } : {}),
  }),
}));

afterEach(cleanup);

const opportunity = { id: "01900100-0000-7000-8000-000000000001" } as OpportunityDetail;
const stage: OpportunityStage = {
  id: "01900100-0000-7000-8000-000000000002",
  pipelineId: "01900100-0000-7000-8000-000000000003",
  opportunityStageId: "01900100-0000-7000-8000-000000000004",
  nameEn: "Lost", nameAr: "\u062e\u0633\u0627\u0631\u0629", flag: "LOST", category: "TERMINAL",
  rank: 1, isActive: true, isSystem: false,
};

describe.each(["en", "ar"])("stage move feedback in %s", (lang) => {
  it.each(["NEW", "LOST"] as const)("localizes a refused %s move without exposing the raw exception", async (flag) => {
    mocks.lang = lang;
    mocks.post.mockReset().mockRejectedValue(new TenantApiClientError("internal raw error", {
      status: 403, statusText: "Forbidden", data: {}, headers: new Headers(),
    }));
    const reload = vi.fn();
    const { result } = renderHook(() => useOpportunityStageMove(opportunity, [{ ...stage, flag }], true, reload));
    await act(async () => { expect(await result.current.move(stage.id, "Reason")).toBe(false); });
    const t = dictionaries[lang];
    expect(result.current.error).toBe(`${t.crmOpportunities.moveFailed} ${t.crmShared.errorForbidden}`);
    expect(result.current.error).not.toContain("internal raw error");
    expect(reload).not.toHaveBeenCalled();
    expect(result.current.isMoving).toBe(false);
    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });

  it("uses localized move and offline text for a network exception", async () => {
    mocks.lang = lang;
    mocks.post.mockReset().mockRejectedValue(new Error("raw connection failure"));
    const { result } = renderHook(() => useOpportunityStageMove(opportunity, [stage], true, vi.fn()));
    await act(async () => { await result.current.move(stage.id, "Reason"); });
    const t = dictionaries[lang];
    expect(result.current.error).toBe(t.crmOpportunityDetail.form.stageOutcomeUnknown);
    expect(result.current.uncertain).toBe(true);
    expect(result.current.error).not.toContain(t.crmOpportunityDetail.historyUnavailable);
  });
});

describe("uncertain stage movement", () => {
  const origin = {
    id: opportunity.id, branchId: "01900100-0000-7000-8000-000000000010", customerProfileId: "01900100-0000-7000-8000-000000000011",
    pipelineId: stage.pipelineId, stageId: "01900100-0000-7000-8000-000000000012", status: "IN_PROGRESS", title: "Support contract", importance: 0,
    createdAt: "2026-11-01T09:00:00.000Z", updatedAt: "2026-11-04T09:00:00.000Z",
  } as OpportunityDetail;

  it("confirms a committed stage through GET instead of repeating the non-replayable POST", async () => {
    mocks.lang = "en";
    mocks.post.mockReset().mockRejectedValueOnce(new Error("Lost response"));
    mocks.get.mockReset().mockResolvedValue({ data: { ...origin, stageId: stage.id, status: "LOST" }, status: 200 });
    const reload = vi.fn();
    const { result } = renderHook(() => useOpportunityStageMove(origin, [stage], true, reload));
    await act(async () => { await result.current.move(stage.id, "Reason"); });
    await act(async () => { expect(await result.current.move(stage.id, "Changed reason")).toBe(true); });
    expect(mocks.post).toHaveBeenCalledOnce();
    expect(mocks.get).toHaveBeenCalledOnce();
    expect(result.current.uncertain).toBe(false);
    expect(reload).toHaveBeenCalledOnce();
  });

  it("keeps the pending move locked when reconciliation cannot read the record", async () => {
    mocks.post.mockReset().mockRejectedValueOnce(new Error("Lost response"));
    mocks.get.mockReset().mockRejectedValue(new Error("Read failed"));
    const { result } = renderHook(() => useOpportunityStageMove(origin, [stage], true, vi.fn()));
    await act(async () => { await result.current.move(stage.id, "Reason"); });
    await act(async () => { expect(await result.current.reconcile()).toBe(false); });
    expect(result.current.uncertain).toBe(true);
    await act(async () => { await result.current.move(stage.id, "Reason"); });
    expect(mocks.post).toHaveBeenCalledOnce();
  });

  it("requires another explicit confirmation after an unchanged authoritative read", async () => {
    mocks.post.mockReset().mockRejectedValueOnce(new Error("Lost response")).mockResolvedValue({ data: {} });
    mocks.get.mockReset().mockResolvedValue({ data: origin });
    const { result } = renderHook(() => useOpportunityStageMove(origin, [stage], true, vi.fn()));
    await act(async () => { await result.current.move(stage.id, "Reason"); });
    await act(async () => { expect(await result.current.move(stage.id, "Reason")).toBe(false); });
    expect(mocks.post).toHaveBeenCalledOnce();
    expect(result.current.uncertain).toBe(false);
    await act(async () => { expect(await result.current.move(stage.id, "Reason")).toBe(true); });
    expect(mocks.post).toHaveBeenCalledTimes(2);
  });
});

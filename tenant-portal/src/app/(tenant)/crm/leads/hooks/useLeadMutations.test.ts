// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { axiosClient, TenantApiClientError } from "@/lib/api/axiosClient";
import type { LeadItem, LeadStage } from "../lead-list-contract";
import { useLeadMutations, type LeadWriteContext } from "./useLeadMutations";

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en }) }));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api/axiosClient")>(),
  axiosClient: { post: vi.fn() },
}));

const stages: [LeadStage, LeadStage] = [
  { id: "01900100-0000-7000-8000-000000000010", nameAr: "", nameEn: "New", flag: "NEW" },
  { id: "01900100-0000-7000-8000-000000000011", nameAr: "", nameEn: "Contacted", flag: "CONTACTED" },
];
const lead: LeadItem = {
  id: "01900100-0000-7000-8000-000000000001",
  partyId: "01900100-0000-7000-8000-000000000002",
  leadProfileType: "INDIVIDUAL", leadName: "Lead", company: "", email: "",
  phone: "", phones: [], country: "", primaryContact: null,
  sourceNameAr: "", sourceNameEn: "", sourceIconUrl: null, stageId: stages[0].id,
  ownerUserId: null, rating: 0, cardColor: null, owner: null, nextActivity: null,
  tags: [],
};

function setup() {
  const context = {
    branchId: "01900100-0000-7000-8000-000000000004", items: [lead], stages,
    capabilities: { create: null, update: { scope: "all", ownerUserIds: null }, delete: null },
    setError: vi.fn(), report: vi.fn(), reconcile: vi.fn().mockResolvedValue(true),
  } satisfies LeadWriteContext;
  const hook = renderHook(() => useLeadMutations({
    ...context, currentPage: 1, closeCreate: vi.fn(), resetSearch: vi.fn(),
    selectedForDelete: null, setSelectedForDelete: vi.fn(),
  }));
  return { ...hook, context };
}

beforeEach(() => vi.clearAllMocks());

describe("single-lead stage move outcomes", () => {
  it.each([400, 403, 409, 422])("returns the %s refusal without claiming a stage change", async (status) => {
    const caught = new TenantApiClientError("Refused", {
      status, statusText: "Refused", headers: new Headers(),
      data: { message: "Rejected stage", correlationId: "stage-reference" },
    });
    vi.mocked(axiosClient.post).mockRejectedValueOnce(caught);
    const { result, context } = setup();
    await act(async () => {
      expect(await result.current.moveLead(lead.id, stages[1].id)).toMatchObject({
        kind: "failed", error: { status, correlationId: "stage-reference" },
      });
    });
    expect(context.report).toHaveBeenCalledWith(caught, en.crmLeads.messages.moveFailed);
    expect(context.reconcile).toHaveBeenCalledOnce();
    expect(result.current.isMovePending).toBe(false);
  });

  it("returns success after reconciliation while keeping the bulk result boolean", async () => {
    const { result, context } = setup();
    await act(async () => {
      expect(await result.current.moveLead(lead.id, stages[1].id)).toEqual({ kind: "success" });
      expect(await result.current.bulkMoveStage([lead.id], stages[1].id)).toBe(true);
    });
    expect(context.reconcile).toHaveBeenCalledTimes(2);
  });

  it("keeps a network failure ambiguous and reloads the server state", async () => {
    vi.mocked(axiosClient.post).mockRejectedValueOnce(new TypeError("Lost connection"));
    const { result, context } = setup();
    await act(async () => {
      expect(await result.current.moveLead(lead.id, stages[1].id)).toMatchObject({ kind: "ambiguous", error: { status: 0 } });
    });
    expect(context.reconcile).toHaveBeenCalledOnce();
  });

  it("returns a blocked outcome without a request for an unavailable stage", async () => {
    const { result } = setup();
    expect(await result.current.moveLead(lead.id, "unknown-stage")).toEqual({ kind: "blocked", message: en.crmLeads.messages.stageUnavailable });
    expect(axiosClient.post).not.toHaveBeenCalled();
  });
});

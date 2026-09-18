// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OpportunityDetail } from "../../opportunity-contract";
import type { OpportunityPipeline } from "../../hooks/pipeline-types";
import { useOpportunityEdit } from "./useOpportunityEdit";
import { usePipelineTransfer } from "./usePipelineTransfer";

const { api } = vi.hoisted(() => ({
  api: { patch: vi.fn(), put: vi.fn() },
}));

vi.mock("@/lib/api/axiosClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/axiosClient")>()),
  axiosClient: api,
}));

const item = {
  id: "01900100-0000-7000-8000-000000000001",
  branchId: "01900100-0000-7000-8000-000000000002",
  customerProfileId: "01900100-0000-7000-8000-000000000003",
  customerPartyId: "01900100-0000-7000-8000-000000000004",
  contactPartyId: null,
  leadId: null,
  pipelineId: "01900100-0000-7000-8000-000000000005",
  stageId: "01900100-0000-7000-8000-000000000006",
  stageFlag: "QUALIFICATION",
  status: "IN_PROGRESS",
  title: "Renewal",
  importance: 2,
  cardColor: null,
  amount: "1000.00",
  currencyCode: "EGP",
  description: null,
  expectedCloseDate: null,
  probabilityPercent: 20,
  ownerUserId: "01900100-0000-7000-8000-000000000007",
  wonAt: null,
  lostAt: null,
  lostReason: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  customerProfileType: "CORPORATE",
  customerDisplayName: "Acme",
  customerCompanyName: "Acme LLC",
  customerPhone: "+201000000000",
  customerEmail: "hello@acme.example",
  customerCountry: "Egypt",
  customerCity: "Cairo",
  primaryContact: null,
  leadSourceName: "Website",
  leadSourceIconUrl: null,
  ownerDisplayName: "Kamal Radwan",
  ownerAvatarUrl: null,
  openActivityCount: 1,
  nextOpenActivityAt: null,
  activityState: "TODAY",
  tags: [],
} satisfies OpportunityDetail;

const targetPipeline: OpportunityPipeline = {
  id: "01900100-0000-7000-8000-000000000010",
  code: "SECOND",
  nameAr: "ثانوي",
  nameEn: "Second",
  isDefault: false,
  isActive: true,
  stages: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  const rawEntity = {
    ...item,
    customerDisplayName: undefined,
    ownerDisplayName: undefined,
    primaryContact: undefined,
    tags: undefined,
  };
  api.patch.mockResolvedValue({ data: rawEntity, status: 200, headers: {} });
  api.put.mockResolvedValue({
    data: { ...rawEntity, pipelineId: targetPipeline.id },
    status: 200,
    headers: {},
  });
});

afterEach(cleanup);

describe("Opportunity detail mutation reconciliation", () => {
  it("reloads after an edit response instead of replacing the rich detail with the raw entity", async () => {
    const reconcile = vi.fn();
    const { result } = renderHook(() => useOpportunityEdit(item, reconcile));
    act(() => {
      result.current.openDrawer();
    });
    act(() => {
      result.current.setField("title", "Renewal 2027");
    });
    await act(async () => {
      await result.current.submit();
    });

    expect(api.patch).toHaveBeenCalledOnce();
    expect(reconcile).toHaveBeenCalledOnce();
    expect(result.current.open).toBe(false);
  });

  it("reloads after a transfer response instead of replacing the rich detail with the raw entity", async () => {
    const reconcile = vi.fn();
    const { result } = renderHook(() =>
      usePipelineTransfer(item, [targetPipeline], reconcile),
    );
    act(() => {
      result.current.openDialog();
      result.current.setPipelineId(targetPipeline.id);
    });
    await act(async () => {
      await result.current.submit();
    });

    expect(api.put).toHaveBeenCalledOnce();
    expect(reconcile).toHaveBeenCalledOnce();
    expect(result.current.open).toBe(false);
  });
});

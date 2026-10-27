// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import type { OpportunityDetail } from "../../opportunity-contract";
import type { OpportunityPipeline } from "../../hooks/pipeline-types";
import { useOpportunityEdit } from "./useOpportunityEdit";
import { usePipelineTransfer } from "./usePipelineTransfer";

const { api } = vi.hoisted(() => ({
  api: { get: vi.fn(), patch: vi.fn(), put: vi.fn() },
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
  api.get.mockResolvedValue({ data: [], status: 200, headers: new Headers() });
  const rawEntity = {
    ...item,
    customerDisplayName: undefined,
    ownerDisplayName: undefined,
    primaryContact: undefined,
    tags: undefined,
  };
  api.patch.mockResolvedValue({ data: rawEntity, status: 200, headers: new Headers() });
  api.put.mockResolvedValue({
    data: { ...rawEntity, pipelineId: targetPipeline.id },
    status: 200,
    headers: new Headers(),
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

  it("loads stored custom fields and persists a correction without resending untouched fields", async () => {
    const definitionId = "01900100-0000-7000-8000-000000000010";
    api.get.mockImplementation(async (path: string) => ({
      data: path.includes("/values?") ? [{
        id: "01900100-0000-7000-8000-000000000011",
        fieldDefinitionId: definitionId, ownerType: "OPPORTUNITY", ownerId: item.id, value: "original",
      }] : [{
        id: definitionId, ownerType: "OPPORTUNITY", fieldKey: "reference",
        nameAr: "\u0645\u0631\u062c\u0639", nameEn: "Reference", type: "TEXT", options: [],
        isSearchable: false, isActive: true, sortOrder: 1, requirements: [],
      }],
      status: 200, headers: {},
    }));
    const reconcile = vi.fn();
    const { result } = renderHook(() => useOpportunityEdit(item, reconcile));
    act(() => result.current.openDrawer());
    await waitFor(() => expect(result.current.form?.customFields).toEqual({ reference: "original" }));
    expect(result.current.isDirty).toBe(false);
    act(() => result.current.setCustomField("reference", "corrected"));
    expect(result.current.isDirty).toBe(true);
    await act(async () => { await result.current.submit(); });
    expect(api.patch.mock.calls[0]?.[1]).toEqual({ customFields: { reference: "corrected" } });
    expect(reconcile).toHaveBeenCalledOnce();
    expect(result.current.open).toBe(false);

    act(() => result.current.openDrawer());
    await waitFor(() => expect(result.current.customFieldsLoading).toBe(false));
    act(() => result.current.setCustomField("reference", "rejected correction"));
    api.patch.mockRejectedValue(new TenantApiClientError("Rejected", {
      status: 422, statusText: "Unprocessable Entity", headers: new Headers(),
      data: { code: "CUSTOM_FIELD_VALUE_INVALID" },
    }));
    await act(async () => { await result.current.submit(); });
    expect(result.current.error?.code).toBe("CUSTOM_FIELD_VALUE_INVALID");
    expect(result.current.form?.customFields.reference).toBe("rejected correction");
    expect(reconcile).toHaveBeenCalledOnce();
    act(() => result.current.revert());
    expect(result.current.form?.customFields.reference).toBe("original");
    expect(result.current.isDirty).toBe(false);
  });

  it("keeps failed reads out of the editable custom-field baseline and permits retry", async () => {
    api.get.mockRejectedValue(new TenantApiClientError("Forbidden", {
      status: 403, statusText: "Forbidden", headers: new Headers(),
      data: { code: "FORBIDDEN" },
    }));
    const { result } = renderHook(() => useOpportunityEdit(item, vi.fn()));
    act(() => result.current.openDrawer());
    await waitFor(() => expect(result.current.customFieldsError?.status).toBe(403));
    act(() => result.current.setCustomField("reference", "unsafe"));
    expect(result.current.form?.customFields).toEqual({});
    api.get.mockResolvedValue({ data: [], status: 200, headers: {} });
    act(() => result.current.retryCustomFields());
    await waitFor(() => expect(result.current.customFieldsError).toBeNull());
    expect(result.current.isDirty).toBe(false);
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

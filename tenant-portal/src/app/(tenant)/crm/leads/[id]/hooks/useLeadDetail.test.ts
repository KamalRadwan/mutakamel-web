// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { readLeadStageCatalogue } from "../../../shared/lead-stage-catalogue";
import type { LeadDetail } from "../../lead-contract";
import { fetchLeadDetail } from "../../lead-requests";
import { useLeadDetail } from "./useLeadDetail";

vi.mock("../../lead-requests", () => ({ fetchLeadDetail: vi.fn() }));
vi.mock("../../../shared/lead-stage-catalogue", () => ({ readLeadStageCatalogue: vi.fn() }));

const leadId = "01900100-0000-7000-8000-000000000001";

function apiError(status: number, code: string) {
  return new TenantApiClientError("Unavailable", {
    status, statusText: "Unavailable", headers: new Headers(), data: { code },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(readLeadStageCatalogue).mockResolvedValue([]);
});
afterEach(cleanup);

describe("useLeadDetail record privacy", () => {
  it("classifies LEAD_NOT_FOUND as not found and clears a previously visible lead", async () => {
    vi.mocked(fetchLeadDetail).mockResolvedValueOnce({ lead: { id: leadId } as LeadDetail, card: null });
    const { result } = renderHook(() => useLeadDetail(leadId));
    await waitFor(() => expect(result.current.lead?.id).toBe(leadId));

    vi.mocked(fetchLeadDetail).mockRejectedValueOnce(apiError(404, "LEAD_NOT_FOUND"));
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.isNotFound).toBe(true));
    expect(result.current.isForbidden).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.lead).toBeNull();
    expect(result.current.card).toBeNull();
    expect(result.current.stageCatalogue).toEqual([]);
    expect(result.current.error).toMatchObject({ status: 404, code: "LEAD_NOT_FOUND" });
  });

  it("retains the permission boundary for a route-level 403", async () => {
    vi.mocked(fetchLeadDetail).mockRejectedValueOnce(apiError(403, "CRM_PERMISSION_DENIED"));
    const { result } = renderHook(() => useLeadDetail(leadId));
    await waitFor(() => expect(result.current.isForbidden).toBe(true));
    expect(result.current.isNotFound).toBe(false);
    expect(result.current.lead).toBeNull();
  });
});

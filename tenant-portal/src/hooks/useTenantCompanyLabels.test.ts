// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TenantUserProfile } from "@/context/AuthContext";
import { useTenantCompanyLabels } from "./useTenantBranchLabels";

const COMPANY = "01900100-0000-7000-8000-000000000001";
const OTHER_COMPANY = "01900100-0000-7000-8000-000000000002";
const state = vi.hoisted(() => ({
  user: null as TenantUserProfile | null,
  generation: "session-1",
  read: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: state.user, realtimeAuthGeneration: state.generation }),
}));
vi.mock("@/app/(tenant)/core/contracts/organization-contract", () => ({
  fetchOrgNodes: (...args: unknown[]) => state.read(...args),
}));

beforeEach(() => {
  state.generation = "session-1";
  state.user = {
    id: "01900100-0000-7000-8000-000000000003",
    email: "agent@example.com", firstName: "Sara", lastName: "Nour",
    isTenantOwner: false, status: "ACTIVE", accessibleCompanies: [COMPANY],
    accessibleBranches: [], accessibleBranchCompanies: [], teamMemberships: [],
    permissions: ["org.company.read"], featureEntitlements: {},
    permissionScopes: { "org.company.read": { tenantWide: true, companyIds: [], branchIds: [] } },
    accessScope: { mode: "EXPLICIT", branchesTruncated: false, companiesTruncated: false,
      teamMembershipsTruncated: false, teamMembershipsTotal: 0 },
  };
  state.read.mockReset();
  state.read.mockResolvedValue({ items: [
    { id: COMPANY, name: " Mersany Trading " },
    { id: OTHER_COMPANY, name: "Other tenant company" },
  ], hasNext: false });
});
afterEach(cleanup);

describe("tenant company labels", () => {
  it("reads company names from Core and keeps only accessible names", async () => {
    const { result } = renderHook(() => useTenantCompanyLabels());
    await waitFor(() => expect(result.current.get(COMPANY)).toBe("Mersany Trading"));
    expect(result.current.has(OTHER_COMPANY)).toBe(false);
    expect(state.read).toHaveBeenCalledWith("companies", expect.objectContaining({
      page: 1, search: "", limit: 100, suppressForbiddenToast: true,
      signal: expect.any(AbortSignal),
    }));
  });

  it("does not read organization companies without permission", () => {
    state.user = { ...state.user!, permissions: [], permissionScopes: {} };
    const { result } = renderHook(() => useTenantCompanyLabels());
    expect(result.current.size).toBe(0);
    expect(state.read).not.toHaveBeenCalled();
  });

  it("drops old names immediately on session changes and retries the lookup", async () => {
    const { result, rerender } = renderHook(() => useTenantCompanyLabels());
    await waitFor(() => expect(result.current.get(COMPANY)).toBe("Mersany Trading"));
    state.generation = "session-2";
    state.read.mockRejectedValueOnce(new Error("Unavailable"));
    rerender();
    expect(result.current.size).toBe(0);
    await waitFor(() => expect(state.read).toHaveBeenCalledTimes(2));
    expect(result.current.size).toBe(0);
  });
});

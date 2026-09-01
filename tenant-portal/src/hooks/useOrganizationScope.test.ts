// @vitest-environment jsdom

import { useEffect } from "react";
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OrganizationScopeMode, TenantScopeSource } from "@/lib/api/organization-scope";
import { useOrganizationScopeHeaders } from "./useOrganizationScope";

const { auth } = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth() as unknown }));

const COMPANY = "0192f3a0-0000-7000-8000-000000000001";
const OTHER_COMPANY = "0192f3a0-0000-7000-8000-000000000004";
const BRANCH = "0192f3a0-0000-7000-8000-000000000002";
const OTHER_BRANCH = "0192f3a0-0000-7000-8000-000000000003";

function source(companyId = COMPANY): TenantScopeSource {
  return {
    accessibleBranches: [BRANCH, OTHER_BRANCH],
    accessibleCompanies: [companyId],
    teamMemberships: [BRANCH, OTHER_BRANCH].map((branchId) => ({ companyId, branchId, isPrimary: false })),
  };
}

afterEach(() => {
  cleanup();
  auth.mockReset();
});

describe("organization scope header identity", () => {
  it("keeps the same headers across unrelated renders and equivalent auth profiles", () => {
    auth.mockReturnValue({ user: source() });
    const request = vi.fn();
    const { result, rerender } = renderHook(() => {
      const headers = useOrganizationScopeHeaders("BRANCH_REQUIRED", BRANCH);
      useEffect(() => { request(headers); }, [headers]);
      return headers;
    });
    const initial = result.current;
    expect(initial).toEqual({ "x-mutakamel-company-id": COMPANY, "x-mutakamel-branch-id": BRANCH });
    rerender();
    auth.mockReturnValue({ user: source() });
    rerender();
    expect(result.current).toBe(initial);
    expect(request).toHaveBeenCalledOnce();
  });

  it("invalidates dependent requests when the company, branch, or route mode changes", () => {
    auth.mockReturnValue({ user: source() });
    const request = vi.fn();
    const { result, rerender } = renderHook(({ branchId, mode }) => {
      const headers = useOrganizationScopeHeaders(mode, branchId);
      useEffect(() => { request(headers); }, [headers]);
      return headers;
    }, { initialProps: { branchId: BRANCH, mode: "BRANCH_REQUIRED" as OrganizationScopeMode } });

    auth.mockReturnValue({ user: source(OTHER_COMPANY) });
    rerender({ branchId: BRANCH, mode: "BRANCH_REQUIRED" });
    expect(result.current).toEqual({ "x-mutakamel-company-id": OTHER_COMPANY, "x-mutakamel-branch-id": BRANCH });
    rerender({ branchId: OTHER_BRANCH, mode: "BRANCH_REQUIRED" });
    expect(result.current).toEqual({ "x-mutakamel-company-id": OTHER_COMPANY, "x-mutakamel-branch-id": OTHER_BRANCH });
    rerender({ branchId: OTHER_BRANCH, mode: "NONE" });
    expect(result.current).toEqual({});
    expect(request).toHaveBeenCalledTimes(4);
  });

  it("keeps unresolved scope stable without guessing a company", () => {
    auth.mockReturnValue({ user: { accessibleBranches: [BRANCH], accessibleCompanies: [COMPANY], teamMemberships: [] } });
    const { result, rerender } = renderHook(() => useOrganizationScopeHeaders("BRANCH_REQUIRED", BRANCH));
    const initial = result.current;
    rerender();
    expect(result.current).toEqual({});
    expect(result.current).toBe(initial);
  });
});

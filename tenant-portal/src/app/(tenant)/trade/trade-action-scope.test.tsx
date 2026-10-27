// @vitest-environment jsdom

import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BRANCH_SCOPE_HEADER, COMPANY_SCOPE_HEADER } from "@/lib/api/organization-scope";
import type { PermissionScope } from "@/lib/auth/permission-scope";
import { useTradeDocumentScope } from "./documents/hooks/useTradeDocumentScope";
import { hasTradePermission, useTradeScope } from "./trade-advanced-scope";

const fixture = vi.hoisted(() => ({
  company: "01902001-3000-7000-8000-000000000001",
  branchA: "01902001-3000-7000-8000-000000000002",
  branchB: "01902001-3000-7000-8000-000000000003",
  read: "trade.quotations.read",
  create: "trade.quotations.create",
  branch: null as string | null,
  resolved: true,
  owner: false,
  scopes: {} as Record<string, PermissionScope>,
}));

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: {
    id: "actor",
    permissions: [fixture.read, fixture.create],
    permissionScopes: fixture.scopes,
    isTenantOwner: fixture.owner,
  } }),
}));

vi.mock("./useTradeScope", () => ({
  useTradeScope: () => ({
    context: { companyId: fixture.company, branchId: fixture.branch, channelId: null },
    companyIds: [fixture.company],
  }),
  useTradeScopeRequest: () => ({
    headers: fixture.resolved ? {
      "x-mutakamel-company-id": fixture.company,
      "x-mutakamel-branch-id": fixture.branch,
    } : {},
    gap: fixture.resolved ? null : "branch-required",
  }),
}));

function useActions() {
  const document = useTradeDocumentScope();
  const advanced = useTradeScope("BRANCH", fixture.branch);
  return {
    document,
    advanced,
    advancedCan: (permission: string) => hasTradePermission(
      advanced.permissions, advanced.isTenantOwner, permission,
    ),
  };
}

beforeEach(() => {
  fixture.branch = fixture.branchA;
  fixture.resolved = true;
  fixture.owner = false;
  fixture.scopes = {
    [fixture.read]: {
      tenantWide: false, companyIds: [fixture.company],
      branchIds: [fixture.branchA, fixture.branchB],
    },
    [fixture.create]: {
      tenantWide: false, companyIds: [fixture.company], branchIds: [fixture.branchA],
    },
  };
});
afterEach(cleanup);

describe("Trade actions follow the request target", () => {
  it("keeps read access in B but removes create access granted only in A", () => {
    const { result, rerender } = renderHook(useActions);
    expect(result.current.document.canWrite(fixture.create)).toBe(true);
    expect(result.current.advancedCan(fixture.create)).toBe(true);

    fixture.branch = fixture.branchB;
    rerender();
    expect(result.current.document.headers[BRANCH_SCOPE_HEADER]).toBe(fixture.branchB);
    expect(result.current.advanced.headers[BRANCH_SCOPE_HEADER]).toBe(fixture.branchB);
    expect(result.current.document.canWrite(fixture.read)).toBe(true);
    expect(result.current.advancedCan(fixture.read)).toBe(true);
    expect(result.current.document.canWrite(fixture.create)).toBe(false);
    expect(result.current.advancedCan(fixture.create)).toBe(false);

    fixture.branch = fixture.branchA;
    rerender();
    expect(result.current.document.canWrite(fixture.create)).toBe(true);
    expect(result.current.advancedCan(fixture.create)).toBe(true);
  });

  it("fails closed without a scope projection even when the flat key exists", () => {
    fixture.scopes = {};
    const { result } = renderHook(useActions);
    expect(result.current.document.canWrite(fixture.create)).toBe(false);
    expect(result.current.advancedCan(fixture.create)).toBe(false);
  });

  it("checks the company sent in headers", () => {
    fixture.scopes[fixture.create].companyIds = [];
    const { result } = renderHook(useActions);
    expect(result.current.document.headers[COMPANY_SCOPE_HEADER]).toBe(fixture.company);
    expect(result.current.document.canWrite(fixture.create)).toBe(false);
    expect(result.current.advancedCan(fixture.create)).toBe(false);
  });

  it("preserves the owner bypass only while the required selection is resolved", () => {
    fixture.owner = true;
    fixture.scopes = {};
    const { result, rerender } = renderHook(useActions);
    expect(result.current.document.canWrite(fixture.create)).toBe(true);
    expect(result.current.advancedCan(fixture.create)).toBe(true);
    fixture.branch = null;
    fixture.resolved = false;
    rerender();
    expect(result.current.document.canWrite(fixture.create)).toBe(false);
    expect(result.current.advancedCan(fixture.create)).toBe(false);
  });

  it("uses company-only and tenant-wide targets for their respective routes", () => {
    const { result } = renderHook(() => ({
      company: useTradeScope("COMPANY", fixture.branch),
      tenant: useTradeScope("TENANT", fixture.branch),
    }));
    expect(result.current.company.headers).toEqual({ [COMPANY_SCOPE_HEADER]: fixture.company });
    expect(result.current.company.permissions).toContain(fixture.create);
    expect(result.current.tenant.headers).toEqual({});
    expect(result.current.tenant.permissions).not.toContain(fixture.create);
  });
});

// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCustomFieldsSessionKey } from "./useCustomFieldsPage";

const fixture = vi.hoisted(() => ({
  user: { id: "actor-a", isTenantOwner: false, permissions: ["crm.custom_fields.read"],
    permissionScopes: {} as Record<string, unknown>, accessibleBranches: ["branch-a"],
    accessibleCompanies: ["company-a"], accessibleBranchCompanies: [{ branchId: "branch-a", companyId: "company-a" }],
    teamMemberships: [] as unknown[], featureEntitlements: { crm: true }, accessScope: { mode: "FULL" },
    firstName: "Kamal" },
  generation: "session-a",
}));
vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: fixture.user, realtimeAuthGeneration: fixture.generation }),
}));
beforeEach(() => {
  fixture.user.id = "actor-a"; fixture.generation = "session-a";
  fixture.user.permissions = ["crm.custom_fields.read"]; fixture.user.permissionScopes = {};
  fixture.user.accessibleBranchCompanies = [{ branchId: "branch-a", companyId: "company-a" }];
});
afterEach(cleanup);

describe("Custom Fields actor/session boundary", () => {
  it.each(["actor", "session", "permissions", "scope", "company"] as const)("remounts the workspace after %s changes", (change) => {
    const { result, rerender } = renderHook(useCustomFieldsSessionKey);
    const previous = result.current;
    if (change === "actor") fixture.user.id = "actor-b";
    if (change === "session") fixture.generation = "session-b";
    if (change === "permissions") fixture.user.permissions = [];
    if (change === "scope") fixture.user.permissionScopes = { "crm.custom_fields.read": { branches: ["branch-b"] } };
    if (change === "company") fixture.user.accessibleBranchCompanies = [{ branchId: "branch-a", companyId: "company-b" }];
    rerender();
    expect(result.current).not.toBe(previous);
  });
  it("retains drafts across a harmless profile-name refresh", () => {
    const { result, rerender } = renderHook(useCustomFieldsSessionKey);
    const previous = result.current;
    fixture.user.firstName = "Updated name";
    rerender();
    expect(result.current).toBe(previous);
  });
});


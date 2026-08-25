import { describe, expect, it } from "vitest";
import { resolveDefaultTenantBranchId } from "./useTenantBranchSelection";

const branchA = "01900100-0000-7000-8000-000000000001";
const branchB = "01900100-0000-7000-8000-000000000002";

describe("tenant branch selection", () => {
  it("prefers one accessible primary branch", () => {
    expect(
      resolveDefaultTenantBranchId({
        accessibleBranches: [branchA, branchB],
        teamMemberships: [{ branchId: branchB, isPrimary: true }],
      }),
    ).toBe(branchB);
  });

  it("requires an explicit choice for multiple branches without a primary", () => {
    expect(
      resolveDefaultTenantBranchId({
        accessibleBranches: [branchA, branchB],
        teamMemberships: [],
      }),
    ).toBeNull();
    expect(
      resolveDefaultTenantBranchId({
        accessibleBranches: [branchA],
        teamMemberships: [],
      }),
    ).toBe(branchA);
  });

  it("never trusts a primary branch outside the accessible set", () => {
    expect(
      resolveDefaultTenantBranchId({
        accessibleBranches: [branchA],
        teamMemberships: [{ branchId: branchB, isPrimary: true }],
      }),
    ).toBe(branchA);
  });
});

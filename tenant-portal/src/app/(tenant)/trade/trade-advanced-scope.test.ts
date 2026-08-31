import { describe, expect, it } from "vitest";
import type { TenantUserProfile } from "@/context/AuthContext";
import { hasTradePermission, tradeScopeHeaders } from "./trade-advanced-scope";

const companyId = "01902001-3000-7000-8000-000000000001";
const otherCompanyId = "01902001-3000-7000-8000-000000000002";
const branchId = "01902001-3000-7000-8000-000000000003";
const channelId = "01902001-3000-7000-8000-000000000004";

function user(overrides: Partial<TenantUserProfile> = {}): TenantUserProfile {
  return {
    id: "01902001-3000-7000-8000-00000000000a",
    email: "a@b.test",
    firstName: "A",
    lastName: "B",
    isTenantOwner: false,
    status: "ACTIVE",
    accessibleBranches: [branchId],
    accessibleCompanies: [companyId],
    permissions: [],
    teamMemberships: [{ companyId, branchId, isPrimary: true }],
    ...overrides,
  } as TenantUserProfile;
}

describe("Trade scope headers", () => {
  it("sends both headers for a BRANCH-target route", () => {
    expect(tradeScopeHeaders(user(), branchId, "BRANCH")).toEqual({
      "x-mutakamel-company-id": companyId,
      "x-mutakamel-branch-id": branchId,
    });
  });

  it("sends the company alone for a COMPANY-target route", () => {
    // A branch header is what makes the resolved target BRANCH; sending one on
    // a COMPANY route narrows the scope and hides rows the user may see.
    expect(tradeScopeHeaders(user(), branchId, "COMPANY")).toEqual({
      "x-mutakamel-company-id": companyId,
    });
  });

  it("sends nothing for a TENANT target, which resolves legally to TENANT", () => {
    expect(tradeScopeHeaders(user(), branchId, "TENANT")).toEqual({});
  });

  it("falls back to the sole accessible company only on a COMPANY route", () => {
    const withoutMembership = user({ teamMemberships: [] });
    expect(tradeScopeHeaders(withoutMembership, null, "COMPANY")).toEqual({
      "x-mutakamel-company-id": companyId,
    });
    // A BRANCH route's company must be the one that owns the branch, so the
    // fallback must not apply there.
    expect(tradeScopeHeaders(withoutMembership, null, "BRANCH")).toEqual({});
  });

  it("refuses to guess when two companies are accessible", () => {
    const ambiguous = user({
      teamMemberships: [],
      accessibleCompanies: [companyId, otherCompanyId],
    });
    expect(tradeScopeHeaders(ambiguous, null, "COMPANY")).toEqual({});
  });

  it("adds Trade's own channel header only when a channel is chosen", () => {
    expect(tradeScopeHeaders(user(), branchId, "BRANCH", channelId)).toHaveProperty(
      "x-mutakamel-channel-id",
      channelId,
    );
    expect(tradeScopeHeaders(user(), branchId, "BRANCH", null)).not.toHaveProperty(
      "x-mutakamel-channel-id",
    );
  });

  it("sends no headers at all when there is no user", () => {
    expect(tradeScopeHeaders(null, branchId, "BRANCH")).toEqual({});
  });
});

describe("Trade advisory action admission", () => {
  it("admits on the permission string", () => {
    expect(hasTradePermission(["trade.inventory.read"], false, "trade.inventory.read")).toBe(
      true,
    );
    expect(hasTradePermission([], false, "trade.inventory.read")).toBe(false);
  });

  it("admits a tenant owner, the only bypass TradePermissionsGuard has", () => {
    expect(hasTradePermission([], true, "trade.inventory.read")).toBe(true);
  });
});

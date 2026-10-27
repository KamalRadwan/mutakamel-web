import { describe, expect, it } from "vitest";
import type { TradeOperatingContext } from "./trade-scope";
import { hasTradePermission, tradeScopeHeaders } from "./trade-advanced-scope";

const companyId = "01902001-3000-7000-8000-000000000001";
const otherCompanyId = "01902001-3000-7000-8000-000000000002";
const branchId = "01902001-3000-7000-8000-000000000003";
const channelId = "01902001-3000-7000-8000-000000000004";

function context(overrides: Partial<TradeOperatingContext> = {}): TradeOperatingContext {
  return { companyId, branchId, channelId: null, ...overrides };
}

describe("Trade scope headers", () => {
  it("sends both headers for a BRANCH-target route", () => {
    expect(tradeScopeHeaders(context(), "BRANCH")).toEqual({
      "x-mutakamel-company-id": companyId,
      "x-mutakamel-branch-id": branchId,
    });
  });

  it("sends the company alone for a COMPANY-target route", () => {
    // A branch header is what makes the resolved target BRANCH; sending one on
    // a COMPANY route narrows the scope and hides rows the user may see.
    expect(tradeScopeHeaders(context(), "COMPANY")).toEqual({
      "x-mutakamel-company-id": companyId,
    });
  });

  it("sends nothing for a TENANT target, which resolves legally to TENANT", () => {
    expect(tradeScopeHeaders(context(), "TENANT")).toEqual({});
  });

  it("accepts a selected company without a branch only on a COMPANY route", () => {
    const companyOnly = context({ branchId: null });
    expect(tradeScopeHeaders(companyOnly, "COMPANY")).toEqual({
      "x-mutakamel-company-id": companyId,
    });
    expect(tradeScopeHeaders(companyOnly, "BRANCH")).toEqual({});
  });

  it("refuses to guess when two companies are accessible", () => {
    expect(tradeScopeHeaders(context({ companyId: null }), "COMPANY")).toEqual({});
  });

  it("adds Trade's own channel header only when a channel is chosen", () => {
    expect(tradeScopeHeaders(context({ channelId }), "BRANCH")).toHaveProperty(
      "x-mutakamel-channel-id",
      channelId,
    );
    expect(tradeScopeHeaders(context(), "BRANCH")).not.toHaveProperty(
      "x-mutakamel-channel-id",
    );
  });

  it("sends no headers at all when there is no company selection", () => {
    expect(tradeScopeHeaders(context({ companyId: null }), "BRANCH")).toEqual({});
  });

  it("uses the explicit shared company without deriving it from memberships", () => {
    const selected = context({ companyId: otherCompanyId });
    expect(tradeScopeHeaders(selected, "BRANCH")).toEqual({
      "x-mutakamel-company-id": otherCompanyId,
      "x-mutakamel-branch-id": branchId,
    });
    expect(tradeScopeHeaders(selected, "COMPANY")).toEqual({
      "x-mutakamel-company-id": otherCompanyId,
    });
  });

  it("does not infer a different company when the shared selection is unresolved", () => {
    expect(tradeScopeHeaders(context({ companyId: null }), "BRANCH")).toEqual({});
  });

  it("never sends a channel without a company or on a tenant-target route", () => {
    expect(tradeScopeHeaders(context({ channelId }), "TENANT")).toEqual({});
    expect(tradeScopeHeaders(context({ companyId: null, channelId }), "BRANCH")).toEqual({});
  });
});

describe("Trade advisory action admission", () => {
  it("admits on a target-filtered permission string", () => {
    expect(hasTradePermission(["trade.inventory.read"], false, "trade.inventory.read")).toBe(
      true,
    );
    expect(hasTradePermission([], false, "trade.inventory.read")).toBe(false);
  });

  it("admits a tenant owner, the only bypass TradePermissionsGuard has", () => {
    expect(hasTradePermission([], true, "trade.inventory.read")).toBe(true);
  });
});

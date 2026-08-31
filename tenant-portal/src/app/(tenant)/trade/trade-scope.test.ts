import { describe, expect, it } from "vitest";
import { BRANCH_SCOPE_HEADER, COMPANY_SCOPE_HEADER } from "@/lib/api/organization-scope";
import { CHANNEL_SCOPE_HEADER } from "./trade-api";
import {
  canPerformTradeAction,
  isTradeEntitlementRefusal,
  resolveTradeScope,
  type TradeOperatingContext,
} from "./trade-scope";

// Each rule here is a real 400 or a real 403 when it is broken, and each was
// read from trade-app source rather than inferred from Core.

const COMPANY = "01890a5d-ac96-774b-bcce-b302099a8057";
const BRANCH = "01890a5d-ac96-774b-bcce-b302099a8058";
const CHANNEL = "01890a5d-ac96-774b-bcce-b302099a8059";

const context = (patch: Partial<TradeOperatingContext> = {}): TradeOperatingContext => ({
  companyId: null,
  branchId: null,
  channelId: null,
  ...patch,
});

describe("resolveTradeScope", () => {
  it("sends NOTHING for a TENANT target, even with a full selection", () => {
    // POST/PATCH /uoms are Gateway `organizationScopeMode: NONE` — a company
    // header there is a 400 GW.REQUEST.INVALID before trade-app runs.
    const resolution = resolveTradeScope("TENANT", {
      companyId: COMPANY,
      branchId: BRANCH,
      channelId: CHANNEL,
    });
    expect(resolution).toEqual({ ok: true, headers: {} });
  });

  it("reports a gap rather than firing a COMPANY request with no company", () => {
    expect(resolveTradeScope("COMPANY", context())).toEqual({
      ok: false,
      gap: "company-required",
    });
  });

  it("drops the branch on a COMPANY target", () => {
    // `TradeScopeGuard` resolves a present branch header to target BRANCH, and
    // the permission is then checked at BRANCH — a different grant entirely.
    const resolution = resolveTradeScope("COMPANY", context({ companyId: COMPANY, branchId: BRANCH }));
    expect(resolution).toEqual({ ok: true, headers: { [COMPANY_SCOPE_HEADER]: COMPANY } });
  });

  it("requires both halves for a BRANCH target", () => {
    expect(resolveTradeScope("BRANCH", context({ companyId: COMPANY }))).toEqual({
      ok: false,
      gap: "branch-required",
    });
    expect(resolveTradeScope("BRANCH", context({ branchId: BRANCH }))).toEqual({
      ok: false,
      gap: "company-required",
    });
  });

  it("narrows COMPANY_OR_BRANCH with a branch when one is selected", () => {
    expect(
      resolveTradeScope("COMPANY_OR_BRANCH", context({ companyId: COMPANY, branchId: BRANCH })),
    ).toEqual({
      ok: true,
      headers: { [COMPANY_SCOPE_HEADER]: COMPANY, [BRANCH_SCOPE_HEADER]: BRANCH },
    });
  });

  it("treats an unset company on OPERATING_CONTEXT as a narrower scope, not a gap", () => {
    // With no headers the guard resolves the target to TENANT, which is a
    // legal read — unlike COMPANY_OR_BRANCH, where it is a 400.
    expect(resolveTradeScope("OPERATING_CONTEXT", context())).toEqual({ ok: true, headers: {} });
    expect(resolveTradeScope("COMPANY_OR_BRANCH", context())).toEqual({
      ok: false,
      gap: "company-required",
    });
  });

  it("never sends a branch or channel without a company", () => {
    expect(
      resolveTradeScope("OPERATING_CONTEXT", context({ branchId: BRANCH, channelId: CHANNEL })),
    ).toEqual({ ok: true, headers: {} });
  });

  it("carries the Trade-only channel header alongside the company", () => {
    expect(
      resolveTradeScope("COMPANY", context({ companyId: COMPANY, channelId: CHANNEL })),
    ).toEqual({
      ok: true,
      headers: { [COMPANY_SCOPE_HEADER]: COMPANY, [CHANNEL_SCOPE_HEADER]: CHANNEL },
    });
  });

  it("rejects a malformed id rather than letting the Gateway do it", () => {
    expect(resolveTradeScope("COMPANY", context({ companyId: "not-a-uuid" }))).toEqual({
      ok: false,
      gap: "company-required",
    });
  });
});

describe("canPerformTradeAction", () => {
  it("admits the tenant owner without the permission string", () => {
    // `TradePermissionsGuard` returns true for `is_tenant_owner` before it
    // looks at any grant.
    expect(canPerformTradeAction({ isTenantOwner: true, permissions: [] }, "trade.items.manage")).toBe(
      true,
    );
  });

  it("matches a Trade permission exactly — there are no scope suffixes", () => {
    const actor = { isTenantOwner: false, permissions: ["trade.items.read.all"] };
    expect(canPerformTradeAction(actor, "trade.items.read")).toBe(false);
  });

  it("is false with no session", () => {
    expect(canPerformTradeAction(null, "trade.items.read")).toBe(false);
  });
});

describe("isTradeEntitlementRefusal", () => {
  it("recognises the two codes that are absent from TRADE_ERROR_CODES", () => {
    expect(isTradeEntitlementRefusal("TRADE.MODULE.DISABLED")).toBe(true);
    expect(isTradeEntitlementRefusal("TRADE.ENTITLEMENT.FEATURE_REQUIRED")).toBe(true);
  });

  it("does not treat a permission refusal as an entitlement refusal", () => {
    expect(isTradeEntitlementRefusal("TRADE.AUTH.TARGET_DENIED")).toBe(false);
    expect(isTradeEntitlementRefusal(undefined)).toBe(false);
  });
});

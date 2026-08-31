"use client";

import { useMemo } from "react";
import { useTenantAuth, type TenantUserProfile } from "@/context/AuthContext";
import {
  BRANCH_SCOPE_HEADER,
  COMPANY_SCOPE_HEADER,
  resolveCompanyForBranch,
} from "@/lib/api/organization-scope";
import { CHANNEL_SCOPE_HEADER } from "./trade-api";

// Trade resolves its own scope, and it is NOT the Gateway mechanism the rest
// of the portal uses.
//
// `resolveOrganizationScope` answers a Gateway question: which headers a
// route's `organizationScopeMode` permits. Of the 129 Phase 12 routes only
// two — `POST /imports/sources` and its release — declare a mode at all
// (docs/generated/tenant-api-routes.json), so that resolver would return `{}`
// for 127 of them and the request would arrive with no scope.
//
// trade-app reads the three headers itself in
// `src/common/guards/trade-scope.guard.ts` and derives the target from what is
// present:
//
//   branch header  -> BRANCH
//   company only   -> COMPANY
//   neither        -> TENANT   (legal for OPERATING_CONTEXT / DASHBOARD_CONTEXT)
//
// so the headers are the request parameter here, not a Gateway precondition.
// The company half is still never asked for in the UI: it is derived from the
// selected branch through the user's own team memberships, because `/auth/me`
// is the only place the branch -> company pairing is stated.

/** What a Trade route's `scope_target` needs from the selection. */
export type TradeScopeTarget = "BRANCH" | "COMPANY" | "TENANT";

export function tradeScopeHeaders(
  user: TenantUserProfile | null,
  branchId: string | null,
  target: TradeScopeTarget,
  channelId?: string | null,
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (target !== "TENANT") {
    const companyId = resolveCompanyForBranch(user, branchId) ?? soleCompany(user, target);
    if (companyId) {
      headers[COMPANY_SCOPE_HEADER] = companyId;
      // A branch header is what makes the resolved target BRANCH, so it is
      // sent only when the route asks for one — adding it to a COMPANY route
      // narrows the scope the server reads and hides rows the user may see.
      if (target === "BRANCH" && branchId) headers[BRANCH_SCOPE_HEADER] = branchId;
    }
  }
  if (channelId) headers[CHANNEL_SCOPE_HEADER] = channelId;
  return headers;
}

/**
 * The company a COMPANY-target route can use without a branch selection.
 *
 * Only when `/auth/me` lists exactly one accessible company — with two the
 * portal would be choosing which company's data to show, which is the user's
 * decision, not ours. A BRANCH-target route never takes this path: its company
 * must be the one that owns the selected branch.
 */
function soleCompany(
  user: TenantUserProfile | null,
  target: TradeScopeTarget,
): string | null {
  if (target !== "COMPANY") return null;
  const companies = [...new Set(user?.accessibleCompanies ?? [])];
  return companies.length === 1 ? companies[0] : null;
}

/**
 * True when the route needs a company the current selection cannot supply.
 *
 * A screen renders its "pick a branch first" empty state on this rather than
 * firing a request that resolves to TENANT and answers 400
 * `TRADE.CONTEXT.*` — a setup gap is an empty state, not an error
 * (docs/design/states.md).
 */
export function useTradeScope(target: TradeScopeTarget, branchId: string | null) {
  const { user } = useTenantAuth();
  return useMemo(() => {
    const headers = tradeScopeHeaders(user, branchId, target);
    return {
      headers,
      isResolved: target === "TENANT" || COMPANY_SCOPE_HEADER in headers,
      isTenantOwner: user?.isTenantOwner ?? false,
      permissions: user?.permissions ?? [],
    };
  }, [user, branchId, target]);
}

/**
 * Advisory action admission.
 *
 * Trade has no capabilities endpoint (Q30), so standing requirement S6 cannot
 * be met on any Phase 12 screen: there is nothing to ask. This is the
 * fallback — the permission string plus tenant ownership — and it is wrong in
 * one direction on purpose. `TradePermissionsGuard` matches `scope_target`
 * exactly, so holding a grant at the wrong target still fails server-side; the
 * button is shown and the refusal renders `PermissionGate`. The reverse
 * (hiding a control the server would have allowed) is the failure mode worth
 * avoiding.
 */
export function hasTradePermission(
  permissions: readonly string[],
  isTenantOwner: boolean,
  permission: string,
): boolean {
  return isTenantOwner || permissions.includes(permission);
}

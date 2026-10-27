"use client";

import { useMemo } from "react";
import { useTenantAuth, type TenantUserProfile } from "@/context/AuthContext";
import { can } from "@/lib/auth/permission-scope";
import {
  BRANCH_SCOPE_HEADER,
  COMPANY_SCOPE_HEADER,
} from "@/lib/api/organization-scope";
import { resolveTradeScope, type TradeOperatingContext } from "./trade-scope";
import { useTradeScope as useSharedTradeScope } from "./useTradeScope";

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
// Advanced screens use the same explicit company and branch selection as
// documents, resolved by the same scope-target rules.

/** What a Trade route's `scope_target` needs from the selection. */
export type TradeScopeTarget = "BRANCH" | "COMPANY" | "TENANT";

export function tradeScopeHeaders(
  context: TradeOperatingContext,
  target: TradeScopeTarget,
): Record<string, string> {
  const resolution = resolveTradeScope(target, context);
  return resolution.ok ? resolution.headers : {};
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
  const { context, companyIds } = useSharedTradeScope();
  return useMemo(() => {
    const headers = tradeScopeHeaders({
      companyId: context.companyId ?? (companyIds.length === 1 ? companyIds[0] : null),
      branchId,
      channelId: context.channelId,
    }, target);
    const isResolved = target === "TENANT" || (
      COMPANY_SCOPE_HEADER in headers && (target !== "BRANCH" || BRANCH_SCOPE_HEADER in headers)
    );
    return {
      headers,
      isResolved,
      isTenantOwner: isResolved && (user?.isTenantOwner ?? false),
      // All action callers consume these keys through hasTradePermission.
      // Filter against the same target used to build the request headers.
      permissions: isResolved ? (user?.permissions ?? []).filter((permission) => can(
        user, permission, target === "TENANT" ? { tenantWide: true } : {
          companyId: headers[COMPANY_SCOPE_HEADER],
          ...(target === "BRANCH" ? { branchId: headers[BRANCH_SCOPE_HEADER] } : {}),
        },
      )) : [],
    };
  }, [user, branchId, target, companyIds, context.companyId, context.channelId]);
}

/** The selection is owned by the route-group provider, including after navigation. */
export function useTradeBranchSelection(user: TenantUserProfile | null) {
  const { branchIds, context, selectBranch } = useSharedTradeScope();
  return useMemo(() => {
    const allowedBranches = branchIds.filter((id) => user?.accessibleBranches.includes(id));
    return {
      branchIds: allowedBranches,
      branchId: context.branchId && allowedBranches.includes(context.branchId)
        ? context.branchId
        : (allowedBranches.length === 1 ? allowedBranches[0] : null),
      selectBranch,
    };
  }, [branchIds, context.branchId, selectBranch, user]);
}

/**
 * Advisory action admission.
 *
 * Pass the target-filtered permissions and owner flag from useTradeScope,
 * never the flat /auth/me keys. Trade has no capabilities endpoint (Q30);
 * its exact-target guard remains authoritative over this scope projection.
 */
export function hasTradePermission(
  permissions: readonly string[],
  isTenantOwner: boolean,
  permission: string,
): boolean {
  return isTenantOwner || permissions.includes(permission);
}

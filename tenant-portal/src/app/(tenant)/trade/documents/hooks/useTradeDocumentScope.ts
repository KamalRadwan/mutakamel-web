"use client";

import { useTenantAuth } from "@/context/AuthContext";
import { BRANCH_SCOPE_HEADER, COMPANY_SCOPE_HEADER } from "@/lib/api/organization-scope";
import { can } from "@/lib/auth/permission-scope";
import { useTradeScopeRequest } from "../../useTradeScope";

export interface TradeDocumentScope {
  /** True once both scope headers resolved; false means the request must not fire. */
  isResolved: boolean;
  headers: Record<string, string>;
  canWrite: (permission: string) => boolean;
  /** The signed-in user, for the maker–checker rule on a purchase order. */
  userId: string | null;
}

/**
 * The branch scope every commercial-document route needs.
 *
 * Every one of the 60 routes targets `BRANCH` at `TradePermissionsGuard`, and
 * 28 are additionally Gateway `BRANCH_REQUIRED` — where a missing or malformed
 * header is refused as `GW.REQUEST.INVALID` (400) before trade-app sees the
 * request. Scope travels as headers only; a query parameter is never correct.
 *
 * The selection itself comes from the `TradeScopeProvider` the route group's
 * layout mounts, **not** from a second resolver of this screen's own. Two
 * resolvers would let the branch a user picked in the scope bar and the branch
 * a document list reads drift apart, which is the failure that provider exists
 * to prevent.
 */
export function useTradeDocumentScope(): TradeDocumentScope {
  const { user } = useTenantAuth();
  const { headers, gap } = useTradeScopeRequest("BRANCH");

  return {
    isResolved: gap === null,
    headers,
    canWrite: (permission: string) => gap === null && (
      user?.isTenantOwner === true || can(user, permission, {
        companyId: headers[COMPANY_SCOPE_HEADER],
        branchId: headers[BRANCH_SCOPE_HEADER],
      })
    ),
    userId: user?.id ?? null,
  };
}

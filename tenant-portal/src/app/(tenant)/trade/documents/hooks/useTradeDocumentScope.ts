"use client";

import { useMemo } from "react";
import { useTenantAuth } from "@/context/AuthContext";
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

  const permissions = useMemo(() => user?.permissions ?? [], [user]);
  const isOwner = user?.isTenantOwner ?? false;

  return {
    isResolved: gap === null,
    headers,
    // Trade publishes no capabilities endpoint (Q30), so this is the most the
    // browser can know: the permission string plus the owner bypass, which is
    // the only thing `TradePermissionsGuard` short-circuits on.
    canWrite: (permission: string) => isOwner || permissions.includes(permission),
    userId: user?.id ?? null,
  };
}

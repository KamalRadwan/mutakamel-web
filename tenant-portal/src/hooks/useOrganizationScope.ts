"use client";

import { useMemo } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import {
  resolveCompanyForBranch,
  resolveOrganizationScope,
  type OrganizationScope,
  type OrganizationScopeMode,
} from "@/lib/api/organization-scope";

// The single place a screen turns "the branch the user picked" into the
// Gateway scope headers a route's policy requires — S2 / L4-3. The company
// half is never asked for in the UI: it is derived from the branch through
// the access-scoped branch ownership returned by `/auth/me` (or the user's
// team memberships when an older Core response omits that ownership map).
function useOrganizationScope(branchId: string | null): OrganizationScope {
  const { user } = useTenantAuth();
  const companyId = useMemo(() => resolveCompanyForBranch(user, branchId), [user, branchId]);
  return { companyId, branchId };
}

/**
 * The headers for one request, ready to spread into a request config.
 *
 * Returns `{}` rather than blocking when the scope cannot be resolved. The
 * Gateway is authoritative and will reject a malformed scope itself; refusing
 * to send the request here would turn a server-side contract question into a
 * silently blank screen. Screens that genuinely cannot proceed without a
 * branch already say so through their own empty state.
 */
export function useOrganizationScopeHeaders(
  mode: OrganizationScopeMode,
  branchId: string | null,
): Record<string, string> {
  const { companyId } = useOrganizationScope(branchId);
  return useMemo(() => {
    const resolution = resolveOrganizationScope(mode, { companyId, branchId });
    return resolution.ok ? resolution.headers : {};
  }, [mode, companyId, branchId]);
}

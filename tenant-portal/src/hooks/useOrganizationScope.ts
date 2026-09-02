"use client";

import { useMemo } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import {
  resolveCompanyForBranch,
  resolveOrganizationScope,
  type OrganizationScope,
  type OrganizationScopeGap,
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
 * The scope for one request: either the headers to spread into a request
 * config, or the reason there are none.
 *
 * `headers` is `null` — not `{}` — when the scope did not resolve, and that is
 * the whole point of the shape. This hook used to hand back an empty object,
 * which spread cleanly into a request that then went out with no scope at all
 * and came back `400 GW.REQUEST.INVALID` from the Gateway on every
 * `BRANCH_REQUIRED` route — a client-side gap reported to the user as a server
 * rejection (defect D4). A caller now cannot send the request without first
 * deciding what to do about `ready: false`.
 */
export type OrganizationScopeHeaders =
  | { ready: true; headers: Record<string, string>; gap: null }
  | { ready: false; headers: null; gap: OrganizationScopeGap };

export function useOrganizationScopeHeaders(
  mode: OrganizationScopeMode,
  branchId: string | null,
): OrganizationScopeHeaders {
  const { companyId } = useOrganizationScope(branchId);
  return useMemo(() => {
    const resolution = resolveOrganizationScope(mode, { companyId, branchId });
    return resolution.ok
      ? { ready: true, headers: resolution.headers, gap: null }
      : { ready: false, headers: null, gap: resolution.gap };
  }, [mode, companyId, branchId]);
}

/**
 * The error a screen shows for a scope that never resolved.
 *
 * `status: 0` is this app's "no HTTP response at all", which is exactly true
 * here: the request was never sent. The code is mapped by `useCrmErrorText`.
 */
export const SCOPE_UNRESOLVED_ERROR = {
  status: 0,
  code: "CRM_ORGANIZATION_SCOPE_UNRESOLVED",
} as const;

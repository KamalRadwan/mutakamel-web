import { isUUIDv7 } from "@/lib/uuid";

// One organization-scope resolver for all three apps — MASTER-PLAN S2 / L4-3.
//
// 77 Gateway routes carry a scope requirement (34 BRANCH_REQUIRED, 43
// OPTIONAL_COMPANY_BRANCH) and 28 more are explicitly NONE. They are NOT a
// CRM-only concern: the split is core 41, trade 32, crm 4.
//
// The scope travels as two request headers, and the Gateway validates their
// SHAPE against the route's policy before the request reaches any app —
// api-gateway-app/src/common/middleware/route-context.middleware.ts,
// validateOrganizationScope(). Getting the shape wrong is a 400
// `GW.REQUEST.INVALID`, not a 403, and it fails before the handler runs:
//
//   NONE                     neither header may be present
//   OPTIONAL_COMPANY_BRANCH  branch only allowed alongside a company
//   COMPANY_REQUIRED         company present, branch absent
//   BRANCH_REQUIRED          both present
//
// Any header that IS sent must be a UUIDv7. The Gateway strips both headers
// before forwarding, so the upstream app never sees them — they are a Gateway
// contract, not an app parameter.
//
// This is separate from CRM's `branchId` QUERY parameter, which the CRM app
// validates itself on routes that carry no `organizationScopeMode` at all
// (464 of 569 rows). A CRM list needs both: the query parameter for the app,
// and — where the route declares a mode — the headers for the Gateway.

export type OrganizationScopeMode =
  | "NONE"
  | "OPTIONAL_COMPANY_BRANCH"
  | "COMPANY_REQUIRED"
  | "BRANCH_REQUIRED";

export const COMPANY_SCOPE_HEADER = "x-mutakamel-company-id";
export const BRANCH_SCOPE_HEADER = "x-mutakamel-branch-id";

export interface OrganizationScope {
  companyId: string | null;
  branchId: string | null;
}

/** What a route's policy needs that the current selection cannot supply. */
export type OrganizationScopeGap =
  | "company-required"
  | "branch-required"
  | "invalid-company-id"
  | "invalid-branch-id";

export type OrganizationScopeResolution =
  | { ok: true; headers: Record<string, string> }
  | { ok: false; gap: OrganizationScopeGap };

function validId(value: string | null): value is string {
  return typeof value === "string" && isUUIDv7(value);
}

/**
 * Builds the scope headers a route's policy requires, or reports what is
 * missing so the screen can ask for it instead of firing a request the
 * Gateway will reject.
 *
 * `NONE` deliberately returns no headers even when a branch is selected:
 * sending one is itself the rejection.
 */
export function resolveOrganizationScope(
  mode: OrganizationScopeMode,
  scope: OrganizationScope,
): OrganizationScopeResolution {
  const { companyId, branchId } = scope;
  if (companyId !== null && !validId(companyId)) return { ok: false, gap: "invalid-company-id" };
  if (branchId !== null && !validId(branchId)) return { ok: false, gap: "invalid-branch-id" };

  switch (mode) {
    case "NONE":
      return { ok: true, headers: {} };

    case "OPTIONAL_COMPANY_BRANCH":
      if (!validId(companyId)) return { ok: true, headers: {} };
      return {
        ok: true,
        headers: validId(branchId)
          ? { [COMPANY_SCOPE_HEADER]: companyId, [BRANCH_SCOPE_HEADER]: branchId }
          : { [COMPANY_SCOPE_HEADER]: companyId },
      };

    case "COMPANY_REQUIRED":
      if (!validId(companyId)) return { ok: false, gap: "company-required" };
      // The branch header is dropped rather than passed through: this mode
      // rejects it outright.
      return { ok: true, headers: { [COMPANY_SCOPE_HEADER]: companyId } };

    case "BRANCH_REQUIRED":
      if (!validId(companyId)) return { ok: false, gap: "company-required" };
      if (!validId(branchId)) return { ok: false, gap: "branch-required" };
      return {
        ok: true,
        headers: { [COMPANY_SCOPE_HEADER]: companyId, [BRANCH_SCOPE_HEADER]: branchId },
      };
  }
}

export interface TenantScopeSource {
  accessibleCompanies: readonly string[];
  teamMemberships: ReadonlyArray<{
    companyId: string;
    branchId: string | null;
    isPrimary: boolean;
  }>;
}

/**
 * The company that owns a selected branch, taken from the user's own team
 * memberships — the only place `/auth/me` states the pairing.
 *
 * Returns null rather than guessing when the branch is not in a membership:
 * `BRANCH_REQUIRED` needs the matching company, and pairing a branch with the
 * wrong company is a scope error the Gateway cannot catch for us.
 */
export function resolveCompanyForBranch(
  source: TenantScopeSource | null | undefined,
  branchId: string | null,
): string | null {
  if (!source || !validId(branchId)) return null;
  const accessible = new Set(source.accessibleCompanies.filter(isUUIDv7));
  const owning = source.teamMemberships
    .filter((membership) => membership.branchId === branchId)
    .map((membership) => membership.companyId)
    .filter((companyId) => accessible.has(companyId));
  const distinct = new Set(owning);
  return distinct.size === 1 ? [...distinct][0] : null;
}

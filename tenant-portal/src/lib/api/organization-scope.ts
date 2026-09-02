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

export interface AccessibleBranchCompany {
  branchId: string;
  companyId: string;
}

export interface TenantScopeSource {
  accessibleBranches: readonly string[];
  accessibleCompanies: readonly string[];
  accessibleBranchCompanies?: readonly AccessibleBranchCompany[];
  teamMemberships: ReadonlyArray<{
    companyId: string;
    branchId: string | null;
    isPrimary: boolean;
  }>;
}

/** A null company set permits Core's truncated company projection, never malformed pairs. */
export function isAccessibleBranchCompanies(
  value: unknown,
  accessibleBranches: readonly string[],
  accessibleCompanies: readonly string[] | null,
): value is AccessibleBranchCompany[] {
  if (!Array.isArray(value)) return false;
  const branches = new Set(accessibleBranches);
  const companies = accessibleCompanies === null ? null : new Set(accessibleCompanies);
  const owners = new Map<string, string>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
    const pair = entry as Record<string, unknown>;
    if (
      !isUUIDv7(pair.branchId) ||
      !isUUIDv7(pair.companyId) ||
      !branches.has(pair.branchId) ||
      (companies !== null && !companies.has(pair.companyId))
    ) return false;
    const owner = owners.get(pair.branchId);
    if (owner !== undefined && owner !== pair.companyId) return false;
    owners.set(pair.branchId, pair.companyId);
  }
  return true;
}

/**
 * The company that owns a selected branch, taken from Core's access-scoped
 * branch ownership map. Older Core responses can use team memberships only
 * when that map is absent; an empty or malformed map never falls back.
 *
 * Returns null rather than guessing when ownership cannot be established:
 * `BRANCH_REQUIRED` needs the matching company, and pairing a branch with the
 * wrong company is a scope error the Gateway cannot catch for us.
 *
 * **The map is the authority on ownership; `accessibleCompanies` is not** —
 * defect D4. Core truncates the two collections INDEPENDENTLY at 500
 * (tenant-access.postgres.integration.spec.ts, "independent company
 * truncation"): the pairs come back in branch order, the companies in their
 * own, and a company owning one of the first 500 branches can be missing from
 * the first 500 companies. Re-checking the resolved company against that list
 * turned a perfectly valid branch into "no company", which
 * `useOrganizationScopeHeaders` then turned into empty headers and a 400 on
 * every `BRANCH_REQUIRED` route. The security boundary is the branch: the pair
 * is only trusted when its branch is one the actor can reach, which is checked
 * on the line above and again inside `isAccessibleBranchCompanies`.
 */
export function resolveCompanyForBranch(
  source: TenantScopeSource | null | undefined,
  branchId: string | null,
): string | null {
  if (!source || !validId(branchId) || !source.accessibleBranches.includes(branchId)) return null;
  if ("accessibleBranchCompanies" in source) {
    // Validated with a null company set for the same reason the lookup no
    // longer consults one — truncation is expected, not corruption.
    if (!isAccessibleBranchCompanies(
      source.accessibleBranchCompanies,
      source.accessibleBranches,
      null,
    )) return null;
    return source.accessibleBranchCompanies.find((pair) => pair.branchId === branchId)?.companyId ?? null;
  }
  const accessible = new Set(source.accessibleCompanies.filter(isUUIDv7));
  const owning = source.teamMemberships
    .filter((membership) => membership.branchId === branchId)
    .map((membership) => membership.companyId)
    .filter((companyId) => accessible.has(companyId));
  const distinct = new Set(owning);
  return distinct.size === 1 ? [...distinct][0] : null;
}

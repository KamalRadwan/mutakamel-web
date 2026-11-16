import { can, type PermissionScope } from "@/lib/auth/permission-scope";
import { isUUIDv7 } from "@/lib/uuid";
import type { OrgLevel, OrgNodeOf } from "../contracts/organization-contract";
import type { OrgLookupResolver } from "./hooks/useOrgLookupResolver";
import { ORG_LEVEL_CONFIG } from "./level-config";
import {
  resolveDirectParentId,
  type OrgNodeFormValues,
} from "./organization-payloads";

interface OrgPermissionUser {
  permissions: readonly string[];
  permissionScopes?: Record<string, PermissionScope>;
}

/**
 * Top-level create button admission.
 *
 * Companies require tenant-wide `org.company.manage`. Child levels admit opening
 * the create modal whenever the user holds `org.<level>.manage` in at least one
 * active scope; exact parent scope is enforced on parent selection and submit.
 */
export function canOpenOrgCreate(
  user: OrgPermissionUser | null | undefined,
  level: OrgLevel,
): boolean {
  const permission = ORG_LEVEL_CONFIG[level].managePermission;
  if (level === "companies") {
    return can(user, permission, { tenantWide: true });
  }
  return can(user, permission);
}

function canManageTeamForDepartment(
  user: OrgPermissionUser | null | undefined,
  departmentId: string,
  lookups: Pick<OrgLookupResolver, "department">,
): boolean {
  if (!isUUIDv7(departmentId)) return false;
  if (can(user, "org.team.manage", { tenantWide: true })) return true;
  const dept = lookups.department(departmentId);
  if (dept.status !== "ready") return false;
  return can(user, "org.team.manage", { branchId: dept.value.branchId });
}

/**
 * Mirrors `OrganizationService` create scope checks:
 * - Company create: tenant-wide `org.company.manage`
 * - Branch create: `org.branch.manage` for `dto.companyId` (`assertCompanyPermission`)
 * - Department create: `org.department.manage` for `dto.branchId` (`assertBranchPermission`)
 * - Team create: `org.team.manage` for owning department's `branchId` (via authorized
 *   department lookup, failing closed while unresolved unless tenant-wide)
 */
export function canSubmitOrgCreate(
  user: OrgPermissionUser | null | undefined,
  level: OrgLevel,
  values: OrgNodeFormValues,
  lookups: Pick<OrgLookupResolver, "department">,
): boolean {
  if (level === "companies") {
    return can(user, "org.company.manage", { tenantWide: true });
  }
  if (level === "branches") {
    const companyId = resolveDirectParentId("branches", values);
    return isUUIDv7(companyId) && can(user, "org.branch.manage", { companyId });
  }
  if (level === "departments") {
    const branchId = resolveDirectParentId("departments", values);
    return isUUIDv7(branchId) && can(user, "org.department.manage", { branchId });
  }
  const departmentId = resolveDirectParentId("teams", values);
  return canManageTeamForDepartment(user, departmentId, lookups);
}

/**
 * Mirrors `OrganizationService` update/delete scope checks per record:
 * - Company edit/delete: tenant-wide `org.company.manage`
 * - Branch edit/delete: `org.branch.manage` for `branch.id`
 * - Department edit/delete: `org.department.manage` for `department.branchId`
 * - Team edit/delete: `org.team.manage` for owning department's `branchId` (via
 *   authorized department lookup, failing closed while unresolved unless tenant-wide)
 */
export function canManageOrgNode<L extends OrgLevel>(
  user: OrgPermissionUser | null | undefined,
  level: L,
  node: OrgNodeOf<L>,
  lookups: Pick<OrgLookupResolver, "department">,
): boolean {
  if (level === "companies") {
    return can(user, "org.company.manage", { tenantWide: true });
  }
  if (level === "branches") {
    return can(user, "org.branch.manage", { branchId: node.id });
  }
  if (level === "departments" && "branchId" in node) {
    return can(user, "org.department.manage", { branchId: node.branchId });
  }
  if (level === "teams" && "departmentId" in node) {
    return canManageTeamForDepartment(user, node.departmentId, lookups);
  }
  return false;
}

import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import type { OrgLevel } from "../contracts/organization-contract";

/**
 * What differs between the four organization levels, stated once.
 *
 * The list, create, edit, deactivate and delete behaviour is identical across
 * companies, branches, departments and teams — they are one controller, one DTO
 * family and one set of 409s. Four copies of the same screen is exactly the
 * duplication file-architecture.md#cleanliness-rules forbids, so the difference
 * lives here as data and the screen reads it.
 */
interface OrgChildDestination {
  href: string;
  readPermission: string;
  kind: "branches" | "departments" | "teams" | "users";
}

export interface OrgLevelConfig {
  level: OrgLevel;
  href: string;
  /** @RequirePermissions on the level's GET routes. */
  readPermission: string;
  /** @RequirePermissions on its POST/PATCH/DELETE routes. */
  managePermission: string;
  /** The level whose id this level's create DTO requires, if any. */
  parent?: OrgLevel;
  /** Ordered ancestor chain shown in cascade creation and placement views. */
  ancestors: readonly OrgLevel[];
  /** Primary child workspace offered when deletion is blocked by child records. */
  childDestination: OrgChildDestination;
  /** The optional scalar fields this level's create/update DTOs accept. */
  fields: readonly OrgLevelField[];
}

type OrgLevelField =
  | "legalName"
  | "taxNumber"
  | "currencyCode"
  | "address"
  | "phone"
  | "isHeadquarters"
  | "leadUserId";

export const ORG_LEVEL_ORDER: readonly OrgLevel[] = [
  "companies",
  "branches",
  "departments",
  "teams",
];

export const ORG_LEVEL_CONFIG: Record<OrgLevel, OrgLevelConfig> = {
  companies: {
    level: "companies",
    href: TENANT_ROUTES.coreCompanies,
    readPermission: "org.company.read",
    managePermission: "org.company.manage",
    ancestors: [],
    childDestination: {
      href: TENANT_ROUTES.coreBranches,
      readPermission: "org.branch.read",
      kind: "branches",
    },
    fields: ["legalName", "taxNumber", "currencyCode"],
  },
  branches: {
    level: "branches",
    href: TENANT_ROUTES.coreBranches,
    readPermission: "org.branch.read",
    managePermission: "org.branch.manage",
    parent: "companies",
    ancestors: ["companies"],
    childDestination: {
      href: TENANT_ROUTES.coreDepartments,
      readPermission: "org.department.read",
      kind: "departments",
    },
    fields: ["address", "phone", "isHeadquarters"],
  },
  departments: {
    level: "departments",
    href: TENANT_ROUTES.coreDepartments,
    readPermission: "org.department.read",
    managePermission: "org.department.manage",
    parent: "branches",
    ancestors: ["companies", "branches"],
    childDestination: {
      href: TENANT_ROUTES.coreTeams,
      readPermission: "org.team.read",
      kind: "teams",
    },
    fields: [],
  },
  teams: {
    level: "teams",
    href: TENANT_ROUTES.coreTeams,
    readPermission: "org.team.read",
    managePermission: "org.team.manage",
    parent: "departments",
    ancestors: ["companies", "branches", "departments"],
    childDestination: {
      href: TENANT_ROUTES.coreUsers,
      readPermission: "users.user.read",
      kind: "users",
    },
    fields: ["leadUserId"],
  },
};

/** The parent id key each create DTO requires — `CreateBranchDto.companyId`, etc. */
export const ORG_PARENT_BODY_KEY = {
  branches: "companyId",
  departments: "branchId",
  teams: "departmentId",
} as const;

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BRANCH_SCOPE_HEADER,
  COMPANY_SCOPE_HEADER,
  resolveCompanyForBranch,
  resolveOrganizationScope,
  type OrganizationScopeMode,
} from "./organization-scope";

const COMPANY = "0192f3a0-0000-7000-8000-000000000001";
const BRANCH = "0192f3a0-0000-7000-8000-000000000002";
const OTHER_BRANCH = "0192f3a0-0000-7000-8000-000000000003";

describe("organization scope resolver", () => {
  it("sends nothing at all on a NONE route, even with a branch selected", () => {
    // The Gateway rejects a NONE route that carries either header, so a
    // selected branch leaking into an unscoped request is itself the bug.
    expect(resolveOrganizationScope("NONE", { companyId: COMPANY, branchId: BRANCH })).toEqual({
      ok: true,
      headers: {},
    });
  });

  it("never sends a branch without its company on OPTIONAL_COMPANY_BRANCH", () => {
    expect(resolveOrganizationScope("OPTIONAL_COMPANY_BRANCH", { companyId: null, branchId: BRANCH })).toEqual({
      ok: true,
      headers: {},
    });
    expect(resolveOrganizationScope("OPTIONAL_COMPANY_BRANCH", { companyId: COMPANY, branchId: BRANCH })).toEqual({
      ok: true,
      headers: { [COMPANY_SCOPE_HEADER]: COMPANY, [BRANCH_SCOPE_HEADER]: BRANCH },
    });
  });

  it("drops the branch on COMPANY_REQUIRED, which rejects it", () => {
    expect(resolveOrganizationScope("COMPANY_REQUIRED", { companyId: COMPANY, branchId: BRANCH })).toEqual({
      ok: true,
      headers: { [COMPANY_SCOPE_HEADER]: COMPANY },
    });
  });

  it("reports the gap instead of firing a request the Gateway will reject", () => {
    expect(resolveOrganizationScope("BRANCH_REQUIRED", { companyId: COMPANY, branchId: null })).toEqual({
      ok: false,
      gap: "branch-required",
    });
    expect(resolveOrganizationScope("BRANCH_REQUIRED", { companyId: null, branchId: BRANCH })).toEqual({
      ok: false,
      gap: "company-required",
    });
    expect(resolveOrganizationScope("COMPANY_REQUIRED", { companyId: null, branchId: null })).toEqual({
      ok: false,
      gap: "company-required",
    });
  });

  it("refuses a non-UUIDv7 selector rather than letting the Gateway 400", () => {
    expect(resolveOrganizationScope("BRANCH_REQUIRED", { companyId: "not-a-uuid", branchId: BRANCH })).toEqual({
      ok: false,
      gap: "invalid-company-id",
    });
  });

  it("pairs a branch with its owning company from team memberships", () => {
    const source = {
      accessibleCompanies: [COMPANY],
      teamMemberships: [
        { companyId: COMPANY, branchId: BRANCH, isPrimary: true },
        { companyId: COMPANY, branchId: null, isPrimary: false },
      ],
    };
    expect(resolveCompanyForBranch(source, BRANCH)).toBe(COMPANY);
    // A branch the user has no membership in must not be paired with a
    // guessed company — BRANCH_REQUIRED needs the *right* company.
    expect(resolveCompanyForBranch(source, OTHER_BRANCH)).toBeNull();
  });
});

describe("route inventory coverage", () => {
  // Guards against the resolver going stale: if the Gateway adds a fifth mode
  // or a new scoped route, this fails rather than silently sending the wrong
  // headers on it.
  const inventory = JSON.parse(
    readFileSync(resolve(process.cwd(), "docs/generated/tenant-api-routes.json"), "utf8"),
  ) as { routes?: unknown } | unknown[];
  const routes = (Array.isArray(inventory) ? inventory : (inventory.routes ?? [])) as Array<{
    app: string;
    organizationScopeMode?: string;
  }>;

  const HANDLED: OrganizationScopeMode[] = [
    "NONE",
    "OPTIONAL_COMPANY_BRANCH",
    "COMPANY_REQUIRED",
    "BRANCH_REQUIRED",
  ];

  it("handles every organizationScopeMode the route inventory declares", () => {
    const declared = new Set(
      routes.map((route) => route.organizationScopeMode).filter((mode): mode is string => Boolean(mode)),
    );
    expect([...declared].sort()).toEqual([...declared].filter((mode) => HANDLED.includes(mode as OrganizationScopeMode)).sort());
  });

  it("still covers 77 scope-carrying routes across all three apps", () => {
    const scoped = routes.filter(
      (route) => route.organizationScopeMode && route.organizationScopeMode !== "NONE",
    );
    expect(scoped).toHaveLength(77);
    // L4-3's point: this is not a CRM-only concern.
    expect(new Set(scoped.map((route) => route.app))).toEqual(new Set(["core", "crm", "trade"]));
  });
});

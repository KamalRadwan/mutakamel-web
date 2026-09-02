import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BRANCH_SCOPE_HEADER,
  COMPANY_SCOPE_HEADER,
  resolveCompanyForBranch,
  resolveOrganizationScope,
  type OrganizationScopeMode,
  type TenantScopeSource,
} from "./organization-scope";

const COMPANY = "0192f3a0-0000-7000-8000-000000000001";
const BRANCH = "0192f3a0-0000-7000-8000-000000000002";
const OTHER_BRANCH = "0192f3a0-0000-7000-8000-000000000003";
const OTHER_COMPANY = "0192f3a0-0000-7000-8000-000000000004";

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
      accessibleBranches: [BRANCH, OTHER_BRANCH],
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

describe("authoritative branch company scope", () => {
  const source = {
    accessibleBranches: [BRANCH],
    accessibleCompanies: [COMPANY, OTHER_COMPANY],
    teamMemberships: [{ companyId: OTHER_COMPANY, branchId: BRANCH, isPrimary: true }],
  };

  it("resolves an accessible branch for an owner without team memberships", () => {
    expect(resolveCompanyForBranch({
      ...source,
      accessibleBranchCompanies: [{ branchId: BRANCH, companyId: COMPANY }],
      teamMemberships: [],
    }, BRANCH)).toBe(COMPANY);
  });

  it("prefers Core's branch ownership map over team memberships", () => {
    expect(resolveCompanyForBranch({
      ...source,
      accessibleBranchCompanies: [{ branchId: BRANCH, companyId: COMPANY }],
    }, BRANCH)).toBe(COMPANY);
  });

  it("uses legacy memberships only when the map is absent", () => {
    expect(resolveCompanyForBranch(source, BRANCH)).toBe(OTHER_COMPANY);
    expect(resolveCompanyForBranch({ ...source, accessibleBranchCompanies: [] }, BRANCH)).toBeNull();
  });

  it("never resolves a branch outside the accessible branch set", () => {
    expect(resolveCompanyForBranch({ ...source, accessibleBranches: [] }, BRANCH)).toBeNull();
    expect(resolveCompanyForBranch({
      ...source,
      accessibleBranches: [],
      accessibleBranchCompanies: [{ branchId: BRANCH, companyId: COMPANY }],
    }, BRANCH)).toBeNull();
  });

  it.each([
    { name: "null map", mapping: null },
    { name: "object instead of array", mapping: { branchId: BRANCH, companyId: COMPANY } },
    { name: "null entry", mapping: [null] },
    { name: "missing company", mapping: [{ branchId: BRANCH }] },
    { name: "invalid UUID", mapping: [{ branchId: BRANCH, companyId: "company" }] },
    { name: "inaccessible branch", mapping: [{ branchId: OTHER_BRANCH, companyId: COMPANY }] },
    { name: "conflicting ownership", mapping: [
      { branchId: BRANCH, companyId: COMPANY },
      { branchId: BRANCH, companyId: OTHER_COMPANY },
    ] },
  ])("fails closed for $name without falling back to memberships", ({ mapping }) => {
    expect(resolveCompanyForBranch({
      ...source,
      accessibleBranchCompanies: mapping,
    } as unknown as TenantScopeSource, BRANCH)).toBeNull();
  });

  // D4, corrected deliberately. This pair of cases used to assert that a
  // company absent from `accessibleCompanies` made its branch unresolvable —
  // which is the exact shape Core produces on purpose. The two collections are
  // truncated INDEPENDENTLY at 500 (Core's
  // tenant-access.postgres.integration.spec.ts asserts
  // `accessibleCompanies` does NOT contain the first pair's company), so that
  // assertion turned a valid branch into a 400 on every BRANCH_REQUIRED route.
  // The map is the ownership authority; the company list is a separate,
  // lossy projection and is no longer consulted.
  it("resolves a mapped company that truncation left out of the company list", () => {
    expect(resolveCompanyForBranch({
      ...source,
      accessibleCompanies: [OTHER_COMPANY],
      accessibleBranchCompanies: [{ branchId: BRANCH, companyId: COMPANY }],
    }, BRANCH)).toBe(COMPANY);
  });

  it("keeps every mapped branch resolvable when companies were truncated", () => {
    const partialCompanies = {
      ...source,
      accessibleBranches: [BRANCH, OTHER_BRANCH],
      accessibleCompanies: [COMPANY],
      accessibleBranchCompanies: [
        { branchId: BRANCH, companyId: COMPANY },
        { branchId: OTHER_BRANCH, companyId: OTHER_COMPANY },
      ],
    };
    expect(resolveCompanyForBranch(partialCompanies, BRANCH)).toBe(COMPANY);
    expect(resolveCompanyForBranch(partialCompanies, OTHER_BRANCH)).toBe(OTHER_COMPANY);
  });

  // The boundary that did NOT move: a branch outside the actor's reach stays
  // unresolvable however the map describes it.
  it("still refuses a pair whose branch the actor cannot reach", () => {
    expect(resolveCompanyForBranch({
      ...source,
      accessibleBranches: [OTHER_BRANCH],
      accessibleCompanies: [],
      accessibleBranchCompanies: [{ branchId: BRANCH, companyId: COMPANY }],
    }, BRANCH)).toBeNull();
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

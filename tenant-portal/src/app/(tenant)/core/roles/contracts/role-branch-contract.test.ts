import { describe, expect, it } from "vitest";
import { generateUUIDv7 } from "@/lib/uuid";
import {
  MAX_ROLE_PERMISSIONS,
  MAX_SYSTEM_ROLE_PERMISSIONS,
  parseTenantRoleDetail,
} from "../../contracts/role-contract";
import {
  buildSaveRoleBranchPermissionsBody,
  MAX_PERMISSIONS_PER_BRANCH,
  MAX_ROLE_BRANCH_PROFILES,
  parseRoleBranchCatalogueItem,
  parseRoleBranchPermissions,
} from "./role-branch-contract";

function makeCatalogueItemPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: generateUUIDv7(),
    key: "crm.leads.read_all",
    nameI18n: { ar: "عرض العملاء المحتملين", en: "View leads" },
    module: { id: "crm", nameI18n: { ar: "المبيعات", en: "CRM" } },
    groups: [{ id: "leads", nameI18n: { ar: "العملاء المحتملون", en: "Leads" } }],
    scope: "BRANCH",
    recordScope: "ALL",
    ...overrides,
  };
}

function makeBranchDocumentPayload(overrides: Record<string, unknown> = {}) {
  const roleId = generateUUIDv7();
  const branchPerm = makeCatalogueItemPayload();
  const tenantPerm = makeCatalogueItemPayload({
    key: "roles.role.update",
    scope: "TENANT",
    recordScope: null,
  });

  return {
    roleId,
    roleName: "Branch Sales Lead",
    isSystem: false,
    permissionMode: "BRANCH",
    revision: "900719925474099312",
    catalogueRevision: "a".repeat(64),
    globalPermissionIds: [],
    profiles: [
      {
        branchId: generateUUIDv7(),
        companyId: generateUUIDv7(),
        branchName: "Riyadh HQ",
        companyName: "Mutakamel Trading",
        isActive: true,
        permissionIds: [branchPerm.id],
      },
    ],
    catalogue: [branchPerm, tenantPerm],
    limits: {
      branches: MAX_ROLE_BRANCH_PROFILES,
      permissionsPerBranch: MAX_PERMISSIONS_PER_BRANCH,
    },
    ...overrides,
  };
}

describe("parseTenantRoleDetail system vs custom permission bounds", () => {
  it("preserves MAX_SYSTEM_ROLE_PERMISSIONS (1000) for system roles while capping custom roles at 200", () => {
    const base = {
      id: generateUUIDv7(),
      name: "System Admin",
      nameI18n: { ar: "مدير النظام", en: "System Admin" },
      description: null,
      createdAt: "2026-11-01T10:00:00.000Z",
      updatedAt: "2026-11-01T10:00:00.000Z",
    };

    const twoHundredFifty = Array.from({ length: 250 }, () => generateUUIDv7());
    const parsedSystem = parseTenantRoleDetail({
      ...base,
      isSystem: true,
      permissionMode: "GLOBAL",
      permissionIds: twoHundredFifty,
    });
    expect(parsedSystem.permissionIds).toHaveLength(250);
    expect(MAX_SYSTEM_ROLE_PERMISSIONS).toBe(1000);
    expect(MAX_ROLE_PERMISSIONS).toBe(200);

    expect(() =>
      parseTenantRoleDetail({
        ...base,
        isSystem: false,
        permissionIds: twoHundredFifty,
      }),
    ).toThrow();

    expect(() =>
      parseTenantRoleDetail({
        ...base,
        isSystem: true,
        permissionMode: "BRANCH",
        permissionIds: [],
      }),
    ).toThrow();
  });
});

describe("parseRoleBranchPermissions & buildSaveRoleBranchPermissionsBody", () => {
  it("preserves exact decimal revision strings and fails closed to TENANT for unknown catalogue scopes", () => {
    const unknownScopeItem = makeCatalogueItemPayload({
      key: "billing.plan.manage",
      scope: "EXPERIMENTAL_SCOPE",
      recordScope: null,
    });
    const payload = makeBranchDocumentPayload({
      catalogue: [makeCatalogueItemPayload(), unknownScopeItem],
    });

    const parsed = parseRoleBranchPermissions(payload, payload.roleId as string);
    expect(parsed.revision).toBe("900719925474099312");
    expect(parsed.catalogue[1]?.scope).toBe("TENANT");
    expect(parseRoleBranchCatalogueItem({ ...unknownScopeItem, scope: undefined }).scope).toBe(
      "TENANT",
    );
  });

  it("rejects mismatched roleId, system roles in BRANCH mode, non-decimal revisions, and cap overflows", () => {
    const valid = makeBranchDocumentPayload();
    expect(() => parseRoleBranchPermissions(valid, generateUUIDv7())).toThrow();
    expect(() =>
      parseRoleBranchPermissions({ ...valid, isSystem: true, permissionMode: "BRANCH" }),
    ).toThrow();
    expect(() => parseRoleBranchPermissions({ ...valid, revision: "12.5" })).toThrow();
    for (const catalogueRevision of ["cat-v3", "a".repeat(63), "A".repeat(64)]) {
      expect(() => parseRoleBranchPermissions({ ...valid, catalogueRevision })).toThrow();
    }

    const tooManyProfiles = Array.from({ length: MAX_ROLE_BRANCH_PROFILES + 1 }, () => ({
      branchId: generateUUIDv7(),
      companyId: generateUUIDv7(),
      branchName: "Branch",
      companyName: "Company",
      isActive: true,
      permissionIds: [],
    }));
    expect(() => parseRoleBranchPermissions({ ...valid, profiles: tooManyProfiles })).toThrow();
  });

  it("assembles exact whitelisted PUT payloads, allows empty profiles, and blocks TENANT-scoped permission IDs", () => {
    const branchPermId = generateUUIDv7();
    const tenantPermId = generateUUIDv7();
    const branchId = generateUUIDv7();
    const branchSet = new Set([branchPermId]);

    const body = buildSaveRoleBranchPermissionsBody(
      {
        expectedRevision: "42",
        catalogueRevision: "a".repeat(64),
        profiles: [{ branchId, permissionIds: [branchPermId] }],
      },
      { branchCatalogueIds: branchSet },
    );
    expect(Object.keys(body).sort()).toEqual(["catalogueRevision", "expectedRevision", "profiles"]);
    expect(body.profiles).toEqual([{ branchId, permissionIds: [branchPermId] }]);

    const cleared = buildSaveRoleBranchPermissionsBody({
      expectedRevision: "42",
      catalogueRevision: "a".repeat(64),
      profiles: [],
    });
    expect(cleared.profiles).toEqual([]);

    expect(() =>
      buildSaveRoleBranchPermissionsBody(
        {
          expectedRevision: "42",
          catalogueRevision: "a".repeat(64),
          profiles: [{ branchId, permissionIds: [tenantPermId] }],
        },
        { branchCatalogueIds: branchSet },
      ),
    ).toThrow();

    expect(() =>
      buildSaveRoleBranchPermissionsBody({
        expectedRevision: "42",
        catalogueRevision: "a".repeat(64),
        profiles: [
          { branchId, permissionIds: [] },
          { branchId, permissionIds: [] },
        ],
      }),
    ).toThrow();
  });
});

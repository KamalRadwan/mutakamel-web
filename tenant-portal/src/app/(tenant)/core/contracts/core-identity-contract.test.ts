import { describe, expect, it } from "vitest";
import { parseCorePage, parseCorePageMeta } from "./core-page";
import {
  parseBranch,
  parseCompany,
  parseOrgTree,
  parseTeam,
  readDeletionBlockers,
} from "./organization-contract";
import {
  parseTenantUser,
} from "./user-contract";
import {
  parseTenantProfile,
} from "./user-subresource-contract";
import {
  parseTenantPermission,
  parseTenantRoleDetail,
} from "./role-contract";
import {
  parseScopeRoleAssignment,
  scopeRoleAssignmentKey,
} from "./role-assignment-contract";

const ID = "0199f2b0-1111-7222-8333-444455556666";
const ID_2 = "0199f2b0-1111-7222-8333-444455556667";
const ID_3 = "0199f2b0-1111-7222-8333-444455556668";
const NOW = "2026-08-31T00:00:00.000Z";

function company(overrides: Record<string, unknown> = {}) {
  return {
    id: ID,
    code: "ACME",
    name: "Acme",
    status: "ACTIVE",
    legalName: null,
    taxNumber: null,
    currencyCode: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("Core envelope", () => {
  // The interceptor puts items in `data` and the pager in `meta`. Re-deriving
  // every claim here is what stops a malformed page driving the pager.
  it("re-derives totalPages, hasNext and hasPrev rather than trusting them", () => {
    expect(
      parseCorePageMeta(
        { page: 2, limit: 25, total: 60, totalPages: 3, hasNext: true, hasPrev: true },
        25,
      ),
    ).toEqual({ page: 2, limit: 25, total: 60, totalPages: 3, hasNext: true, hasPrev: true });

    expect(() =>
      parseCorePageMeta(
        { page: 2, limit: 25, total: 60, totalPages: 2, hasNext: true, hasPrev: true },
        25,
      ),
    ).toThrow();
    expect(() =>
      parseCorePageMeta(
        { page: 3, limit: 25, total: 60, totalPages: 3, hasNext: true, hasPrev: true },
        25,
      ),
    ).toThrow();
  });

  it("refuses a page whose limit is past the DTO's own maximum", () => {
    expect(() =>
      parseCorePageMeta(
        { page: 1, limit: 101, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
        0,
      ),
    ).toThrow();
  });

  it("refuses duplicate ids in one page", () => {
    const meta = { page: 1, limit: 25, total: 2, totalPages: 1, hasNext: false, hasPrev: false };
    expect(() =>
      parseCorePage({ data: [company(), company()], meta }, parseCompany),
    ).toThrow();
  });
});

describe("Organization contract", () => {
  it("keeps the nullable company fields nullable rather than coercing them", () => {
    const parsed = parseCompany(company({ legalName: "Acme LLC", currencyCode: "SAR" }));
    expect(parsed.legalName).toBe("Acme LLC");
    expect(parsed.currencyCode).toBe("SAR");
    expect(parsed.taxNumber).toBeNull();
  });

  it("rejects an unknown org status instead of rendering a raw wire value", () => {
    expect(() => parseCompany(company({ status: "ARCHIVED" }))).toThrow();
  });

  it("requires the parent key each nested level actually carries", () => {
    expect(
      parseBranch({
        ...company(),
        companyId: ID_2,
        address: null,
        phone: null,
        isHeadquarters: true,
      }).isHeadquarters,
    ).toBe(true);
    expect(() => parseBranch(company())).toThrow();
    expect(() => parseTeam({ ...company(), departmentId: "not-a-uuid" })).toThrow();
  });

  it("accepts the four-level tree and refuses a fifth", () => {
    interface RawNode {
      id: string;
      code: string;
      name: string;
      status: string;
      children: RawNode[];
    }
    const team: RawNode = { id: ID_3, code: "T", name: "Team", status: "ACTIVE", children: [] };
    const department: RawNode = { id: ID_2, code: "D", name: "Dept", status: "ACTIVE", children: [team] };
    const branch: RawNode = { id: ID, code: "B", name: "Branch", status: "ACTIVE", children: [department] };
    const root: RawNode = { id: ID, code: "C", name: "Co", status: "ACTIVE", children: [branch] };

    expect(parseOrgTree([root])[0].children[0].children[0].children).toHaveLength(1);

    const tooDeep = structuredClone(root);
    tooDeep.children[0].children[0].children[0].children = [
      { id: ID, code: "X", name: "X", status: "ACTIVE", children: [] },
    ];
    expect(() => parseOrgTree([tooDeep])).toThrow();
  });

  it("reads the 409 blockers only from the code that carries them", () => {
    const blockers = { blockers: ["company has branches"] };
    expect(
      readDeletionBlockers({ status: 409, code: "ORG_NODE_NOT_EMPTY", fieldErrors: blockers }),
    ).toEqual(["company has branches"]);
    expect(
      readDeletionBlockers({ status: 409, code: "ORG_CODE_TAKEN", fieldErrors: blockers }),
    ).toEqual([]);
    expect(readDeletionBlockers({ status: 409, code: "ORG_NODE_NOT_EMPTY" })).toEqual([]);
  });
});

describe("User contract", () => {
  const user = {
    id: ID,
    email: "a@example.test",
    firstName: "A",
    lastName: "B",
    employeeCode: null,
    companyId: ID,
    branchId: ID_2,
    departmentId: ID_3,
    teamId: null,
    managerId: null,
    jobTitle: null,
    isTenantOwner: false,
    status: "DEACTIVATED",
    createdAt: NOW,
    updatedAt: NOW,
  };

  it("accepts DEACTIVATED as a fourth status, not a synonym for deleted", () => {
    expect(parseTenantUser(user).status).toBe("DEACTIVATED");
  });

  it("rejects a status outside UserStatusEnum", () => {
    expect(() => parseTenantUser({ ...user, status: "ARCHIVED" })).toThrow();
  });

  it("defaults a profile's extensions to an object so the screen never reads undefined", () => {
    expect(parseTenantProfile({ id: ID, tenantUserId: ID_2 }).extensions).toEqual({});
    expect(() => parseTenantProfile({ id: ID, tenantUserId: ID_2, extensions: [] })).toThrow();
  });
});

describe("Role contract", () => {
  const role = {
    id: ID,
    name: "Editor",
    nameI18n: { ar: "محرر", en: "Editor" },
    descriptionI18n: { ar: "وصف", en: "Description" },
    isSystem: true,
    permissionIds: [ID_2],
    createdAt: NOW,
    updatedAt: NOW,
  };

  it("prefers the server's localized names and falls back to the stored name", () => {
    expect(parseTenantRoleDetail(role).nameAr).toBe("محرر");
    const { nameI18n: _dropped, ...withoutI18n } = role;
    expect(parseTenantRoleDetail(withoutI18n).nameAr).toBe("Editor");
  });

  it("refuses a permission set past the DTO's 200 cap or with duplicates", () => {
    expect(() =>
      parseTenantRoleDetail({ ...role, permissionIds: [ID_2, ID_2] }),
    ).toThrow();
    expect(() =>
      parseTenantRoleDetail({
        ...role,
        permissionIds: Array.from({ length: 201 }, () => ID_2),
      }),
    ).toThrow();
  });

  it("requires both localized blocks on a permission — the catalogue always sends them", () => {
    const permission = {
      id: ID,
      key: "users.user.read",
      group: "users",
      descriptionI18n: { ar: "قراءة", en: "Read users" },
      groupI18n: { ar: "المستخدمون", en: "Users" },
    };
    expect(parseTenantPermission(permission).nameEn).toBe("Read users");
    const { groupI18n: _missing, ...withoutGroup } = permission;
    expect(() => parseTenantPermission(withoutGroup)).toThrow();
  });

  it("keys a scope-role grant on its tuple, treating null and undefined alike", () => {
    const stored = parseScopeRoleAssignment({
      id: ID,
      tenantUserId: ID_2,
      roleId: ID_3,
      scopeTarget: "TENANT",
      companyId: null,
      branchId: null,
    });
    expect(scopeRoleAssignmentKey(stored)).toBe(
      scopeRoleAssignmentKey({ scopeTarget: "TENANT", roleId: ID_3 }),
    );
    expect(scopeRoleAssignmentKey(stored)).not.toBe(
      scopeRoleAssignmentKey({ scopeTarget: "COMPANY", roleId: ID_3, companyId: ID }),
    );
  });
});

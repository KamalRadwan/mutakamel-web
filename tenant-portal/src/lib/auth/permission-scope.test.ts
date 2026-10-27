import { describe, expect, it } from "vitest";
import { can, isPermissionScopes, type PermissionScope } from "./permission-scope";

const KEY = "org.company.manage";
const companyScope: PermissionScope = {
  tenantWide: false, companyIds: ["company-a"], branchIds: ["branch-a"],
};
const subject = (scope = companyScope) => ({
  permissions: [KEY], permissionScopes: { [KEY]: scope },
});

describe("Core permission targets", () => {
  it("does not upgrade company or branch grants to tenant-wide authority", () => {
    const user = { ...subject(), accessScope: { mode: "FULL" } };
    expect(can(user, KEY)).toBe(true);
    expect(can(user, KEY, { tenantWide: true })).toBe(false);
    expect(can(user, KEY, { companyId: null })).toBe(false);
    expect(can(user, KEY, { companyId: "company-a" })).toBe(true);
    expect(can(user, KEY, { companyId: "company-b" })).toBe(false);
    expect(can(user, KEY, { branchId: "branch-a" })).toBe(true);
    expect(can(user, KEY, { branchId: "branch-b" })).toBe(false);
    expect(can(user, KEY, { companyId: "company-b", branchId: "branch-a" })).toBe(false);
  });

  it("permits tenant holders for every explicit target", () => {
    const user = subject({ tenantWide: true, companyIds: [], branchIds: [] });
    expect(can(user, KEY, { tenantWide: true })).toBe(true);
    expect(can(user, KEY, { companyId: "company-b" })).toBe(true);
    expect(can(user, KEY, { branchId: "branch-b" })).toBe(true);
    expect(can(user, "roles.role.create", { tenantWide: true })).toBe(false);
  });

  it("fails closed without a matching live projection", () => {
    expect(can(null, KEY)).toBe(false);
    expect(can({ permissions: [KEY] }, KEY, { tenantWide: true })).toBe(false);
    expect(can({ permissions: [], permissionScopes: subject().permissionScopes }, KEY)).toBe(false);
    expect(can(subject({ tenantWide: false, companyIds: [], branchIds: [] }), KEY)).toBe(false);
    expect(can({ permissions: ["toString"], permissionScopes: {} }, "toString")).toBe(false);
  });
});

describe("permission scope response validation", () => {
  it("accepts bounded projections matching the flat keys", () => {
    expect(isPermissionScopes(subject().permissionScopes, [KEY])).toBe(true);
    expect(isPermissionScopes({}, [])).toBe(true);
  });

  it.each([
    undefined, null, [], {}, { [KEY]: null },
    { [KEY]: { ...companyScope, tenantWide: "true" } },
    { [KEY]: { ...companyScope, companyIds: ["company-a", "company-a"] } },
    { [KEY]: { ...companyScope, branchIds: [null] } },
    { [KEY]: { ...companyScope, branchIds: [""] } },
    { [KEY]: { ...companyScope, companyIds: Array.from({ length: 501 }, (_, i) => `c-${i}`) } },
  ].map((value) => ({ value })))("rejects malformed or incomplete scopes: %j", ({ value }) => {
    expect(isPermissionScopes(value, [KEY])).toBe(false);
  });

  it("rejects key mismatches, duplicates and overflow", () => {
    expect(isPermissionScopes({ "": companyScope }, [""])).toBe(false);
    expect(isPermissionScopes(subject().permissionScopes, ["roles.role.create"])).toBe(false);
    expect(isPermissionScopes(subject().permissionScopes, [KEY, KEY])).toBe(false);
    const keys = Array.from({ length: 501 }, (_, i) => `permission-${i}`);
    expect(isPermissionScopes(Object.fromEntries(keys.map((key) => [key, companyScope])), keys)).toBe(false);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const { allowed, canMock, canAllMock } = vi.hoisted(() => {
  const allowed = new Set<string>();
  return {
    allowed,
    canMock: vi.fn((_user: unknown, permission: string) =>
      allowed.has(permission),
    ),
    canAllMock: vi.fn((_user: unknown, permissions: readonly string[]) =>
      permissions.every((permission) => allowed.has(permission)),
    ),
  };
});

vi.mock("@/lib/auth/rbac", () => ({
  adminCan: canMock,
  adminCanAll: canAllMock,
}));

import {
  TENANT_PERMISSION_REQUIREMENTS,
  readTenantCorePermissions,
} from "./permissions";

describe("tenant route permission model", () => {
  beforeEach(() => {
    allowed.clear();
    canMock.mockClear();
    canAllMock.mockClear();
  });

  it("declares the exact gateway route requirements", () => {
    expect(TENANT_PERMISSION_REQUIREMENTS).toEqual({
      read: ["admin.tenants.read"],
      update: ["admin.tenants.update"],
      lifecycle: ["admin.tenants.suspend", "admin.tenants.critical"],
      provisioning: ["admin.tenants.reprovision", "admin.tenants.critical"],
      softDelete: ["admin.tenants.delete", "admin.tenants.critical"],
      restore: ["admin.tenants.restore", "admin.tenants.critical"],
      destroy: ["admin.tenants.destroy", "admin.tenants.critical"],
      manageFqdns: [
        "admin.tenants.manage_fqdns",
        "admin.tenants.critical",
      ],
    });
  });

  it("requires both the route permission and critical grant for mutations", () => {
    allowed.add("admin.tenants.suspend");
    allowed.add("admin.tenants.reprovision");
    allowed.add("admin.tenants.delete");
    allowed.add("admin.tenants.destroy");
    allowed.add("admin.tenants.restore");
    allowed.add("admin.tenants.manage_fqdns");
    const withoutCritical = readTenantCorePermissions({} as never);
    expect(withoutCritical).toMatchObject({
      canSuspendOrActivate: false,
      canReprovisionOrCancel: false,
      canSoftDelete: false,
      canRestore: false,
      canDestroy: false,
      canManageFqdns: false,
    });

    allowed.add("admin.tenants.critical");
    const withCritical = readTenantCorePermissions({} as never);
    expect(withCritical).toMatchObject({
      canSuspendOrActivate: true,
      canReprovisionOrCancel: true,
      canSoftDelete: true,
      canDestroy: true,
      canManageFqdns: true,
    });
  });

  it("allows FQDN preflight with create OR manage_fqdns", () => {
    allowed.add("admin.tenants.create");
    expect(readTenantCorePermissions({} as never).canValidateFqdn).toBe(true);
    allowed.clear();
    allowed.add("admin.tenants.manage_fqdns");
    expect(readTenantCorePermissions({} as never).canValidateFqdn).toBe(true);
    allowed.clear();
    expect(readTenantCorePermissions({} as never).canValidateFqdn).toBe(false);
  });

  it("keeps read and profile update independent", () => {
    allowed.add("admin.tenants.read");
    expect(readTenantCorePermissions({} as never)).toMatchObject({
      canRead: true,
      canUpdate: false,
    });
    allowed.add("admin.tenants.update");
    expect(readTenantCorePermissions({} as never).canUpdate).toBe(true);
  });
});

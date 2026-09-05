import { describe, expect, it } from "vitest";
import {
  missingRelocationExecutePermissions,
  readTenantRelocationPermissions,
} from "./permissions";

const context = (permissions: string[], isSuperAdmin = false) => ({
  isSuperAdmin,
  permissions,
});

describe("readTenantRelocationPermissions", () => {
  it("requires both execute and critical before offering the move", () => {
    const executeOnly = readTenantRelocationPermissions(
      context(["admin.tenant_relocations.execute"]),
    );
    expect(executeOnly.hasExecute).toBe(true);
    expect(executeOnly.canExecute).toBe(false);
    expect(executeOnly.canReleaseSource).toBe(false);

    const criticalOnly = readTenantRelocationPermissions(
      context(["admin.tenant_relocations.critical"]),
    );
    expect(criticalOnly.canExecute).toBe(false);

    const both = readTenantRelocationPermissions(
      context([
        "admin.tenant_relocations.execute",
        "admin.tenant_relocations.critical",
      ]),
    );
    expect(both.canExecute).toBe(true);
    expect(both.canReleaseSource).toBe(true);
  });

  it("keeps read independent of execute", () => {
    const readOnly = readTenantRelocationPermissions(
      context(["admin.tenant_relocations.read"]),
    );
    expect(readOnly.canRead).toBe(true);
    expect(readOnly.canExecute).toBe(false);

    const writeOnly = readTenantRelocationPermissions(
      context([
        "admin.tenant_relocations.execute",
        "admin.tenant_relocations.critical",
      ]),
    );
    expect(writeOnly.canRead).toBe(false);
    expect(writeOnly.canExecute).toBe(true);
  });

  it("treats a missing user as holding nothing and a super admin as holding all", () => {
    const anonymous = readTenantRelocationPermissions(null);
    expect(anonymous.canRead).toBe(false);
    expect(anonymous.canExecute).toBe(false);

    const superAdmin = readTenantRelocationPermissions(context([], true));
    expect(superAdmin.canRead).toBe(true);
    expect(superAdmin.canExecute).toBe(true);
  });
});

describe("missingRelocationExecutePermissions", () => {
  it("names exactly the permissions the operator lacks", () => {
    expect(
      missingRelocationExecutePermissions(
        readTenantRelocationPermissions(context(["admin.tenant_relocations.read"])),
      ),
    ).toEqual([
      "admin.tenant_relocations.execute",
      "admin.tenant_relocations.critical",
    ]);

    expect(
      missingRelocationExecutePermissions(
        readTenantRelocationPermissions(
          context(["admin.tenant_relocations.execute"]),
        ),
      ),
    ).toEqual(["admin.tenant_relocations.critical"]);

    expect(
      missingRelocationExecutePermissions(
        readTenantRelocationPermissions(
          context([
            "admin.tenant_relocations.execute",
            "admin.tenant_relocations.critical",
          ]),
        ),
      ),
    ).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";

import {
  MIGRATION_CRITICAL_PERMISSION,
  MIGRATION_EXECUTE_PERMISSION,
  MIGRATION_READ_PERMISSION,
  missingExecutePermissions,
  readMigrationPermissions,
} from "./migration-permissions";

const user = (permissions: string[]) => ({
  isSuperAdmin: false,
  permissions,
});

describe("migration permissions", () => {
  it("grants nothing without an authenticated authorization context", () => {
    const permissions = readMigrationPermissions(null);
    expect(permissions).toEqual({
      canRead: false,
      hasExecute: false,
      hasCritical: false,
      canExecute: false,
      canDestroy: false,
    });
  });

  it("opens the surface read-only with admin.migrations.read alone", () => {
    const permissions = readMigrationPermissions(
      user([MIGRATION_READ_PERMISSION]),
    );
    expect(permissions.canRead).toBe(true);
    expect(permissions.canExecute).toBe(false);
    expect(permissions.canDestroy).toBe(false);
    expect(missingExecutePermissions(permissions)).toEqual([
      MIGRATION_EXECUTE_PERMISSION,
      MIGRATION_CRITICAL_PERMISSION,
    ]);
  });

  it("refuses execution to a manage-only operator, matching the ALL route contract", () => {
    const permissions = readMigrationPermissions(
      user([MIGRATION_READ_PERMISSION, MIGRATION_EXECUTE_PERMISSION]),
    );
    expect(permissions.hasExecute).toBe(true);
    expect(permissions.hasCritical).toBe(false);
    expect(permissions.canExecute).toBe(false);
    expect(permissions.canDestroy).toBe(false);
    expect(missingExecutePermissions(permissions)).toEqual([
      MIGRATION_CRITICAL_PERMISSION,
    ]);
  });

  it("refuses execution to a critical-only operator", () => {
    const permissions = readMigrationPermissions(
      user([MIGRATION_READ_PERMISSION, MIGRATION_CRITICAL_PERMISSION]),
    );
    expect(permissions.canExecute).toBe(false);
    expect(permissions.canDestroy).toBe(false);
    expect(missingExecutePermissions(permissions)).toEqual([
      MIGRATION_EXECUTE_PERMISSION,
    ]);
  });

  it("grants execution and destruction only with both mutating permissions", () => {
    const permissions = readMigrationPermissions(
      user([
        MIGRATION_READ_PERMISSION,
        MIGRATION_EXECUTE_PERMISSION,
        MIGRATION_CRITICAL_PERMISSION,
      ]),
    );
    expect(permissions.canRead).toBe(true);
    expect(permissions.canExecute).toBe(true);
    expect(permissions.canDestroy).toBe(true);
    expect(missingExecutePermissions(permissions)).toEqual([]);
  });

  it("does not infer read access from the mutating permissions", () => {
    const permissions = readMigrationPermissions(
      user([MIGRATION_EXECUTE_PERMISSION, MIGRATION_CRITICAL_PERMISSION]),
    );
    expect(permissions.canRead).toBe(false);
    expect(permissions.canExecute).toBe(true);
  });

  it("grants every tier to a super admin", () => {
    const permissions = readMigrationPermissions({
      isSuperAdmin: true,
      permissions: [],
    });
    expect(permissions).toEqual({
      canRead: true,
      hasExecute: true,
      hasCritical: true,
      canExecute: true,
      canDestroy: true,
    });
  });
});

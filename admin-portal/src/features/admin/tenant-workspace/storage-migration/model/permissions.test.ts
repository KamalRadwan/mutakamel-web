import { describe, expect, it } from "vitest";
import {
  missingStorageMigrationExecutePermissions,
  readTenantStorageMigrationPermissions,
} from "./permissions";

const context = (permissions: string[], isSuperAdmin = false) => ({
  isSuperAdmin,
  permissions,
});

describe("readTenantStorageMigrationPermissions", () => {
  it("requires execute and critical together", () => {
    expect(
      readTenantStorageMigrationPermissions(
        context(["admin.storage_migrations.execute"]),
      ).canExecute,
    ).toBe(false);
    expect(
      readTenantStorageMigrationPermissions(
        context(["admin.storage_migrations.critical"]),
      ).canExecute,
    ).toBe(false);
    expect(
      readTenantStorageMigrationPermissions(
        context([
          "admin.storage_migrations.execute",
          "admin.storage_migrations.critical",
        ]),
      ).canExecute,
    ).toBe(true);
  });

  it("keeps backup evidence access independent of the migration permissions", () => {
    const migrationOnly = readTenantStorageMigrationPermissions(
      context([
        "admin.storage_migrations.read",
        "admin.storage_migrations.execute",
        "admin.storage_migrations.critical",
      ]),
    );
    expect(migrationOnly.canExecute).toBe(true);
    expect(migrationOnly.canReadBackupEvidence).toBe(false);

    const backupsOnly = readTenantStorageMigrationPermissions(
      context(["admin.backups.read"]),
    );
    expect(backupsOnly.canReadBackupEvidence).toBe(true);
    expect(backupsOnly.canRead).toBe(false);
  });

  it("treats a missing user as holding nothing and a super admin as holding all", () => {
    const anonymous = readTenantStorageMigrationPermissions(undefined);
    expect(anonymous.canRead).toBe(false);
    expect(anonymous.canExecute).toBe(false);
    expect(anonymous.canReadBackupEvidence).toBe(false);

    const superAdmin = readTenantStorageMigrationPermissions(context([], true));
    expect(superAdmin.canRead).toBe(true);
    expect(superAdmin.canExecute).toBe(true);
    expect(superAdmin.canReadBackupEvidence).toBe(true);
  });
});

describe("missingStorageMigrationExecutePermissions", () => {
  it("names every permission the operator still needs to compose a migration", () => {
    expect(
      missingStorageMigrationExecutePermissions(
        readTenantStorageMigrationPermissions(
          context(["admin.storage_migrations.read"]),
        ),
      ),
    ).toEqual([
      "admin.storage_migrations.execute",
      "admin.storage_migrations.critical",
      "admin.backups.read",
    ]);

    expect(
      missingStorageMigrationExecutePermissions(
        readTenantStorageMigrationPermissions(
          context([
            "admin.storage_migrations.execute",
            "admin.storage_migrations.critical",
            "admin.backups.read",
          ]),
        ),
      ),
    ).toEqual([]);
  });
});

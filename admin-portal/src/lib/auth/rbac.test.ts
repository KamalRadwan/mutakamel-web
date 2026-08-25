import { describe, it, expect } from "vitest";
import {
  AdminPermission,
  getPermissionName,
  adminCan,
  adminCanAll,
  adminCanAny,
  ADMIN_RBAC_CRITICAL,
  AdminAuthorizationContext,
} from "./rbac";

describe("Bilingual RBAC System", () => {
  const mockPermission: AdminPermission = {
    id: "019f0000-0000-7000-8000-000000000201",
    key: "admin.database_servers.update",
    nameAr: "تحديث خادم قاعدة بيانات",
    nameEn: "Update a database server",
    description: "Legacy description",
    group: "Database Servers",
    descriptionI18n: {
      ar: "تحديث خادم قاعدة بيانات (Legacy)",
      en: "Update a database server (Legacy)",
    },
    groupI18n: {
      ar: "خوادم قواعد البيانات",
      en: "Database Servers",
    },
    createdAt: "2026-07-27T01:00:00.000Z",
    updatedAt: "2026-07-27T01:00:00.000Z",
  };

  describe("getPermissionName Localization", () => {
    it("1. English permission names use nameEn", () => {
      expect(getPermissionName(mockPermission, "en")).toBe("Update a database server");
    });

    it("2. Arabic permission names use nameAr", () => {
      expect(getPermissionName(mockPermission, "ar")).toBe("تحديث خادم قاعدة بيانات");
    });

    it("11. Existing descriptionI18n responses remain usable as a temporary fallback", () => {
      const fallbackPerm = { ...mockPermission, nameAr: "", nameEn: "" };
      expect(getPermissionName(fallbackPerm, "en")).toBe("Update a database server (Legacy)");
      expect(getPermissionName(fallbackPerm, "ar")).toBe("تحديث خادم قاعدة بيانات (Legacy)");
    });

    it("12. Missing display names fall back safely to description and then key", () => {
      const barePerm = { ...mockPermission, nameAr: "", nameEn: "", descriptionI18n: undefined };
      expect(getPermissionName(barePerm, "en")).toBe("Legacy description");

      const keyOnlyPerm = { ...barePerm, description: "" };
      expect(getPermissionName(keyOnlyPerm, "en")).toBe("admin.database_servers.update");
    });
  });

  describe("Permission Search Matching (Simulated Component Logic)", () => {
    const searchFilter = (search: string, permissions: AdminPermission[]) => {
      const normalizedSearch = search.trim().toLocaleLowerCase();
      return permissions.filter((permission) =>
        [
          permission.key,
          permission.nameAr,
          permission.nameEn,
          permission.group,
          permission.description,
        ].some((value) => value?.toLocaleLowerCase().includes(normalizedSearch))
      );
    };

    it("3. Search matches key, Arabic name, and English name", () => {
      expect(searchFilter("admin.database", [mockPermission]).length).toBe(1);
      expect(searchFilter("تحديث خادم", [mockPermission]).length).toBe(1);
      expect(searchFilter("update a data", [mockPermission]).length).toBe(1);
      expect(searchFilter("not matched", [mockPermission]).length).toBe(0);
    });
  });

  describe("Authorization Guards", () => {
    it("supports explicit ANY permission contracts without weakening ALL checks", () => {
      const fqdnCreator: AdminAuthorizationContext = {
        isSuperAdmin: false,
        permissions: ["admin.tenants.create"],
      };

      expect(
        adminCanAny(fqdnCreator, [
          "admin.tenants.create",
          "admin.tenants.manage_fqdns",
        ]),
      ).toBe(true);
      expect(
        adminCanAll(fqdnCreator, [
          "admin.tenants.create",
          "admin.tenants.manage_fqdns",
        ]),
      ).toBe(false);
      expect(adminCanAny(fqdnCreator, [])).toBe(false);
    });

    const normalAdmin: AdminAuthorizationContext = {
      isSuperAdmin: false,
      permissions: ["admin.database_servers.read", "admin.database_servers.update"],
    };

    const criticalAdmin: AdminAuthorizationContext = {
      isSuperAdmin: false,
      permissions: ["admin.database_servers.read", "admin.database_servers.update", "admin.database_servers.critical"],
    };

    const superAdmin: AdminAuthorizationContext = {
      isSuperAdmin: true,
      permissions: [],
    };

    it("4. Authorization uses key only", () => {
      expect(adminCan(normalAdmin, "admin.database_servers.read")).toBe(true);
      expect(adminCan(normalAdmin, "admin.database_servers.delete")).toBe(false);
    });

    it("5. A localized name never grants access", () => {
      expect(adminCan(normalAdmin, "Update a database server")).toBe(false);
      expect(adminCan(normalAdmin, "تحديث خادم قاعدة بيانات")).toBe(false);
    });

    it("6. A normal admin with only a base permission cannot perform its critical operation", () => {
      expect(adminCanAll(normalAdmin, ADMIN_RBAC_CRITICAL.DB_SERVERS_UPDATE)).toBe(false);
    });

    it("7. A normal admin with base plus matching critical permission can perform it", () => {
      expect(adminCanAll(criticalAdmin, ADMIN_RBAC_CRITICAL.DB_SERVERS_UPDATE)).toBe(true);
    });

    it("8. A super admin with an empty permission array passes RBAC UI checks", () => {
      expect(adminCan(superAdmin, "admin.database_servers.delete")).toBe(true);
      expect(adminCanAll(superAdmin, ADMIN_RBAC_CRITICAL.DB_SERVERS_DELETE)).toBe(true);
      expect(adminCanAll(superAdmin, ADMIN_RBAC_CRITICAL.DB_SERVERS_DESTROY)).toBe(true);
    });

    it("9. Database Server Destroy requires hard-delete and critical permissions", () => {
      const destroyAdmin: AdminAuthorizationContext = {
        isSuperAdmin: false,
        permissions: [
          "admin.database_servers.delete.hard",
          "admin.database_servers.critical",
        ],
      };
      expect(
        adminCanAll(destroyAdmin, ADMIN_RBAC_CRITICAL.DB_SERVERS_DESTROY),
      ).toBe(true);

      expect(
        adminCanAll(
          {
            ...destroyAdmin,
            permissions: ["admin.database_servers.delete.hard"],
          },
          ADMIN_RBAC_CRITICAL.DB_SERVERS_DESTROY,
        ),
      ).toBe(false);
      expect(
        adminCanAll(
          {
            ...destroyAdmin,
            permissions: [
              "admin.database_servers.delete",
              "admin.database_servers.critical",
            ],
          },
          ADMIN_RBAC_CRITICAL.DB_SERVERS_DESTROY,
        ),
      ).toBe(false);
    });

    it("10. Worker job and migration controls use their new permission pairs", () => {
      const workerAdmin: AdminAuthorizationContext = {
        isSuperAdmin: false,
        permissions: ["admin.jobs.manage", "admin.jobs.critical", "admin.migrations.manage", "admin.migrations.critical"],
      };
      expect(adminCanAll(workerAdmin, ADMIN_RBAC_CRITICAL.JOBS_MANAGE)).toBe(true);
      expect(adminCanAll(workerAdmin, ADMIN_RBAC_CRITICAL.MIGRATIONS_MANAGE)).toBe(true);

      const weakWorkerAdmin: AdminAuthorizationContext = {
        isSuperAdmin: false,
        permissions: ["admin.jobs.manage", "admin.migrations.manage"], // missing critical
      };
      expect(adminCanAll(weakWorkerAdmin, ADMIN_RBAC_CRITICAL.JOBS_MANAGE)).toBe(false);
      expect(adminCanAll(weakWorkerAdmin, ADMIN_RBAC_CRITICAL.MIGRATIONS_MANAGE)).toBe(false);
    });

    it("13. Backup policy, deletion, and restore commands require their exact critical pairs", () => {
      const backupAdmin: AdminAuthorizationContext = {
        isSuperAdmin: false,
        permissions: [
          "admin.backups.manage",
          "admin.backups.delete",
          "admin.backups.restore",
          "admin.backups.critical",
        ],
      };

      expect(adminCanAll(backupAdmin, ADMIN_RBAC_CRITICAL.BACKUPS_POLICY_MANAGE)).toBe(true);
      expect(adminCanAll(backupAdmin, ADMIN_RBAC_CRITICAL.BACKUPS_DELETE)).toBe(true);
      expect(adminCanAll(backupAdmin, ADMIN_RBAC_CRITICAL.BACKUPS_RESTORE)).toBe(true);

      const backupAdminWithoutCritical: AdminAuthorizationContext = {
        ...backupAdmin,
        permissions: [
          "admin.backups.manage",
          "admin.backups.delete",
          "admin.backups.restore",
        ],
      };

      expect(adminCanAll(backupAdminWithoutCritical, ADMIN_RBAC_CRITICAL.BACKUPS_POLICY_MANAGE)).toBe(false);
      expect(adminCanAll(backupAdminWithoutCritical, ADMIN_RBAC_CRITICAL.BACKUPS_DELETE)).toBe(false);
      expect(adminCanAll(backupAdminWithoutCritical, ADMIN_RBAC_CRITICAL.BACKUPS_RESTORE)).toBe(false);
    });

    it("14. Backup database credential controls keep the Database Server permission boundary", () => {
      const databaseCredentialAdmin: AdminAuthorizationContext = {
        isSuperAdmin: false,
        permissions: [
          "admin.database_servers.update",
          "admin.database_servers.credentials.rotate",
          "admin.database_servers.critical",
        ],
      };

      expect(adminCanAll(databaseCredentialAdmin, ADMIN_RBAC_CRITICAL.BACKUP_DB_ROTATION_POLICY_UPDATE)).toBe(true);
      expect(adminCanAll(databaseCredentialAdmin, ADMIN_RBAC_CRITICAL.BACKUP_DB_CREDENTIAL_REGENERATE)).toBe(true);
      expect(adminCanAll(databaseCredentialAdmin, ADMIN_RBAC_CRITICAL.BACKUP_DB_CREDENTIAL_RECONCILE)).toBe(true);

      const backupOnlyAdmin: AdminAuthorizationContext = {
        isSuperAdmin: false,
        permissions: [
          "admin.backups.read",
          "admin.backups.manage",
          "admin.backups.critical",
        ],
      };

      expect(adminCanAll(backupOnlyAdmin, ADMIN_RBAC_CRITICAL.BACKUP_DB_ROTATION_POLICY_UPDATE)).toBe(false);
      expect(adminCanAll(backupOnlyAdmin, ADMIN_RBAC_CRITICAL.BACKUP_DB_CREDENTIAL_REGENERATE)).toBe(false);
      expect(adminCanAll(backupOnlyAdmin, ADMIN_RBAC_CRITICAL.BACKUP_DB_CREDENTIAL_RECONCILE)).toBe(false);
    });
  });
});

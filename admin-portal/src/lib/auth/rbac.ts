export type AdminPermission = {
  id: string;
  key: string;
  nameAr: string;
  nameEn: string;
  description: string;
  group: string;
  descriptionI18n?: {
    ar: string;
    en: string;
  };
  groupI18n?: {
    ar: string;
    en: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type AdminAuthorizationContext = {
  isSuperAdmin: boolean;
  permissions: string[];
};

export function getPermissionName(
  permission: AdminPermission,
  locale: "ar" | "en",
): string {
  if (locale === "ar") {
    return (
      permission.nameAr ||
      permission.descriptionI18n?.ar ||
      permission.description ||
      permission.key
    );
  }

  return (
    permission.nameEn ||
    permission.descriptionI18n?.en ||
    permission.description ||
    permission.key
  );
}

export function adminCan(
  user: AdminAuthorizationContext | null | undefined,
  permission: string,
): boolean {
  return (
    user?.isSuperAdmin === true ||
    user?.permissions?.includes(permission) === true
  );
}

export function adminCanAll(
  user: AdminAuthorizationContext | null | undefined,
  requiredPermissions: readonly string[],
): boolean {
  return (
    user?.isSuperAdmin === true ||
    requiredPermissions.every((permission) =>
      user?.permissions?.includes(permission) === true
    )
  );
}

// Critical Action Semantics
export const ADMIN_RBAC_CRITICAL = {
  USERS_INVITE: ["admin.users.invite", "admin.users.critical"] as const,
  USERS_UPDATE: ["admin.users.update", "admin.users.critical"] as const,
  USERS_SUSPEND: ["admin.users.suspend", "admin.users.critical"] as const,
  USERS_DELETE: ["admin.users.delete", "admin.users.critical"] as const,
  USERS_ASSIGN_ROLES: ["admin.users.assign_roles", "admin.users.critical"] as const,

  ROLES_CREATE: ["admin.roles.create", "admin.roles.critical"] as const,
  ROLES_UPDATE: ["admin.roles.update", "admin.roles.critical"] as const,
  ROLES_DELETE: ["admin.roles.delete", "admin.roles.critical"] as const,

  // Tenant Critical
  TENANTS_DESTROY: ["admin.tenants.destroy", "admin.tenants.critical"] as const,

  // Applications Critical
  APPLICATIONS_UPDATE: ["admin.applications.update", "admin.applications.critical"] as const,
  APPLICATIONS_DELETE: ["admin.applications.delete", "admin.applications.critical"] as const,

  // Database Servers Critical
  DB_SERVERS_UPDATE: ["admin.database_servers.update", "admin.database_servers.critical"] as const,
  DB_SERVERS_DELETE: ["admin.database_servers.delete", "admin.database_servers.critical"] as const,
  DB_SERVERS_DESTROY: ["admin.database_servers.delete.hard", "admin.database_servers.critical"] as const,
  DB_SERVERS_BOOTSTRAP_INITIAL: ["admin.database_servers.create", "admin.database_servers.critical"] as const,
  DB_SERVERS_BOOTSTRAP_EXISTING: ["admin.database_servers.update", "admin.database_servers.critical"] as const,
  DB_SERVERS_REGENERATE: ["admin.database_servers.credentials.rotate", "admin.database_servers.critical"] as const,
  DB_SERVERS_RECONCILE: ["admin.database_servers.credentials.rotate", "admin.database_servers.critical"] as const,

  // Storage Servers Critical
  STORAGE_SERVERS_CREATE: ["admin.storage_servers.create", "admin.storage_servers.critical"] as const,
  STORAGE_SERVERS_UPDATE: ["admin.storage_servers.update", "admin.storage_servers.critical"] as const,
  STORAGE_SERVERS_DELETE: ["admin.storage_servers.delete", "admin.storage_servers.critical"] as const,

  // Backups Critical
  BACKUPS_POLICY_MANAGE: ["admin.backups.manage", "admin.backups.critical"] as const,
  BACKUPS_DELETE: ["admin.backups.delete", "admin.backups.critical"] as const,
  BACKUPS_RESTORE: ["admin.backups.restore", "admin.backups.critical"] as const,
  BACKUP_DB_ROTATION_POLICY_UPDATE: ["admin.database_servers.update", "admin.database_servers.critical"] as const,
  BACKUP_DB_CREDENTIAL_REGENERATE: ["admin.database_servers.credentials.rotate", "admin.database_servers.critical"] as const,
  BACKUP_DB_CREDENTIAL_RECONCILE: ["admin.database_servers.credentials.rotate", "admin.database_servers.critical"] as const,

  // Worker / Background Jobs Critical
  JOBS_MANAGE: ["admin.jobs.manage", "admin.jobs.critical"] as const,
  MIGRATIONS_MANAGE: ["admin.migrations.manage", "admin.migrations.critical"] as const,
} as const;

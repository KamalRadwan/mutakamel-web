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

export function adminCanAny(
  user: AdminAuthorizationContext | null | undefined,
  requiredPermissions: readonly string[],
): boolean {
  return (
    user?.isSuperAdmin === true ||
    requiredPermissions.some((permission) =>
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
  TENANTS_SUSPEND: ["admin.tenants.suspend", "admin.tenants.critical"] as const,
  TENANTS_REPROVISION: ["admin.tenants.reprovision", "admin.tenants.critical"] as const,
  TENANTS_DELETE: ["admin.tenants.delete", "admin.tenants.critical"] as const,
  TENANTS_RESTORE: ["admin.tenants.restore", "admin.tenants.critical"] as const,
  TENANTS_MANAGE_FQDNS: ["admin.tenants.manage_fqdns", "admin.tenants.critical"] as const,
  TENANT_USERS_INVITE: ["admin.tenant_users.invite", "admin.tenant_users.critical"] as const,
  TENANT_USERS_RESET_PASSWORD: ["admin.tenant_users.reset_password", "admin.tenant_users.critical"] as const,
  TENANT_USERS_SUSPEND: ["admin.tenant_users.suspend", "admin.tenant_users.critical"] as const,
  TENANT_USERS_ASSIGN_ROLES: ["admin.tenant_users.assign_roles", "admin.tenant_users.critical"] as const,
  TENANT_USERS_DELETE: ["admin.tenant_users.delete", "admin.tenant_users.critical"] as const,
  TENANT_USERS_RESTORE: ["admin.tenant_users.restore", "admin.tenant_users.critical"] as const,
  TENANT_USERS_TRANSFER_OWNERSHIP: ["admin.tenant_users.transfer_ownership", "admin.tenant_users.critical"] as const,

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
  // Drain and both credential-rotation writes share this same pair on the
  // backend controller (@RequirePermissions(UPDATE, CRITICAL) for all
  // three) rather than a dedicated rotate permission the way database
  // servers has — verified against storage-servers.controller.ts.
  STORAGE_SERVERS_UPDATE: ["admin.storage_servers.update", "admin.storage_servers.critical"] as const,
  STORAGE_SERVERS_DELETE: ["admin.storage_servers.delete", "admin.storage_servers.critical"] as const,

  // Tenant Storage Migrations Critical
  STORAGE_MIGRATIONS_EXECUTE: ["admin.storage_migrations.execute", "admin.storage_migrations.critical"] as const,

  // Tenant Database Relocations Critical. The Worker declares this exact pair
  // on both mutating relocation routes — `POST /relocations/tenants/:tenantId`
  // and `POST /relocations/:runId/destroy-source` — so one entry covers the
  // move and the irreversible source release.
  TENANT_RELOCATIONS_EXECUTE: ["admin.tenant_relocations.execute", "admin.tenant_relocations.critical"] as const,

  // Backups Critical
  BACKUPS_POLICY_MANAGE: ["admin.backups.manage", "admin.backups.critical"] as const,
  BACKUPS_DELETE: ["admin.backups.delete", "admin.backups.critical"] as const,
  BACKUPS_RESTORE: ["admin.backups.restore", "admin.backups.critical"] as const,
  BACKUP_DB_ROTATION_POLICY_UPDATE: ["admin.database_servers.update", "admin.database_servers.critical"] as const,
  BACKUP_DB_CREDENTIAL_REGENERATE: ["admin.database_servers.credentials.rotate", "admin.database_servers.critical"] as const,
  BACKUP_DB_CREDENTIAL_RECONCILE: ["admin.database_servers.credentials.rotate", "admin.database_servers.critical"] as const,

  // Worker migrations
  MIGRATIONS_MANAGE: ["admin.migrations.manage", "admin.migrations.critical"] as const,

  // Settings and commercial actions
  SETTINGS_UPDATE: ["admin.settings.update", "admin.settings.critical"] as const,
  CATALOG_MANAGE: ["admin.catalog.manage", "admin.catalog.critical"] as const,
  CURRENCY_MANAGE: ["admin.billing.currency.manage", "admin.catalog.critical"] as const,
  INVOICES_ISSUE: ["admin.invoices.update", "admin.invoices.critical"] as const,
  INVOICES_VOID: ["admin.invoices.void", "admin.invoices.critical"] as const,
  BILLING_PAYMENT_MANAGE: ["admin.wallet.manage", "admin.billing.critical"] as const,
  BILLING_RECONCILE: ["admin.billing.reconcile", "admin.billing.critical"] as const,
  WALLET_MANAGE: ["admin.wallet.manage", "admin.wallet.critical"] as const,
  SUBSCRIPTIONS_CREATE: ["admin.subscriptions.create", "admin.subscriptions.critical"] as const,
  SUBSCRIPTIONS_UPDATE: ["admin.subscriptions.update", "admin.subscriptions.critical"] as const,
  SUBSCRIPTIONS_CANCEL: ["admin.subscriptions.cancel", "admin.subscriptions.critical"] as const,

  // Logging and provisioning
  LOGGING_UPDATE: ["admin.logging.update", "admin.logging.critical"] as const,
  LOGGING_LIVE: ["admin.logging.read", "admin.logging.critical"] as const,
  PROVISIONING_ROLLOUT_CREATE: ["admin.provisioning.rollouts.create", "admin.provisioning.critical"] as const,
  PROVISIONING_ROLLOUT_MANAGE: ["admin.provisioning.rollouts.manage", "admin.provisioning.critical"] as const,
  PROVISIONING_ROLLOUT_ATTEST: ["admin.provisioning.rollouts.report", "admin.provisioning.critical"] as const,
  PROVISIONING_DISCOVERY_RUN: ["admin.provisioning.discovery.run", "admin.provisioning.critical"] as const,
  PROVISIONING_PUBLISHER_KEYS_MANAGE: ["admin.provisioning.publisher-keys.manage", "admin.provisioning.critical"] as const,
  PROVISIONING_RELEASE_PUBLISH: ["admin.provisioning.releases.publish", "admin.provisioning.critical"] as const,
  PROVISIONING_RELEASE_RETIRE: ["admin.provisioning.releases.retire", "admin.provisioning.critical"] as const,
  PROVISIONING_TENANT_UPDATE: ["admin.tenants.reprovision", "admin.tenants.critical", "admin.provisioning.critical"] as const,
  PROVISIONING_PREREQUISITES_REQUEST: ["admin.provisioning.prerequisites.request", "admin.provisioning.critical"] as const,
  PROVISIONING_ADD_APPLICATION: ["admin.provisioning.add-application", "admin.provisioning.critical"] as const,
  PROVISIONING_REPAIR: ["admin.provisioning.repair", "admin.provisioning.critical"] as const,
  PROVISIONING_DECOMMISSION: ["admin.provisioning.decommission", "admin.provisioning.critical"] as const,
  PROVISIONING_CONFLICTS_RESOLVE: ["admin.provisioning.conflicts.resolve", "admin.provisioning.critical"] as const,
} as const;

import { adminCan, type AdminAuthorizationContext } from "@/lib/auth/rbac";

export const STORAGE_MIGRATION_READ_PERMISSION = "admin.storage_migrations.read";
export const STORAGE_MIGRATION_EXECUTE_PERMISSION =
  "admin.storage_migrations.execute";
export const STORAGE_MIGRATION_CRITICAL_PERMISSION =
  "admin.storage_migrations.critical";
/** Backup artifacts and restore runs are Worker reads under their own gate. */
export const BACKUP_EVIDENCE_READ_PERMISSION = "admin.backups.read";

export interface TenantStorageMigrationPermissions {
  canRead: boolean;
  hasExecute: boolean;
  hasCritical: boolean;
  canExecute: boolean;
  /**
   * Whether the operator may load the backup artifact and restore run this
   * command must be bound to. Independent of the migration permissions: a
   * migration reader without `admin.backups.read` can watch a migration but
   * cannot compose one.
   */
  canReadBackupEvidence: boolean;
}

/**
 * Derives this wizard's visible surface from `/auth/me` permissions.
 *
 * Presentation only. The Gateway route contract and Core's `AdminGuard` decide
 * authorization; hiding a control grants nothing, and a `403` still renders as
 * forbidden rather than as an empty list.
 */
export function readTenantStorageMigrationPermissions(
  user: AdminAuthorizationContext | null | undefined,
): TenantStorageMigrationPermissions {
  const canRead = adminCan(user, STORAGE_MIGRATION_READ_PERMISSION);
  const hasExecute = adminCan(user, STORAGE_MIGRATION_EXECUTE_PERMISSION);
  const hasCritical = adminCan(user, STORAGE_MIGRATION_CRITICAL_PERMISSION);

  return {
    canRead,
    hasExecute,
    hasCritical,
    // ALL semantics: Gateway declares both on `POST
    // /tenants/:tenantId/storage-migrations`.
    canExecute: hasExecute && hasCritical,
    canReadBackupEvidence: adminCan(user, BACKUP_EVIDENCE_READ_PERMISSION),
  };
}

/** The exact permissions the operator lacks, so a disabled submit can say why. */
export function missingStorageMigrationExecutePermissions(
  permissions: TenantStorageMigrationPermissions,
): string[] {
  const missing: string[] = [];
  if (!permissions.hasExecute) missing.push(STORAGE_MIGRATION_EXECUTE_PERMISSION);
  if (!permissions.hasCritical) {
    missing.push(STORAGE_MIGRATION_CRITICAL_PERMISSION);
  }
  if (!permissions.canReadBackupEvidence) {
    missing.push(BACKUP_EVIDENCE_READ_PERMISSION);
  }
  return missing;
}

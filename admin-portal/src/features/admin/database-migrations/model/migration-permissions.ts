import { adminCan, type AdminAuthorizationContext } from "@/lib/auth/rbac";
import type { MigrationPermissions } from "../types/database-migrations";

export const MIGRATION_READ_PERMISSION = "admin.migrations.read";
export const MIGRATION_EXECUTE_PERMISSION = "admin.migrations.manage";
export const MIGRATION_CRITICAL_PERMISSION = "admin.migrations.critical";

/**
 * Derives the operator surface's visibility from `/auth/me` permissions.
 *
 * This is presentation only. Every rule below is enforced again by the Gateway
 * route contract and the Worker admin guard; hiding a control never authorizes
 * anything and a `403` is still a real answer rather than an empty state.
 */
export function readMigrationPermissions(
  user: AdminAuthorizationContext | null | undefined,
): MigrationPermissions {
  const canRead = adminCan(user, MIGRATION_READ_PERMISSION);
  const hasExecute = adminCan(user, MIGRATION_EXECUTE_PERMISSION);
  const hasCritical = adminCan(user, MIGRATION_CRITICAL_PERMISSION);

  return {
    canRead,
    hasExecute,
    hasCritical,
    // ALL semantics: the Gateway declares both permissions on every mutating
    // `/migrations/runs*` route, including pause, resume and retry-failed.
    canExecute: hasExecute && hasCritical,
    // The destructive tier the LLD calls out separately. It coincides with
    // `canExecute` under today's route contract and stays correct if the
    // Gateway later relaxes the non-destructive routes to `execute` alone.
    canDestroy: hasExecute && hasCritical,
  };
}

/**
 * The exact permissions an operator is missing, so a read-only surface can say
 * why it is read-only instead of silently omitting every control.
 */
export function missingExecutePermissions(
  permissions: MigrationPermissions,
): string[] {
  const missing: string[] = [];
  if (!permissions.hasExecute) missing.push(MIGRATION_EXECUTE_PERMISSION);
  if (!permissions.hasCritical) missing.push(MIGRATION_CRITICAL_PERMISSION);
  return missing;
}

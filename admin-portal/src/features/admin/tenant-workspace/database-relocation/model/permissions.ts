import { adminCan, type AdminAuthorizationContext } from "@/lib/auth/rbac";

export const TENANT_RELOCATION_READ_PERMISSION = "admin.tenant_relocations.read";
export const TENANT_RELOCATION_EXECUTE_PERMISSION =
  "admin.tenant_relocations.execute";
export const TENANT_RELOCATION_CRITICAL_PERMISSION =
  "admin.tenant_relocations.critical";

export interface TenantRelocationPermissions {
  canRead: boolean;
  hasExecute: boolean;
  hasCritical: boolean;
  canExecute: boolean;
  /** The irreversible source release. Same pair today; named separately
   *  because it is the one command with no rollback behind it. */
  canReleaseSource: boolean;
}

/**
 * Derives this wizard's visible surface from `/auth/me` permissions.
 *
 * Presentation only. The Gateway route contract and the Worker admin guard
 * enforce every rule below again, hiding a control authorizes nothing, and a
 * `403` remains a real answer rather than an empty state.
 */
export function readTenantRelocationPermissions(
  user: AdminAuthorizationContext | null | undefined,
): TenantRelocationPermissions {
  const canRead = adminCan(user, TENANT_RELOCATION_READ_PERMISSION);
  const hasExecute = adminCan(user, TENANT_RELOCATION_EXECUTE_PERMISSION);
  const hasCritical = adminCan(user, TENANT_RELOCATION_CRITICAL_PERMISSION);

  // ALL semantics: the Gateway declares both permissions on `POST
  // /relocations/tenants/:tenantId` and on `POST /:runId/destroy-source`.
  const canExecute = hasExecute && hasCritical;
  return {
    canRead,
    hasExecute,
    hasCritical,
    canExecute,
    canReleaseSource: canExecute,
  };
}

/**
 * The exact permissions an operator is missing, so a read-only surface can say
 * why it is read-only instead of silently omitting the submit.
 */
export function missingRelocationExecutePermissions(
  permissions: TenantRelocationPermissions,
): string[] {
  const missing: string[] = [];
  if (!permissions.hasExecute) missing.push(TENANT_RELOCATION_EXECUTE_PERMISSION);
  if (!permissions.hasCritical) {
    missing.push(TENANT_RELOCATION_CRITICAL_PERMISSION);
  }
  return missing;
}

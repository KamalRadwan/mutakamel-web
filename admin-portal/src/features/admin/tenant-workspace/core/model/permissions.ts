import {
  adminCan,
  adminCanAll,
  ADMIN_RBAC_CRITICAL,
  type AdminAuthorizationContext,
} from "@/lib/auth/rbac";
import type { TenantCorePermissions } from "../types";

export const TENANT_PERMISSION_REQUIREMENTS = {
  read: ["admin.tenants.read"],
  update: ["admin.tenants.update"],
  lifecycle: ADMIN_RBAC_CRITICAL.TENANTS_SUSPEND,
  provisioning: ADMIN_RBAC_CRITICAL.TENANTS_REPROVISION,
  softDelete: ADMIN_RBAC_CRITICAL.TENANTS_DELETE,
  restore: ADMIN_RBAC_CRITICAL.TENANTS_RESTORE,
  destroy: ADMIN_RBAC_CRITICAL.TENANTS_DESTROY,
  manageFqdns: ADMIN_RBAC_CRITICAL.TENANTS_MANAGE_FQDNS,
} as const;

export function readTenantCorePermissions(
  user: AdminAuthorizationContext | null | undefined,
): TenantCorePermissions {
  return {
    canRead: adminCan(user, TENANT_PERMISSION_REQUIREMENTS.read[0]),
    canUpdate: adminCan(user, TENANT_PERMISSION_REQUIREMENTS.update[0]),
    canSuspendOrActivate: adminCanAll(
      user,
      TENANT_PERMISSION_REQUIREMENTS.lifecycle,
    ),
    canReprovisionOrCancel: adminCanAll(
      user,
      TENANT_PERMISSION_REQUIREMENTS.provisioning,
    ),
    canSoftDelete: adminCanAll(
      user,
      TENANT_PERMISSION_REQUIREMENTS.softDelete,
    ),
    canRestore: adminCanAll(
      user,
      TENANT_PERMISSION_REQUIREMENTS.restore,
    ),
    canDestroy: adminCanAll(
      user,
      TENANT_PERMISSION_REQUIREMENTS.destroy,
    ),
    canValidateFqdn:
      adminCan(user, "admin.tenants.create") ||
      adminCan(user, "admin.tenants.manage_fqdns"),
    canManageFqdns: adminCanAll(
      user,
      TENANT_PERMISSION_REQUIREMENTS.manageFqdns,
    ),
  };
}

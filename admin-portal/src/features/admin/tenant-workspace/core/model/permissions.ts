import {
  adminCan,
  adminCanAll,
  type AdminAuthorizationContext,
} from "@/lib/auth/rbac";
import type { TenantCorePermissions } from "../types";

export const TENANT_PERMISSION_REQUIREMENTS = {
  read: ["admin.tenants.read"],
  update: ["admin.tenants.update"],
  lifecycle: ["admin.tenants.suspend", "admin.tenants.critical"],
  provisioning: ["admin.tenants.reprovision", "admin.tenants.critical"],
  softDelete: ["admin.tenants.delete", "admin.tenants.critical"],
  destroy: ["admin.tenants.destroy", "admin.tenants.critical"],
  manageFqdns: ["admin.tenants.manage_fqdns", "admin.tenants.critical"],
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

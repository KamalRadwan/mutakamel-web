import {
  adminCan,
  adminCanAll,
  ADMIN_RBAC_CRITICAL,
  type AdminAuthorizationContext,
} from "@/lib/auth/rbac";
import type { ProvisioningPermissions } from "../types";

export const PROVISIONING_PERMISSION_REQUIREMENTS = {
  read: ["admin.tenants.read"],
  retryOrCancel: [
    "admin.tenants.read",
    ...ADMIN_RBAC_CRITICAL.TENANTS_REPROVISION,
  ],
  // Gateway `core.admin.tenants.operations.resync`: the same pair as retry
  // and cancel, although the command changes nothing by itself.
  resync: [
    "admin.tenants.read",
    ...ADMIN_RBAC_CRITICAL.TENANTS_REPROVISION,
  ],
  applyUpdates: ADMIN_RBAC_CRITICAL.PROVISIONING_TENANT_UPDATE,
  readPrerequisites: ["admin.provisioning.prerequisites.read"],
  requestPrerequisites: ADMIN_RBAC_CRITICAL.PROVISIONING_PREREQUISITES_REQUEST,
  closeFailed: ADMIN_RBAC_CRITICAL.PROVISIONING_TENANT_UPDATE,
  addApplication: ADMIN_RBAC_CRITICAL.PROVISIONING_ADD_APPLICATION,
  repair: ADMIN_RBAC_CRITICAL.PROVISIONING_REPAIR,
  decommission: ADMIN_RBAC_CRITICAL.PROVISIONING_DECOMMISSION,
  resolveConflicts: ADMIN_RBAC_CRITICAL.PROVISIONING_CONFLICTS_RESOLVE,
} as const;

export function deriveProvisioningPermissions(
  user: AdminAuthorizationContext | null | undefined,
): ProvisioningPermissions {
  return {
    canResendRelease: adminCanAll(user, PROVISIONING_PERMISSION_REQUIREMENTS.requestPrerequisites),
    canCloseFailed: adminCanAll(user, PROVISIONING_PERMISSION_REQUIREMENTS.closeFailed),
    canReadOperations: adminCan(user, PROVISIONING_PERMISSION_REQUIREMENTS.read[0]),
    canRetryOrCancel: adminCanAll(
      user,
      PROVISIONING_PERMISSION_REQUIREMENTS.retryOrCancel,
    ),
    canResync: adminCanAll(user, PROVISIONING_PERMISSION_REQUIREMENTS.resync),
    canApplyUpdates: adminCanAll(
      user,
      PROVISIONING_PERMISSION_REQUIREMENTS.applyUpdates,
    ),
    canReadPrerequisites: adminCanAll(
      user,
      PROVISIONING_PERMISSION_REQUIREMENTS.readPrerequisites,
    ),
    canRequestPrerequisites: adminCanAll(
      user,
      PROVISIONING_PERMISSION_REQUIREMENTS.requestPrerequisites,
    ),
    canAddApplication: adminCanAll(
      user,
      PROVISIONING_PERMISSION_REQUIREMENTS.addApplication,
    ),
    canRepair: adminCanAll(user, PROVISIONING_PERMISSION_REQUIREMENTS.repair),
    canDecommission: adminCanAll(
      user,
      PROVISIONING_PERMISSION_REQUIREMENTS.decommission,
    ),
    canResolveConflicts: adminCanAll(
      user,
      PROVISIONING_PERMISSION_REQUIREMENTS.resolveConflicts,
    ),
  };
}

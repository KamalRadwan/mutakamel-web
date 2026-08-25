import {
  adminCan,
  adminCanAll,
  type AdminAuthorizationContext,
} from "@/lib/auth/rbac";
import type { ProvisioningPermissions } from "../types";

export const PROVISIONING_PERMISSION_REQUIREMENTS = {
  read: ["admin.tenants.read"],
  retryOrCancel: [
    "admin.tenants.read",
    "admin.tenants.reprovision",
    "admin.tenants.critical",
  ],
  applyUpdates: [
    "admin.tenants.reprovision",
    "admin.tenants.critical",
    "admin.provisioning.critical",
  ],
  readPrerequisites: ["admin.provisioning.prerequisites.read"],
  requestPrerequisites: [
    "admin.provisioning.prerequisites.request",
    "admin.provisioning.critical",
  ],
  addApplication: [
    "admin.provisioning.add-application",
    "admin.provisioning.critical",
  ],
  repair: [
    "admin.provisioning.repair",
    "admin.provisioning.critical",
  ],
  decommission: [
    "admin.provisioning.decommission",
    "admin.provisioning.critical",
  ],
  resolveConflicts: [
    "admin.provisioning.conflicts.resolve",
    "admin.provisioning.critical",
  ],
} as const;

export function deriveProvisioningPermissions(
  user: AdminAuthorizationContext | null | undefined,
): ProvisioningPermissions {
  return {
    canReadOperations: adminCan(user, PROVISIONING_PERMISSION_REQUIREMENTS.read[0]),
    canRetryOrCancel: adminCanAll(
      user,
      PROVISIONING_PERMISSION_REQUIREMENTS.retryOrCancel,
    ),
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

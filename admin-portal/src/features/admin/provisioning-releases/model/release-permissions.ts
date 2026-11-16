import { adminCan, adminCanAll, ADMIN_RBAC_CRITICAL, type AdminAuthorizationContext } from "@/lib/auth/rbac";
import type { ReleasePermissions } from "../types/provisioning-releases";

export function readReleasePermissions(
  user: AdminAuthorizationContext | null | undefined,
): ReleasePermissions {
  return {
    canRead: adminCan(user, "admin.provisioning.releases.read"),
    canManageDrafts: adminCan(user, "admin.provisioning.releases.publish"),
    canPublishCritical: adminCanAll(user, ADMIN_RBAC_CRITICAL.PROVISIONING_RELEASE_PUBLISH),
    canRetireCritical: adminCanAll(user, ADMIN_RBAC_CRITICAL.PROVISIONING_RELEASE_RETIRE),
  };
}

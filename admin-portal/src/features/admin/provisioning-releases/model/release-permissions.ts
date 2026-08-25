import { adminCan, adminCanAll, type AdminAuthorizationContext } from "@/lib/auth/rbac";
import type { ReleasePermissions } from "../types/provisioning-releases";

export function readReleasePermissions(
  user: AdminAuthorizationContext | null | undefined,
): ReleasePermissions {
  return {
    canRead: adminCan(user, "admin.provisioning.releases.read"),
    canManageDrafts: adminCan(user, "admin.provisioning.releases.publish"),
    canPublishCritical: adminCanAll(user, [
      "admin.provisioning.releases.publish",
      "admin.provisioning.critical",
    ]),
    canRetireCritical: adminCanAll(user, [
      "admin.provisioning.releases.retire",
      "admin.provisioning.critical",
    ]),
  };
}

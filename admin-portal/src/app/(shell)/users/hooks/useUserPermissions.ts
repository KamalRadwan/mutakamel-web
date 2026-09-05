import { useAuth } from "@/context/AuthContext";
import { adminCan, adminCanAll, ADMIN_RBAC_CRITICAL, type AdminAuthorizationContext } from "@/lib/auth/rbac";
import type { AdminUserStatus } from "../types";

export interface UserPermissionsResult {
  canView: boolean;
  canInvite: boolean;
  canEdit: boolean;
  canAssignRole: boolean;
  canSuspend: boolean;
  canActivate: boolean;
  canDelete: boolean;
  canViewWebphone: boolean;
  canEditWebphone: boolean;
  canViewRoles: boolean;
  isSelf: boolean;
  isCurrentSuperAdmin: boolean;
}

export function getUserRowPermissions(
  currentUser: (AdminAuthorizationContext & { id?: string }) | null | undefined,
  targetUserId?: string | null,
  targetStatus?: AdminUserStatus | null
): UserPermissionsResult {
  const isCurrentSuperAdmin = currentUser?.isSuperAdmin === true;
  const isSelf = Boolean(
    currentUser && targetUserId && currentUser.id === targetUserId
  );

  const canView = adminCan(currentUser, "admin.users.read");
  const canInvite = adminCanAll(currentUser, ADMIN_RBAC_CRITICAL.USERS_INVITE);
  const canEdit = adminCanAll(currentUser, ADMIN_RBAC_CRITICAL.USERS_UPDATE);
  const canAssignRole = adminCanAll(
    currentUser,
    ADMIN_RBAC_CRITICAL.USERS_ASSIGN_ROLES
  );
  const canSuspendBase = adminCanAll(
    currentUser,
    ADMIN_RBAC_CRITICAL.USERS_SUSPEND
  );
  const canDeleteBase = adminCanAll(
    currentUser,
    ADMIN_RBAC_CRITICAL.USERS_DELETE
  );

  const canViewRoles = adminCan(currentUser, "admin.roles.read");
  // A user's WebPhone identity is served by the WebPhone module, whose routes
  // ask for its own permissions — admin.users.* no longer opens that door, and
  // the module's writes carry no `critical` companion.
  const canViewWebphone = adminCan(currentUser, "admin.webphone.read");
  const canEditWebphone = adminCan(currentUser, "admin.webphone.update");

  const isInvited = targetStatus === "INVITED";
  const canSuspend = canSuspendBase && !isSelf && !isInvited && targetStatus === "ACTIVE";
  const canActivate = canSuspendBase && !isSelf && !isInvited && targetStatus === "SUSPENDED";
  const canDelete = canDeleteBase && !isSelf;

  return {
    canView,
    canInvite,
    canEdit,
    canAssignRole,
    canSuspend,
    canActivate,
    canDelete,
    canViewWebphone,
    canEditWebphone,
    canViewRoles,
    isSelf,
    isCurrentSuperAdmin,
  };
}

export function useUserPermissions(
  targetUserId?: string | null,
  targetStatus?: AdminUserStatus | null
): UserPermissionsResult {
  const { user: currentUser } = useAuth();
  return getUserRowPermissions(currentUser, targetUserId, targetStatus);
}

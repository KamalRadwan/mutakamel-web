import { useAuth } from "@/context/AuthContext";
import { adminCan, adminCanAll, ADMIN_RBAC_CRITICAL } from "@/lib/auth/rbac";
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

export function useUserPermissions(
  targetUserId?: string | null,
  targetStatus?: AdminUserStatus | null
): UserPermissionsResult {
  const { user: currentUser } = useAuth();

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
  const canViewWebphone = adminCan(currentUser, "admin.users.read");
  const canEditWebphone = adminCanAll(
    currentUser,
    ADMIN_RBAC_CRITICAL.USERS_UPDATE
  );

  // Status and Self-action Gating
  const isInvited = targetStatus === "INVITED";

  // Cannot suspend or delete self; cannot suspend an INVITED user
  const canSuspend = canSuspendBase && !isSelf && !isInvited && targetStatus === "ACTIVE";
  
  // Cannot activate self; cannot activate an INVITED user
  const canActivate = canSuspendBase && !isSelf && !isInvited && targetStatus === "SUSPENDED";

  // Cannot delete self
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

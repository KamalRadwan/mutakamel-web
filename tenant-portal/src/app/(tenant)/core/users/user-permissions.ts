import { can, type PermissionScope } from "@/lib/auth/permission-scope";
import type { TenantUser } from "../contracts/user-contract";

export interface UserPermissionActor {
  id?: string;
  isTenantOwner?: boolean;
  permissions: readonly string[];
  permissionScopes?: Record<string, PermissionScope>;
}

export type UserRowAction =
  | "suspend"
  | "activate"
  | "delete"
  | "revokeSessions"
  | "resendInvite";

export interface AllowedUserActions {
  edit: boolean;
  suspend: boolean;
  activate: boolean;
  revokeSessions: boolean;
  resendInvite: boolean;
  delete: boolean;
  reason: "ownerProtected" | "selfProtected" | null;
}

const INVITE_PLACEMENT_PERMISSIONS = [
  "org.company.read",
  "org.branch.read",
  "org.department.read",
] as const;

export function canOpenUserInvite(
  actor: UserPermissionActor | null | undefined,
): boolean {
  return can(actor, "users.user.invite");
}

export function canInviteWithPlacement(
  actor: UserPermissionActor | null | undefined,
): boolean {
  return INVITE_PLACEMENT_PERMISSIONS.every((key) => can(actor, key));
}

/**
 * Mirrors `TenantUsersService.prepareInvitation`: inviting requires
 * `users.user.invite` covering `dto.branchId`.
 */
export function canSubmitUserInvite(
  actor: UserPermissionActor | null | undefined,
  branchId: string,
): boolean {
  return Boolean(branchId) && can(actor, "users.user.invite", { branchId });
}

/**
 * Mirrors `TenantUsersService` target guards (`assertNotSelf`, `assertNotOwner`,
 * valid source lifecycle status, and `assertCanAccessBranch(user.branchId, ...)`
 * via `can(actor, permissionKey, { branchId: user.branchId })`).
 *
 * Client checks are advisory; Core remains authoritative (including target
 * grant containment in `assertTargetAuthorityCovered`).
 */
export function allowedUserActions(
  user: TenantUser,
  actor: UserPermissionActor | null | undefined,
): AllowedUserActions {
  const isSelf = Boolean(actor?.id && user.id === actor.id);
  const isProtected = user.isTenantOwner || isSelf;
  const targetScope = { branchId: user.branchId };

  return {
    edit: !isProtected && can(actor, "users.user.update", targetScope),
    suspend:
      !isProtected &&
      (user.status === "ACTIVE" || user.status === "INVITED") &&
      can(actor, "users.user.deactivate", targetScope),
    activate:
      !isProtected &&
      user.status === "SUSPENDED" &&
      can(actor, "users.user.deactivate", targetScope),
    revokeSessions:
      !isProtected &&
      user.status !== "DEACTIVATED" &&
      can(actor, "users.user.deactivate", targetScope),
    resendInvite:
      !isProtected &&
      user.status === "INVITED" &&
      can(actor, "users.user.invite", targetScope),
    delete:
      !isProtected &&
      user.status !== "DEACTIVATED" &&
      can(actor, "users.user.delete", targetScope),
    reason: user.isTenantOwner ? "ownerProtected" : isSelf ? "selfProtected" : null,
  };
}

export function canPerformUserAction(
  actor: UserPermissionActor | null | undefined,
  target: TenantUser | null | undefined,
  action: UserRowAction,
): boolean {
  if (!target) return false;
  return allowedUserActions(target, actor)[action];
}

/**
 * Mirrors `TenantUsersService.update`: requires `users.user.update` on both the
 * user's current branch and, when moving branches, the destination `branchId`.
 */
export function canSubmitUserUpdate(
  actor: UserPermissionActor | null | undefined,
  target: TenantUser | null | undefined,
  nextBranchId?: string,
): boolean {
  if (!target || !allowedUserActions(target, actor).edit) return false;
  if (nextBranchId && nextBranchId !== target.branchId) {
    return can(actor, "users.user.update", { branchId: nextBranchId });
  }
  return true;
}

export function canManageUserMemberships(
  actor: UserPermissionActor | null | undefined,
  target: TenantUser | null | undefined,
): boolean {
  if (!target || target.isTenantOwner || target.id === actor?.id) return false;
  return can(actor, "users.user.manage_memberships", { branchId: target.branchId });
}

export function canManageUserModules(
  actor: UserPermissionActor | null | undefined,
  target: TenantUser | null | undefined,
): boolean {
  if (!target || target.id === actor?.id) return false;
  return (
    actor?.isTenantOwner === true ||
    can(actor, "users.user.manage_modules", { branchId: target.branchId })
  );
}

export function canAssignUserRoles(
  actor: UserPermissionActor | null | undefined,
): boolean {
  return actor?.isTenantOwner === true || can(actor, "users.user.assign_roles");
}

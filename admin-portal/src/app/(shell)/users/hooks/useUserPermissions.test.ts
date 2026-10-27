import { describe, expect, it, vi } from "vitest";
import { getUserRowPermissions } from "./useUserPermissions";

vi.mock("@/context/AuthContext", () => ({ useAuth: vi.fn() }));

const actor = {
  id: "actor",
  isSuperAdmin: false,
  permissions: ["admin.users.assign_roles", "admin.users.critical"],
};

const manager = {
  ...actor,
  permissions: [
    "admin.users.read", "admin.users.invite", "admin.users.update",
    "admin.users.assign_roles", "admin.users.suspend", "admin.users.delete",
    "admin.users.critical", "admin.webphone.read", "admin.webphone.update",
  ],
};

describe("protected super-admin targets", () => {
  it.each(["ACTIVE", "SUSPENDED", "INVITED", "DEACTIVATED"] as const)(
    "blocks delegated user-management actions for a %s super admin",
    (status) => {
      expect(getUserRowPermissions(manager, "target", status, true)).toMatchObject({
        isProtectedTarget: true,
        canEdit: false,
        canAssignRole: false,
        canSuspend: false,
        canActivate: false,
        canDelete: false,
        canResendInvite: false,
        canView: true,
        canInvite: true,
        canViewWebphone: true,
        canEditWebphone: true,
      });
    },
  );

  it.each([
    { isSuperAdmin: false, targetIsSuperAdmin: false },
    { isSuperAdmin: true, targetIsSuperAdmin: true },
  ])("preserves authorized actions for actor/target %o", ({ isSuperAdmin, targetIsSuperAdmin }) => {
    const currentUser = { ...manager, isSuperAdmin };
    expect(getUserRowPermissions(currentUser, "target", "ACTIVE", targetIsSuperAdmin)).toMatchObject({
      isProtectedTarget: false,
      canEdit: true,
      canAssignRole: true,
      canSuspend: true,
      canDelete: true,
    });
    expect(getUserRowPermissions(currentUser, "target", "SUSPENDED", targetIsSuperAdmin).canActivate).toBe(true);
    expect(getUserRowPermissions(currentUser, "target", "INVITED", targetIsSuperAdmin).canResendInvite).toBe(true);
  });

  it("keeps permission and self-action restrictions", () => {
    expect(getUserRowPermissions({ ...manager, permissions: [] }, "target", "ACTIVE", false))
      .toMatchObject({ canEdit: false, canAssignRole: false, canSuspend: false, canDelete: false });
    expect(getUserRowPermissions({ ...manager, isSuperAdmin: true }, "actor", "ACTIVE", true))
      .toMatchObject({ isProtectedTarget: false, canSuspend: false, canDelete: false });
  });
});

describe("admin user role assignment permissions", () => {
  it('exposes resend only for another INVITED user with both invite permissions', () => {
    const inviter = { ...actor, permissions: ['admin.users.invite', 'admin.users.critical'] };
    expect(getUserRowPermissions(inviter, 'target', 'INVITED').canResendInvite).toBe(true);
    expect(getUserRowPermissions(inviter, 'actor', 'INVITED').canResendInvite).toBe(false);
    for (const status of ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'] as const) {
      expect(getUserRowPermissions(inviter, 'target', status).canResendInvite).toBe(false);
    }
    for (const permission of inviter.permissions) {
      expect(getUserRowPermissions({ ...inviter, permissions: [permission] }, 'target', 'INVITED').canResendInvite).toBe(false);
    }
  });
  it("allows an active target only with both required permissions", () => {
    expect(getUserRowPermissions(actor, "target", "ACTIVE").canAssignRole).toBe(true);
    for (const permission of actor.permissions) {
      expect(getUserRowPermissions({
        ...actor,
        permissions: [permission],
      }, "target", "ACTIVE").canAssignRole).toBe(false);
    }
  });

  it.each(["INVITED", "SUSPENDED", "DEACTIVATED", null, undefined] as const)(
    "hides role assignment for target status %s, including for super admins",
    (status) => {
      expect(getUserRowPermissions(actor, "target", status).canAssignRole).toBe(false);
      expect(getUserRowPermissions({
        ...actor,
        isSuperAdmin: true,
      }, "target", status).canAssignRole).toBe(false);
    },
  );
});

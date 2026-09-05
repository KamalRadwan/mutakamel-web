// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  authLoading: false,
  listUsers: vi.fn(),
  summarizeUsers: vi.fn(),
  listRoles: vi.fn(),
  listBranches: vi.fn(),
  listDepartments: vi.fn(),
  listTeams: vi.fn(),
  getUser: vi.fn(),
  inviteUser: vi.fn(),
  updateUser: vi.fn(),
  resetPassword: vi.fn(),
  resendInvite: vi.fn(),
  transferOwnership: vi.fn(),
  changePassword: vi.fn(),
  suspendUser: vi.fn(),
  activateUser: vi.fn(),
  replaceRoles: vi.fn(),
  deleteUser: vi.fn(),
  restoreUser: vi.fn(),
  uuid: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { isSuperAdmin: false, permissions: mocks.permissions },
    isLoading: mocks.authLoading,
  }),
}));
vi.mock("@/lib/auth/rbac", () => ({
  adminCanAll: (_user: unknown, required: readonly string[]) =>
    required.every((permission) => mocks.permissions.includes(permission)),
}));
vi.mock("@/lib/utils/uuid", () => ({ generateUUIDv7: mocks.uuid }));
vi.mock("./api", async () => {
  const actual = await vi.importActual<typeof import("./api")>("./api");
  return {
    toTenantUserSummaryQuery: actual.toTenantUserSummaryQuery,
    tenantAccessApi: {
      listUsers: mocks.listUsers,
      summarizeUsers: mocks.summarizeUsers,
      listRoles: mocks.listRoles,
      listBranches: mocks.listBranches,
      listDepartments: mocks.listDepartments,
      listTeams: mocks.listTeams,
      getUser: mocks.getUser,
      inviteUser: mocks.inviteUser,
      updateUser: mocks.updateUser,
      resetPassword: mocks.resetPassword,
      resendInvite: mocks.resendInvite,
      transferOwnership: mocks.transferOwnership,
      changePassword: mocks.changePassword,
      suspendUser: mocks.suspendUser,
      activateUser: mocks.activateUser,
      replaceRoles: mocks.replaceRoles,
      deleteUser: mocks.deleteUser,
      restoreUser: mocks.restoreUser,
    },
  };
});

import { useTenantAccess } from "./use-tenant-access";
import { TENANT_ACCESS_PERMISSION_SETS } from "./types";
import type { TenantStatus } from "../core/types";
import {
  BRANCH_ID,
  COMMAND_ID,
  DEPARTMENT_ID,
  ROLE_ID,
  TENANT_ID,
  USER_ID,
  branchFixture,
  departmentFixture,
  pageFixture,
  roleFixture,
  summaryFixture,
  teamFixture,
  userFixture,
} from "./__tests__/fixtures";

const ALL_PERMISSIONS = Array.from(
  new Set(Object.values(TENANT_ACCESS_PERMISSION_SETS).flat()),
);
const COMMAND_ID_2 = "019ff251-4000-7000-8000-000000000002";
const OTHER_BRANCH_ID = "019ff251-2000-7000-8000-000000000099";
const OWNER_ID = "019ff251-1000-7000-8000-000000000002";
const HEIR_ID = "019ff251-1000-7000-8000-0000000000a1";

describe("useTenantAccess", () => {
  beforeEach(() => {
    mocks.permissions = [...ALL_PERMISSIONS];
    mocks.authLoading = false;
    for (const mock of Object.values(mocks)) {
      if (typeof mock === "function" && "mockReset" in mock) {
        (mock as ReturnType<typeof vi.fn>).mockReset();
      }
    }
    mocks.uuid.mockReturnValueOnce(COMMAND_ID).mockReturnValueOnce(COMMAND_ID_2);
    mocks.listUsers.mockResolvedValue(pageFixture([userFixture()]));
    mocks.summarizeUsers.mockResolvedValue(summaryFixture);
    mocks.listRoles.mockResolvedValue(pageFixture([roleFixture]));
    mocks.listBranches.mockResolvedValue(pageFixture([branchFixture]));
    mocks.listDepartments.mockResolvedValue(pageFixture([departmentFixture]));
    mocks.listTeams.mockResolvedValue(pageFixture([teamFixture]));
    mocks.getUser.mockResolvedValue(userFixture());
    mocks.inviteUser.mockResolvedValue({ user: userFixture(), delivery: "QUEUED" });
    mocks.updateUser.mockResolvedValue(userFixture());
    mocks.resetPassword.mockResolvedValue({ userId: USER_ID, delivery: "QUEUED" });
    mocks.resendInvite.mockResolvedValue({ userId: USER_ID, delivery: "QUEUED" });
    mocks.changePassword.mockResolvedValue(userFixture());
    mocks.suspendUser.mockResolvedValue(userFixture({ status: "SUSPENDED" }));
    mocks.activateUser.mockResolvedValue(userFixture({ status: "ACTIVE" }));
    mocks.replaceRoles.mockResolvedValue(userFixture());
    // The service contract answers a transfer with the *new* owner's view.
    mocks.transferOwnership.mockResolvedValue(
      userFixture({ id: HEIR_ID, isTenantOwner: true }),
    );
    mocks.deleteUser.mockResolvedValue(undefined);
    mocks.restoreUser.mockResolvedValue(
      userFixture({ status: "SUSPENDED", deletedAt: null }),
    );
  });

  it("does not hit tenant-scoped routes before database readiness", async () => {
    const { result, rerender } = renderHook(
      ({ status }) =>
        useTenantAccess({ tenantId: TENANT_ID, tenantStatus: status }),
      { initialProps: { status: "PROVISIONING" as TenantStatus } },
    );
    await waitFor(() => expect(result.current.directory.status).toBe("unavailable"));
    expect(result.current.directory.error?.errorCode).toBe(
      "TENANT_DATABASE_NOT_READY",
    );
    expect(mocks.listUsers).not.toHaveBeenCalled();
    expect(mocks.summarizeUsers).not.toHaveBeenCalled();
    expect(mocks.listBranches).not.toHaveBeenCalled();
    expect(mocks.listRoles).not.toHaveBeenCalled();

    rerender({ status: "ACTIVE" });
    await waitFor(() => expect(mocks.listUsers).toHaveBeenCalledTimes(1));
    expect(mocks.summarizeUsers).toHaveBeenCalledTimes(1);
  });

  it("gates reads and each critical permission set", async () => {
    mocks.permissions = [
      "admin.tenant_users.read",
      "admin.tenant_users.invite",
      "admin.tenant_users.assign_roles",
    ];
    const { result, rerender } = renderHook(() =>
      useTenantAccess({ tenantId: TENANT_ID, tenantStatus: "ACTIVE" }),
    );
    await waitFor(() => expect(result.current.directory.status).toBe("ready"));
    expect(result.current.permissions).toMatchObject({
      canRead: true,
      canReadRoles: true,
      canInvite: false,
      canAssignRoles: false,
      canResetPassword: false,
    });
    expect(mocks.listBranches).toHaveBeenCalledTimes(1);
    expect(mocks.listRoles).toHaveBeenCalledTimes(1);
    mocks.permissions = ["admin.tenant_users.read"];
    rerender();
    await act(async () => result.current.loadRoles());
    expect(result.current.roles.status).toBe("forbidden");
  });

  it("makes no reads without the read permission", async () => {
    mocks.permissions = [];
    const { result } = renderHook(() =>
      useTenantAccess({ tenantId: TENANT_ID, tenantStatus: "ACTIVE" }),
    );
    await waitFor(() => expect(result.current.directory.status).toBe("forbidden"));
    expect(mocks.listUsers).not.toHaveBeenCalled();
    expect(mocks.summarizeUsers).not.toHaveBeenCalled();
  });

  it("loads directory, matching summary filters, and independent catalogues", async () => {
    const { result } = renderHook(() =>
      useTenantAccess({ tenantId: TENANT_ID, tenantStatus: "SUSPENDED" }),
    );
    await waitFor(() => expect(result.current.directory.status).toBe("ready"));
    await waitFor(() => expect(result.current.summary.status).toBe("ready"));
    expect(mocks.listUsers).toHaveBeenCalledWith(
      TENANT_ID,
      expect.objectContaining({ page: 1, limit: 20, visibility: "ACTIVE" }),
      expect.any(AbortSignal),
    );
    expect(mocks.summarizeUsers).toHaveBeenCalledWith(
      TENANT_ID,
      expect.objectContaining({ visibility: "ACTIVE" }),
      expect.any(AbortSignal),
    );
    expect(mocks.summarizeUsers.mock.calls[0]?.[1]).not.toHaveProperty("page");
    expect(mocks.listBranches).toHaveBeenCalledTimes(1);
    expect(mocks.listRoles).toHaveBeenCalledTimes(1);

    act(() =>
      result.current.setQuery((current) => ({
        ...current,
        page: 3,
        q: "mona",
        role: ROLE_ID,
        visibility: "ALL",
      })),
    );
    await waitFor(() => expect(mocks.listUsers).toHaveBeenCalledTimes(3));
    expect(mocks.summarizeUsers.mock.calls.at(-1)?.[1]).toMatchObject({
      q: "mona",
      role: ROLE_ID,
      visibility: "ALL",
    });
  });

  it("keeps summary usable when the directory reports database-not-ready", async () => {
    mocks.listUsers.mockRejectedValueOnce({
      response: {
        status: 503,
        data: {
          success: false,
          statusCode: 503,
          errorCode: "TENANT_DATABASE_NOT_READY",
          errorCategory: "SERVER_ERROR",
          message: "Tenant database is not ready yet.",
        },
      },
    });
    const { result } = renderHook(() =>
      useTenantAccess({ tenantId: TENANT_ID, tenantStatus: "ACTIVE" }),
    );
    await waitFor(() => expect(result.current.directory.status).toBe("unavailable"));
    expect(result.current.summary.status).toBe("ready");
    expect(result.current.summary.data).toEqual(summaryFixture);
  });

  it("reuses a caller-owned command identity for an exact failed retry", async () => {
    mocks.inviteUser
      .mockRejectedValueOnce(new Error("network lost"))
      .mockResolvedValueOnce({ user: userFixture(), delivery: "QUEUED" })
      .mockResolvedValueOnce({ user: userFixture(), delivery: "QUEUED" });
    const { result } = renderHook(() =>
      useTenantAccess({ tenantId: TENANT_ID, tenantStatus: "ACTIVE" }),
    );
    await waitFor(() => expect(result.current.directory.status).toBe("ready"));
    const input = {
      email: "mona@example.test",
      firstName: "Mona",
      lastName: "Ali",
      companyId: branchFixture.company.id,
      branchId: BRANCH_ID,
      departmentId: DEPARTMENT_ID,
    };
    await act(async () => {
      await expect(result.current.inviteUser(input)).rejects.toMatchObject({
        errorCode: "UNKNOWN_ERROR",
      });
    });
    await act(async () => {
      await result.current.inviteUser(input);
    });
    expect(mocks.inviteUser.mock.calls[0]?.[2]).toBe(COMMAND_ID);
    expect(mocks.inviteUser.mock.calls[1]?.[2]).toBe(COMMAND_ID);

    await act(async () => {
      await result.current.inviteUser(input);
    });
    expect(mocks.inviteUser.mock.calls[2]?.[2]).toBe(COMMAND_ID_2);
  });

  it("retains the command identity after an ambiguous 503 response", async () => {
    mocks.inviteUser
      .mockRejectedValueOnce({
        response: {
          status: 503,
          data: {
            success: false,
            statusCode: 503,
            errorCode: "TENANT_DATABASE_NOT_READY",
            errorCategory: "SERVER_ERROR",
            message: "Tenant database is not ready yet.",
          },
        },
      })
      .mockResolvedValueOnce({ user: userFixture(), delivery: "QUEUED" });
    const { result } = renderHook(() =>
      useTenantAccess({ tenantId: TENANT_ID, tenantStatus: "ACTIVE" }),
    );
    await waitFor(() => expect(result.current.directory.status).toBe("ready"));
    const input = {
      email: "mona@example.test",
      firstName: "Mona",
      lastName: "Ali",
      companyId: branchFixture.company.id,
      branchId: BRANCH_ID,
      departmentId: DEPARTMENT_ID,
    };

    await act(async () => {
      await expect(result.current.inviteUser(input)).rejects.toMatchObject({
        httpStatus: 503,
        errorCode: "TENANT_DATABASE_NOT_READY",
      });
    });
    await act(async () => {
      await result.current.inviteUser(input);
    });

    expect(mocks.inviteUser.mock.calls[0]?.[2]).toBe(COMMAND_ID);
    expect(mocks.inviteUser.mock.calls[1]?.[2]).toBe(COMMAND_ID);
  });

  it("rotates the command identity after a deterministic cached conflict", async () => {
    mocks.inviteUser
      .mockRejectedValueOnce({
        response: {
          status: 409,
          data: {
            success: false,
            statusCode: 409,
            errorCode: "TENANT_USER_EMAIL_CONFLICT",
            errorCategory: "CONFLICT",
            message: "A tenant user already has this email.",
          },
        },
      })
      .mockResolvedValueOnce({ user: userFixture(), delivery: "QUEUED" });
    const { result } = renderHook(() =>
      useTenantAccess({ tenantId: TENANT_ID, tenantStatus: "ACTIVE" }),
    );
    await waitFor(() => expect(result.current.directory.status).toBe("ready"));
    const input = {
      email: "mona@example.test",
      firstName: "Mona",
      lastName: "Ali",
      companyId: branchFixture.company.id,
      branchId: BRANCH_ID,
      departmentId: DEPARTMENT_ID,
    };

    await act(async () => {
      await expect(result.current.inviteUser(input)).rejects.toMatchObject({
        httpStatus: 409,
        errorCode: "TENANT_USER_EMAIL_CONFLICT",
      });
    });
    await act(async () => {
      await result.current.inviteUser(input);
    });

    expect(mocks.inviteUser.mock.calls[0]?.[2]).toBe(COMMAND_ID);
    expect(mocks.inviteUser.mock.calls[1]?.[2]).toBe(COMMAND_ID_2);
  });

  // Owner protection is per action: what is refused is the pair with no way
  // back (identity and roles) plus deletion. Lifecycle and credentials are the
  // operator's only route to an owner who cannot get in, so they go through.
  it("protects owner identity, roles, and deletion — and nothing else", async () => {
    const owner = userFixture({ id: "019ff251-1000-7000-8000-000000000002", isTenantOwner: true });
    const { result } = renderHook(() =>
      useTenantAccess({ tenantId: TENANT_ID, tenantStatus: "ACTIVE" }),
    );
    await waitFor(() => expect(result.current.directory.status).toBe("ready"));
    await act(async () => {
      await expect(result.current.updateUser(owner, { firstName: "Owner" })).rejects.toMatchObject({ errorCode: "TENANT_OWNER_PROTECTED" });
      await expect(result.current.replaceRoles(owner, { assignments: [] })).rejects.toMatchObject({ errorCode: "TENANT_OWNER_PROTECTED" });
      await expect(result.current.deleteUser(owner)).rejects.toMatchObject({ errorCode: "TENANT_OWNER_PROTECTED" });
    });
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.replaceRoles).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("lets the owner be suspended, activated, and re-credentialed", async () => {
    const owner = userFixture({ id: "019ff251-1000-7000-8000-000000000002", isTenantOwner: true });
    const { result } = renderHook(() =>
      useTenantAccess({ tenantId: TENANT_ID, tenantStatus: "ACTIVE" }),
    );
    await waitFor(() => expect(result.current.directory.status).toBe("ready"));
    await act(async () => {
      await result.current.suspendUser(owner);
    });
    expect(mocks.suspendUser).toHaveBeenCalledTimes(1);
  });

  it("moves the owner seat through transferOwnership", async () => {
    const owner = userFixture({ id: "019ff251-1000-7000-8000-000000000002", isTenantOwner: true });
    const heir = "019ff251-1000-7000-8000-0000000000a1";
    const { result } = renderHook(() =>
      useTenantAccess({ tenantId: TENANT_ID, tenantStatus: "ACTIVE" }),
    );
    await waitFor(() => expect(result.current.directory.status).toBe("ready"));
    await act(async () => {
      await result.current.transferOwnership(owner, heir);
    });
    expect(mocks.transferOwnership).toHaveBeenCalledWith(
      TENANT_ID,
      owner.id,
      heir,
      expect.any(String),
    );
  });

  // The transfer answers with the destination's view, so the generic readback
  // — which only replaces the selected detail when the ids match — leaves the
  // former owner's open detail showing the seat it no longer holds.
  it("reloads the former owner's open detail after the seat moves", async () => {
    const owner = userFixture({ id: OWNER_ID, isTenantOwner: true });
    mocks.getUser
      .mockResolvedValueOnce(owner)
      .mockResolvedValueOnce(userFixture({ id: OWNER_ID, isTenantOwner: false }));
    const { result } = renderHook(() =>
      useTenantAccess({ tenantId: TENANT_ID, tenantStatus: "ACTIVE" }),
    );
    await waitFor(() => expect(result.current.directory.status).toBe("ready"));

    await act(async () => {
      await result.current.loadUser(OWNER_ID);
    });
    expect(result.current.selectedUser.data?.isTenantOwner).toBe(true);

    await act(async () => {
      await result.current.transferOwnership(owner, HEIR_ID);
    });

    await waitFor(() => {
      expect(result.current.selectedUser.data?.id).toBe(OWNER_ID);
      expect(result.current.selectedUser.data?.isTenantOwner).toBe(false);
    });
    expect(mocks.getUser).toHaveBeenCalledTimes(2);
    expect(mocks.getUser).toHaveBeenLastCalledWith(
      TENANT_ID,
      OWNER_ID,
      expect.any(AbortSignal),
    );
  });

  it("leaves an unrelated open detail alone when the seat moves", async () => {
    const owner = userFixture({ id: OWNER_ID, isTenantOwner: true });
    const bystander = userFixture();
    mocks.getUser.mockResolvedValue(bystander);
    const { result } = renderHook(() =>
      useTenantAccess({ tenantId: TENANT_ID, tenantStatus: "ACTIVE" }),
    );
    await waitFor(() => expect(result.current.directory.status).toBe("ready"));

    await act(async () => {
      await result.current.loadUser(bystander.id);
    });
    await act(async () => {
      await result.current.transferOwnership(owner, HEIR_ID);
    });

    expect(result.current.selectedUser.data?.id).toBe(bystander.id);
    expect(mocks.getUser).toHaveBeenCalledTimes(1);
  });

  it("refuses to transfer ownership from a user who does not hold it", async () => {
    const member = userFixture({ isTenantOwner: false });
    const { result } = renderHook(() =>
      useTenantAccess({ tenantId: TENANT_ID, tenantStatus: "ACTIVE" }),
    );
    await waitFor(() => expect(result.current.directory.status).toBe("ready"));
    await act(async () => {
      await expect(
        result.current.transferOwnership(member, "019ff251-1000-7000-8000-0000000000a1"),
      ).rejects.toMatchObject({ errorCode: "TENANT_OWNER_TRANSFER_INVALID" });
    });
    expect(mocks.transferOwnership).not.toHaveBeenCalled();
  });

  it("enforces lifecycle predicates before transport", async () => {
    const invited = userFixture({ status: "INVITED" });
    const deleted = userFixture({ status: "DEACTIVATED", deletedAt: "2026-08-11T20:00:00.000Z" });
    const { result } = renderHook(() =>
      useTenantAccess({ tenantId: TENANT_ID, tenantStatus: "ACTIVE" }),
    );
    await waitFor(() => expect(result.current.directory.status).toBe("ready"));
    await act(async () => {
      await expect(result.current.resetPassword(invited)).rejects.toMatchObject({ errorCode: "TENANT_USER_PASSWORD_RESET_UNAVAILABLE" });
      await expect(result.current.activateUser(userFixture())).rejects.toMatchObject({ errorCode: "TENANT_USER_ACTIVATE_UNAVAILABLE" });
      await expect(result.current.restoreUser(userFixture())).rejects.toMatchObject({ errorCode: "TENANT_USER_NOT_DELETED" });
      await result.current.resendInvite(invited);
      await result.current.restoreUser(deleted);
    });
    expect(mocks.resetPassword).not.toHaveBeenCalled();
    expect(mocks.activateUser).not.toHaveBeenCalled();
    expect(mocks.resendInvite).toHaveBeenCalledTimes(1);
    expect(mocks.restoreUser).toHaveBeenCalledTimes(1);
  });

  it("clears the dependent team catalogue when the branch changes", async () => {
    const { result } = renderHook(() =>
      useTenantAccess({ tenantId: TENANT_ID, tenantStatus: "ACTIVE" }),
    );
    await waitFor(() => expect(result.current.directory.status).toBe("ready"));
    await act(async () => {
      await result.current.loadTeams({ departmentId: DEPARTMENT_ID, page: 1, limit: 50 });
    });
    expect(result.current.teams.status).toBe("ready");
    await act(async () => {
      await result.current.loadDepartments({ branchId: OTHER_BRANCH_ID, page: 1, limit: 50 });
    });
    expect(result.current.departments.status).toBe("ready");
    expect(result.current.teams.status).toBe("idle");
  });
});

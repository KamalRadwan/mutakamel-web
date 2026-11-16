// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { PermissionScope } from "@/lib/auth/permission-scope";
import {
  deleteTenantUser,
  fetchTenantUsers,
  inviteTenantUser,
  resendTenantUserInvite,
  revokeTenantUserSessions,
  setTenantUserStatus,
  updateTenantUser,
  type TenantUser,
  type UserStatus,
} from "../../contracts/user-contract";
import { userToFormValues } from "../user-payloads";
import { useTenantUsers } from "./useTenantUsers";

const ACTOR_ID = "019f3100-0000-7000-8000-000000000001";
const COMPANY_ID = "019f3100-0000-7000-8000-000000000010";
const BRANCH_A = "019f3100-0000-7000-8000-000000000020";
const BRANCH_B = "019f3100-0000-7000-8000-000000000021";
const DEPT_ID = "019f3100-0000-7000-8000-000000000030";

const DEFAULT_PERMISSIONS = [
  "users.user.read",
  "users.user.invite",
  "users.user.update",
  "users.user.deactivate",
  "users.user.delete",
  "org.company.read",
  "org.branch.read",
  "org.department.read",
] as const;

function buildScopes(
  permissions: readonly string[],
  branchIds?: string[],
): Record<string, PermissionScope> {
  return Object.fromEntries(
    permissions.map((key) => [
      key,
      branchIds
        ? { tenantWide: false, companyIds: [COMPANY_ID], branchIds }
        : { tenantWide: true, companyIds: [], branchIds: [] },
    ]),
  );
}

const authState = vi.hoisted(() => ({
  permissions: [] as string[],
  permissionScopes: {} as Record<string, PermissionScope>,
}));

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({
    user: {
      id: ACTOR_ID,
      permissions: authState.permissions,
      permissionScopes: authState.permissionScopes,
    },
  }),
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));
vi.mock("@/design-system", () => ({
  useRealtimeResync: () => undefined,
}));
vi.mock("../../contracts/user-contract", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../contracts/user-contract")>()),
  fetchTenantUsers: vi.fn(),
  inviteTenantUser: vi.fn(),
  updateTenantUser: vi.fn(),
  resendTenantUserInvite: vi.fn(),
  revokeTenantUserSessions: vi.fn(),
  setTenantUserStatus: vi.fn(),
  deleteTenantUser: vi.fn(),
}));

function makeUser(
  id: string,
  status: UserStatus,
  extra: Partial<TenantUser> = {},
): TenantUser {
  return {
    id,
    email: `${status.toLowerCase()}@example.com`,
    firstName: status,
    lastName: "User",
    employeeCode: null,
    jobTitle: null,
    companyId: COMPANY_ID,
    branchId: BRANCH_A,
    departmentId: DEPT_ID,
    teamId: null,
    managerId: null,
    status,
    isTenantOwner: false,
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-01T10:00:00.000Z",
    ...extra,
  };
}

beforeEach(() => {
  authState.permissions = [...DEFAULT_PERMISSIONS];
  authState.permissionScopes = buildScopes(authState.permissions);
  vi.mocked(fetchTenantUsers).mockResolvedValue({
    items: [],
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useTenantUsers lifecycle mutations, pagination recovery, and branch scope fences", () => {
  it("records honest QUEUED state on resendInvite and clears it when invite is revoked", async () => {
    const invited = makeUser("019f3100-0000-7000-8000-000000000101", "INVITED");
    vi.mocked(fetchTenantUsers).mockResolvedValue({
      items: [invited],
      page: 1,
      limit: 25,
      total: 1,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    });
    vi.mocked(resendTenantUserInvite).mockResolvedValue({ deliveryStatus: "QUEUED" });
    vi.mocked(setTenantUserStatus).mockResolvedValue({ ...invited, status: "SUSPENDED" });

    const { result } = renderHook(() => useTenantUsers());
    await waitFor(() => expect(result.current.rows).toHaveLength(1));

    act(() => result.current.requestAction(invited, "resendInvite"));
    await act(async () => {
      await result.current.confirmAction();
    });

    expect(resendTenantUserInvite).toHaveBeenCalledWith(invited.id);
    expect(result.current.inviteQueuedUser?.id).toBe(invited.id);

    act(() => result.current.requestAction(invited, "suspend"));
    await act(async () => {
      await result.current.confirmAction();
    });
    expect(setTenantUserStatus).toHaveBeenCalledWith(invited.id, "suspend");
    expect(result.current.inviteQueuedUser).toBeNull();
  });

  it("adopts server-returned INVITED status on activate and preserves status on revokeSessions and delete", async () => {
    const suspended = makeUser("019f3100-0000-7000-8000-000000000102", "SUSPENDED");
    const restoredAsInvited: TenantUser = { ...suspended, status: "INVITED" };
    vi.mocked(fetchTenantUsers)
      .mockResolvedValueOnce({
        items: [suspended],
        page: 1,
        limit: 25,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      })
      .mockResolvedValue({
        items: [restoredAsInvited],
        page: 1,
        limit: 25,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
    vi.mocked(setTenantUserStatus).mockResolvedValue(restoredAsInvited);
    vi.mocked(revokeTenantUserSessions).mockResolvedValue(restoredAsInvited);
    vi.mocked(deleteTenantUser).mockResolvedValue(undefined);

    const { result } = renderHook(() => useTenantUsers());
    await waitFor(() => expect(result.current.rows[0]?.status).toBe("SUSPENDED"));

    act(() => result.current.requestAction(suspended, "activate"));
    await act(async () => {
      await result.current.confirmAction();
    });
    expect(setTenantUserStatus).toHaveBeenCalledWith(suspended.id, "activate");
    expect(result.current.rows[0]?.status).toBe("INVITED");

    act(() => result.current.requestAction(restoredAsInvited, "revokeSessions"));
    await act(async () => {
      await result.current.confirmAction();
    });
    expect(revokeTenantUserSessions).toHaveBeenCalledWith(suspended.id);
    expect(result.current.rows[0]?.status).toBe("INVITED");

    act(() => result.current.requestAction(restoredAsInvited, "delete"));
    await act(async () => {
      await result.current.confirmAction();
    });
    expect(deleteTenantUser).toHaveBeenCalledWith(suspended.id);
  });

  it("recovers out-of-range page after delete count shrink while preserving filters/sort, and keeps failed delete context intact", async () => {
    const page2User = makeUser("019f3100-0000-7000-8000-000000000103", "ACTIVE");
    const page3User = makeUser("019f3100-0000-7000-8000-000000000104", "ACTIVE");
    let deleted = false;

    vi.mocked(fetchTenantUsers).mockImplementation(async (params) => {
      if (!deleted) {
        return {
          items: params.page === 3 ? [page3User] : [page2User],
          page: params.page ?? 1,
          limit: 25,
          total: 51,
          totalPages: 3,
          hasNext: (params.page ?? 1) < 3,
          hasPrev: (params.page ?? 1) > 1,
        };
      }
      if (params.page === 3) {
        return {
          items: [],
          page: 3,
          limit: 25,
          total: 50,
          totalPages: 2,
          hasNext: false,
          hasPrev: true,
        };
      }
      return {
        items: [page2User],
        page: 2,
        limit: 25,
        total: 50,
        totalPages: 2,
        hasNext: false,
        hasPrev: true,
      };
    });

    vi.mocked(deleteTenantUser)
      .mockRejectedValueOnce(new Error("Delete failed"))
      .mockImplementationOnce(async () => {
        deleted = true;
      });

    const { result } = renderHook(() => useTenantUsers());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setFilters({ status: "ACTIVE" });
      result.current.setSort({ id: "firstName", direction: "asc" });
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setPage(3));
    await waitFor(() => expect(result.current.pageInfo.page).toBe(3));
    expect(result.current.rows[0]?.id).toBe(page3User.id);

    // Failed delete keeps current page and preserves pendingAction + error for retry
    act(() => result.current.requestAction(page3User, "delete"));
    await act(async () => {
      await result.current.confirmAction();
    });
    expect(result.current.pageInfo.page).toBe(3);
    expect(result.current.pendingAction?.user.id).toBe(page3User.id);
    expect(result.current.mutationError).not.toBeNull();

    // Retry succeeds -> page 3 reloads empty (totalPages: 2) -> recovers to page 2 with filters & sort intact
    await act(async () => {
      await result.current.confirmAction();
    });
    await waitFor(() => expect(result.current.pageInfo.page).toBe(2));
    expect(result.current.rows.map((u) => u.id)).toEqual([page2User.id]);
    expect(fetchTenantUsers).toHaveBeenLastCalledWith(
      expect.objectContaining({
        page: 2,
        filters: { status: "ACTIVE" },
        sortBy: "firstName",
        sortDir: "ASC",
      }),
    );
  });

  it("enforces branch-scoped callback guards, cancels stale confirmations on authority loss, and fences duplicate confirms", async () => {
    authState.permissionScopes = buildScopes(authState.permissions, [BRANCH_A]);
    const branchAUser = makeUser("019f3100-0000-7000-8000-000000000105", "ACTIVE", {
      branchId: BRANCH_A,
    });
    const branchBUser = makeUser("019f3100-0000-7000-8000-000000000106", "ACTIVE", {
      branchId: BRANCH_B,
    });

    vi.mocked(fetchTenantUsers).mockResolvedValue({
      items: [branchAUser, branchBUser],
      page: 1,
      limit: 25,
      total: 2,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    });

    const { result, rerender } = renderHook(() => useTenantUsers());
    await waitFor(() => expect(result.current.rows).toHaveLength(2));

    // Out-of-scope branch B callbacks are rejected directly
    act(() => result.current.openEdit(branchBUser));
    expect(result.current.editingUser).toBeNull();

    act(() => result.current.requestAction(branchBUser, "suspend"));
    expect(result.current.pendingAction).toBeNull();

    let invited = true;
    await act(async () => {
      invited = await result.current.handleInvite({
        email: "b@example.com",
        firstName: "Branch",
        lastName: "B",
        companyId: COMPANY_ID,
        branchId: BRANCH_B,
        departmentId: DEPT_ID,
      });
    });
    expect(invited).toBe(false);
    expect(inviteTenantUser).not.toHaveBeenCalled();

    // Moving an authorized branch-A user into unauthorized branch-B is refused
    act(() => result.current.openEdit(branchAUser));
    expect(result.current.editingUser?.id).toBe(branchAUser.id);
    let updated = true;
    await act(async () => {
      updated = await result.current.handleUpdate({
        ...userToFormValues(branchAUser),
        branchId: BRANCH_B,
      });
    });
    expect(updated).toBe(false);
    expect(updateTenantUser).not.toHaveBeenCalled();
    act(() => result.current.closeEdit());

    // Stale open confirmation after losing `users.user.deactivate` closes without dispatching
    act(() => result.current.requestAction(branchAUser, "suspend"));
    expect(result.current.pendingAction?.user.id).toBe(branchAUser.id);
    authState.permissions = authState.permissions.filter(
      (key) => key !== "users.user.deactivate",
    );
    authState.permissionScopes = buildScopes(authState.permissions, [BRANCH_A]);
    rerender();

    await act(async () => {
      await result.current.confirmAction();
    });
    expect(result.current.pendingAction).toBeNull();
    expect(setTenantUserStatus).not.toHaveBeenCalled();

    // Restore permission and verify rapid duplicate confirm dispatches once
    authState.permissions = [...DEFAULT_PERMISSIONS];
    authState.permissionScopes = buildScopes(authState.permissions, [BRANCH_A]);
    rerender();

    let resolveSuspend: (value: TenantUser) => void = () => undefined;
    vi.mocked(setTenantUserStatus).mockReturnValueOnce(
      new Promise<TenantUser>((resolve) => {
        resolveSuspend = resolve;
      }),
    );

    act(() => result.current.requestAction(branchAUser, "suspend"));
    await act(async () => {
      const first = result.current.confirmAction();
      const second = result.current.confirmAction();
      resolveSuspend({ ...branchAUser, status: "SUSPENDED" });
      await Promise.all([first, second]);
    });
    expect(setTenantUserStatus).toHaveBeenCalledTimes(1);
  });
});

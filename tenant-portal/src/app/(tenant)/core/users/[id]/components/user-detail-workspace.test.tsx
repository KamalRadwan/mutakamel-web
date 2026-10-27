// @vitest-environment jsdom

import { createElement, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TooltipProvider } from "@/design-system";
import { fetchTenantUser, updateTenantUser, type TenantUser } from "../../../contracts/user-contract";
import { fetchTeamMemberships } from "../../../contracts/user-subresource-contract";
import { fetchAssignmentOptions } from "../../../contracts/assignment-options-contract";
import {
  fetchBranchRoleAssignments,
  fetchScopeRoleAssignments,
} from "../../../contracts/role-assignment-contract";
import { useTenantUserDetail } from "../hooks/useTenantUserDetail";
import { UserFormDrawer, type UserFormValues } from "../../components/UserFormDrawer";
import { UserDetailWorkspace } from "./user-detail-workspace";

const ACTOR_ID = "0192f3a0-0000-7000-8000-000000000001";
const OTHER_ID = "0192f3a0-0000-7000-8000-000000000002";
const TEAM_ID = "0192f3a0-0000-7000-8000-000000000003";
const NEXT_ID = "0192f3a0-0000-7000-8000-000000000004";

const moduleAuthority = vi.hoisted(() => ({ canManage: false, isOwner: false }));

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({
    user: {
      id: "0192f3a0-0000-7000-8000-000000000001",
      isTenantOwner: moduleAuthority.isOwner,
      permissions: ["users.user.read", "users.user.update", "users.user.manage_memberships", "users.user.assign_roles",
        ...(moduleAuthority.canManage ? ["users.user.manage_modules"] : [])],
    },
  }),
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));
vi.mock("@/i18n/useLanguage", () => ({ useLanguage: () => "en", useDictionary: () => en, useDirection: () => "ltr" }));
vi.mock("@/design-system", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/design-system")>(),
  PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("../../../contracts/user-contract", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../../contracts/user-contract")>(),
  fetchTenantUser: vi.fn(),
  updateTenantUser: vi.fn(),
}));
vi.mock("../../../contracts/user-subresource-contract", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../../contracts/user-subresource-contract")>(),
  fetchTeamMemberships: vi.fn(),
}));
vi.mock("../../../contracts/role-assignment-contract", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../../contracts/role-assignment-contract")>(),
  fetchBranchRoleAssignments: vi.fn(),
  fetchScopeRoleAssignments: vi.fn(),
}));
vi.mock("../../../contracts/assignment-options-contract", () => ({ fetchAssignmentOptions: vi.fn() }));
vi.mock("../../../hooks/useCoreOptions", () => {
  const options = {
    options: [], isLoading: false, labelFor: () => "Team A", search: vi.fn(),
  };
  return { useOrgNodeOptions: () => options, useRoleOptions: () => options };
});
vi.mock("../../components/UserFormDrawer", () => ({
  UserFormDrawer: vi.fn(() => <div data-testid="user-form-drawer" />),
}));
vi.mock("./ModuleSeatsPanel", () => ({
  ModuleSeatsPanel: ({ canManage }: { canManage: boolean }) => (
    <div data-testid="module-seats" data-can-manage={canManage} />
  ),
}));
vi.mock("./BranchRolesSection", () => ({
  BranchRolesSection: () => createElement("button", null, "Change branch grants"),
}));
vi.mock("./ScopeRolesSection", () => ({
  ScopeRolesSection: () => createElement("button", null, "Change scope grants"),
}));

function target(id: string, isTenantOwner = false): TenantUser {
  return {
    id, isTenantOwner, email: "user@example.com", firstName: "Test", lastName: "User",
    companyId: OTHER_ID, branchId: OTHER_ID, departmentId: OTHER_ID,
    teamId: null, managerId: null, employeeCode: null, jobTitle: null,
    status: "ACTIVE", createdAt: "2026-10-17T00:00:00Z", updatedAt: "2026-10-17T00:00:00Z",
  };
}

function renderWorkspace(id: string) {
  return render(<TooltipProvider><UserDetailWorkspace id={id} /></TooltipProvider>);
}

beforeEach(() => {
  moduleAuthority.canManage = false;
  moduleAuthority.isOwner = false;
  vi.mocked(fetchAssignmentOptions).mockResolvedValue({ choices: [], labels: [], hasMore: false });
  vi.mocked(fetchTeamMemberships).mockResolvedValue([{
    id: TEAM_ID, tenantUserId: OTHER_ID, teamId: TEAM_ID, role: "MEMBER", isPrimary: false,
  }]);
  vi.mocked(fetchBranchRoleAssignments).mockResolvedValue([]);
  vi.mocked(fetchScopeRoleAssignments).mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("protected user management", () => {
  it.each([
    ["profile editor", OTHER_ID, false, false, false],
    ["seat manager", OTHER_ID, true, false, true],
    ["self seat manager", ACTOR_ID, true, false, false],
    ["owner managing another user", OTHER_ID, false, true, true],
    ["self owner", ACTOR_ID, false, true, false],
  ] as const)("gates module controls for %s", async (_name, id, canManage, isOwner, expected) => {
    moduleAuthority.canManage = canManage;
    moduleAuthority.isOwner = isOwner;
    vi.mocked(fetchTenantUser).mockResolvedValue(target(id));
    renderWorkspace(id);
    expect(await screen.findByTestId("module-seats")).toHaveAttribute("data-can-manage", String(expected));
  });

  it.each([
    ["self", ACTOR_ID, false, en.coreIdentity.users.selfManagementProtected],
    ["owner", OTHER_ID, true, en.coreIdentity.users.ownerManagementProtected],
    ["self owner", ACTOR_ID, true, en.coreIdentity.users.ownerManagementProtected],
  ] as const)("keeps %s detail read-only and skips grant requests", async (_kind, id, isOwner, reason) => {
    vi.mocked(fetchTenantUser).mockResolvedValue(target(id, isOwner));
    renderWorkspace(id);

    const edit = await screen.findByRole("button", { name: en.coreIdentity.actions.edit });
    expect(edit).toBeDisabled();
    expect(edit).toHaveAccessibleDescription(reason);
    if (id === ACTOR_ID) {
      expect(screen.getByRole("link", { name: en.coreIdentity.users.editMyName })).toHaveAttribute("href", "/core/profile");
    } else {
      expect(screen.queryByRole("link", { name: en.coreIdentity.users.editMyName })).toBeNull();
    }
    await screen.findByText("Team A");
    expect(screen.queryByRole("button", { name: en.coreIdentity.memberships.add })).toBeNull();
    expect(screen.queryByRole("button", { name: en.coreIdentity.memberships.replaceAll })).toBeNull();
    expect(screen.queryByRole("button", { name: `${en.common.delete}: Team A` })).toBeNull();
    expect(screen.queryByRole("button", { name: "Change branch grants" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Change scope grants" })).toBeNull();
    expect(fetchTeamMemberships).toHaveBeenCalledWith(id, expect.any(AbortSignal));
    expect(fetchBranchRoleAssignments).not.toHaveBeenCalled();
    expect(fetchScopeRoleAssignments).not.toHaveBeenCalled();
    expect(fetchAssignmentOptions).not.toHaveBeenCalled();
  });

  it.each([false, true])("preserves management of other users with owner status %s", async (isOwner) => {
    moduleAuthority.isOwner = isOwner;
    vi.mocked(fetchTenantUser).mockResolvedValue(target(OTHER_ID));
    renderWorkspace(OTHER_ID);

    expect(await screen.findByRole("button", { name: en.coreIdentity.actions.edit })).toBeEnabled();
    expect(UserFormDrawer).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: en.coreIdentity.memberships.add })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change branch grants" })).toBeEnabled();
    await waitFor(() => expect(fetchBranchRoleAssignments).toHaveBeenCalledWith(OTHER_ID, expect.any(AbortSignal)));
    if (isOwner) {
      await waitFor(() => expect(fetchScopeRoleAssignments).toHaveBeenCalledWith(OTHER_ID, expect.any(AbortSignal), {
        suppressForbiddenToast: true,
      }));
    } else {
      expect(fetchScopeRoleAssignments).not.toHaveBeenCalled();
    }
  });

  it.each([[ACTOR_ID, false], [OTHER_ID, true]] as const)(
    "guards edit callbacks for protected target %s",
    async (id, isOwner) => {
      vi.mocked(fetchTenantUser).mockResolvedValue(target(id, isOwner));
      const { result } = renderHook(() => useTenantUserDetail(id));
      await waitFor(() => expect(result.current.user).not.toBeNull());
      act(() => result.current.openEdit());
      expect(result.current.isEditOpen).toBe(false);
      let saved = true;
      await act(async () => { saved = await result.current.saveEdits({ firstName: "Changed" }); });
      expect(saved).toBe(false);
      expect(updateTenantUser).not.toHaveBeenCalled();
    },
  );
});

describe("user placement edits", () => {
  it.each([
    ["moves department and clears the old home team", { departmentId: NEXT_ID, teamId: "" }, { departmentId: NEXT_ID, teamId: null }],
    ["clears the home team", { teamId: "" }, { teamId: null }],
    ["clears the manager", { managerId: "" }, { managerId: null }],
    ["replaces team and manager", { teamId: NEXT_ID, managerId: TEAM_ID }, { teamId: NEXT_ID, managerId: TEAM_ID }],
  ] as const)("%s and completes the save", async (_description, changes, expected) => {
    const loaded = { ...target(OTHER_ID), teamId: TEAM_ID, managerId: ACTOR_ID };
    vi.mocked(fetchTenantUser).mockResolvedValue(loaded);
    vi.mocked(updateTenantUser).mockResolvedValue({ ...loaded, ...expected });
    renderWorkspace(OTHER_ID);
    fireEvent.click(await screen.findByRole("button", { name: en.coreIdentity.actions.edit }));

    const drawer = vi.mocked(UserFormDrawer).mock.lastCall?.[0];
    if (!drawer) throw new Error("User edit form was not rendered");
    expect(drawer.isOpen).toBe(true);
    const values: UserFormValues = {
      email: loaded.email, firstName: loaded.firstName, lastName: loaded.lastName,
      companyId: loaded.companyId, branchId: loaded.branchId, departmentId: loaded.departmentId,
      teamId: loaded.teamId, managerId: loaded.managerId, employeeCode: "", jobTitle: "",
      ...changes,
    };
    let saved = false;
    await act(async () => { saved = await drawer.onSubmit(values); });

    expect(saved).toBe(true);
    expect(updateTenantUser).toHaveBeenCalledExactlyOnceWith(OTHER_ID, {
      firstName: loaded.firstName, lastName: loaded.lastName,
      companyId: loaded.companyId, branchId: loaded.branchId, departmentId: loaded.departmentId,
      employeeCode: "", jobTitle: "", ...expected,
    });
    expect(screen.queryByTestId("user-form-drawer")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: en.coreIdentity.actions.edit }));
    expect(vi.mocked(UserFormDrawer).mock.lastCall?.[0].initial).toMatchObject({
      departmentId: "departmentId" in expected ? expected.departmentId : loaded.departmentId,
      teamId: "teamId" in expected ? expected.teamId ?? "" : loaded.teamId,
      managerId: "managerId" in expected ? expected.managerId ?? "" : loaded.managerId,
    });
  });

  it.each([null, TEAM_ID])("omits unchanged team and manager values (%s)", async (value) => {
    const loaded = { ...target(OTHER_ID), teamId: value, managerId: value };
    vi.mocked(fetchTenantUser).mockResolvedValue(loaded);
    vi.mocked(updateTenantUser).mockResolvedValue({ ...loaded, firstName: "Changed" });
    renderWorkspace(OTHER_ID);
    fireEvent.click(await screen.findByRole("button", { name: en.coreIdentity.actions.edit }));

    const drawer = vi.mocked(UserFormDrawer).mock.lastCall?.[0];
    if (!drawer) throw new Error("User edit form was not rendered");
    await act(async () => {
      await drawer.onSubmit({
        email: loaded.email, firstName: "Changed", lastName: loaded.lastName,
        companyId: loaded.companyId, branchId: loaded.branchId, departmentId: loaded.departmentId,
        teamId: value ?? "", managerId: value ?? "", employeeCode: "", jobTitle: "",
      });
    });

    expect(updateTenantUser).toHaveBeenCalledExactlyOnceWith(OTHER_ID, {
      firstName: "Changed", lastName: loaded.lastName,
      companyId: loaded.companyId, branchId: loaded.branchId, departmentId: loaded.departmentId,
      employeeCode: "", jobTitle: "",
    });
  });
});

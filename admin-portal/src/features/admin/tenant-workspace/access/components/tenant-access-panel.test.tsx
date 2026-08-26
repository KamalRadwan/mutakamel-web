// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ controller: null as unknown }));
vi.mock("../use-tenant-access", () => ({
  useTenantAccess: () => state.controller,
}));

// TenantAccessPanel takes `locale` as a prop and builds its own copy via
// tenantAccessCopy(locale) rather than calling useI18n() — but its table
// (DataTable/Pagination) and success notices (useToast) both call useI18n()
// internally. No test here asserts on toast content or DataTable's own
// chrome text, so a single static "en" answer is safe across every case,
// including the Arabic-copy test (which only checks tenantAccessCopy's own
// heading text and the panel's own dir attribute).
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en" as const }),
}));

import { TenantAccessPanel } from "./tenant-access-panel";
import {
  BRANCH_ID,
  COMPANY_ID,
  DEPARTMENT_ID,
  ROLE_ID,
  TEAM_ID,
  TENANT_ID,
  branchFixture,
  departmentFixture,
  pageFixture,
  roleFixture,
  summaryFixture,
  teamFixture,
  userFixture,
} from "../__tests__/fixtures";
import type { TenantUserListQuery } from "../types";

function controller(overrides: Record<string, unknown> = {}) {
  const user = userFixture();
  return {
    tenantId: TENANT_ID,
    tenantStatus: "ACTIVE",
    enabled: true,
    ready: true,
    isAuthLoading: false,
    permissions: {
      canRead: true,
      canReadRoles: true,
      canInvite: true,
      canUpdate: true,
      canResetPassword: true,
      canManageWebphone: true,
      canSuspend: true,
      canAssignRoles: true,
      canDelete: true,
      canRestore: true,
    },
    query: { page: 1, limit: 20, visibility: "ACTIVE", sortBy: "createdAt", sortDir: "DESC" },
    setQuery: vi.fn(),
    directory: { status: "ready", data: pageFixture([user]), error: null },
    summary: { status: "ready", data: summaryFixture, error: null },
    roles: { status: "ready", data: pageFixture([roleFixture]), error: null },
    branches: { status: "ready", data: pageFixture([branchFixture]), error: null },
    departments: { status: "ready", data: pageFixture([departmentFixture]), error: null },
    teams: { status: "ready", data: pageFixture([teamFixture]), error: null },
    selectedUser: { status: "idle", data: null, error: null },
    command: { name: null, userId: null, pending: false, error: null },
    refresh: vi.fn().mockResolvedValue([]),
    refreshDirectory: vi.fn().mockResolvedValue(undefined),
    refreshSummary: vi.fn().mockResolvedValue(undefined),
    loadRoles: vi.fn().mockResolvedValue(undefined),
    loadBranches: vi.fn().mockResolvedValue(undefined),
    loadDepartments: vi.fn().mockResolvedValue(undefined),
    loadTeams: vi.fn().mockResolvedValue(undefined),
    loadUser: vi.fn().mockResolvedValue(undefined),
    closeUser: vi.fn(),
    inviteUser: vi.fn().mockResolvedValue({ user, delivery: "QUEUED" }),
    updateUser: vi.fn().mockResolvedValue(user),
    resetPassword: vi.fn().mockResolvedValue({ userId: user.id, delivery: "QUEUED" }),
    resendInvite: vi.fn().mockResolvedValue({ userId: user.id, delivery: "QUEUED" }),
    changePassword: vi.fn().mockResolvedValue(user),
    updateWebphone: vi.fn().mockResolvedValue(user.webphone),
    suspendUser: vi.fn().mockResolvedValue({ ...user, status: "SUSPENDED" }),
    activateUser: vi.fn().mockResolvedValue(user),
    replaceRoles: vi.fn().mockResolvedValue(user),
    deleteUser: vi.fn().mockResolvedValue(undefined),
    restoreUser: vi.fn().mockResolvedValue({ ...user, status: "SUSPENDED", deletedAt: null }),
    ...overrides,
  };
}

describe("TenantAccessPanel", () => {
  beforeEach(() => {
    state.controller = controller();
  });

  it("renders authoritative rows/summary and applies canonical server filters", () => {
    const current = state.controller as ReturnType<typeof controller>;
    render(<TenantAccessPanel tenantId={TENANT_ID} tenantStatus="ACTIVE" />);
    expect(screen.getByRole("heading", { name: "Users & access" })).toBeInTheDocument();
    expect(screen.getByText("Mona Ali")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search users"), { target: { value: "  mona  " } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "ACTIVE" } });
    fireEvent.change(screen.getByLabelText("All users"), { target: { value: "ALL" } });
    fireEvent.change(screen.getByLabelText("Roles"), { target: { value: ROLE_ID } });
    fireEvent.change(screen.getByLabelText("Branch"), { target: { value: BRANCH_ID } });
    fireEvent.change(screen.getByLabelText("Department"), { target: { value: DEPARTMENT_ID } });
    fireEvent.change(screen.getByLabelText("Team (optional)"), { target: { value: TEAM_ID } });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));

    const updater = current.setQuery.mock.calls[0]?.[0] as (
      query: TenantUserListQuery,
    ) => TenantUserListQuery;
    expect(
      updater({ page: 5, limit: 20, visibility: "ACTIVE" }),
    ).toMatchObject({
      page: 1,
      q: "mona",
      status: "ACTIVE",
      visibility: "ALL",
      role: ROLE_ID,
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      departmentId: DEPARTMENT_ID,
      teamId: TEAM_ID,
    });
    expect(current.loadDepartments).toHaveBeenCalledWith({ branchId: BRANCH_ID, page: 1, limit: 100 });
    expect(current.loadTeams).toHaveBeenCalledWith({ departmentId: DEPARTMENT_ID, page: 1, limit: 100 });

    fireEvent.click(screen.getByRole("button", { name: "User details" }));
    expect(current.loadUser).toHaveBeenCalledWith(userFixture().id);
  });

  it("renders readiness and authorization gates without exposing actions", () => {
    state.controller = controller({
      ready: false,
      permissions: { ...(controller().permissions), canInvite: true },
      directory: {
        status: "unavailable",
        data: null,
        error: { errorCode: "TENANT_DATABASE_NOT_READY" },
      },
      summary: { status: "unavailable", data: null, error: null },
    });
    const { rerender } = render(
      <TenantAccessPanel tenantId={TENANT_ID} tenantStatus="PROVISIONING" />,
    );
    expect(screen.getByText(/after the tenant database is ready/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Invite user" })).not.toBeInTheDocument();

    state.controller = controller({
      permissions: { ...(controller().permissions), canRead: false },
      directory: { status: "forbidden", data: null, error: null },
    });
    rerender(<TenantAccessPanel tenantId={TENANT_ID} tenantStatus="ACTIVE" />);
    expect(screen.getByText(/do not have permission to view/i)).toBeInTheDocument();
  });

  it("keeps independent summary evidence visible when the directory fails", () => {
    state.controller = controller({
      directory: {
        status: "error",
        data: null,
        error: { correlationId: "corr-1" },
      },
    });
    render(<TenantAccessPanel tenantId={TENANT_ID} tenantStatus="ACTIVE" />);
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText(/corr-1/)).toBeInTheDocument();
  });

  it("protects owner actions while preserving reset and WebPhone actions", () => {
    const owner = userFixture({ isTenantOwner: true });
    state.controller = controller({
      directory: { status: "ready", data: pageFixture([owner]), error: null },
      selectedUser: { status: "ready", data: owner, error: null },
    });
    render(<TenantAccessPanel tenantId={TENANT_ID} tenantStatus="ACTIVE" />);
    expect(screen.getByText("Owner account is protected from this action.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit profile" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Manage roles" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change password" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send reset link" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Configure WebPhone" })).toBeInTheDocument();
  });

  it("offers restore based on deletedAt rather than a fabricated status", () => {
    const deleted = userFixture({ status: "DEACTIVATED", deletedAt: "2026-08-11T20:00:00.000Z" });
    state.controller = controller({
      directory: { status: "ready", data: pageFixture([deleted]), error: null },
      selectedUser: { status: "ready", data: deleted, error: null },
    });
    render(<TenantAccessPanel tenantId={TENANT_ID} tenantStatus="ACTIVE" />);
    expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("builds an invite from live cascading catalogues and role options", async () => {
    const current = state.controller as ReturnType<typeof controller>;
    render(<TenantAccessPanel tenantId={TENANT_ID} tenantStatus="ACTIVE" />);
    fireEvent.click(screen.getByRole("button", { name: "Invite user" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("First name"), { target: { value: "Sara" } });
    fireEvent.change(within(dialog).getByLabelText("Last name"), { target: { value: "Saleh" } });
    fireEvent.change(within(dialog).getByLabelText("Email"), { target: { value: "SARA@EXAMPLE.TEST" } });
    fireEvent.change(within(dialog).getByLabelText("Branch"), { target: { value: BRANCH_ID } });
    fireEvent.change(within(dialog).getByLabelText("Department"), { target: { value: DEPARTMENT_ID } });
    fireEvent.click(within(dialog).getByLabelText("Finance"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(current.inviteUser).toHaveBeenCalledTimes(1));
    expect(current.inviteUser).toHaveBeenCalledWith({
      email: "sara@example.test",
      firstName: "Sara",
      lastName: "Saleh",
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      departmentId: DEPARTMENT_ID,
      roleAssignments: [{ branchId: BRANCH_ID, roleId: ROLE_ID }],
    });
  });

  it("validates direct password change and submits no mismatched secret", async () => {
    state.controller = controller({
      selectedUser: { status: "ready", data: userFixture(), error: null },
    });
    const current = state.controller as ReturnType<typeof controller>;
    render(<TenantAccessPanel tenantId={TENANT_ID} tenantStatus="ACTIVE" />);
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    let dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("New password"), { target: { value: "StrongPassword!2026" } });
    fireEvent.change(within(dialog).getByLabelText("Confirm password"), { target: { value: "different-password" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/must match/i);
    expect(current.changePassword).not.toHaveBeenCalled();

    dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Confirm password"), { target: { value: "StrongPassword!2026" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(current.changePassword).toHaveBeenCalledWith(userFixture(), { newPassword: "StrongPassword!2026", passwordConfirmation: "StrongPassword!2026" }));
  });

  it("never preloads SIP credentials and routes lifecycle confirmation", async () => {
    state.controller = controller({
      selectedUser: { status: "ready", data: userFixture(), error: null },
    });
    const current = state.controller as ReturnType<typeof controller>;
    render(<TenantAccessPanel tenantId={TENANT_ID} tenantStatus="ACTIVE" />);
    fireEvent.click(screen.getByRole("button", { name: "Configure WebPhone" }));
    let dialog = screen.getByRole("dialog");
    const secret = within(dialog).getByLabelText(/New SIP password/i) as HTMLInputElement;
    expect(secret.value).toBe("");
    fireEvent.change(secret, { target: { value: "rotated-secret" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(current.updateWebphone).toHaveBeenCalledWith(userFixture(), expect.objectContaining({ sipPassword: "rotated-secret" })));

    fireEvent.click(screen.getByRole("button", { name: "Suspend" }));
    dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(current.suspendUser).toHaveBeenCalledWith(userFixture()));
  });

  it("renders compact Arabic copy and direction", () => {
    render(<TenantAccessPanel tenantId={TENANT_ID} tenantStatus="ACTIVE" locale="ar" />);
    const heading = screen.getByRole("heading", { name: "المستخدمون والصلاحيات" });
    expect(heading.closest("section")).toHaveAttribute("dir", "rtl");
  });
});

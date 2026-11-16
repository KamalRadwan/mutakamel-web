// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import type { PermissionScope } from "@/lib/auth/permission-scope";
import type { ColumnDef, FilterDef, FilterValues } from "@/design-system";
import {
  deleteTenantUser,
  fetchTenantUsers,
  inviteTenantUser,
  resendTenantUserInvite,
  revokeTenantUserSessions,
  setTenantUserStatus,
  USER_LIMIT_REACHED_CODE,
  type InviteUserInput,
  type TenantUser,
  type UserStatus,
} from "../../contracts/user-contract";
import { allowedUserActions } from "../user-permissions";
import { UserFormDrawer } from "./UserFormDrawer";
import { UsersWorkspace } from "./users-workspace";

const ACTOR_ID = "0192f3a0-0000-7000-8000-000000000001";
const COMPANY_ID = "0192f3a0-0000-7000-8000-000000000010";
const BRANCH_ID = "0192f3a0-0000-7000-8000-000000000020";
const BRANCH_B_ID = "0192f3a0-0000-7000-8000-000000000021";
const DEPT_ID = "0192f3a0-0000-7000-8000-000000000030";
const TEAM_ID = "0192f3a0-0000-7000-8000-000000000040";

const actor = vi.hoisted(() => ({
  permissions: [] as string[],
  branchIds: null as string[] | null,
  lang: "en" as "en" | "ar",
}));
const placementPermissions = ["org.company.read", "org.branch.read", "org.department.read"];

function buildPermissionScopes(
  permissions: readonly string[],
  branchIds: string[] | null,
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

const filterHarness = vi.hoisted(() => ({
  lastFilters: [] as FilterDef[],
  onChange: null as ((next: FilterValues) => void) | null,
}));

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({
    user: {
      id: ACTOR_ID,
      permissions: actor.permissions,
      permissionScopes: buildPermissionScopes(actor.permissions, actor.branchIds),
    },
  }),
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: { en, ar }[actor.lang], lang: actor.lang }),
}));
vi.mock("@/design-system", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/design-system")>();
  return {
    ...actual,
    PermissionGate: ({ denied, children }: { denied?: boolean; children: ReactNode }) =>
      denied ? <div data-testid="permission-denied">Denied</div> : <>{children}</>,
    PageHeader: ({
      primaryAction,
    }: {
      primaryAction?: { label: string; onClick: () => void; disabled?: boolean };
    }) =>
      primaryAction ? (
        <button disabled={primaryAction.disabled} onClick={primaryAction.onClick}>
          {primaryAction.label}
        </button>
      ) : null,
    SubNav: () => null,
    FilterBar: ({
      filters,
      onChange,
    }: {
      filters: FilterDef[];
      onChange: (next: FilterValues) => void;
    }) => {
      filterHarness.lastFilters = filters;
      filterHarness.onChange = onChange;
      return <div data-testid="filter-bar" />;
    },
    DataTable: <T,>({
      rows,
      columns,
      rowKey,
    }: {
      rows: T[];
      columns: ColumnDef<T>[];
      rowKey: (row: T) => string;
    }) => (
      <div data-testid="users-table">
        {rows.map((row) => (
          <div key={rowKey(row)} data-testid={`row-${rowKey(row)}`}>
            {columns.map((col) => (
              <div key={col.id}>{col.cell(row)}</div>
            ))}
          </div>
        ))}
      </div>
    ),
    ConfirmActionModal: ({
      open,
      title,
      confirmLabel,
      onConfirm,
    }: {
      open: boolean;
      title: string;
      confirmLabel: string;
      onConfirm: () => void;
    }) =>
      open ? (
        <div role="alertdialog" aria-label={title}>
          <button onClick={onConfirm}>{confirmLabel}</button>
        </div>
      ) : null,
    useRealtimeResync: () => undefined,
  };
});
vi.mock("../../hooks/useCoreOptions", () => ({
  useOrgNodeOptions: () => {
    const names: Record<string, string> = {
      [COMPANY_ID]: "Mersany Group",
      [BRANCH_ID]: "Cairo Branch",
      [BRANCH_B_ID]: "Alexandria Branch",
      [DEPT_ID]: "Revenue Dept",
      [TEAM_ID]: "Enterprise Team",
    };
    return {
      options: Object.entries(names).map(([value, label]) => ({ value, label })),
      isLoading: false,
      isReady: true,
      labelFor: (id?: string | null) => (id ? names[id] : undefined),
      search: vi.fn(),
    };
  },
}));
vi.mock("../../contracts/user-contract", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../contracts/user-contract")>()),
  fetchTenantUsers: vi.fn(),
  inviteTenantUser: vi.fn(),
  setTenantUserStatus: vi.fn(),
  resendTenantUserInvite: vi.fn(),
  revokeTenantUserSessions: vi.fn(),
  deleteTenantUser: vi.fn(),
}));
vi.mock("./UserFormDrawer", () => ({
  UserFormDrawer: vi.fn(
    ({
      onClose,
      onSubmit,
    }: {
      onClose: () => void;
      onSubmit: (values: Record<string, string>) => Promise<boolean>;
    }) => (
      <div>
        <button onClick={onClose}>Close user form</button>
        <button
          onClick={() =>
            void onSubmit({
              email: "quota@example.com",
              firstName: "Quota",
              lastName: "Test",
              employeeCode: "",
              jobTitle: "",
              companyId: COMPANY_ID,
              branchId: BRANCH_ID,
              departmentId: DEPT_ID,
              teamId: "",
              managerId: "",
            })
          }
        >
          Submit user form
        </button>
      </div>
    ),
  ),
}));

function makeUser(id: string, status: UserStatus, extra: Partial<TenantUser> = {}): TenantUser {
  return {
    id,
    email: `${status.toLowerCase()}@example.com`,
    firstName: status,
    lastName: "Member",
    employeeCode: null,
    jobTitle: null,
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    departmentId: DEPT_ID,
    teamId: TEAM_ID,
    managerId: null,
    status,
    isTenantOwner: false,
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-01T10:00:00.000Z",
    ...extra,
  };
}

beforeEach(() => {
  actor.lang = "en";
  actor.branchIds = null;
  actor.permissions = [
    "users.user.read",
    "users.user.invite",
    "users.user.update",
    "users.user.deactivate",
    "users.user.delete",
    "tenant.billing.read",
    ...placementPermissions,
    "org.team.read",
  ];
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

describe("user invite drawer admission", () => {
  it("loads only the users list until Invite opens, and unmounts the closed form", async () => {
    render(<UsersWorkspace />);
    await waitFor(() => expect(fetchTenantUsers).toHaveBeenCalledTimes(1));
    expect(UserFormDrawer).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: en.coreIdentity.users.invite }));
    expect(screen.getByRole("button", { name: "Close user form" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close user form" }));
    expect(screen.queryByRole("button", { name: "Close user form" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: en.coreIdentity.users.invite }));
    expect(screen.getByRole("button", { name: "Close user form" })).toBeInTheDocument();
  });

  it.each(placementPermissions)(
    "disables Invite without %s and explains it in both languages",
    async (missing) => {
      actor.permissions = actor.permissions.filter((permission) => permission !== missing);
      const { rerender } = render(<UsersWorkspace />);
      await waitFor(() => expect(fetchTenantUsers).toHaveBeenCalledTimes(1));
      expect(screen.getByRole("button", { name: en.coreIdentity.users.invite })).toBeDisabled();
      expect(
        screen.getByText(en.coreIdentity.users.invitePlacementReadRequired),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: en.coreIdentity.users.invite }));
      expect(UserFormDrawer).not.toHaveBeenCalled();

      actor.lang = "ar";
      rerender(<UsersWorkspace />);
      expect(screen.getByRole("button", { name: ar.coreIdentity.users.invite })).toBeDisabled();
      expect(
        screen.getByText(ar.coreIdentity.users.invitePlacementReadRequired),
      ).toBeInTheDocument();
    },
  );

  it("keeps the drawer unmounted for readers without Invite permission", async () => {
    actor.permissions = ["users.user.read"];
    render(<UsersWorkspace />);
    await waitFor(() => expect(fetchTenantUsers).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("button", { name: en.coreIdentity.users.invite })).toBeNull();
    expect(
      screen.queryByText(en.coreIdentity.users.invitePlacementReadRequired),
    ).toBeNull();
    expect(UserFormDrawer).not.toHaveBeenCalled();
  });
});

describe("users table, branch-scoped gating, lifecycle safety, and quota states", () => {
  it("renders all four lifecycle statuses with scoped placement names and zero raw UUIDs", async () => {
    const rows = [
      makeUser("0192f3a0-0000-7000-8000-000000000101", "INVITED"),
      makeUser("0192f3a0-0000-7000-8000-000000000102", "ACTIVE"),
      makeUser("0192f3a0-0000-7000-8000-000000000103", "SUSPENDED"),
      makeUser("0192f3a0-0000-7000-8000-000000000104", "DEACTIVATED"),
    ];
    vi.mocked(fetchTenantUsers).mockResolvedValue({
      items: rows,
      page: 1,
      limit: 25,
      total: 4,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    });

    const { container } = render(<UsersWorkspace />);
    await waitFor(() => expect(screen.getByText(en.coreIdentity.userStatus.INVITED)).toBeInTheDocument());
    expect(screen.getByText(en.coreIdentity.userStatus.ACTIVE)).toBeInTheDocument();
    expect(screen.getByText(en.coreIdentity.userStatus.SUSPENDED)).toBeInTheDocument();
    expect(screen.getByText(en.coreIdentity.userStatus.DEACTIVATED)).toBeInTheDocument();
    expect(screen.getAllByText("Cairo Branch")).toHaveLength(4);
    expect(screen.getAllByText("Revenue Dept · Enterprise Team")).toHaveLength(4);
    expect(container.textContent).not.toContain(BRANCH_ID);
    expect(container.textContent).not.toContain(DEPT_ID);
  });

  it("gates row edit and lifecycle menus per target user branch scope", async () => {
    actor.branchIds = [BRANCH_ID];
    const inScopeUser = makeUser("0192f3a0-0000-7000-8000-000000000111", "ACTIVE", {
      firstName: "Amina",
      branchId: BRANCH_ID,
    });
    const outOfScopeUser = makeUser("0192f3a0-0000-7000-8000-000000000112", "ACTIVE", {
      firstName: "Bilal",
      branchId: BRANCH_B_ID,
    });
    vi.mocked(fetchTenantUsers).mockResolvedValue({
      items: [inScopeUser, outOfScopeUser],
      page: 1,
      limit: 25,
      total: 2,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    });

    render(<UsersWorkspace />);
    const rowA = await screen.findByTestId(`row-${inScopeUser.id}`);
    const rowB = await screen.findByTestId(`row-${outOfScopeUser.id}`);

    expect(
      within(rowA).getByRole("button", { name: new RegExp(en.coreIdentity.actions.edit) }),
    ).toBeEnabled();
    expect(
      within(rowA).getByRole("button", { name: new RegExp(en.common.actions) }),
    ).toBeEnabled();

    expect(
      within(rowB).queryByRole("button", { name: new RegExp(en.coreIdentity.actions.edit) }),
    ).toBeNull();
    expect(
      within(rowB).queryByRole("button", { name: new RegExp(en.common.actions) }),
    ).toBeNull();
    expect(
      within(rowB).getByRole("link", { name: new RegExp(en.coreIdentity.actions.view) }),
    ).toBeInTheDocument();
  });

  it("renders PermissionGate denied on 403 and resets downstream workplace filters when company changes", async () => {
    const { unmount } = render(<UsersWorkspace />);
    await waitFor(() => expect(fetchTenantUsers).toHaveBeenCalledTimes(1));

    act(() => {
      filterHarness.onChange?.({ companyId: { kind: "select", value: COMPANY_ID } });
    });
    await waitFor(() =>
      expect(fetchTenantUsers).toHaveBeenLastCalledWith(
        expect.objectContaining({ filters: expect.objectContaining({ companyId: COMPANY_ID }) }),
      ),
    );

    act(() => {
      filterHarness.onChange?.({
        companyId: { kind: "select", value: COMPANY_ID },
        branchId: { kind: "select", value: BRANCH_ID },
      });
    });
    await waitFor(() =>
      expect(fetchTenantUsers).toHaveBeenLastCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({ companyId: COMPANY_ID, branchId: BRANCH_ID }),
        }),
      ),
    );

    act(() => {
      filterHarness.onChange?.({
        companyId: { kind: "select", value: "0192f3a0-0000-7000-8000-000000000099" },
        branchId: { kind: "select", value: BRANCH_ID },
      });
    });
    await waitFor(() =>
      expect(fetchTenantUsers).toHaveBeenLastCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({
            companyId: "0192f3a0-0000-7000-8000-000000000099",
            branchId: undefined,
          }),
        }),
      ),
    );
    unmount();

    vi.mocked(fetchTenantUsers).mockRejectedValueOnce(
      new TenantApiClientError("Forbidden", {
        status: 403,
        statusText: "Forbidden",
        headers: new Headers(),
        data: { errorCode: "PERMISSION_DENIED", message: "Forbidden" },
      }),
    );
    render(<UsersWorkspace />);
    expect(await screen.findByTestId("permission-denied")).toBeInTheDocument();
  });

  it("surfaces USER_LIMIT_REACHED seat banner on 403 invite rejection", async () => {
    vi.mocked(inviteTenantUser).mockRejectedValueOnce(
      new TenantApiClientError("User limit reached", {
        status: 403,
        statusText: "Forbidden",
        headers: new Headers(),
        data: { errorCode: USER_LIMIT_REACHED_CODE, message: "User limit reached" },
      }),
    );

    render(<UsersWorkspace />);
    await waitFor(() => expect(fetchTenantUsers).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: en.coreIdentity.users.invite }));
    fireEvent.click(screen.getByRole("button", { name: "Submit user form" }));

    expect(await screen.findByText(en.coreIdentity.users.seatLimitTitle)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: en.coreIdentity.users.seatLimitAction }),
    ).toHaveAttribute("href", "/core/billing");
    expect(inviteTenantUser).toHaveBeenCalledWith(
      expect.objectContaining<Partial<InviteUserInput>>({ email: "quota@example.com" }),
    );
  });

  it("enforces target/status and branch-scope action guards accurately", () => {
    const fullActor = {
      id: ACTOR_ID,
      permissions: actor.permissions,
      permissionScopes: buildPermissionScopes(actor.permissions, [BRANCH_ID]),
    };

    const invited = makeUser("0192f3a0-0000-7000-8000-000000000201", "INVITED");
    const active = makeUser("0192f3a0-0000-7000-8000-000000000202", "ACTIVE");
    const suspended = makeUser("0192f3a0-0000-7000-8000-000000000203", "SUSPENDED");
    const deactivated = makeUser("0192f3a0-0000-7000-8000-000000000204", "DEACTIVATED");
    const owner = makeUser("0192f3a0-0000-7000-8000-000000000205", "ACTIVE", {
      isTenantOwner: true,
    });
    const self = makeUser(ACTOR_ID, "ACTIVE");
    const otherBranch = makeUser("0192f3a0-0000-7000-8000-000000000206", "INVITED", {
      branchId: BRANCH_B_ID,
    });

    expect(allowedUserActions(invited, fullActor)).toMatchObject({
      edit: true,
      resendInvite: true,
      suspend: true,
      activate: false,
      revokeSessions: true,
      delete: true,
    });
    expect(allowedUserActions(active, fullActor)).toMatchObject({
      resendInvite: false,
      suspend: true,
      activate: false,
      revokeSessions: true,
    });
    expect(allowedUserActions(suspended, fullActor)).toMatchObject({
      resendInvite: false,
      suspend: false,
      activate: true,
      revokeSessions: true,
    });
    expect(allowedUserActions(deactivated, fullActor)).toMatchObject({
      edit: true,
      resendInvite: false,
      suspend: false,
      activate: false,
      revokeSessions: false,
      delete: false,
    });
    expect(allowedUserActions(owner, fullActor)).toMatchObject({
      edit: false,
      suspend: false,
      resendInvite: false,
      delete: false,
      reason: "ownerProtected",
    });
    expect(allowedUserActions(self, fullActor)).toMatchObject({
      edit: false,
      suspend: false,
      revokeSessions: false,
      delete: false,
      reason: "selfProtected",
    });
    expect(allowedUserActions(otherBranch, fullActor)).toMatchObject({
      edit: false,
      resendInvite: false,
      suspend: false,
      activate: false,
      revokeSessions: false,
      delete: false,
      reason: null,
    });

    expect(setTenantUserStatus).toBeDefined();
    expect(resendTenantUserInvite).toBeDefined();
    expect(revokeTenantUserSessions).toBeDefined();
    expect(deleteTenantUser).toBeDefined();
  });
});

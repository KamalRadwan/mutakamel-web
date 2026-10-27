// @vitest-environment jsdom

import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { fetchTenantUsers } from "../../contracts/user-contract";
import { UserFormDrawer } from "./UserFormDrawer";
import { UsersWorkspace } from "./users-workspace";

const actor = vi.hoisted(() => ({ permissions: [] as string[], lang: "en" as "en" | "ar" }));
const placementPermissions = ["org.company.read", "org.branch.read", "org.department.read"];

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: { id: "0192f3a0-0000-7000-8000-000000000001", permissions: actor.permissions } }),
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: { en, ar }[actor.lang], lang: actor.lang }),
}));
vi.mock("@/design-system", () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</>,
  PageHeader: ({ primaryAction }: { primaryAction?: { label: string; onClick: () => void; disabled?: boolean } }) => (
    primaryAction ? <button disabled={primaryAction.disabled} onClick={primaryAction.onClick}>{primaryAction.label}</button> : null
  ),
  Button: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CORE_IDENTITY_NAV_ITEMS: [],
  SubNav: () => null,
  FilterBar: () => null,
  DataTable: () => null,
  ConfirmActionModal: () => null,
  useRealtimeResync: () => undefined,
}));
vi.mock("../../hooks/useCoreErrorText", () => ({ useCoreErrorText: () => () => undefined }));
vi.mock("./useUserColumns", () => ({ useUserColumns: () => [] }));
vi.mock("../../contracts/user-contract", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../contracts/user-contract")>(),
  fetchTenantUsers: vi.fn(),
}));
vi.mock("./UserFormDrawer", () => ({
  UserFormDrawer: vi.fn(({ onClose }: { onClose: () => void }) => (
    <button onClick={onClose}>Close user form</button>
  )),
}));

beforeEach(() => {
  actor.lang = "en";
  actor.permissions = ["users.user.read", "users.user.invite", ...placementPermissions];
  vi.mocked(fetchTenantUsers).mockResolvedValue({
    items: [], page: 1, limit: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false,
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

  it.each(placementPermissions)("disables Invite without %s and explains it in both languages", async (missing) => {
    actor.permissions = actor.permissions.filter((permission) => permission !== missing);
    const { rerender } = render(<UsersWorkspace />);
    await waitFor(() => expect(fetchTenantUsers).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: en.coreIdentity.users.invite })).toBeDisabled();
    expect(screen.getByText(en.coreIdentity.users.invitePlacementReadRequired)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: en.coreIdentity.users.invite }));
    expect(UserFormDrawer).not.toHaveBeenCalled();

    actor.lang = "ar";
    rerender(<UsersWorkspace />);
    expect(screen.getByRole("button", { name: ar.coreIdentity.users.invite })).toBeDisabled();
    expect(screen.getByText(ar.coreIdentity.users.invitePlacementReadRequired)).toBeInTheDocument();
  });

  it("keeps the drawer unmounted for readers without Invite permission", async () => {
    actor.permissions = ["users.user.read"];
    render(<UsersWorkspace />);
    await waitFor(() => expect(fetchTenantUsers).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("button", { name: en.coreIdentity.users.invite })).toBeNull();
    expect(screen.queryByText(en.coreIdentity.users.invitePlacementReadRequired)).toBeNull();
    expect(UserFormDrawer).not.toHaveBeenCalled();
  });
});

// @vitest-environment jsdom

import type { ReactNode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import type { AdminUser } from "./types";

const state = vi.hoisted(() => ({
  lang: "en" as "en" | "ar",
  actor: {
    id: "actor", isSuperAdmin: false,
    permissions: ["admin.users.read", "admin.users.suspend", "admin.users.delete", "admin.users.critical"],
  },
  openModal: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: state.actor }) }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: state.lang, t: state.lang === "ar" ? ar : en }),
}));
vi.mock("./hooks/useUsers", async () => {
  const { en } = await import("@/i18n/dictionaries/en");
  const { ar } = await import("@/i18n/dictionaries/ar");
  return {
    useUsers: () => ({
      lang: state.lang, t: state.lang === "ar" ? ar : en,
      search: "", statusFilter: "ALL", roleFilter: "ALL", isSuperAdminFilter: "ALL",
      roles: [], rolesStatus: "success", reloadRoles: vi.fn(),
      summaryMetrics: { total: 3 }, webphoneExtensions: new Map(),
      users: [
        { id: "protected", firstName: "Protected", lastName: "Admin", email: "protected@example.invalid", isSuperAdmin: true, status: "ACTIVE" },
        { id: "suspended", firstName: "Suspended", lastName: "Admin", email: "suspended@example.invalid", isSuperAdmin: true, status: "SUSPENDED" },
        { id: "ordinary", firstName: "Ordinary", lastName: "Admin", email: "ordinary@example.invalid", isSuperAdmin: false, status: "ACTIVE" },
      ],
      openModal: state.openModal,
    }),
  };
});
vi.mock("./components/InviteUserModal", () => ({ InviteUserModal: () => null }));
vi.mock("@/components/shared/DestructiveActionModal", () => ({ DestructiveActionModal: () => null }));
vi.mock("@/design-system", () => {
  const Children = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    PageHeader: () => null, StatGrid: () => null, StatCard: () => null,
    FilterBar: () => null, ErrorState: () => null, Badge: Children,
    DropdownMenu: Children, DropdownMenuContent: Children, DropdownMenuTrigger: Children,
    Button: ({ children, disabled, "aria-label": label }: { children: ReactNode; disabled?: boolean; "aria-label"?: string }) => (
      <button disabled={disabled} aria-label={label}>{children}</button>
    ),
    DropdownMenuItem: ({ children, onSelect }: { children: ReactNode; onSelect: () => void }) => (
      <button onClick={onSelect}>{children}</button>
    ),
    DataTable: ({ data, columns }: {
      data: AdminUser[];
      columns: { key: string; cell?: (user: AdminUser) => ReactNode }[];
    }) => (
      <table><tbody>{data.map((user) => (
        <tr key={user.id} data-testid={user.id}>
          <td>{columns.find((column) => column.key === "actions")?.cell?.(user)}</td>
        </tr>
      ))}</tbody></table>
    ),
  };
});

import UsersDirectoryPage from "./page";

describe("user directory target protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.actor.isSuperAdmin = false;
    state.lang = "en";
  });

  it.each(["en", "ar"] as const)("hides protected row actions with a %s reason and preserves ordinary actions", (lang) => {
    state.lang = lang;
    const t = lang === "ar" ? ar : en;
    render(<UsersDirectoryPage />);
    for (const id of ["protected", "suspended"]) {
      const row = within(screen.getByTestId(id));
      expect(row.getByText(t.users.protectedSuperAdminReason)).toBeInTheDocument();
      expect(row.queryByRole("button")).not.toBeInTheDocument();
    }
    const ordinary = within(screen.getByTestId("ordinary"));
    fireEvent.click(ordinary.getByRole("button", { name: t.users.suspendAccount }));
    fireEvent.click(ordinary.getByRole("button", { name: t.users.delete }));
    expect(state.openModal.mock.calls).toEqual([["ordinary", "suspend"], ["ordinary", "delete"]]);
  });

  it("preserves protected-target actions for a super-admin actor", () => {
    state.actor.isSuperAdmin = true;
    render(<UsersDirectoryPage />);
    expect(screen.queryByText(en.users.protectedSuperAdminReason)).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByTestId("protected")).getByRole("button", { name: en.users.suspendAccount }));
    fireEvent.click(within(screen.getByTestId("suspended")).getByRole("button", { name: en.users.activateAccount }));
    expect(state.openModal.mock.calls).toEqual([["protected", "suspend"], ["suspended", "activate"]]);
  });
});

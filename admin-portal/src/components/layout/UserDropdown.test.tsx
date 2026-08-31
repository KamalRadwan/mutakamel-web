// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock } = vi.hoisted(() => ({
  authMock: {
    user: {
      firstName: "Admin",
      lastName: "Operator",
      email: "operator@example.test",
      isSuperAdmin: false,
      role: { name: "Operator" },
      permissions: [] as string[],
    },
    logout: vi.fn(),
  },
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => authMock }));
vi.mock("@/components/ui/ToastContext", () => ({
  useToast: () => ({ error: vi.fn() }),
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    lang: "en",
    t: {
      common: {
        superAdminRole: "Super admin",
        profileAndCurrency: "Profile & Currency",
        permissionsAndRoles: "Permissions & Roles",
        systemSettings: "System Settings",
        accountMenu: "account menu",
        signOut: "Sign Out",
      },
    },
  }),
}));

import { UserDropdown } from "./UserDropdown";

describe("UserDropdown permission-filtered destinations", () => {
  beforeEach(() => {
    authMock.user.permissions = [];
    authMock.user.isSuperAdmin = false;
    authMock.logout.mockReset();
  });

  it("always exposes self-service profile but hides unauthorized admin links", () => {
    render(<UserDropdown />);
    fireEvent.pointerDown(screen.getByRole("button", { name: /Admin Operator/i }), {
      button: 0,
      ctrlKey: false,
    });

    expect(
      screen.getByRole("menuitem", { name: "Profile & Currency" }),
    ).toHaveAttribute("href", "/profile");
    expect(
      screen.queryByRole("menuitem", { name: "Permissions & Roles" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "System Settings" }),
    ).not.toBeInTheDocument();
  });

  it("shows roles and settings only with their exact read permissions", () => {
    authMock.user.permissions = ["admin.roles.read", "admin.settings.read"];
    render(<UserDropdown />);
    fireEvent.pointerDown(screen.getByRole("button", { name: /Admin Operator/i }), {
      button: 0,
      ctrlKey: false,
    });

    expect(
      screen.getByRole("menuitem", { name: "Permissions & Roles" }),
    ).toHaveAttribute("href", "/roles");
    expect(
      screen.getByRole("menuitem", { name: "System Settings" }),
    ).toHaveAttribute("href", "/settings");
  });
});

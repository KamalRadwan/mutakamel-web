// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, listHookMock } = vi.hoisted(() => ({
  authMock: {
    user: { isSuperAdmin: false, permissions: [] as string[] },
    isLoading: false,
  },
  listHookMock: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => authMock }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", dir: "ltr" }),
}));
vi.mock("@/components/layout/Navbar", () => ({
  Navbar: () => <nav data-testid="navbar" />,
}));
vi.mock("@/features/admin/database-servers/hooks/useDatabaseServers", () => ({
  useDatabaseServers: listHookMock,
}));

import DatabaseServersPage from "./page";

describe("DatabaseServersPage read preflight", () => {
  beforeEach(() => {
    authMock.user = { isSuperAdmin: false, permissions: [] };
    authMock.isLoading = false;
    listHookMock.mockReset();
  });

  it("does not mount the API-backed list hook without read permission", () => {
    render(<DatabaseServersPage />);

    expect(
      screen.getByRole("heading", {
        name: "You do not have permission to view database servers.",
      }),
    ).toBeInTheDocument();
    expect(listHookMock).not.toHaveBeenCalled();
  });

  it("does not mount the list hook while authorization is unresolved", () => {
    authMock.isLoading = true;
    render(<DatabaseServersPage />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Checking database-server access",
    );
    expect(listHookMock).not.toHaveBeenCalled();
  });
});

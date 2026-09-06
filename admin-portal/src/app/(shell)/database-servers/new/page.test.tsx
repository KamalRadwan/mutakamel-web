// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/context/AuthContext";
import NewDatabaseServerPage from "./page";

vi.mock("@/context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", dir: "ltr" }),
}));
vi.mock("@/features/admin/database-servers/components/CreateDatabaseServerWizard", () => ({
  CreateDatabaseServerWizard: () => <div data-testid="database-server-wizard" />,
}));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockedUseAuth = vi.mocked(useAuth);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("NewDatabaseServerPage", () => {
  it("does not mount the registration wizard without create permission", () => {
    mockedUseAuth.mockReturnValue({
      user: { isSuperAdmin: false, permissions: [] } as never,
      authState: "AUTHENTICATED",
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      acceptInvite: vi.fn(),
      resetPassword: vi.fn(),
      logout: vi.fn(),
      logoutAll: vi.fn(),
      retryBootstrap: vi.fn(),
      bootstrapFailure: null,
      freshLoginCount: 0,
    });

    render(<NewDatabaseServerPage />);

    expect(screen.queryByTestId("database-server-wizard")).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain(
      "admin.database_servers.create",
    );
  });

  it("mounts the registration wizard for an authorized administrator", () => {
    mockedUseAuth.mockReturnValue({
      user: {
        isSuperAdmin: false,
        permissions: ["admin.database_servers.create"],
      } as never,
      authState: "AUTHENTICATED",
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      acceptInvite: vi.fn(),
      resetPassword: vi.fn(),
      logout: vi.fn(),
      logoutAll: vi.fn(),
      retryBootstrap: vi.fn(),
      bootstrapFailure: null,
      freshLoginCount: 0,
    });

    render(<NewDatabaseServerPage />);

    expect(screen.getByTestId("database-server-wizard")).not.toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

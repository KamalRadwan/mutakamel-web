// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, i18nMock } = vi.hoisted(() => ({
  authMock: {
    user: {
      isSuperAdmin: false,
      permissions: [] as string[],
    },
    isLoading: false,
  },
  i18nMock: { lang: "en" as "ar" | "en" },
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => authMock }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => i18nMock }));

import { RequirePermission } from "./RequirePermission";

describe("RequirePermission", () => {
  beforeEach(() => {
    authMock.user = { isSuperAdmin: false, permissions: [] };
    authMock.isLoading = false;
    i18nMock.lang = "en";
  });

  it("preserves the single-permission policy", () => {
    authMock.user.permissions = ["admin.backups.read"];
    render(
      <RequirePermission permission="admin.backups.read">
        <p>Protected content</p>
      </RequirePermission>,
    );

    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });

  it("fails closed for no or partial ALL permission sets", () => {
    const policy = ["admin.settings.update", "admin.settings.critical"];
    authMock.user.permissions = ["admin.settings.update"];
    const { rerender } = render(
      <RequirePermission allOf={policy}>
        <p>Critical settings</p>
      </RequirePermission>,
    );

    expect(screen.queryByText("Critical settings")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("all of");

    authMock.user.permissions = policy;
    rerender(
      <RequirePermission allOf={policy}>
        <p>Critical settings</p>
      </RequirePermission>,
    );
    expect(screen.getByText("Critical settings")).toBeInTheDocument();
  });

  it("allows ANY when exactly one candidate permission is present", () => {
    authMock.user.permissions = ["admin.tenants.create"];
    render(
      <RequirePermission anyOf={["admin.catalog.read", "admin.tenants.create"]}>
        <p>Subscription quote</p>
      </RequirePermission>,
    );

    expect(screen.getByText("Subscription quote")).toBeInTheDocument();
  });

  it("treats empty policies as invalid and renders the caller fallback", () => {
    render(
      <RequirePermission allOf={[]} fallback={<p>Hidden safely</p>}>
        <p>Never rendered</p>
      </RequirePermission>,
    );

    expect(screen.getByText("Hidden safely")).toBeInTheDocument();
    expect(screen.queryByText("Never rendered")).not.toBeInTheDocument();
  });

  it("honors super-admin semantics and hides content while auth is loading", () => {
    authMock.user = { isSuperAdmin: true, permissions: [] };
    const { rerender } = render(
      <RequirePermission allOf={["one", "two"]}>
        <p>Super admin content</p>
      </RequirePermission>,
    );
    expect(screen.getByText("Super admin content")).toBeInTheDocument();

    authMock.isLoading = true;
    rerender(
      <RequirePermission allOf={["one", "two"]}>
        <p>Super admin content</p>
      </RequirePermission>,
    );
    expect(screen.queryByText("Super admin content")).not.toBeInTheDocument();
  });

  it("renders the denial state in Arabic without weakening the policy", () => {
    i18nMock.lang = "ar";
    render(
      <RequirePermission anyOf={["admin.roles.read", "admin.users.read"]}>
        <p>Never rendered</p>
      </RequirePermission>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("غير مصرح لك");
  });
});

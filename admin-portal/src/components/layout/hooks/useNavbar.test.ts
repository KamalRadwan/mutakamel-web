// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock } = vi.hoisted(() => ({
  authMock: {
    user: {
      isSuperAdmin: false,
      permissions: ["admin.audit.read"],
    } as { isSuperAdmin: boolean; permissions: string[] } | null,
  },
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/audit" }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => authMock }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    lang: "en",
    t: {
      common: {
        appName: "Mutakamel",
        adminTag: "Admin",
        portalName: "Portal",
      },
      nav: {
        users: "Users",
        roles: "Roles",
        reports: "Reports",
        subscriptions: "Subscriptions",
        invoices: "Invoices",
        logging: "Logging control",
        provisioning: "Provisioning governance",
        databaseServers: "Database servers",
        storageServers: "Storage servers",
        dashboard: "Dashboard",
        infrastructure: "Infrastructure",
        tenants: "Tenants",
        applications: "Applications",
        backup: "Backup",
        adminDropdown: "Administration",
        settings: "Settings",
      },
    },
  }),
}));

import { useNavbar } from "./useNavbar";

describe("useNavbar audit destination", () => {
  beforeEach(() => {
    authMock.user = {
      isSuperAdmin: false,
      permissions: ["admin.audit.read"],
    };
  });

  it("shows and activates the audit destination for an authorized admin", () => {
    const { result } = renderHook(() => useNavbar());

    expect(result.current.filteredAdminItems).toContainEqual({
      label: "Audit log",
      href: "/audit",
      permission: "admin.audit.read",
    });
    expect(result.current.isAdminChildActive).toBe(true);
  });

  it("does not disclose the audit destination without its read permission", () => {
    authMock.user = { isSuperAdmin: false, permissions: [] };
    const { result } = renderHook(() => useNavbar());

    expect(result.current.filteredAdminItems).not.toContainEqual(
      expect.objectContaining({ href: "/audit" }),
    );
  });

  it("shows reports and subscriptions only with their exact read permissions", () => {
    authMock.user = {
      isSuperAdmin: false,
      permissions: ["admin.reports.read", "admin.subscriptions.read"],
    };
    const { result } = renderHook(() => useNavbar());

    expect(result.current.filteredAdminItems).toEqual(
      expect.arrayContaining([
        {
          label: "Reports",
          href: "/reports",
          permission: "admin.reports.read",
        },
        {
          label: "Subscriptions",
          href: "/subscriptions",
          permission: "admin.subscriptions.read",
        },
      ]),
    );

    authMock.user = { isSuperAdmin: false, permissions: [] };
    const unauthorized = renderHook(() => useNavbar());
    expect(unauthorized.result.current.filteredAdminItems).not.toContainEqual(
      expect.objectContaining({ href: "/reports" }),
    );
    expect(unauthorized.result.current.filteredAdminItems).not.toContainEqual(
      expect.objectContaining({ href: "/subscriptions" }),
    );
  });

  it("permission-filters invoices, logging, and any-readable provisioning destination", () => {
    authMock.user = {
      isSuperAdmin: false,
      permissions: [
        "admin.invoices.read",
        "admin.logging.read",
        "admin.provisioning.discovery.read",
      ],
    };
    const { result } = renderHook(() => useNavbar());

    expect(result.current.filteredAdminItems).toEqual(
      expect.arrayContaining([
        {
          label: "Invoices",
          href: "/invoices",
          permission: "admin.invoices.read",
        },
        {
          label: "Logging control",
          href: "/logging",
          permission: "admin.logging.read",
        },
        expect.objectContaining({
          label: "Provisioning governance",
          href: "/provisioning",
        }),
      ]),
    );

    authMock.user = { isSuperAdmin: false, permissions: [] };
    const unauthorized = renderHook(() => useNavbar());
    expect(unauthorized.result.current.filteredAdminItems).not.toContainEqual(
      expect.objectContaining({ href: "/invoices" }),
    );
    expect(unauthorized.result.current.filteredAdminItems).not.toContainEqual(
      expect.objectContaining({ href: "/logging" }),
    );
    expect(unauthorized.result.current.filteredAdminItems).not.toContainEqual(
      expect.objectContaining({ href: "/provisioning" }),
    );
  });

  it("permission-filters top-level destinations and chooses an authorized brand home", () => {
    authMock.user = {
      isSuperAdmin: false,
      permissions: ["admin.tenants.read"],
    };
    const { result } = renderHook(() => useNavbar());

    expect(result.current.canViewDashboard).toBe(false);
    expect(result.current.canViewTenants).toBe(true);
    expect(result.current.canViewApplications).toBe(false);
    expect(result.current.homeHref).toBe("/tenants");

    authMock.user = { isSuperAdmin: false, permissions: [] };
    const noRoutes = renderHook(() => useNavbar());
    expect(noRoutes.result.current.homeHref).toBe("/profile");
  });

  it("links create-only infrastructure actors directly to registration screens", () => {
    authMock.user = {
      isSuperAdmin: false,
      permissions: [
        "admin.applications.create",
        "admin.database_servers.create",
        "admin.storage_servers.create",
        "admin.storage_servers.critical",
      ],
    };

    const { result } = renderHook(() => useNavbar());

    expect(result.current.canViewApplications).toBe(true);
    expect(result.current.filteredInfrastructureItems).toEqual([
      { label: "Database servers", href: "/database-servers/new" },
      { label: "Storage servers", href: "/storage-servers/new" },
    ]);
    expect(result.current.homeHref).toBe("/applications-catalogue");
  });
});

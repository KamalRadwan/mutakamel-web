"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";
import { useAuth } from "@/context/AuthContext";
import {
  ADMIN_RBAC_CRITICAL,
  adminCan,
  adminCanAll,
  adminCanAny,
} from "@/lib/auth/rbac";

export interface UseNavbarProps {
  onMobileMenuToggle?: () => void;
  onWebPhoneToggle?: () => void;
}

export function useNavbar(props: UseNavbarProps = {}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAdminDropdownOpen, setIsAdminDropdownOpen] = useState(false);
  const [isInfrastructureDropdownOpen, setIsInfrastructureDropdownOpen] =
    useState(false);
  const pathname = usePathname();
  const { t, lang } = useI18n();
  const auth = useAuth();
  const canViewDashboard = adminCan(auth?.user, "admin.reports.read");
  const canViewTenants = adminCan(auth?.user, "admin.tenants.read");
  const canViewApplications =
    adminCan(auth?.user, "admin.applications.read") ||
    adminCan(auth?.user, "admin.applications.create");
  const canViewDatabaseServers = adminCan(
    auth?.user,
    "admin.database_servers.read",
  );
  const canRegisterDatabaseServer = adminCan(
    auth?.user,
    "admin.database_servers.create",
  );
  const canViewStorageServers = adminCan(
    auth?.user,
    "admin.storage_servers.read",
  );
  const canRegisterStorageServer = adminCanAll(
    auth?.user,
    ADMIN_RBAC_CRITICAL.STORAGE_SERVERS_CREATE,
  );

  const handleMobileMenuToggle = () => {
    setIsMobileMenuOpen((prev) => !prev);
    props.onMobileMenuToggle?.();
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const handleWebPhoneToggle = () => {
    props.onWebPhoneToggle?.();
  };

  const toggleAdminDropdown = () => {
    setIsAdminDropdownOpen((prev) => !prev);
  };

  const closeAdminDropdown = () => {
    setIsAdminDropdownOpen(false);
  };

  const toggleInfrastructureDropdown = () => {
    setIsInfrastructureDropdownOpen((previous) => !previous);
  };

  const closeInfrastructureDropdown = () => {
    setIsInfrastructureDropdownOpen(false);
  };

  const isLinkActive = (path: string) => {
    if (
      path === "/dashboard" &&
      (pathname === "/" || pathname === "/dashboard")
    ) {
      return true;
    }
    return pathname === path || pathname.startsWith(path + "/");
  };

  const isAdminChildActive =
    pathname.startsWith("/users") ||
    pathname.startsWith("/roles") ||
    pathname.startsWith("/audit") ||
    pathname.startsWith("/reports") ||
    pathname.startsWith("/subscriptions") ||
    pathname.startsWith("/invoices") ||
    pathname.startsWith("/logging") ||
    pathname.startsWith("/provisioning");
  const isInfrastructureChildActive =
    pathname.startsWith("/database-servers") ||
    pathname.startsWith("/storage-servers");

  // Define full routes
  const rawAdminItems = [
    { label: t.nav.users, href: "/users", permission: "admin.users.read" },
    { label: t.nav.roles, href: "/roles", permission: "admin.roles.read" },
    {
      label: lang === "ar" ? "سجل التدقيق" : "Audit log",
      href: "/audit",
      permission: "admin.audit.read",
    },
    {
      label: t.nav.reports,
      href: "/reports",
      permission: "admin.reports.read",
    },
    {
      label: t.nav.subscriptions,
      href: "/subscriptions",
      permission: "admin.subscriptions.read",
    },
    {
      label: t.nav.invoices,
      href: "/invoices",
      permission: "admin.invoices.read",
    },
    {
      label: t.nav.logging,
      href: "/logging",
      permission: "admin.logging.read",
    },
    {
      label: t.nav.provisioning,
      href: "/provisioning",
      permissions: [
        "admin.tenants.read",
        "admin.provisioning.discovery.read",
        "admin.provisioning.rollouts.read",
        "admin.provisioning.rollouts.report",
        "admin.provisioning.publisher-keys.read",
        "admin.provisioning.releases.read",
      ],
    },
  ];

  // Filter based on permissions
  const filteredAdminItems = rawAdminItems.filter((item) =>
    Array.isArray(item.permissions)
      ? adminCanAny(auth?.user, item.permissions)
      : !item.permission || adminCan(auth?.user, item.permission),
  );

  const filteredInfrastructureItems = [
    ...(canViewDatabaseServers || canRegisterDatabaseServer
      ? [{
      label: t.nav.databaseServers,
      href: canViewDatabaseServers
        ? "/database-servers"
        : "/database-servers/new",
    }]
      : []),
    ...(canViewStorageServers || canRegisterStorageServer
      ? [{
      label: t.nav.storageServers,
      href: canViewStorageServers ? "/storage-servers" : "/storage-servers/new",
    }]
      : []),
  ];
  const homeHref = canViewDashboard
    ? "/dashboard"
    : canViewTenants
      ? "/tenants"
      : canViewApplications
        ? "/applications-catalogue"
        : (filteredInfrastructureItems[0]?.href ??
          filteredAdminItems[0]?.href ??
          "/profile");

  return {
    pathname,
    isMobileMenuOpen,
    isAdminDropdownOpen,
    isInfrastructureDropdownOpen,
    handleMobileMenuToggle,
    closeMobileMenu,
    handleWebPhoneToggle,
    toggleAdminDropdown,
    closeAdminDropdown,
    toggleInfrastructureDropdown,
    closeInfrastructureDropdown,
    isLinkActive,
    isAdminChildActive,
    isInfrastructureChildActive,
    filteredAdminItems,
    filteredInfrastructureItems,
    homeHref,
    canViewDashboard,
    canViewTenants,
    canViewApplications,
    canViewDatabaseServers,
    canViewStorageServers,
    canViewBackup: adminCan(auth?.user, "admin.backups.read"),
    brand: {
      title: t.common.appName,
      subTitle: t.common.adminTag,
      portalName: t.common.portalName,
    },
    navRoutes: {
      dashboard: { label: t.nav.dashboard, href: "/dashboard" },
      infrastructureDropdown: { label: t.nav.infrastructure },
      tenants: { label: t.nav.tenants, href: "/tenants" },
      applications: {
        label: t.nav.applications,
        href: "/applications-catalogue",
      },
      backup: { label: t.nav.backup, href: "/backup" },
      databaseServers: {
        label: t.nav.databaseServers,
        href: "/database-servers",
      },
      storageServers: { label: t.nav.storageServers, href: "/storage-servers" },
      adminDropdown: {
        label: t.nav.adminDropdown,
      },
      settings: { label: t.nav.settings, href: "/settings" },
    },
  };
}

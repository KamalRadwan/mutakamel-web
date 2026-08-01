"use client";

import { useState, useContext } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";
import { useAuth } from "@/context/AuthContext";
import { adminCanAll, adminCan } from "@/lib/auth/rbac";

export interface UseNavbarProps {
  onMobileMenuToggle?: () => void;
  onWebPhoneToggle?: () => void;
}

export function useNavbar(props: UseNavbarProps = {}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAdminDropdownOpen, setIsAdminDropdownOpen] = useState(false);
  const [isInfrastructureDropdownOpen, setIsInfrastructureDropdownOpen] = useState(false);
  const pathname = usePathname();
  const { t } = useI18n();
  const auth = useAuth();

  const handleMobileMenuToggle = () => {
    setIsMobileMenuOpen((prev) => !prev);
    props.onMobileMenuToggle?.();
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
    setIsInfrastructureDropdownOpen((prev) => !prev);
  };

  const closeInfrastructureDropdown = () => {
    setIsInfrastructureDropdownOpen(false);
  };

  const isLinkActive = (path: string) => {
    if (path === "/dashboard" && (pathname === "/" || pathname === "/dashboard")) {
      return true;
    }
    return pathname === path || pathname.startsWith(path + "/");
  };

  const isAdminChildActive = pathname.startsWith("/users") || pathname.startsWith("/roles");
  const isInfrastructureChildActive = pathname.startsWith("/database-servers") || pathname.startsWith("/storage-servers");

  // Define full routes
  const rawAdminItems = [
    { label: t.nav.users, href: "/users", permission: "admin.users.read" },
    { label: t.nav.roles, href: "/roles", permission: "admin.roles.read" },
  ];

  // Filter based on permissions
  const filteredAdminItems = rawAdminItems.filter(item => 
    !item.permission || adminCan(auth?.user, item.permission)
  );

  const rawInfrastructureItems = [
    { label: t.nav.databaseServers, href: "/database-servers", permission: "admin.database_servers.read" },
    { label: t.nav.storageServers, href: "/storage-servers", permission: "admin.storage_servers.read" },
  ];

  const filteredInfrastructureItems = rawInfrastructureItems.filter(item => 
    !item.permission || adminCan(auth?.user, item.permission)
  );

  return {
    pathname,
    isMobileMenuOpen,
    isAdminDropdownOpen,
    isInfrastructureDropdownOpen,
    handleMobileMenuToggle,
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
    brand: {
      title: t.common.appName,
      subTitle: t.common.adminTag,
      portalName: t.common.portalName,
    },
    navRoutes: {
      dashboard: { label: t.nav.dashboard, href: "/dashboard" },
      tenants: { label: t.nav.tenants, href: "/tenants" },
      modules: { label: t.nav.modules, href: "/modules" },
      infrastructureDropdown: { label: t.nav.infrastructure || "Infrastructure" },
      adminDropdown: {
        label: t.nav.adminDropdown,
      },
      settings: { label: t.nav.settings, href: "/settings" },
    },
  };
}

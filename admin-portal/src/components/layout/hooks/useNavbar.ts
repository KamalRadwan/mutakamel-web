"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";

export interface UseNavbarProps {
  onMobileMenuToggle?: () => void;
  onWebPhoneToggle?: () => void;
}

export function useNavbar(props: UseNavbarProps = {}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAdminDropdownOpen, setIsAdminDropdownOpen] = useState(false);
  const pathname = usePathname();
  const { t } = useI18n();

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

  const isLinkActive = (path: string) => {
    if (path === "/dashboard" && (pathname === "/" || pathname === "/dashboard")) {
      return true;
    }
    return pathname === path || pathname.startsWith(path + "/");
  };

  const isAdminChildActive = pathname.startsWith("/users") || pathname.startsWith("/roles");

  return {
    pathname,
    isMobileMenuOpen,
    isAdminDropdownOpen,
    handleMobileMenuToggle,
    handleWebPhoneToggle,
    toggleAdminDropdown,
    closeAdminDropdown,
    isLinkActive,
    isAdminChildActive,
    brand: {
      title: t.common.appName,
      subTitle: t.common.adminTag,
      portalName: t.common.portalName,
    },
    navRoutes: {
      dashboard: { label: t.nav.dashboard, href: "/dashboard" },
      databaseServers: { label: t.nav.databaseServers, href: "/database-servers" },
      tenants: { label: t.nav.tenants, href: "/tenants" },
      modules: { label: t.nav.modules, href: "/modules" },
      adminDropdown: {
        label: t.nav.adminDropdown,
        items: [
          { label: t.nav.users, href: "/users" },
          { label: t.nav.roles, href: "/roles" },
        ],
      },
      settings: { label: t.nav.settings, href: "/settings" },
    },
  };
}

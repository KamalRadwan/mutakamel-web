"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantAuth } from "@/context/AuthContext";
import {
  TENANT_ROUTES,
  getFirstPermittedCrmRoute,
} from "@/lib/navigation/tenant-routes";
import { Layers, ShoppingCart, TrendingUp } from "lucide-react";

export function useNavbar() {
  const pathname = usePathname();
  const { t } = useI18n();
  const { user } = useTenantAuth();
  const crmEntryRoute = getFirstPermittedCrmRoute(user?.permissions ?? []);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const apps = [
    {
      id: "core",
      name: t.nav.workspaceCenter,
      href: TENANT_ROUTES.home,
      icon: Layers,
      description: "Core System & Workspace",
      isActive: pathname.startsWith("/core") || (pathname === "/" && !pathname.startsWith("/crm") && !pathname.startsWith("/trade")),
    },
    ...(crmEntryRoute
      ? [
          {
            id: "crm",
            name: "CRM",
            href: crmEntryRoute,
            icon: TrendingUp,
            description: "Customer Relationship Management",
            isActive: pathname.startsWith(TENANT_ROUTES.crm),
          },
        ]
      : []),
  ];

  const activeApp = pathname.startsWith(TENANT_ROUTES.trade)
    ? {
        id: "trade",
        name: "Trade",
        href: TENANT_ROUTES.trade,
        icon: ShoppingCart,
        description: "Trade portal migration",
        isActive: true,
      }
    : apps.find((app) => app.isActive) || apps[0];

  const toggleDropdown = () => setIsOpen((prev) => !prev);
  const closeDropdown = () => setIsOpen(false);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return {
    t,
    apps,
    activeApp,
    isOpen,
    toggleDropdown,
    closeDropdown,
    dropdownRef,
  };
}

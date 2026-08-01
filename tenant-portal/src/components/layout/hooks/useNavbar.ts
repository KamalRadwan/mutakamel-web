"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";
import { Layers, TrendingUp, ShoppingCart } from "lucide-react";

export function useNavbar() {
  const pathname = usePathname();
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const apps = [
    {
      id: "core",
      name: t.nav.workspaceCenter,
      href: "/",
      icon: Layers,
      description: "Core System & Workspace",
      isActive: pathname.startsWith("/core") || (pathname === "/" && !pathname.startsWith("/crm") && !pathname.startsWith("/trade")),
    },
    {
      id: "crm",
      name: "CRM",
      href: "/crm/dashboard",
      icon: TrendingUp,
      description: "Customer Relationship Management",
      isActive: pathname.startsWith("/crm"),
    },
    {
      id: "trade",
      name: "Trade",
      href: "/trade/dashboard-builder",
      icon: ShoppingCart,
      description: "Trade & Commercial Operations",
      isActive: pathname.startsWith("/trade"),
    },
  ];

  const activeApp = apps.find((app) => app.isActive) || apps[0];

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

"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSidebar } from "./useSidebar";
import { useCommandPalette } from "./useCommandPalette";

export function useAppShell(defaultSidebarCollapsed: boolean) {
  const { collapsed, toggle: toggleSidebar } = useSidebar(defaultSidebarCollapsed);
  const { open: commandPaletteOpen, setOpen: setCommandPaletteOpen, sections: commandPaletteSections, navigate: navigateFromCommandPalette } =
    useCommandPalette();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    queueMicrotask(() => setMobileNavOpen(false));
  }, [pathname]);

  const openMobileNav = useCallback(() => setMobileNavOpen(true), []);
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);
  const openCommandPalette = useCallback(() => setCommandPaletteOpen(true), [setCommandPaletteOpen]);

  return {
    sidebarCollapsed: collapsed,
    toggleSidebar,
    mobileNavOpen,
    openMobileNav,
    closeMobileNav,
    setMobileNavOpen,
    commandPaletteOpen,
    setCommandPaletteOpen,
    commandPaletteSections,
    navigateFromCommandPalette,
    openCommandPalette,
  };
}

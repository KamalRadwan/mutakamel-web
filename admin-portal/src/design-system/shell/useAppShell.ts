"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useSidebar } from "./useSidebar";
import { useCommandPalette } from "./useCommandPalette";

export function useAppShell(defaultSidebarCollapsed: boolean) {
  const { collapsed, toggle: toggleSidebar } = useSidebar(defaultSidebarCollapsed);
  const { open: commandPaletteOpen, setOpen: setCommandPaletteOpen, sections: commandPaletteSections, navigate: navigateFromCommandPalette } =
    useCommandPalette();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);
  const previousPathnameRef = useRef(pathname);

  useEffect(() => {
    queueMicrotask(() => setMobileNavOpen(false));

    if (previousPathnameRef.current === pathname) return;
    previousPathnameRef.current = pathname;

    // Next's built-in route announcer already announces the new title/h1.
    // Focusing the stable main landmark restores keyboard position without
    // adding a second live announcement or depending on page-specific timing.
    const animationFrame = window.requestAnimationFrame(() => {
      mainRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [pathname]);

  const openMobileNav = useCallback(() => setMobileNavOpen(true), []);
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);
  const openCommandPalette = useCallback(() => setCommandPaletteOpen(true), [setCommandPaletteOpen]);

  return {
    sidebarCollapsed: collapsed,
    toggleSidebar,
    mainRef,
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

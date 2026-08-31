"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { TooltipProvider } from "../primitives/Tooltip";
import { cn } from "../lib/cn";
import { focusRing, hitArea } from "../lib/variants";
import { Sidebar, SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_EXPANDED_WIDTH } from "./Sidebar";
import { Topbar } from "./Topbar";
import { MobileNav } from "./MobileNav";
import { CommandPalette } from "./CommandPalette";
import { useAppShell } from "./useAppShell";

export function AppShell({ children, defaultSidebarCollapsed }: { children: ReactNode; defaultSidebarCollapsed: boolean }) {
  const { lang } = useI18n();
  const {
    sidebarCollapsed,
    toggleSidebar,
    mainRef,
    mobileNavOpen,
    openMobileNav,
    setMobileNavOpen,
    commandPaletteOpen,
    setCommandPaletteOpen,
    commandPaletteSections,
    navigateFromCommandPalette,
    openCommandPalette,
  } = useAppShell(defaultSidebarCollapsed);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-dvh bg-background">
        <a
          href="#admin-main-content"
          className={cn(
            "fixed start-3 top-3 z-50 -translate-y-24 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground",
            "focus:translate-y-0 motion-reduce:transition-none",
            focusRing,
            hitArea,
          )}
        >
          {lang === "ar" ? "تخطي إلى المحتوى الرئيسي" : "Skip to main content"}
        </a>

        <Sidebar collapsed={sidebarCollapsed} onToggleCollapse={toggleSidebar} />

        <div
          className="flex min-h-dvh flex-col transition-[margin] duration-150 motion-reduce:transition-none lg:ms-(--shell-sidebar-width)"
          style={{ "--shell-sidebar-width": sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH } as React.CSSProperties}
        >
          <Topbar onOpenMobileNav={openMobileNav} onOpenSearch={openCommandPalette} />
          <main
            id="admin-main-content"
            ref={mainRef}
            tabIndex={-1}
            className="flex-1 scroll-mt-14 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:p-6"
          >
            {children}
          </main>
        </div>

        <MobileNav open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
        <CommandPalette
          open={commandPaletteOpen}
          onOpenChange={setCommandPaletteOpen}
          sections={commandPaletteSections}
          onNavigate={navigateFromCommandPalette}
        />
      </div>
    </TooltipProvider>
  );
}

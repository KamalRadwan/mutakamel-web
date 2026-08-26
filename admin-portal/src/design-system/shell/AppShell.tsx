"use client";

import type { ReactNode } from "react";
import { TooltipProvider } from "../primitives/Tooltip";
import { Sidebar, SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_EXPANDED_WIDTH } from "./Sidebar";
import { Topbar } from "./Topbar";
import { MobileNav } from "./MobileNav";
import { CommandPalette } from "./CommandPalette";
import { useAppShell } from "./useAppShell";

export function AppShell({ children, defaultSidebarCollapsed }: { children: ReactNode; defaultSidebarCollapsed: boolean }) {
  const shell = useAppShell(defaultSidebarCollapsed);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-dvh bg-background">
        <Sidebar collapsed={shell.sidebarCollapsed} onToggleCollapse={shell.toggleSidebar} />

        <div
          className="flex min-h-dvh flex-col transition-[margin] duration-150 lg:ms-(--shell-sidebar-width)"
          style={{ "--shell-sidebar-width": shell.sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH } as React.CSSProperties}
        >
          <Topbar onOpenMobileNav={shell.openMobileNav} onOpenSearch={shell.openCommandPalette} />
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>

        <MobileNav open={shell.mobileNavOpen} onOpenChange={shell.setMobileNavOpen} />
        <CommandPalette
          open={shell.commandPaletteOpen}
          onOpenChange={shell.setCommandPaletteOpen}
          sections={shell.commandPaletteSections}
          onNavigate={shell.navigateFromCommandPalette}
        />
      </div>
    </TooltipProvider>
  );
}

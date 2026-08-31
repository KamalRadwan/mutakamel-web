"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { focusRing } from "../lib/variants";
import { cn } from "../lib/cn";
import { OfflineBanner } from "../patterns/offline-banner/OfflineBanner";
import { useConnectivity } from "../patterns/offline-banner/useConnectivity";
import { MobileNav } from "./MobileNav";
import { NavCommandPalette } from "./NavCommandPalette";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useNavTree } from "./useNavTree";
import { useSidebar, type SidebarState } from "./useSidebar";

export interface AppShellProps {
  children: React.ReactNode;
  // Read server-side from the tenant_sidebar cookie in
  // app/(tenant)/layout.tsx — the one shell dimension genuinely resolved
  // server-side, so there is no collapse flash on first paint. A first-ever
  // visitor (no cookie yet) starts expanded; this does not implement
  // shell.md's viewport-conditional default (collapsed at lg-xl, expanded
  // at xl+), which would need a hydration-unsafe viewport read to do
  // server-side.
  initialSidebarState: SidebarState;
}

export function AppShell({ children, initialSidebarState }: AppShellProps) {
  const { t } = useI18n();
  const { state } = useSidebar(initialSidebarState);
  const sections = useNavTree();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { status, stopReason } = useConnectivity();

  return (
    <div className="relative flex h-dvh overflow-hidden bg-canvas">
      {/* B6 (SKILL-AUDIT.md): the first focusable element in the app.
          Without it a keyboard user tabs the whole sidebar — up to eleven
          items plus the collapse control — on every page load before
          reaching the screen they asked for. `sr-only` until focused, then
          `not-sr-only` so it is genuinely visible — a skip link nobody can
          see is a skip link nobody uses. No transform, so nothing here is
          animating a layout property. docs/design/shell.md#skip-link. */}
      <a
        href="#main"
        className={cn(
          "sr-only print:hidden",
          "focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-(--z-topbar)",
          "focus:rounded-sm focus:border focus:border-border focus:bg-card",
          "focus:px-3 focus:py-1.5 focus:text-sm focus:text-foreground",
          focusRing,
        )}
      >
        {t.common.skipToContent}
      </a>
      <div className="hidden lg:block print:hidden">
        <Sidebar sections={sections} state={state} />
      </div>
      <MobileNav sections={sections} open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
      {/* Mounted once, at the shell — the palette is global by definition and
          a second instance would fight for Ctrl/Cmd+K. */}
      <NavCommandPalette />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar onMobileMenuOpen={() => setMobileNavOpen(true)} />
        {/* Above <main>, not inside it: the connection state is a property of
            the whole session, and a strip that scrolls away with the page is
            one the user stops seeing. */}
        <OfflineBanner
          status={status}
          stopReason={stopReason}
          labels={t.connectivity}
          onReload={() => window.location.reload()}
        />
        {/* tabIndex -1 so the skip link's target can actually take focus:
            without it the browser scrolls to <main> but leaves focus at the
            top of the document, and the next Tab lands back in the nav. */}
        <main id="main" tabIndex={-1} className="flex-1 overflow-y-auto p-4 outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}

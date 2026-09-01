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
import { useActiveApp } from "./useActiveApp";
import { useNavApps } from "./useNavApps";
import { useSidebar, type SidebarState } from "./useSidebar";
import type { NavAppId } from "./nav-config";

export interface AppShellProps {
  children: React.ReactNode;
  // Read server-side from the tenant_app cookie in app/(tenant)/layout.tsx,
  // the same way initialSidebarState is — so the first painted frame already
  // shows the right app's sidebar. It is only the FALLBACK: `useActiveApp`
  // derives the app from the route wherever the route belongs to one, and
  // consults this only for `/`, `/search` and `/getting-started`.
  initialApp: NavAppId;
  // Read server-side from the tenant_sidebar cookie in
  // app/(tenant)/layout.tsx — the one shell dimension genuinely resolved
  // server-side, so there is no collapse flash on first paint. A first-ever
  // visitor (no cookie yet) starts expanded; this does not implement
  // shell.md's viewport-conditional default (collapsed at lg-xl, expanded
  // at xl+), which would need a hydration-unsafe viewport read to do
  // server-side.
  initialSidebarState: SidebarState;
}

export function AppShell({ children, initialSidebarState, initialApp }: AppShellProps) {
  const { t } = useI18n();
  const { state } = useSidebar(initialSidebarState);
  const apps = useNavApps();
  const { app, selectApp } = useActiveApp(initialApp);
  // The sidebar is scoped to one app. `apps` is already permission-filtered,
  // so this is the second, independent cut: permissions decide what exists,
  // the switcher decides which slice of it is on screen. Nothing is hidden
  // permanently — every section belongs to exactly one app (asserted in
  // nav-config.test.ts) and Ctrl/Cmd+K still searches all of them.
  const sections = apps.find((entry) => entry.id === app)?.sections ?? [];
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
        <Sidebar sections={sections} state={state} apps={apps} activeApp={app} />
      </div>
      <MobileNav
        sections={sections}
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
        apps={apps}
        activeApp={app}
      />
      {/* Mounted once, at the shell — the palette is global by definition and
          a second instance would fight for Ctrl/Cmd+K. */}
      <NavCommandPalette />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar
          onMobileMenuOpen={() => setMobileNavOpen(true)}
          apps={apps}
          activeApp={app}
          onAppSelect={selectApp}
        />
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
        <main id="main" tabIndex={-1} className="flex-1 scroll-mt-14 overflow-y-auto p-4 outline-none md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { PanelLeft } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { focusRing } from "../lib/variants";
import { cn } from "../lib/cn";
import { OfflineBanner } from "../patterns/offline-banner/OfflineBanner";
import { useConnectivity } from "../patterns/offline-banner/useConnectivity";
import { GlobalNav } from "./GlobalNav";
import { NavCommandPalette } from "./NavCommandPalette";
import { NavSheet } from "./NavSheet";
import { PageActionBar } from "./PageActionBar";
import { PageActionSlotsProvider } from "./page-action-slots";
import { useActiveApp } from "./useActiveApp";
import { useNavApps } from "./useNavApps";
import { useNavLocation } from "./useNavLocation";
import { useCrmSettingsNavigation } from "./useCrmSettingsNavigation";
import { CrmSettingsAside, CrmSettingsSheet } from "./CrmSettingsAside";
import { SettingsPresentationContext } from "./settings-presentation";
import { AnalyticsPresentationContext } from "./analytics-presentation";
import { Button } from "../primitives/Button";
import type { NavAppId } from "./nav-config";

export interface AppShellProps {
  children: React.ReactNode;
  // Read server-side from the tenant_app cookie in app/(tenant)/layout.tsx, so
  // the first painted frame already shows the right app's menus. It is only the
  // FALLBACK: `useActiveApp` derives the app from the route wherever the route
  // belongs to one, and consults this only for `/`, `/search` and
  // `/getting-started`.
  initialApp: NavAppId;
}

/**
 * Ocean Navy global navigation above a full-height content column.
 *
 * ```text
 * ┌ GlobalNav ── brand · app · destinations · Settings · account ┐
 * │ Settings aside │ PageActionBar                              │
 * │ (settings only)│ main                                       │
 * ```
 *
 * The 240px aside belongs only to CRM Settings. Record pages retain all
 * available width; the compact Sections sheet replaces the aside below lg.
 *
 * **The height chain is load-bearing.** `h-dvh` here, `shrink-0` on both bars,
 * `flex-1` on `<main>`. Every board and every `h-full` view inside one resolves
 * its height through this and collapses to nothing if `<main>` stops being a
 * flex item with a definite height. Both intermediate columns use min-h-0.
 * It is equally load-bearing that a screen
 * root is `<main>`'s CHILD: a segment layout that wraps it in a real box makes
 * `h-full` resolve against that box's auto height instead, which is why the
 * Core, CRM and Trade segment layouts all render their children directly.
 * `dvh`, not `vh`, so mobile browser chrome does not clip the board.
 */
export function AppShell({ children, initialApp }: AppShellProps) {
  const { t } = useI18n();
  const apps = useNavApps();
  const { app, selectApp } = useActiveApp(initialApp);
  // The nav is scoped to one app. `apps` is already permission-filtered, so
  // this is the second, independent cut: permissions decide what exists, the
  // switcher decides which slice of it is on screen. Nothing is hidden
  // permanently — every section belongs to exactly one app (asserted in
  // nav-config.test.ts) and Ctrl/Cmd+K still searches all of them.
  const activeApp = apps.find((entry) => entry.id === app);
  const sections = activeApp?.sections ?? [];
  const appLabelKey = activeApp?.labelKey ?? "appWorkspace";
  const { itemId } = useNavLocation(sections);
  const settings = useCrmSettingsNavigation(sections);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { status, stopReason } = useConnectivity();

  return (
    <PageActionSlotsProvider>
      <div className="relative flex h-dvh flex-col overflow-hidden bg-gradient-canvas">
        {/* B6 (SKILL-AUDIT.md): the first focusable element in the app.
            Without it a keyboard user tabs the whole nav — the brand, the
            switcher and up to six menus — on every page load before reaching
            the screen they asked for. `sr-only` until focused, then
            `not-sr-only` so it is genuinely visible: a skip link nobody can
            see is a skip link nobody uses. No transform, so nothing here is
            animating a layout property. docs/design/shell.md#skip-link--the-first-focusable-element-in-the-app. */}
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
        <GlobalNav
          onMobileMenuOpen={() => setMobileNavOpen(true)}
          apps={apps}
          activeApp={app}
          onAppSelect={selectApp}
          sections={sections}
          activeItemId={itemId}
        />
        <NavSheet
          sections={sections}
          open={mobileNavOpen}
          onOpenChange={setMobileNavOpen}
          apps={apps}
          activeApp={app}
          activeItemId={itemId}
        />
        {/* Mounted once, at the shell — the palette is global by definition and
            a second instance would fight for Ctrl/Cmd+K. */}
        <NavCommandPalette />
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
            top of the document, and the next Tab lands back in the nav.

            `<main>` is its own scroll container, so an in-page anchor scrolls
            inside it and never under the bars, which is why no scroll-margin
            compensates for chrome height here. The `scroll-mt-14` that used to
            sit on this element was 56px against a 48px topbar and had nothing
            to do in either arrangement. */}
        {/* 10px on every side, at every width. The bar directly above already
            names the screen, so the space between it and the first control is
            spacing and nothing else — the 16/24px this inherited from the
            sidebar era read as a gap where a page title used to be, and on a
            1366×768 laptop it was 48px of vertical budget spent on nothing. */}
        <div className="flex min-h-0 flex-1">
          {settings.isSettings && <CrmSettingsAside section={settings.section} activeItemId={itemId} />}
          <div className="flex min-w-0 flex-1 flex-col">
            <PageActionBar sections={sections} appLabelKey={appLabelKey}
              leading={settings.isSettings ? (
                <Button variant="outline" size="sm" className="lg:hidden"
                  aria-controls="crm-settings-sections" aria-expanded={settings.open}
                  onClick={() => settings.onOpenChange(true)}>
                  <PanelLeft className="size-4" aria-hidden="true" />
                  {t.crmSettingsNavigation.sections}
                </Button>
              ) : undefined}
            />
            <main id="main" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto p-2.5 outline-none">
              <SettingsPresentationContext.Provider value={settings.isSettings}>
                <AnalyticsPresentationContext.Provider value={settings.isAnalytics}>
                  {children}
                </AnalyticsPresentationContext.Provider>
              </SettingsPresentationContext.Provider>
            </main>
          </div>
        </div>
        {settings.isSettings && <CrmSettingsSheet section={settings.section} activeItemId={itemId}
          open={settings.open} onOpenChange={settings.onOpenChange} />}
      </div>
    </PageActionSlotsProvider>
  );
}

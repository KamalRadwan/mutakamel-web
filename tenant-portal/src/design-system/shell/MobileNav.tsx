"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { Sheet, SheetContent, SheetTitle } from "../primitives/Sheet";
import { Sidebar } from "./Sidebar";
import type { NavApp, NavAppId, NavSection } from "./nav-config";

export interface MobileNavProps {
  sections: NavSection[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apps: NavApp[];
  activeApp: NavAppId;
}

// Full-width Sheet, below lg — closes on route change so a tapped nav item
// doesn't leave the sheet open behind the new page.
//
// It renders the same `Sidebar`, so it is app-scoped on the same terms and
// carries the same switcher: this IS the sidebar below lg, and a phone that
// showed all fifteen sections while the desktop showed six would be two
// different navigations wearing one name. Switching apps here closes the sheet
// on the route change, which lands the user in the app they picked.
export function MobileNav({
  sections,
  open,
  onOpenChange,
  apps,
  activeApp,
}: MobileNavProps) {
  const { t } = useI18n();
  const pathname = usePathname();

  useEffect(() => {
    onOpenChange(false);
    // Only the route itself should close the sheet — including onOpenChange
    // here would re-run this effect every time the sheet opens/closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="start" className="w-full max-w-none p-0 sm:max-w-none">
        {/* Names the app the sheet is showing, for the same reason the
            sidebar's own landmark does — the sheet is app-scoped now. */}
        <SheetTitle className="sr-only">
          {t.nav[
            (apps.find((app) => app.id === activeApp)?.labelKey ??
              "workspaceCenter") as keyof typeof t.nav
          ]}
        </SheetTitle>
        <Sidebar sections={sections} state="expanded" apps={apps} activeApp={activeApp} />
      </SheetContent>
    </Sheet>
  );
}

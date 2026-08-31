"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { Sheet, SheetContent, SheetTitle } from "../primitives/Sheet";
import { Sidebar } from "./Sidebar";
import type { NavSection } from "./nav-config";

export interface MobileNavProps {
  sections: NavSection[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Full-width Sheet, below lg — closes on route change so a tapped nav item
// doesn't leave the sheet open behind the new page.
export function MobileNav({ sections, open, onOpenChange }: MobileNavProps) {
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
        <SheetTitle className="sr-only">{t.nav.workspaceCenter}</SheetTitle>
        <Sidebar sections={sections} state="expanded" />
      </SheetContent>
    </Sheet>
  );
}

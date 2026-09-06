"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "../lib/cn";
import { Sheet, SheetContent, SheetTitle } from "../primitives/Sheet";
import type { NavAppId, NavApp, NavSection } from "./nav-config";

export interface NavSheetProps {
  sections: NavSection[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apps: NavApp[];
  activeApp: NavAppId;
  activeItemId: string | null;
}

/**
 * Every section of the active app, below `xl`, as an edge sheet.
 *
 * This is where the sidebar's one real advantage survives: the whole tree
 * visible at once, with its descriptive headings rather than the global nav's
 * one-word triggers. It is not a port of the old `Sidebar` — that component
 * carried an icon rail, a collapse state and a width transition, none of which
 * mean anything for a sheet — but it renders the same map on the same terms.
 *
 * Opens from the inline start via `side="start"`, so it mirrors under RTL
 * without a direction branch, and closes on a route change so a tapped item
 * does not leave the sheet standing over the screen it opened.
 */
export function NavSheet({
  sections,
  open,
  onOpenChange,
  apps,
  activeApp,
  activeItemId,
}: NavSheetProps) {
  const { t } = useI18n();
  const pathname = usePathname();

  useEffect(() => {
    onOpenChange(false);
    // Only the route itself should close the sheet — including onOpenChange
    // here would re-run this effect every time the sheet opens or closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const appLabelKey = apps.find((entry) => entry.id === activeApp)?.labelKey ?? "appWorkspace";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="start" className="w-full max-w-none overflow-y-auto p-0 sm:max-w-none">
        {/* Names the app the sheet is showing: a sheet announced as
            "navigation" while listing only CRM tells the wrong story. */}
        <SheetTitle className="px-4 pb-2 pt-4 text-sm font-medium text-foreground">
          {t.nav[appLabelKey as keyof typeof t.nav]}
        </SheetTitle>
        <nav aria-label={t.nav.mainNavigation} className="flex flex-col gap-1 px-2 pb-4">
          {sections.map((section) => (
            <div key={section.id} className="flex flex-col gap-0.5">
              <p className="px-2 pb-1 pt-3 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                {t.nav[(section.labelKey ?? section.menuLabelKey) as keyof typeof t.nav]}
              </p>
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = item.id === activeItemId;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "relative flex items-center gap-2 rounded-xs px-2 py-1.5 text-sm text-sidebar-foreground",
                      "before:absolute before:inset-y-1 before:start-0 before:w-0.5 before:rounded-full before:bg-transparent",
                      "hover:bg-accent",
                      isActive && "font-medium text-foreground before:bg-sidebar-active",
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      {t.nav[item.labelKey as keyof typeof t.nav]}
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

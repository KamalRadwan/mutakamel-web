"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";
import { useDirection } from "@/i18n/useLanguage";
import { cn } from "../lib/cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "../primitives/Tooltip";
import type { NavSection } from "./nav-config";
import type { SidebarState } from "./useSidebar";

export interface SidebarProps {
  sections: NavSection[];
  state: SidebarState;
}

// Active state is a 2px logical inset-start bar plus weight 500 — never a
// filled pill, one of the tells in docs/design/anti-patterns.md. The
// sidebar is bg-sidebar, white in light mode; a permanently dark chrome
// around a light body is banned outright.
//
// Nav items here are flat within each section (no item has its own
// children), so collapsing to the icon rail is just "shrink to icon +
// Tooltip" per item — there is no hierarchy that would need a flyout, which
// shell.md's spec anticipates for a deeper tree than this one has.
export function Sidebar({ sections, state }: SidebarProps) {
  const { t } = useI18n();
  const dir = useDirection();
  const pathname = usePathname();
  const isCollapsed = state === "collapsed";
  // Radix takes a physical side — compute it from direction rather than
  // hardcoding one. See docs/design/theming.md#third-party-physical-apis.
  const tooltipSide = dir === "rtl" ? "left" : "right";

  return (
    <nav
      aria-label={t.nav.workspaceCenter}
      className={cn(
        "flex h-full flex-col gap-1 overflow-y-auto border-e border-border bg-sidebar py-2 transition-[width] duration-150",
        isCollapsed ? "w-(--size-rail) items-center px-1" : "w-(--size-sidebar) px-2",
      )}
    >
      {sections.map((section) => (
        <div key={section.id} className="flex flex-col gap-0.5">
          {!isCollapsed && section.labelKey && (
            <p className="px-2 pb-1 pt-3 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              {t.nav[section.labelKey as keyof typeof t.nav]}
            </p>
          )}
          {section.items.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const label = t.nav[item.labelKey as keyof typeof t.nav] as string;
            const Icon = item.icon;

            const link = (
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-2 rounded-xs py-1.5 text-sm text-sidebar-foreground",
                  "before:absolute before:inset-y-1 before:start-0 before:w-0.5 before:rounded-full before:bg-transparent",
                  "hover:bg-accent",
                  isActive && "font-medium text-foreground before:bg-sidebar-active",
                  isCollapsed ? "justify-center px-0 size-8" : "px-2",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                {!isCollapsed && <span className="truncate">{label}</span>}
              </Link>
            );

            if (!isCollapsed) return <div key={item.id}>{link}</div>;

            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side={tooltipSide}>{label}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

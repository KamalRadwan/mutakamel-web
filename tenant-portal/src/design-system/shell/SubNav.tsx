"use client";

import Link from "next/link";
import { cn } from "../lib/cn";
import type { NavItem } from "./nav-config";
import { useSubNav } from "./useSubNav";

export interface SubNavProps {
  items: NavItem[];
}

// CRM setup's five screens and Core settings' six share this — a horizontal
// second-level nav with an active underline driven by usePathname().
//
// It survived the shell's move to two top bars and did not fold into either
// of them. The global nav's menu answers "what else is in this section" one
// click away; this answers it without the click, in the body, next to the
// screen it belongs to — which is what a person comparing four tax tables
// actually wants. See docs/design/shell.md#sub-navigation.
//
// Callers pass a whole nav section, so the list arrives unfiltered. Filtering
// happens here, against the same `hasAccess` predicate `useNavTree` applies to
// the global nav (MASTER-PLAN 5.16) — otherwise the nav hides a screen while
// this bar keeps linking to it, and the link only fails on arrival.
export function SubNav({ items }: SubNavProps) {
  const { t, visibleItems, activeItemId } = useSubNav(items);

  if (visibleItems.length === 0) return null;

  return (
    <nav className="flex min-w-0 max-w-full gap-4 overflow-x-auto border-b border-border">
      {visibleItems.map((item) => {
        const isActive = activeItemId === item.id;
        return (
          <Link
            key={item.id}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "shrink-0 whitespace-nowrap border-b-2 border-transparent pb-2 text-sm text-muted-foreground hover:text-foreground",
              isActive && "border-brand-600 font-medium text-foreground dark:border-brand-400",
            )}
          >
            {t.nav[item.labelKey as keyof typeof t.nav]}
          </Link>
        );
      })}
    </nav>
  );
}

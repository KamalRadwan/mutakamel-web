"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantAuth } from "@/context/AuthContext";
import { cn } from "../lib/cn";
import type { NavItem } from "./nav-config";

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
  const { t } = useI18n();
  const { user } = useTenantAuth();
  const pathname = usePathname();
  const permissions = user?.permissions ?? [];
  const isTenantOwner = user?.isTenantOwner ?? false;
  const visibleItems = items.filter((item) =>
    // Owner-guarded entries carry no permission to look up — see NavItem.
    item.requiresTenantOwner ? isTenantOwner : item.hasAccess(permissions, isTenantOwner),
  );

  if (visibleItems.length === 0) return null;

  return (
    <nav className="flex gap-4 border-b border-border">
      {visibleItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.id}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "border-b-2 border-transparent pb-2 text-sm text-muted-foreground hover:text-foreground",
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

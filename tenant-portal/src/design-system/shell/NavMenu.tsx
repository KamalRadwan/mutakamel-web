"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "../lib/cn";
import { focusRing } from "../lib/variants";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../primitives/DropdownMenu";
import type { NavItem, NavSection } from "./nav-config";

export interface NavMenuProps {
  section: NavSection;
  /** The item the current route resolves to, if it is in this section. */
  activeItemId: string | null;
}

// The active marker on both shapes below: a 2px logical bar along the BOTTOM
// edge, which is the horizontal nav's equivalent of the sidebar's inset-start
// bar. Not a filled chip — docs/design/anti-patterns.md#4-hue-coded-controls
// and the sidebar rule it inherits.
// Inactive is the muted role and active is the plain one, in both themes: on
// the light chrome that reads as ink-400 against white rather than as two
// shades of ink, and `nav-surface` is what makes the same two names mean that
// here. The marker keeps its own token because it is the one colour on the bar
// that is neither text nor surface.
const TRIGGER =
  "relative flex h-full items-center gap-1 px-3 text-sm text-muted-foreground " +
  "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-transparent " +
  "hover:bg-accent";

const TRIGGER_ACTIVE = "font-medium text-foreground after:bg-nav-active";

/**
 * One nav section as a menu in the global nav.
 *
 * **Why a menu and not a row of links.** The three apps carry 30, 11 and 30
 * items. A horizontal bar can hold roughly six labels beside the brand zone,
 * the app switcher and the account controls, so the only structure that fits a
 * 1366px screen is one trigger per section — the grouping the sidebar already
 * had, rotated ninety degrees. Flattening instead would either overflow or push
 * the excess into a "More" bucket, which is the unlabelled overflow menu
 * anti-patterns.md#density-is-not-an-excuse rejects by name.
 *
 * **A one-item section renders as a plain link.** Permission filtering
 * routinely reduces a section to a single screen, and a menu whose only job is
 * to reveal one item costs a click and a keystroke for nothing.
 *
 * The trigger stays marked while a route inside the section is open, so the
 * bar still answers "where am I" at the section level with every menu closed.
 * The item level is answered by `PageActionBar`, which names the active screen.
 */
export function NavMenu({ section, activeItemId }: NavMenuProps) {
  const { t } = useI18n();
  const label = (item: NavItem) => t.nav[item.labelKey as keyof typeof t.nav] as string;
  const isActive = section.items.some((item) => item.id === activeItemId);

  const only = section.items.length === 1 ? section.items[0] : undefined;
  if (only) {
    const Icon = only.icon;
    return (
      <Link
        href={only.href}
        aria-current={only.id === activeItemId ? "page" : undefined}
        className={cn(TRIGGER, isActive && TRIGGER_ACTIVE, focusRing)}
      >
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="whitespace-nowrap">{label(only)}</span>
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(TRIGGER, isActive && TRIGGER_ACTIVE, focusRing)}>
        <span className="whitespace-nowrap">
          {t.nav[section.menuLabelKey as keyof typeof t.nav]}
        </span>
        {/* A disclosure chevron is direction-neutral: it must NOT mirror under
            RTL — docs/design/icons.md. */}
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="bottom" className="min-w-56">
        {section.items.map((item) => {
          const Icon = item.icon;
          return (
            <DropdownMenuItem key={item.id} asChild>
              <Link
                href={item.href}
                aria-current={item.id === activeItemId ? "page" : undefined}
                className={cn(item.id === activeItemId && "font-medium text-foreground")}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{label(item)}</span>
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

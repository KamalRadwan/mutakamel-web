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

// Inactive tabs render high-contrast `text-nav-foreground` (#E2E8F0) with a
// 23×23 soft icon box (`bg-white/10`) that lightens on hover; active tabs use
// the brand-to-sky gradient pill (`bg-gradient-primary`) with a luminous border
// (`border-nav-tab-active-line`) and glow (`shadow-nav-active`).
function navTabClass(active: boolean): string {
  return cn(
    "group relative flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-3 transition-colors xl:gap-1 xl:px-2",
    active
      ? "border-nav-tab-active-line bg-gradient-primary font-semibold text-white shadow-nav-active"
      : "border-transparent font-medium text-nav-foreground hover:bg-white/10 hover:text-nav-foreground-strong",
    focusRing,
  );
}

function navTabIconBoxClass(active: boolean): string {
  return cn(
    "flex size-[23px] shrink-0 items-center justify-center rounded-md transition-colors",
    active
      ? "bg-white/20 text-white"
      : "bg-white/10 text-nav-foreground group-hover:bg-white/15 group-hover:text-nav-foreground-strong",
  );
}

/**
 * One nav section as a menu in the global nav.
 *
 * **Why a menu and not a row of links.** The three apps carry 30, 14 and 30
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

  if (section.globalNavDisplay === "items") {
    return (
      <>
        {section.items.map((item) => {
          const Icon = item.icon;
          const itemIsActive = item.id === activeItemId;
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={itemIsActive ? "page" : undefined}
              className={navTabClass(itemIsActive)}
            >
              <span className={navTabIconBoxClass(itemIsActive)}>
                <Icon className="size-3.5 shrink-0" aria-hidden="true" />
              </span>
              <span className="whitespace-nowrap text-tab">{label(item)}</span>
            </Link>
          );
        })}
      </>
    );
  }

  const only = section.items.length === 1 ? section.items[0] : undefined;
  if (only) {
    const Icon = only.icon;
    const onlyIsActive = only.id === activeItemId;
    return (
      <Link
        href={only.href}
        aria-current={onlyIsActive ? "page" : undefined}
        className={navTabClass(isActive)}
      >
        <span className={navTabIconBoxClass(isActive)}>
          <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        </span>
        <span className="whitespace-nowrap text-tab">{label(only)}</span>
      </Link>
    );
  }

  const SectionIcon = section.icon ?? section.items[0]?.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={navTabClass(isActive)}>
        {SectionIcon && (
          <span className={navTabIconBoxClass(isActive)}>
            <SectionIcon className="size-3.5 shrink-0" aria-hidden="true" />
          </span>
        )}
        <span className="whitespace-nowrap text-tab">
          {t.nav[section.menuLabelKey as keyof typeof t.nav]}
        </span>
        {/* A disclosure chevron is direction-neutral: it must NOT mirror under
            RTL — docs/design/icons.md. */}
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 transition-colors",
            isActive
              ? "text-white/90"
              : "text-nav-foreground/75 group-hover:text-nav-foreground-strong",
          )}
          aria-hidden="true"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="bottom" className="min-w-56">
        {section.items.map((item) => {
          const Icon = item.icon;
          const itemIsActive = item.id === activeItemId;
          return (
            <DropdownMenuItem key={item.id} asChild>
              <Link
                href={item.href}
                aria-current={itemIsActive ? "page" : undefined}
                className={cn(
                  itemIsActive &&
                    "bg-selected font-medium text-selected-foreground focus:bg-selected focus:text-selected-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "size-3.5 shrink-0 text-muted-foreground",
                    itemIsActive && "text-selected-foreground",
                  )}
                  aria-hidden="true"
                />
                <span className="truncate">{label(item)}</span>
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

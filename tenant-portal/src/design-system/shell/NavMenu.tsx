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
  "relative my-1 flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-transparent px-2 text-xs font-medium text-white/85 transition-colors xl:px-2.5 xl:text-sm " +
  "after:pointer-events-none after:absolute after:inset-x-1.5 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-transparent " +
  "hover:bg-white/10 hover:text-white";

const TRIGGER_ACTIVE =
  "border-[#38bdf8]/50 bg-[#38bdf8]/22 font-semibold text-white hover:bg-[#38bdf8]/28 hover:text-white after:bg-nav-active after:shadow-[0_0_8px_#38bdf8]";

const ICON_BADGE_PALETTE: Record<string, string> = {
  // CRM items & sections
  crmDashboardReports: "bg-purple-500/20 text-purple-300",
  leads: "bg-sky-500/25 text-sky-300",
  customerProfiles: "bg-emerald-500/20 text-emerald-300",
  opportunities: "bg-amber-500/20 text-amber-300",
  crmSetup: "bg-rose-500/20 text-rose-300",
  crmActivities: "bg-teal-500/20 text-teal-300",
  // Workspace sections
  workspace: "bg-purple-500/20 text-purple-300",
  coreIdentity: "bg-sky-500/25 text-sky-300",
  coreOperations: "bg-emerald-500/20 text-emerald-300",
  coreSettings: "bg-rose-500/20 text-rose-300",
  coreBilling: "bg-amber-500/20 text-amber-300",
  account: "bg-teal-500/20 text-teal-300",
  // Trade sections
  tradeFoundation: "bg-sky-500/25 text-sky-300",
  tradeDocuments: "bg-emerald-500/20 text-emerald-300",
  tradeInventory: "bg-amber-500/20 text-amber-300",
  tradeGovernance: "bg-rose-500/20 text-rose-300",
  tradeAutomation: "bg-teal-500/20 text-teal-300",
  tradeAnalytics: "bg-purple-500/20 text-purple-300",
};

function iconBadgeClass(key: string): string {
  return (
    ICON_BADGE_PALETTE[key] ??
    "bg-sky-500/20 text-sky-300"
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
              className={cn(TRIGGER, itemIsActive && TRIGGER_ACTIVE, focusRing)}
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-xs",
                  iconBadgeClass(item.id),
                )}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden="true" />
              </span>
              <span className="whitespace-nowrap">{label(item)}</span>
            </Link>
          );
        })}
      </>
    );
  }

  const only = section.items.length === 1 ? section.items[0] : undefined;
  if (only) {
    const Icon = only.icon;
    return (
      <Link
        href={only.href}
        aria-current={only.id === activeItemId ? "page" : undefined}
        className={cn(TRIGGER, isActive && TRIGGER_ACTIVE, focusRing)}
      >
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-xs",
            iconBadgeClass(only.id in ICON_BADGE_PALETTE ? only.id : section.id),
          )}
        >
          <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        </span>
        <span className="whitespace-nowrap">{label(only)}</span>
      </Link>
    );
  }

  const SectionIcon = section.icon ?? section.items[0]?.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(TRIGGER, isActive && TRIGGER_ACTIVE, focusRing)}>
        {SectionIcon && (
          <span
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-xs",
              iconBadgeClass(section.id),
            )}
          >
            <SectionIcon className="size-3.5 shrink-0" aria-hidden="true" />
          </span>
        )}
        <span className="whitespace-nowrap">
          {t.nav[section.menuLabelKey as keyof typeof t.nav]}
        </span>
        {/* A disclosure chevron is direction-neutral: it must NOT mirror under
            RTL — docs/design/icons.md. */}
        <ChevronDown
          className={cn(
            "size-3 shrink-0 text-white/60",
            isActive && "text-sky-300",
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

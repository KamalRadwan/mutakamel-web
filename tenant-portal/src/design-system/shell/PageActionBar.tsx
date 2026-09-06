"use client";

import { useCallback } from "react";
import { ChevronRight } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "../lib/cn";
import { iconSize, mirrorInRtl } from "../lib/icons";
import { usePageActionSlots } from "./page-action-slots";
import { useNavLocation } from "./useNavLocation";
import type { NavSection } from "./nav-config";

export interface PageActionBarProps {
  /** The active app's permission-filtered sections — the location map. */
  sections: NavSection[];
  /** Names the bar where the route belongs to no nav entry. */
  appLabelKey: string;
}

/**
 * The second bar: where the current screen puts its own controls.
 *
 * ```text
 * CRM › Leads                     [+ Add lead]  [search…]        [board|card|table]
 * ```
 *
 * Two jobs, and the first one is not obvious.
 *
 * **It says where you are.** The sidebar answered that continuously by marking
 * one row in a visible column. A row of menus cannot — its items are behind a
 * trigger — so the answer moves here, to the start of the bar: the section, then
 * the screen. Without it the shell would have replaced a permanent location
 * indicator with none, which is the one real thing a horizontal nav costs.
 *
 * **It holds the screen's controls**, portalled in from the page itself so each
 * keeps the state and handlers it was written with — see `page-action-slots.tsx`
 * for why that is a portal and not shell state.
 *
 * The bar renders on every route, including one that registers nothing. A bar
 * that disappeared on some screens would move the whole page up 45px on those
 * routes, and every navigation between the two kinds would shift the content
 * under the pointer.
 */
export function PageActionBar({ sections, appLabelKey }: PageActionBarProps) {
  const { t } = useI18n();
  const { register } = usePageActionSlots();
  const location = useNavLocation(sections);

  // Each ref has to keep ONE identity for the life of the bar. React detaches
  // and re-attaches a callback ref whose function identity changed, so an
  // inline `ref={(node) => register("actions", node)}` is called with null and
  // then with the element on every commit — and since each of those writes
  // provider state, and that state re-renders this component, the pair loops
  // until React throws "Maximum update depth exceeded". Found by
  // AppShell.actions.test.tsx, which is the reason that test renders the real
  // bar instead of a stub.
  const setActions = useCallback((node: HTMLDivElement | null) => register("actions", node), [register]);
  const setSearch = useCallback((node: HTMLDivElement | null) => register("search", node), [register]);
  const setView = useCallback((node: HTMLDivElement | null) => register("view", node), [register]);

  const sectionLabel = location.section
    ? (t.nav[location.section.menuLabelKey as keyof typeof t.nav] as string)
    : (t.nav[appLabelKey as keyof typeof t.nav] as string);
  const itemLabel = location.itemLabelKey
    ? (t.nav[location.itemLabelKey as keyof typeof t.nav] as string)
    : null;

  return (
    <div
      className={cn(
        "flex h-(--size-actionbar) shrink-0 items-center gap-3 border-b border-border",
        // A screen's controls are fixed-width (a 240px search box, a segmented
        // switcher) and the bar cannot wrap them onto a second line without
        // becoming two bars. Below `sm` they scroll inside it instead — the
        // shell root is `overflow-hidden`, so without this they would be
        // silently clipped, and the view switcher is the one that would go.
        "overflow-x-auto bg-card px-3 print:hidden",
      )}
    >
      {/* Plain text, not a <nav>: these are not links — the sections have no
          index route — and a second landmark announced as navigation would
          just add noise to the one above it. */}
      <p className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
        <span className="truncate">{sectionLabel}</span>
        {itemLabel && (
          <>
            <ChevronRight
              className={cn(iconSize({ size: "xs" }), mirrorInRtl)}
              aria-hidden="true"
            />
            <span className="truncate text-sm font-medium text-foreground">{itemLabel}</span>
          </>
        )}
      </p>
      {/* min-w-0 so a long search box shrinks instead of pushing the view
          switcher off the inline end. */}
      <div className="ms-auto flex min-w-0 items-center gap-2">
        <div ref={setActions} className="flex items-center gap-2" />
        <div ref={setSearch} className="flex min-w-0 items-center gap-2" />
        <div ref={setView} className="flex items-center gap-2" />
      </div>
    </div>
  );
}

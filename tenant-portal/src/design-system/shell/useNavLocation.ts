"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import type { NavSection } from "./nav-config";

export interface NavLocation {
  /** The section owning the current route, or `null` off the map. */
  section: NavSection | null;
  /** `NavItem.id` of the current route's nav entry, or `null`. */
  itemId: string | null;
  /** `NavItem.labelKey` of that entry — what the action bar names. */
  itemLabelKey: string | null;
}

const NONE: NavLocation = { section: null, itemId: null, itemLabelKey: null };

/**
 * Which nav entry the current route belongs to.
 *
 * This is the signal the sidebar used to carry for free. A column of every
 * item with one of them marked answered "where am I" continuously; a row of
 * menus cannot, because the items are behind a trigger. So the answer moves to
 * the page action bar, which names the section and the screen at the start of
 * the bar, and to `NavMenu`, which keeps the owning section's trigger marked.
 *
 * **Longest prefix wins**, which is what makes detail routes resolve. Under a
 * plain `startsWith` scan `/crm/leads/<id>` matches `/crm/leads`, but
 * `/core/settings/currencies` matches BOTH `/core/settings` and
 * `/core/settings/currencies` — and the settings hub, being shorter, would win
 * and mislabel every settings screen. Comparing lengths picks the specific one.
 *
 * The boundary check matters as much: `/crm/leads` must not claim
 * `/crm/leads-archive`, so a prefix only counts when the next character is `/`.
 */
export function useNavLocation(sections: NavSection[]): NavLocation {
  const pathname = usePathname();

  return useMemo(() => {
    let best = NONE;
    let bestLength = -1;

    for (const section of sections) {
      for (const item of section.items) {
        const matches =
          pathname === item.href ||
          (pathname.startsWith(item.href) && pathname.charAt(item.href.length) === "/");
        if (!matches || item.href.length <= bestLength) continue;
        bestLength = item.href.length;
        best = { section, itemId: item.id, itemLabelKey: item.labelKey };
      }
    }

    return best;
  }, [pathname, sections]);
}

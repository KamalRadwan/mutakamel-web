"use client";

import { useMemo } from "react";
import { NAV_APPS, type NavApp } from "./nav-config";
import { useNavTree } from "./useNavTree";

/**
 * The three apps, each carrying the sections THIS user can actually reach.
 *
 * Layered on `useNavTree()` rather than replacing it: permission filtering
 * stays the one rule it always was, and app scoping is a second, independent
 * cut over its result. Keeping them separate is what lets
 * `NavCommandPalette` go on consuming the unscoped tree — Ctrl/Cmd+K searches
 * every screen the actor may open, in every app, which is the point of a
 * command palette and the reason scoping it would be a regression.
 *
 * An app whose sections all filtered away comes back with an empty list. The
 * switcher renders it disabled rather than hiding it, so a tenant without the
 * Trade module sees Trade greyed instead of missing.
 */
export function useNavApps(): NavApp[] {
  const sections = useNavTree();

  return useMemo(
    () =>
      NAV_APPS.map((app) => ({
        ...app,
        sections: sections.filter((section) => section.app === app.id),
      })),
    [sections],
  );
}

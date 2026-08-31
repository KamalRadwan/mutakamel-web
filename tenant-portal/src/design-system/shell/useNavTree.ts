"use client";

import { useMemo } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { NAV_SECTIONS, type NavSection } from "./nav-config";

// Filters nav-config.ts against the authenticated permission set. A section
// with zero accessible items does not render its heading.
//
// An item marked `requiresTenantOwner` is checked against `isTenantOwner`
// instead: billing and subscription are behind `TenantOwnerGuard` and carry no
// permission string, so there is nothing for `hasAccess` to look up.
export function useNavTree(): NavSection[] {
  const { user } = useTenantAuth();

  return useMemo(() => {
    const permissions = user?.permissions ?? [];
    const isTenantOwner = user?.isTenantOwner ?? false;
    return NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        item.requiresTenantOwner ? isTenantOwner : item.hasAccess(permissions),
      ),
    })).filter((section) => section.items.length > 0);
  }, [user]);
}

import { useMemo } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { NAV_SECTIONS, type NavSection } from "./nav-config";

// Filters nav-config.ts against the authenticated permission set. A section
// with zero accessible items does not render its heading.
export function useNavTree(): NavSection[] {
  const { user } = useTenantAuth();

  return useMemo(() => {
    const permissions = user?.permissions ?? [];
    return NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => item.hasAccess(permissions)),
    })).filter((section) => section.items.length > 0);
  }, [user]);
}

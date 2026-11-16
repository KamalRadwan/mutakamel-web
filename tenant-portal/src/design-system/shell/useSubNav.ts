"use client";

import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantAuth } from "@/context/AuthContext";
import type { NavItem } from "./nav-config";

export function useSubNav(items: NavItem[]) {
  const { t } = useI18n();
  const { user } = useTenantAuth();
  const pathname = usePathname();
  const permissions = user?.permissions ?? [];
  const isTenantOwner = user?.isTenantOwner ?? false;
  const visibleItems = items.filter((item) =>
    item.requiresTenantOwner
      ? isTenantOwner
      : item.hasAccess(permissions, isTenantOwner, user?.featureEntitlements),
  );
  // A section root and its child can both match; only the closest destination
  // describes the current page. Match path segments so archives are unrelated.
  const activeItem = visibleItems.reduce<NavItem | null>((best, item) => {
    const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return matches && (!best || item.href.length > best.href.length) ? item : best;
  }, null);
  return { t, visibleItems, activeItemId: activeItem?.id };
}

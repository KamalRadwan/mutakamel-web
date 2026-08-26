"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { adminCan, adminCanAll, adminCanAny } from "@/lib/auth/rbac";
import { NAV_SECTIONS, type NavItem, type NavPermission, type NavSection } from "./nav-config";

function satisfiesPermission(user: Parameters<typeof adminCan>[0], permission: NavPermission): boolean {
  switch (permission.kind) {
    case "public":
      return true;
    case "single":
      return adminCan(user, permission.permission);
    case "any":
      return adminCanAny(user, permission.permissions);
    case "all":
      return adminCanAll(user, permission.permissions);
  }
}

function isActive(pathname: string, item: NavItem): boolean {
  if (item.href === "/dashboard" && (pathname === "/" || pathname === "/dashboard")) return true;
  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return true;
  return (item.activePrefixes ?? []).some((prefix) => pathname.startsWith(prefix));
}

/**
 * Filters nav-config.ts against the signed-in user's permissions — the
 * same adminCan/adminCanAll/adminCanAny checks useNavbar.ts used, applied
 * to data instead of a hand-written list of booleans. Preserves the
 * homeHref fallback chain (dashboard -> tenants -> applications -> first
 * visible item -> /profile) verbatim.
 */
export function useNavTree() {
  const pathname = usePathname();
  const { user } = useAuth();

  const sections: NavSection[] = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => satisfiesPermission(user, item.permission)),
  })).filter((section) => section.items.length > 0);

  const activeItem = sections.flatMap((s) => s.items).find((item) => isActive(pathname, item));

  const canViewDashboard = adminCan(user, "admin.reports.read");
  const canViewTenants = adminCan(user, "admin.tenants.read");
  const canViewApplications = adminCanAny(user, ["admin.applications.read", "admin.applications.create"]);
  const firstVisibleHref = sections.flatMap((s) => s.items)[0]?.href;

  const homeHref = canViewDashboard
    ? "/dashboard"
    : canViewTenants
      ? "/tenants"
      : canViewApplications
        ? "/applications-catalogue"
        : (firstVisibleHref ?? "/profile");

  return { pathname, sections, activeItem, homeHref };
}

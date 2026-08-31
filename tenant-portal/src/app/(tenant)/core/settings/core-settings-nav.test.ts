import { describe, expect, it } from "vitest";
import { CORE_SETTINGS_NAV_ITEMS, NAV_SECTIONS } from "@/design-system";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";

// MASTER-PLAN 5.15 and 5.16. The sidebar, the settings SubNav and the hub all
// have to agree about what a given permission set can reach — a screen the
// sidebar hides but the SubNav still links to only fails on arrival.
describe("Core settings navigation", () => {
  const coreItems = NAV_SECTIONS.flatMap((section) => section.items).filter(
    (item) =>
      item.href.startsWith("/core/settings/") || item.href === TENANT_ROUTES.coreNotifications,
  );

  it("registers every Core settings route with a permission-bearing predicate", () => {
    expect(coreItems.map((item) => item.href).sort()).toEqual(
      [
        TENANT_ROUTES.coreSettingsWorkspace,
        TENANT_ROUTES.coreSettingsCurrencies,
        TENANT_ROUTES.coreSettingsTaxes,
        TENANT_ROUTES.coreSettingsNumbering,
        TENANT_ROUTES.coreSettingsEmail,
        TENANT_ROUTES.coreSettingsBranding,
        TENANT_ROUTES.coreNotifications,
      ].sort(),
    );

    for (const item of coreItems) {
      expect(item.hasAccess([])).toBe(false);
    }
  });

  it("admits exactly the screens a permission set covers", () => {
    expect(
      coreItems
        .filter((item) => item.hasAccess(["workspace.read", "notifications.notification.read"]))
        .map((item) => item.href),
    ).toEqual([TENANT_ROUTES.coreSettingsWorkspace, TENANT_ROUTES.coreNotifications]);
  });

  it("keeps the hub reachable so it can explain an empty section list", () => {
    const hub = NAV_SECTIONS.flatMap((section) => section.items).find(
      (item) => item.href === TENANT_ROUTES.coreSettings,
    );
    expect(hub?.hasAccess([])).toBe(true);
  });

  it("exports the SubNav section in the order the sidebar renders it", () => {
    expect(CORE_SETTINGS_NAV_ITEMS.map((item) => item.href)).toEqual([
      TENANT_ROUTES.coreSettings,
      TENANT_ROUTES.coreSettingsWorkspace,
      TENANT_ROUTES.coreSettingsCurrencies,
      TENANT_ROUTES.coreSettingsTaxes,
      TENANT_ROUTES.coreSettingsNumbering,
      TENANT_ROUTES.coreSettingsEmail,
      TENANT_ROUTES.coreSettingsBranding,
    ]);
  });

  // Billing and subscription sit in their own section and are NOT permission
  // gated — `TenantOwnerGuard` carries no permission string, so `hasAccess`
  // has nothing to look up and `requiresTenantOwner` is the predicate instead.
  it("gates the owner-only section on ownership rather than on a permission", () => {
    const ownerItems = NAV_SECTIONS.flatMap((section) => section.items).filter(
      (item) => item.requiresTenantOwner === true,
    );
    expect(ownerItems.map((item) => item.href)).toEqual([
      TENANT_ROUTES.coreBilling,
      TENANT_ROUTES.coreBillingInvoices,
      TENANT_ROUTES.coreSubscription,
    ]);
    for (const item of ownerItems) {
      expect(item.hasAccess([])).toBe(true);
    }
  });
});

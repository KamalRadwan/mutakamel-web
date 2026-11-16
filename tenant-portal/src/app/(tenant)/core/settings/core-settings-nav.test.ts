import { describe, expect, it } from "vitest";
import {
  CORE_SETTINGS_NAV_ITEMS,
  NAV_APPS,
  NAV_SECTIONS,
  WORKSPACE_NAV_SECTIONS,
} from "@/design-system";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";

describe("Core settings navigation", () => {
  const coreItems = NAV_SECTIONS.flatMap((section) => section.items).filter(
    (item) =>
      item.href.startsWith("/core/settings") || item.href === TENANT_ROUTES.coreNotifications,
  );

  it("places Settings last in Workspace desktop and mobile app navigation", () => {
    expect(WORKSPACE_NAV_SECTIONS.map((section) => section.id)).toEqual([
      "workspace",
      "coreIdentity",
      "coreOperations",
      "coreBilling",
      "account",
      "coreSettings",
    ]);
    const workspaceApp = NAV_APPS.find((app) => app.id === "workspace");
    expect(workspaceApp?.sections.at(-1)?.id).toBe("coreSettings");
  });

  it("omits the All Settings hub item from every navigation surface", () => {
    const allItems = NAV_SECTIONS.flatMap((section) => section.items);
    expect(allItems.some((item) => item.id === "coreSettingsHub")).toBe(false);
    expect(allItems.some((item) => item.href === TENANT_ROUTES.coreSettings)).toBe(false);
    expect(
      CORE_SETTINGS_NAV_ITEMS.some((item) => item.href === TENANT_ROUTES.coreSettings),
    ).toBe(false);
  });

  it("registers every Core settings route with a permission-bearing predicate", () => {
    expect(coreItems.map((item) => item.href).sort()).toEqual(
      [
        TENANT_ROUTES.coreSettingsWorkspace,
        TENANT_ROUTES.coreSettingsCurrencies,
        TENANT_ROUTES.coreSettingsTaxes,
        TENANT_ROUTES.coreSettingsNumbering,
        TENANT_ROUTES.coreSettingsEmail,
        TENANT_ROUTES.coreSettingsBranding,
        TENANT_ROUTES.coreSettingsUpdates,
        TENANT_ROUTES.coreNotifications,
      ].sort(),
    );

    for (const item of coreItems) {
      expect(item.hasAccess([])).toBe(false);
    }
  });

  it("admits exactly the screens a permission and entitlement set covers", () => {
    expect(
      coreItems
        .filter((item) => item.hasAccess(["workspace.read", "notifications.notification.read"]))
        .map((item) => item.href),
    ).toEqual([
      TENANT_ROUTES.coreNotifications,
      TENANT_ROUTES.coreSettingsWorkspace,
      TENANT_ROUTES.coreSettingsUpdates,
    ]);

    const emailItem = CORE_SETTINGS_NAV_ITEMS.find((item) => item.id === "coreEmail");
    expect(
      emailItem?.hasAccess(["workspace.email.read"], true, { "crm.outbound_email": false }),
    ).toBe(false);
    expect(
      emailItem?.hasAccess(["workspace.email.read"], false, { "crm.outbound_email": true }),
    ).toBe(true);
  });

  it("exports the Settings registry in navigation order starting with Workspace", () => {
    expect(CORE_SETTINGS_NAV_ITEMS.map((item) => item.href)).toEqual([
      TENANT_ROUTES.coreSettingsWorkspace,
      TENANT_ROUTES.coreSettingsCurrencies,
      TENANT_ROUTES.coreSettingsTaxes,
      TENANT_ROUTES.coreSettingsNumbering,
      TENANT_ROUTES.coreSettingsEmail,
      TENANT_ROUTES.coreSettingsBranding,
      TENANT_ROUTES.coreSettingsUpdates,
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
      TENANT_ROUTES.coreSubscriptionCatalogue,
    ]);
    for (const item of ownerItems) {
      expect(item.hasAccess([])).toBe(true);
    }
  });
});

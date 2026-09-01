import { describe, expect, it } from "vitest";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { appForPath, isNavAppId, storedAppOrDefault } from "./nav-app";
import { NAV_SECTIONS } from "./nav-config";

describe("appForPath — the app is derived from the route first", () => {
  it.each([
    [TENANT_ROUTES.crm, "crm"],
    [TENANT_ROUTES.crmLeads, "crm"],
    [TENANT_ROUTES.crmDashboards, "crm"],
    [TENANT_ROUTES.crmSettings, "crm"],
    [TENANT_ROUTES.trade, "trade"],
    [TENANT_ROUTES.tradeItems, "trade"],
    [TENANT_ROUTES.tradeInvoices, "trade"],
    [TENANT_ROUTES.tradeInventoryNodes, "trade"],
    [TENANT_ROUTES.core, "workspace"],
    [TENANT_ROUTES.coreUsers, "workspace"],
    [TENANT_ROUTES.coreBilling, "workspace"],
    [TENANT_ROUTES.coreSettingsBranding, "workspace"],
    [TENANT_ROUTES.coreProfile, "workspace"],
  ])("puts %s in the %s app", (pathname, expected) => {
    expect(appForPath(pathname)).toBe(expected);
  });

  // The whole reason the route outranks the stored preference: a deep link
  // opened in a fresh browser must show its own app's sidebar.
  it.each([
    ["/crm/leads/8f2c1b90-0000-4000-8000-000000000000", "crm"],
    ["/crm/customer-profiles/8f2c1b90-0000-4000-8000-000000000000", "crm"],
    ["/trade/items/8f2c1b90-0000-4000-8000-000000000000", "trade"],
    ["/trade/inventory/nodes/8f2c1b90-0000-4000-8000-000000000000", "trade"],
    ["/core/users/8f2c1b90-0000-4000-8000-000000000000", "workspace"],
  ])("derives %s from the detail route, not from a preference", (pathname, expected) => {
    expect(appForPath(pathname)).toBe(expected);
  });

  // `null` is "no app owns this" — the ONLY case the stored preference gets to
  // answer. `/search` and `/getting-started` are cross-module by design (see
  // the note on TENANT_ROUTES.search), so a CRM user opening global search
  // stays in CRM rather than being thrown to Workspace.
  it.each([
    [TENANT_ROUTES.home],
    [TENANT_ROUTES.search],
    [TENANT_ROUTES.gettingStarted],
    ["/unavailable"],
    ["/login"],
    ["/crm/not-a-real-screen"],
    ["/trade/not-a-real-screen"],
    ["/core/not-a-real-screen"],
    ["/crm/leads/one/two"],
  ])("returns null for %s, so the stored preference decides", (pathname) => {
    expect(appForPath(pathname)).toBeNull();
  });

  // The drift guard between the two mechanisms. Every nav item's href is
  // routed by `appForPath`, and the section it lives in already declares an
  // app; if those two ever disagree, a user clicking a link in one app's
  // sidebar would land with a different app's sidebar around them.
  it("agrees with every nav item's own section for every app-owned href", () => {
    const disagreements = NAV_SECTIONS.flatMap((section) =>
      section.items
        .map((item) => ({ item, routeApp: appForPath(item.href) }))
        .filter(({ routeApp }) => routeApp !== null && routeApp !== section.app)
        .map(({ item, routeApp }) => `${item.id} (${item.href}): ${section.app} vs ${routeApp}`),
    );

    expect(disagreements).toEqual([]);
  });
});

describe("the stored preference — the fallback, and only the fallback", () => {
  it.each(["workspace", "crm", "trade"])("accepts %s", (value) => {
    expect(storedAppOrDefault(value)).toBe(value);
    expect(isNavAppId(value)).toBe(true);
  });

  // A cookie is user-editable text, so an unknown value must not become a
  // NavAppId that indexes nothing.
  it.each([undefined, null, "", "CRM", "billing", "__proto__"])(
    "falls back to workspace for %s",
    (value) => {
      expect(storedAppOrDefault(value)).toBe("workspace");
      expect(isNavAppId(value)).toBe(false);
    },
  );
});

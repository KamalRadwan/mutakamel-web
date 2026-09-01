// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
import { NAV_SECTIONS, type NavAppId, type NavSection } from "./nav-config";

// What the sidebar was actually handed. This is the assertion surface: the
// sidebar renders whatever it is given, so "the sidebar is app-scoped" is
// exactly "AppShell hands it one app's sections".
let received: NavSection[] = [];
let pathname = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    t: {
      common: { skipToContent: "Skip to content" },
      nav: { appSwitcher: "Switch app" },
      connectivity: {},
    },
  }),
}));

// The permission filter is not what this test is about — it hands back the
// whole nav map, so anything missing downstream was removed by app scoping.
vi.mock("./useNavTree", () => ({ useNavTree: () => NAV_SECTIONS }));

vi.mock("./Sidebar", () => ({
  Sidebar: ({ sections }: { sections: NavSection[] }) => {
    received = sections;
    return <nav />;
  },
}));
vi.mock("./Topbar", () => ({ Topbar: () => <header /> }));
vi.mock("./MobileNav", () => ({ MobileNav: () => null }));
vi.mock("./NavCommandPalette", () => ({ NavCommandPalette: () => null }));
vi.mock("../patterns/offline-banner/OfflineBanner", () => ({ OfflineBanner: () => null }));
vi.mock("../patterns/offline-banner/useConnectivity", () => ({
  useConnectivity: () => ({ status: "online" }),
}));

const EXPECTED: Record<NavAppId, string[]> = {
  workspace: ["workspace", "coreIdentity", "coreOperations", "coreSettings", "coreBilling", "account"],
  crm: ["crm", "crmAnalytics", "crmSetup"],
  trade: [
    "tradeFoundation",
    "tradeDocuments",
    "tradeInventory",
    "tradeGovernance",
    "tradeAutomation",
    "tradeAnalytics",
  ],
};

function renderAt(route: string, initialApp: NavAppId = "workspace") {
  pathname = route;
  render(
    <AppShell initialSidebarState="expanded" initialApp={initialApp}>
      <p>Body</p>
    </AppShell>,
  );
  return received.map((section) => section.id);
}

beforeEach(() => {
  received = [];
});
afterEach(cleanup);

describe("the sidebar is scoped to one app", () => {
  it.each([
    ["/crm/leads", "crm"],
    ["/trade/items", "trade"],
    ["/core/users", "workspace"],
  ] as const)("shows only the %s app's sections on %s", (route, app) => {
    expect(renderAt(route)).toEqual(EXPECTED[app]);
  });

  // The fallback, and the only place it applies: `/` belongs to no app, so
  // the stored preference is what decides.
  it("falls back to the stored app on a route that belongs to no app", () => {
    expect(renderAt("/", "trade")).toEqual(EXPECTED.trade);
    cleanup();
    expect(renderAt("/", "crm")).toEqual(EXPECTED.crm);
  });

  // The route outranks the preference — this is the ordering the whole
  // feature turns on. Stored "trade", standing on a CRM route: CRM wins.
  it("lets the route beat the stored preference, not the other way round", () => {
    expect(renderAt("/crm/leads", "trade")).toEqual(EXPECTED.crm);
  });

  // ---- NEGATIVE CONTROL --------------------------------------------------
  //
  // If the app filtering is removed — from `useNavApps`'s
  // `sections.filter(section => section.app === app.id)`, or from AppShell's
  // `apps.find(entry => entry.id === app)` — the sidebar is handed all 15
  // sections again and every assertion below fails. Verified by deleting each
  // in turn and watching this test go red.
  it("does NOT show all 15 sections once an app is active", () => {
    const shown = renderAt("/crm/leads");

    expect(shown).not.toEqual(NAV_SECTIONS.map((section) => section.id));
    expect(shown.length).toBeLessThan(NAV_SECTIONS.length);
    expect(shown).not.toContain("tradeFoundation");
    expect(shown).not.toContain("coreBilling");
    expect(shown).not.toContain("workspace");
  });
});

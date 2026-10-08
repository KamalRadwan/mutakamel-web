// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
import { PageActions } from "./PageActions";
import { PageHeader } from "../patterns/page-header/PageHeader";
import { Button } from "../primitives/Button";
import { en } from "@/i18n/dictionaries/en";

// The end-to-end proof of the second bar: a screen declares its actions where
// it always did, and they render in the bar.
//
// Deliberately shallow on mocks. `GlobalNav`, `BrandMark`, `NavMenu`,
// `PageActionBar`, `PageActionSlotsProvider`, `PageActions` and `PageHeader` are
// all REAL here — the portal is the mechanism under test, and a test that
// stubbed the bar would assert nothing about it. Only the leaves that reach the
// network or the router are replaced.
//
// The dictionary is the real `en`, so a missing key fails here as a missing
// label rather than as `undefined` rendered into the bar.

let pathname = "/crm/leads";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", dir: "ltr", t: en }),
}));
vi.mock("@/i18n/useLanguage", () => ({
  useDictionary: () => en,
  useDirection: () => "ltr",
}));

// Everything in CRM, so the leads entry survives filtering.
vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({
    user: {
      isTenantOwner: true,
      permissions: [
        "crm.leads.read",
        "crm.lead_stages.read",
        "crm.customer_profiles.read",
        "crm.opportunities.read",
        "crm.pipelines.read",
        "trade.items.read",
        // Two setup screens, so that section renders as a MENU. With one it
        // would render as a direct link instead — NavMenu.test.tsx covers that.
        "crm.custom_fields.read",
      ],
    },
  }),
}));

vi.mock("@/context/BrandingContext", () => ({
  useTenantBranding: () => ({ appName: "Acme", logoUrl: null }),
}));

vi.mock("./NotificationsDropdown", () => ({ NotificationsDropdown: () => null }));
vi.mock("./UserMenu", () => ({ UserMenu: () => null }));
vi.mock("./ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("./LanguageToggle", () => ({ LanguageToggle: () => null }));
vi.mock("./NavCommandPalette", () => ({ NavCommandPalette: () => null }));
vi.mock("../patterns/offline-banner/OfflineBanner", () => ({ OfflineBanner: () => null }));
vi.mock("../patterns/offline-banner/useConnectivity", () => ({
  useConnectivity: () => ({ status: "online" }),
}));

afterEach(() => {
  cleanup();
  pathname = "/crm/leads";
});

function renderShell(children: React.ReactNode, initialApp: "crm" | "trade" = "crm") {
  const { container } = render(<AppShell initialApp={initialApp}>{children}</AppShell>);
  // The bar is the sibling directly after the <header>, and the only element
  // between it and <main>.
  const bar = container.querySelector("header")!.nextElementSibling as HTMLElement;
  return { container, bar, main: screen.getByRole("main") };
}

describe("the page action bar", () => {
  it("renders a PageHeader's primary action inside the bar, not in the page", () => {
    const { bar, main } = renderShell(
      <PageHeader
        title="Leads"
        primaryAction={{
          label: "Add lead",
          icon: <span aria-hidden="true">+</span>,
          onClick: vi.fn(),
        }}
      />,
    );

    const action = within(bar).getByRole("button", { name: "Add lead" });
    expect(action).toBeInTheDocument();
    expect(action).toHaveTextContent("+Add lead");
    expect(within(main).queryByRole("button", { name: "Add lead" })).toBeNull();
  });

  // The heading is the document's outline and stays on the page. Moving it too
  // would leave every screen without an <h1>.
  it("leaves the heading in the page", () => {
    const { bar, main } = renderShell(<PageHeader title="Leads" />);

    expect(within(main).getByRole("heading", { level: 1, name: "Leads" })).toBeInTheDocument();
    expect(within(bar).queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("puts the primary action first on Leads and preserves the trailing control order", () => {
    const { bar } = renderShell(
      <>
        <PageHeader
          title="Leads"
          primaryAction={{ label: "Add lead", onClick: vi.fn() }}
          secondaryActions={<Button variant="outline">Branch</Button>}
        />
        <PageActions slot="search">
          <Button variant="outline">Search</Button>
        </PageActions>
        <PageActions slot="view">
          <Button variant="outline">Board</Button>
        </PageActions>
      </>,
    );

    const order = within(bar)
      .getAllByRole("button")
      .map((button) => button.textContent);
    expect(order).toEqual(["Add lead", "Branch", "Search", "Board"]);
  });

  // Leads is already a first-level destination in GlobalNav. Repeating its
  // section and screen consumes the exact inline-start position its primary
  // action needs, so the exact list route replaces that location with Add.
  it("omits a primary page's redundant location even when create is unavailable", () => {
    const { bar } = renderShell(<PageHeader title="Leads" />);

    expect(within(bar).queryByText(en.nav.navMenuRecords)).toBeNull();
    expect(within(bar).queryByRole("link", { name: en.nav.leads })).toBeNull();
  });

  it("starts the Items bar with + New Item and omits Foundation / Items", () => {
    pathname = "/trade/items";
    const { bar } = renderShell(
      <PageHeader
        title="Items"
        primaryAction={{
          label: "New Item",
          icon: <span aria-hidden="true">+</span>,
          onClick: vi.fn(),
        }}
        secondaryActions={<Button variant="outline">Refresh</Button>}
      />,
      "trade",
    );

    expect(within(bar).queryByText(en.nav.navMenuFoundation)).toBeNull();
    expect(within(bar).queryByRole("link", { name: en.nav.tradeItems })).toBeNull();
    expect(within(bar).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "+New Item",
      "Refresh",
    ]);
  });

  // What the sidebar used to say by marking a row. Routes that are not
  // explicitly promoted still need the persistent answer to "where am I".
  it("names an ordinary current location from the nav map", () => {
    pathname = "/crm/opportunities";
    const { bar } = renderShell(<PageHeader title="Opportunities" />);

    expect(bar).toHaveTextContent(en.nav.navMenuRecords);
    expect(bar).toHaveTextContent(en.nav.opportunities);
  });

  it("names the location of a detail route by its list entry", () => {
    pathname = "/crm/leads/018f-a-lead";
    const { bar } = renderShell(<PageHeader title="A lead" />);

    expect(bar).toHaveTextContent(en.nav.navMenuRecords);
    expect(within(bar).getByRole("link", { name: en.nav.leads })).toHaveAttribute(
      "href",
      "/crm/leads",
    );
  });
});

describe("the global nav", () => {
  it("renders one menu trigger per permitted section, plus the brand and switcher", () => {
    const { container } = renderShell(<PageHeader title="Leads" />);
    const nav = within(container.querySelector("header")!).getByRole("navigation", {
      name: en.nav.mainNavigation,
    });

    // CRM promotes its three record screens; `crmAnalytics` is filtered away.
    expect(within(nav).queryByText(en.nav.navMenuRecords)).toBeNull();
    expect(within(nav).getAllByRole("link").map((link) => link.textContent)).toEqual([
      en.nav.leads,
      en.nav.customerProfiles,
      en.nav.opportunities,
    ]);
    expect(within(nav).getByText(en.nav.navMenuSetup)).toBeInTheDocument();
    expect(within(nav).queryByText(en.nav.navMenuDashboards)).toBeNull();

    expect(screen.getByRole("link", { name: en.nav.brandHome })).toHaveAttribute("href", "/");
    expect(screen.getByRole("button", { name: en.nav.appSwitcher })).toBeInTheDocument();
  });
});

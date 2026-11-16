// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { CrmSettingsAside } from "./CrmSettingsAside";
import { NavMenu } from "./NavMenu";
import { NAV_SECTIONS } from "./nav-config";

let dictionary = en;
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: dictionary }) }));
const settings = NAV_SECTIONS.find((section) => section.id === "crmSetup")!;
afterEach(() => { cleanup(); dictionary = en; });

describe("settings-only CRM navigation", () => {
  it("renders one direct top-level Settings link, without a dropdown", () => {
    render(<NavMenu section={settings} activeItemId="customFields" />);
    expect(screen.getByRole("link", { name: en.nav.navMenuSettings })).toHaveAttribute("href", "/crm/lead-stages");
    expect(screen.getByRole("link", { name: en.nav.navMenuSettings })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it.each([en, ar])("renders the nine configuration links and keeps analytics outside the aside", (copy) => {
    dictionary = copy;
    render(<CrmSettingsAside section={settings} activeItemId="crmTags" />);
    const aside = screen.getByRole("complementary", { name: copy.nav.crmSettings });
    const links = within(aside).getAllByRole("link");
    expect(links).toHaveLength(9);
    expect(links.map((link) => link.getAttribute("href"))).toEqual(settings.items.map((item) => item.href));
    expect(within(aside).getByRole("link", { name: copy.nav.crmTags })).toHaveAttribute("aria-current", "page");
    expect(within(aside).queryByRole("link", { name: copy.nav.crmWidgetLibrary })).toBeNull();
    expect(within(aside).queryByRole("link", { name: copy.nav.crmDashboardBuilder })).toBeNull();
  });

  it("shows only the supplied permission-filtered entries in both navigation surfaces", () => {
    const permitted = { ...settings, items: settings.items.filter((item) => item.id === "crmTags") };
    const { rerender } = render(<CrmSettingsAside section={permitted} activeItemId="crmTags" />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: en.nav.crmTags })).toHaveAttribute("href", "/crm/tags");
    rerender(<NavMenu section={permitted} activeItemId={null} />);
    expect(screen.getByRole("link", { name: en.nav.navMenuSettings })).toHaveAttribute("href", "/crm/tags");
  });
});

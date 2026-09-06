// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Rows3 } from "lucide-react";
import { NAV_SECTIONS } from "./nav-config";
import { NavMenu } from "./NavMenu";
import type { NavItem, NavSection } from "./nav-config";
import { en } from "@/i18n/dictionaries/en";

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ lang: "en", dir: "ltr", t: en }) }));

// Radix's menu measures and captures the pointer; jsdom implements neither.
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(cleanup);

function item(id: string, labelKey: string, href: string): NavItem {
  return { id, labelKey, href, icon: Rows3, hasAccess: () => true };
}

function section(items: NavItem[]): NavSection {
  return { id: "crmSetup", app: "crm", labelKey: "crmSetup", menuLabelKey: "navMenuSetup", items };
}

describe("NavMenu", () => {
  // Permission filtering routinely leaves a section with one screen. A menu
  // whose only job is to reveal a single item costs a click and a keystroke to
  // tell the user what it could have said outright.
  it("renders a one-item section as a direct link to that item", () => {
    render(
      <NavMenu section={section([item("leadStages", "leadStages", "/crm/lead-stages")])} activeItemId={null} />,
    );

    expect(screen.getByRole("link", { name: en.nav.leadStages })).toHaveAttribute(
      "href",
      "/crm/lead-stages",
    );
    expect(screen.queryByText(en.nav.navMenuSetup)).toBeNull();
  });

  it("renders a multi-item section as a menu named by its SHORT label", () => {
    render(
      <NavMenu
        section={section([
          item("leadStages", "leadStages", "/crm/lead-stages"),
          item("customFields", "customFields", "/crm/custom-fields"),
        ])}
        activeItemId={null}
      />,
    );

    expect(screen.getByRole("button", { name: new RegExp(en.nav.navMenuSetup) })).toBeInTheDocument();
    // The descriptive heading is for NavSheet; a trigger that long would not
    // fit a row of five siblings.
    expect(screen.queryByText(en.nav.crmSetup)).toBeNull();
  });

  it("marks the trigger while any item in the section is the active route", () => {
    const items = [
      item("leadStages", "leadStages", "/crm/lead-stages"),
      item("customFields", "customFields", "/crm/custom-fields"),
    ];
    const { rerender } = render(<NavMenu section={section(items)} activeItemId="customFields" />);
    expect(screen.getByRole("button", { name: new RegExp(en.nav.navMenuSetup) }).className).toContain(
      "after:bg-sidebar-active",
    );

    rerender(<NavMenu section={section(items)} activeItemId="tradeItems" />);
    expect(
      screen.getByRole("button", { name: new RegExp(en.nav.navMenuSetup) }).className,
    ).not.toContain("after:bg-sidebar-active");
  });
});

// The one that answers "did anything get lost when the sidebar went away".
//
// The sidebar rendered every item of every section as a visible row. A menu
// hides them behind a trigger, so "the item is still in nav-config" is no
// longer the same claim as "the user can still reach it" — this opens each of
// the fifteen sections and reads back what is inside.
describe("every nav item survives the move to menus", () => {
  it.each(NAV_SECTIONS.filter((entry) => entry.items.length > 1).map((entry) => [entry.id, entry]))(
    "lists all of %s's items",
    (_id, entry) => {
      render(<NavMenu section={entry} activeItemId={null} />);
      // Radix opens on pointerdown, which jsdom does not synthesise from a
      // click. Enter on the trigger is the keyboard path and works here — and
      // it is the path this test most wants to prove works anyway.
      fireEvent.keyDown(
        screen.getByRole("button", {
          name: new RegExp(en.nav[entry.menuLabelKey as keyof typeof en.nav] as string),
        }),
        { key: "Enter" },
      );

      for (const navItem of entry.items) {
        const label = en.nav[navItem.labelKey as keyof typeof en.nav] as string;
        expect(screen.getByRole("menuitem", { name: label })).toHaveAttribute(
          "href",
          navItem.href,
        );
      }
    },
  );

  it("leaves no section unreachable — every one is a menu or a link", () => {
    for (const entry of NAV_SECTIONS) {
      expect(entry.items.length).toBeGreaterThan(0);
      expect(en.nav[entry.menuLabelKey as keyof typeof en.nav]).toBeTruthy();
    }
  });
});

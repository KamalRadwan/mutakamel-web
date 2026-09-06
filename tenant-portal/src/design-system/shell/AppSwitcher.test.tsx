// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AppSwitcher } from "./AppSwitcher";
import { NAV_APPS, type NavApp } from "./nav-config";

const push = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/i18n/useLanguage", () => ({ useDirection: () => "rtl" }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    t: {
      nav: {
        appSwitcher: "Switch app",
        appWorkspace: "Workspace",
        appCrm: "CRM",
        appTrade: "Trade",
      },
    },
  }),
}));

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

afterEach(() => {
  cleanup();
  push.mockClear();
});

// The real NAV_APPS, carrying a stand-in for what the permission filter would
// have left. Trade is given nothing, which is what a tenant without the Trade
// module actually sees.
function appsFixture(): NavApp[] {
  const withSections = (id: string, href: string) => ({
    ...NAV_APPS.find((app) => app.id === id)!,
    sections: [{ id: `${id}-section`, app: id, labelKey: null, items: [{ href }] }],
  });

  return [
    withSections("workspace", "/core/users"),
    withSections("crm", "/crm/leads"),
    { ...NAV_APPS.find((app) => app.id === "trade")!, sections: [] },
  ] as NavApp[];
}

function open() {
  const trigger = screen.getByRole("button", { name: "Switch app" });
  fireEvent.keyDown(trigger, { key: "Enter" });
  return trigger;
}

describe("AppSwitcher", () => {
  it("names the current app on the trigger and offers all three in the menu", () => {
    render(
      <AppSwitcher apps={appsFixture()} activeApp="crm" onSelect={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: "Switch app" })).toHaveTextContent("CRM");

    open();
    const options = screen.getAllByRole("menuitemradio");
    expect(options.map((option) => option.textContent)).toEqual(["Workspace", "CRM", "Trade"]);
  });

  it("marks the active app checked, which is what tells AT which app they are in", () => {
    render(
      <AppSwitcher apps={appsFixture()} activeApp="crm" onSelect={vi.fn()} />,
    );
    open();

    expect(screen.getByRole("menuitemradio", { name: "CRM" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("menuitemradio", { name: "Workspace" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  // Recording the preference alone would look broken from an app-owned route,
  // because useActiveApp derives from the route first and would outrank it.
  it("records the choice AND navigates into the chosen app", () => {
    const onSelect = vi.fn();
    render(
      <AppSwitcher apps={appsFixture()} activeApp="crm" onSelect={onSelect} />,
    );
    open();

    fireEvent.click(screen.getByRole("menuitemradio", { name: "Workspace" }));

    expect(onSelect).toHaveBeenCalledWith("workspace");
    expect(push).toHaveBeenCalledWith("/core/users");
  });

  it("disables an app the actor can reach nothing in, rather than hiding it", () => {
    render(
      <AppSwitcher apps={appsFixture()} activeApp="crm" onSelect={vi.fn()} />,
    );
    open();

    const trade = screen.getByRole("menuitemradio", { name: "Trade" });
    expect(trade).toHaveAttribute("data-disabled");

    fireEvent.click(trade);
    expect(push).not.toHaveBeenCalled();
  });

  // It scopes every menu that follows it in the global nav, and below `xl`
  // those menus are not on screen at all — the sheet carries them. The switcher
  // stays either way. This pins that the control keeps its accessible name and
  // its keyboard path regardless of which of the two the viewport is showing.
  it("stays a named, keyboard-operable button", () => {
    render(<AppSwitcher apps={appsFixture()} activeApp="crm" onSelect={vi.fn()} />);

    const trigger = screen.getByRole("button", { name: "Switch app" });
    expect(trigger).not.toHaveAttribute("tabindex", "-1");
    expect(trigger).not.toBeDisabled();

    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(screen.getAllByRole("menuitemradio")).toHaveLength(3);
  });
});
